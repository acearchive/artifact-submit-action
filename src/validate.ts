import * as core from "@actions/core";
import fsPromises from "fs/promises";
import { downloadFile, headFile } from "./download";
import { defaultAlgorithm, encodeMultihash, hashFile } from "./hash";
import { newRandomArtifactID } from "./id";
import { Params } from "./params";
import { getSubmissionPath } from "./repo";
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
      core.info(`GET ${sourceUrl}`);

      const { path, mediaType } = await downloadFile(sourceUrl);
      const multihash = await hashFile(path, defaultAlgorithm);
      await fsPromises.unlink(path);

      const completeDetails = {
        multihash: encodeMultihash(multihash),
        mediaType: incompleteDetails.mediaType,
      };

      completeDetails.mediaType ??= mediaType;

      completeDetailsMap.set(sourceUrl, completeDetails);
    } else {
      core.info(`HEAD ${sourceUrl}`);
      const { mediaType } = await headFile(sourceUrl);

      const completeDetails: CompleteFileDetails = {
        multihash: incompleteDetails.multihash,
        mediaType: incompleteDetails.mediaType,
      };

      completeDetails.mediaType ??= mediaType;

      completeDetailsMap.set(sourceUrl, completeDetails);
    }

    core.info(`Successfully downloaded: ${sourceUrl}`);
  }

  return completeDetailsMap;
};

const applyFileDetails = async (
  files: ReadonlyArray<IncompleteFileSubmission>,
  detailsMap: CompleteFileDetailsMap
): Promise<ReadonlyArray<CompleteFileSubmission>> =>
  files.map((fileSubmission) => {
    const details = detailsMap.get(fileSubmission.sourceUrl);

    if (details === undefined) {
      throw new Error(
        `Unexpected file source URL: ${fileSubmission.sourceUrl}`
      );
    }

    const { multihash, mediaType } = details;

    return {
      ...fileSubmission,
      mediaType,
      multihash,
    };
  });

export const completeArtifactSubmissions = (
  submissions: ReadonlyArray<IncompleteArtifactSubmission>
): Promise<ReadonlyArray<CompleteArtifactSubmission>> =>
  Promise.all(
    submissions.map(async (incompleteSubmission) => {
      const fileDetailsMap = await completeFileDetails(submissions);

      return {
        ...incompleteSubmission,
        id:
          incompleteSubmission.id === undefined
            ? newRandomArtifactID()
            : incompleteSubmission.id,
        files: await applyFileDetails(
          incompleteSubmission.files,
          fileDetailsMap
        ),
      };
    })
  );

export const writeFileSubmissions = async (
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
