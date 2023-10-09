import path from "path";
import { spawn } from "child_process";
import fsPromises from "fs/promises";
import { JsonObject } from "./submission";

import * as core from "@actions/core";

const submissionFileExt = ".json";

// This uses git to determine which submission files have been modified between
// `main` and the PR which triggered this action.
const listModifiedSubmissionFiles = async ({
  repoPath,
  submissionPath,
  baseRef,
}: {
  repoPath: string;
  submissionPath: string;
  baseRef: string;
}): Promise<ReadonlyArray<string>> => {
  // TODO: This makes a hardcoded assumption about the default branch name.
  const childProcess = spawn("git", [
    "-C",
    repoPath,
    "diff",
    "--name-only",
    baseRef,
    "HEAD",
    "--",
    submissionPath,
  ]);

  let stdout = "";
  let stderr = "";

  childProcess.stdout.on("data", (chunk) => {
    stdout += chunk;
  });

  childProcess.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  await new Promise((resolve) => {
    childProcess.on("close", resolve);
  });

  if (childProcess.exitCode !== 0) {
    throw new Error(`git diff returned a non-zero exit code: ${stderr}`);
  }

  const filePaths = stdout.split("\n");

  const submissionFilePaths = filePaths
    .filter((filePath) => path.extname(filePath) === submissionFileExt)
    .map((filePath) => path.join(repoPath, filePath));

  core.startGroup(
    `Found ${submissionFilePaths.length} submission files which have been modified`
  );

  for (const filePath of submissionFilePaths) {
    core.info(filePath);
  }

  core.endGroup();

  return submissionFilePaths;
};

export type RawSubmission = Readonly<{
  json: JsonObject;
  fileName: string;
}>;

export const getSubmissions = async ({
  repoPath,
  submissionPath,
  baseRef,
}: {
  repoPath: string;
  submissionPath: string;
  baseRef: string;
}): Promise<ReadonlyArray<RawSubmission>> => {
  const fileNames = await listModifiedSubmissionFiles({
    repoPath,
    submissionPath,
    baseRef,
  });

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
