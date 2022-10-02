import path from "path";
import fsPromises from "fs/promises";
import { ArtifactSubmission } from "./submission";

const listSubmissionFiles = async (
  submissionPath: string
): Promise<ReadonlyArray<string>> => {
  const repoPath = process.env.GITHUB_WORKSPACE;
  if (repoPath === undefined) {
    throw new Error(
      "The environment variable GITHUB_WORKSPACE is undefined.\nThis tool is expecting to be run in a GitHub Actions workflow and needs to know the path of the checked-out git repository."
    );
  }

  const entries = await fsPromises.readdir(
    path.join(repoPath, submissionPath),
    {
      withFileTypes: true,
    }
  );

  return entries
    .filter((entry) => entry.isFile() && path.extname(entry.name) === "json")
    .map((entry) => entry.name);
};

const getSubmissions = async (
  submissionPath: string
): Promise<ReadonlyArray<ArtifactSubmission>> => {
  const fileNames = await listSubmissionFiles(submissionPath);

  const submissions: ArtifactSubmission[] = [];

  for (const fileName of fileNames) {
    const fileContent = await fsPromises.readFile(fileName, {
      encoding: "utf-8",
    });

    submissions.push(JSON.parse(fileContent));
  }

  return submissions;
};

export default getSubmissions;
