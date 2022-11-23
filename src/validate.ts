import * as core from "@actions/core";
import fsPromises from "fs/promises";
import { downloadFile, headFile } from "./download";
import { defaultAlgorithm, encodeMultihash, hashFile } from "./hash";
import { Params } from "./params";
import { getSubmissionPath } from "./repo";
import { ArtifactSubmission } from "./submission";

// To avoid unnecessary noise in the git diffs, this should match the
// indentation used for pretty-printing the submission JSON in the artifact
// submission form in the `acearchive/acearchive.lgbt` repo.
const jsonPrettyPrintIndent = 2;

interface FileValidation {
  multihash?: string;
  mediaType?: string;
}

type FileValidationMap = Map<URL, FileValidation>;

const computeFileValidationMap = async (
  submissions: ReadonlyArray<ArtifactSubmission>
): Promise<FileValidationMap> => {
  const validationMap: FileValidationMap = new Map(
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

  for (const [sourceUrl, validation] of validationMap) {
    if (
      validation.mediaType !== undefined &&
      validation.multihash !== undefined
    )
      continue;

    if (validation.multihash === undefined) {
      core.info(`GET ${sourceUrl}`);

      const { path, mediaType } = await downloadFile(sourceUrl);
      const multihash = await hashFile(path, defaultAlgorithm);
      await fsPromises.unlink(path);

      validation.multihash = encodeMultihash(multihash);
      validation.mediaType ??= mediaType;
    } else {
      core.info(`HEAD ${sourceUrl}`);
      const { mediaType } = await headFile(sourceUrl);

      validation.mediaType ??= mediaType;
    }

    core.info(`Successfully downloaded: ${sourceUrl}`);
  }

  return validationMap;
};

const applyFileValidationMap = async (
  submissions: ReadonlyArray<ArtifactSubmission>,
  validationMap: FileValidationMap
): Promise<ReadonlyArray<ArtifactSubmission>> =>
  submissions.map((submission) => ({
    ...submission,
    files: submission.files.map((fileSubmission) => {
      const { mediaType, multihash } = validationMap.get(
        fileSubmission.sourceUrl
      ) ?? { mediaType: undefined, multihash: undefined };

      return {
        ...fileSubmission,
        mediaType,
        multihash,
      };
    }),
  }));

export const upadateFileSubmissions = async (
  submissions: ReadonlyArray<ArtifactSubmission>
): Promise<ReadonlyArray<ArtifactSubmission>> =>
  await applyFileValidationMap(
    submissions,
    await computeFileValidationMap(submissions)
  );

export type FileSubmissionUpdateStats = Readonly<{
  // A map of artifact slugs to the set of file names of files which were
  // updated in that artifact.
  filesUpdatedByArtifact: ReadonlyMap<string, ReadonlySet<string>>;
  artifactsUpdated: number;
  totalFilesUpdated: number;
}>;

export const getFileSubmissionUpdateStats = (
  oldSubmissions: ReadonlyArray<ArtifactSubmission>,
  newSubmissions: ReadonlyArray<ArtifactSubmission>
): FileSubmissionUpdateStats => {
  const filesUpdatedByArtifact = new Map<string, Set<string>>();
  let artifactsUpdated = 0;
  let totalFilesUpdated = 0;

  const newSubmissionsBySlug = new Map(
    newSubmissions.map((submission) => [submission.slug, submission])
  );

  for (const oldSubmission of oldSubmissions) {
    const newSubmission = newSubmissionsBySlug.get(oldSubmission.slug);

    if (newSubmission === undefined) continue;

    const newFileSubmissionsByFileName = new Map(
      newSubmission.files.map((fileSubmission) => [
        fileSubmission.fileName,
        fileSubmission,
      ])
    );

    const updatedFileSet = new Set<string>();

    for (const oldFileSubmission of oldSubmission.files) {
      const newFileSubmission = newFileSubmissionsByFileName.get(
        oldFileSubmission.fileName
      );

      if (newFileSubmission === undefined) continue;

      if (
        oldFileSubmission.mediaType !== newFileSubmission.mediaType ||
        oldFileSubmission.multihash !== newFileSubmission.multihash
      ) {
        totalFilesUpdated += 1;
        updatedFileSet.add(oldFileSubmission.fileName);
      }
    }

    if (updatedFileSet.size > 0) {
      artifactsUpdated += 1;
    }

    filesUpdatedByArtifact.set(oldSubmission.slug, updatedFileSet);
  }

  return { filesUpdatedByArtifact, artifactsUpdated, totalFilesUpdated };
};

export const writeFileSubmissions = async (
  submissions: ReadonlyArray<ArtifactSubmission>,
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
