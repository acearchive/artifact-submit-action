import * as core from "@actions/core";
import fsPromises from "fs/promises";
import { downloadFile, headFile } from "./download";
import { defaultAlgorithm, encodeMultihash, hashFile } from "./hash";
import { newRandomArtifactID } from "./id";
import { getArtifactIdBySlug } from "./kv";
import { Params } from "./params";
import { getSubmissionPath, RawSubmission } from "./repo";
import {
  IncompleteArtifactSubmission,
  CompleteArtifactSubmission,
  CompleteFileSubmission,
  IncompleteFileSubmission,
} from "./submission";

// To avoid unnecessary noise in the git diffs, this should match the
// indentation used for pretty-printing the submission JSON in the artifact
// submission form in the `acearchive/acearchive.lgbt` repo.
const jsonPrettyPrintIndent = 2;

interface IncompleteFileDetails {
  multihash?: string;
  mediaType?: string;
}

interface CompleteFileDetails {
  multihash: string;
  mediaType?: string;
}

type IncompleteFileDetailsMap = ReadonlyMap<
  URL,
  Readonly<IncompleteFileDetails>
>;
type CompleteFileDetailsMap = Map<URL, CompleteFileDetails>;

const completeFileDetails = async (
  submissions: ReadonlyArray<IncompleteArtifactSubmission>
): Promise<CompleteFileDetailsMap> => {
  const incompleteDetailsMap: IncompleteFileDetailsMap = new Map(
    submissions.flatMap(({ files }) =>
      files.map(({ sourceUrl, multihash, mediaType }) => [
        sourceUrl,
        {
          multihash,
          mediaType,
        },
      ])
    )
  );

  const completeDetailsMap: CompleteFileDetailsMap = new Map();

  for (const [sourceUrl, incompleteDetails] of incompleteDetailsMap) {
    if (
      incompleteDetails.mediaType !== undefined &&
      incompleteDetails.multihash !== undefined
    )
      continue;

    if (incompleteDetails.multihash === undefined) {
      core.info(
        `Downloading file from source URL to compute hash: GET ${sourceUrl}`
      );

      const { path, mediaType } = await downloadFile(sourceUrl);
      const multihash = await hashFile(path, defaultAlgorithm);
      await fsPromises.unlink(path);

      const completeDetails = {
        multihash: encodeMultihash(multihash),
        mediaType: incompleteDetails.mediaType,
      };

      completeDetails.mediaType ??= mediaType;

      completeDetailsMap.set(sourceUrl, completeDetails);

      core.info(`GET request successful: ${sourceUrl}`);
    } else {
      core.info(
        `Checking Content-Type header of source URL to get media type: HEAD ${sourceUrl}`
      );
      const { mediaType } = await headFile(sourceUrl);

      const completeDetails: CompleteFileDetails = {
        multihash: incompleteDetails.multihash,
        mediaType: incompleteDetails.mediaType,
      };

      completeDetails.mediaType ??= mediaType;

      completeDetailsMap.set(sourceUrl, completeDetails);

      core.info(`HEAD request successful: ${sourceUrl}`);
    }
  }

  return completeDetailsMap;
};

const applyFileDetails = async (
  files: ReadonlyArray<IncompleteFileSubmission>,
  detailsMap: CompleteFileDetailsMap
): Promise<ReadonlyArray<CompleteFileSubmission>> =>
  files.map((fileSubmission) => {
    const currentMultihash = fileSubmission.multihash;
    const currentMediaType = fileSubmission.mediaType;

    if (currentMultihash === undefined) {
      const details = detailsMap.get(fileSubmission.sourceUrl);

      if (details === undefined) {
        throw new Error(
          `Unexpected file URL: ${fileSubmission.sourceUrl}\nThis is most likely a bug.`
        );
      }

      return {
        ...fileSubmission,
        mediaType: currentMediaType ?? details.mediaType,
        multihash: details.multihash,
      };
    } else {
      return {
        ...fileSubmission,
        multihash: currentMultihash,
      };
    }
  });

// If there is already an existing artifact with this slug in KV, get its
// artifact ID. Otherwise, generate a new one.
const getOrCreateArtifactId = async (
  artifactSlug: string,
  params: Params
): Promise<string> => {
  const idOfExistingArtifact = await getArtifactIdBySlug({
    accountId: params.cloudflareAccountId,
    secretToken: params.cloudflareApiToken,
    namespace: params.kvNamespaceId,
    artifactSlug,
  });

  if (idOfExistingArtifact !== undefined) {
    core.warning(
      `Artifact is missing its ID, but the slug exists in KV: ${artifactSlug}\nGetting the existing artifact ID from KV.`
    );
    return idOfExistingArtifact;
  }

  core.info(`Generating an artifact ID for a new artifact: ${artifactSlug}`);
  return newRandomArtifactID();
};

// Make "incomplete" artifact submissions "complete" by filling in missing
// fields which are intended to be computed/inferred.
//
// If a submission is missing an artifact ID, then this method first check if an
// artifact with that slug already exists in KV. If it does, then it pulls the
// existing artifact ID from KV. This shouldn't happen during normal use, but
// it's a useful safeguard to ensure that artifact IDs never change.
//
// If a submission is missing an artifact ID and the slug does not already exist
// in KV, then it means it's a new artifact and we generate an artifact ID for
// it.
//
// If a file in a submission is missing a media type, we check the
// `Content-Type` header from the source URL.
//
// If a file in a submission is missing a multihash, we download the file from
// the source URL and compute the hash.
export const completeArtifactSubmissions = (
  submissions: ReadonlyArray<IncompleteArtifactSubmission>,
  params: Params
): Promise<ReadonlyArray<CompleteArtifactSubmission>> =>
  Promise.all(
    submissions.map(async (incompleteSubmission) => {
      const fileDetailsMap = await completeFileDetails(submissions);

      return {
        ...incompleteSubmission,
        id:
          incompleteSubmission.id === undefined
            ? await getOrCreateArtifactId(incompleteSubmission.slug, params)
            : incompleteSubmission.id,
        files: await applyFileDetails(
          incompleteSubmission.files,
          fileDetailsMap
        ),
      };
    })
  );

// Write "complete" artifact submissions to the local clone of the git repo.
export const writeArtifactSubmissions = async (
  submissions: ReadonlyArray<CompleteArtifactSubmission>,
  params: Params
): Promise<void> => {
  for (const submission of submissions) {
    const submissionPath = getSubmissionPath({
      repoPath: params.repo,
      submissionPath: params.path,
      artifactSlug: submission.slug,
    });

    await fsPromises.writeFile(
      submissionPath,
      JSON.stringify(submission, null, jsonPrettyPrintIndent)
    );
  }
};

// Get a set of all the artifact slugs and artifact slug aliases in all the
// given submissions. This is used before schema validation so that the set of
// artifact slugs can be passed into the schema validator to validate that
// artifact slugs are unique.
export const allSlugsInSubmissions = (
  submissions: ReadonlyArray<RawSubmission>
): Set<string> => {
  const allSlugs = new Set<string>();

  for (const { json: rawSubmission } of submissions) {
    const slug = rawSubmission["slug"];
    const aliases = rawSubmission["aliases"];

    // If any of these manual type checks fail, the schema validation will fail
    // anyways, so it doesn't matter that we're silently skipping them.
    if (typeof slug !== "string" || !Array.isArray(aliases)) continue;

    allSlugs.add(slug);

    for (const alias of aliases) {
      if (typeof alias === "string") {
        allSlugs.add(alias);
      }
    }
  }

  return allSlugs;
};
