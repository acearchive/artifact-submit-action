import path from "path";
import fsPromises from "fs/promises";
import { JsonObject } from "./submission";

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
): Promise<ReadonlyArray<JsonObject>> => {
  const fileNames = await listSubmissionFiles(repoPath, submissionPath);

  const submissions: JsonObject[] = [];

  for (const fileName of fileNames) {
    const fileContent = await fsPromises.readFile(fileName, {
      encoding: "utf-8",
    });

    const fileJson = JSON.parse(fileContent);
    fileJson.slug = path.parse(fileName).name;

    submissions.push(fileJson);
  }

  return submissions;
};

export default getSubmissions;
