import path from "path";
import fsPromises from "fs/promises";
import { JsonObject } from "./submission";

const submissionFileExt = ".json";

const listSubmissionFiles = async (
  repoPath: string,
  submissionPath: string
): Promise<ReadonlyArray<string>> => {
  const fullPath = path.join(repoPath, submissionPath);

  const entries = await fsPromises.readdir(fullPath, {
    withFileTypes: true,
  });

  return entries
    .filter(
      (entry) =>
        entry.isFile() && path.extname(entry.name) === submissionFileExt
    )
    .map((entry) => path.join(fullPath, entry.name));
};

export type RawSubmission = Readonly<{
  json: JsonObject;
  fileName: string;
}>;

export const getSubmissions = async (
  repoPath: string,
  submissionPath: string
): Promise<ReadonlyArray<RawSubmission>> => {
  const fileNames = await listSubmissionFiles(repoPath, submissionPath);

  const submissions: RawSubmission[] = [];

  for (const fileName of fileNames) {
    const fileContent = await fsPromises.readFile(fileName, {
      encoding: "utf-8",
    });

    submissions.push({ json: JSON.parse(fileContent), fileName: fileName });
  }

  return submissions;
};

export const getSubmissionPath = ({
  repoPath,
  submissionPath,
  artifactSlug,
}: {
  repoPath: string;
  submissionPath: string;
  artifactSlug: string;
}): string => path.join(repoPath, submissionPath, `${artifactSlug}.json`);
