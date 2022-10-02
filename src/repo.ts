import path from "path";
import fsPromises from "fs/promises";
import { JsonValue } from "./submission";

const submissionFileExt = "json";

const listSubmissionFiles = async (
  repoPath: string,
  submissionPath: string
): Promise<ReadonlyArray<string>> => {
  const entries = await fsPromises.readdir(
    path.join(repoPath, submissionPath),
    {
      withFileTypes: true,
    }
  );

  return entries
    .filter(
      (entry) =>
        entry.isFile() && path.extname(entry.name) === submissionFileExt
    )
    .map((entry) => entry.name);
};

const getSubmissions = async (
  repoPath: string,
  submissionPath: string
): Promise<ReadonlyArray<JsonValue>> => {
  const fileNames = await listSubmissionFiles(repoPath, submissionPath);

  const submissions: JsonValue[] = [];

  for (const fileName of fileNames) {
    const fileContent = await fsPromises.readFile(fileName, {
      encoding: "utf-8",
    });

    submissions.push(JSON.parse(fileContent));
  }

  return submissions;
};

export default getSubmissions;
