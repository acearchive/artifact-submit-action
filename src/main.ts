import * as core from "@actions/core";
import Joi from "joi";
import path from "path";
import fsPromises from "fs/promises";

import { getParams, Params } from "./params";
import { getSubmissions } from "./repo";
import { schema } from "./schema";
import { downloadAndVerify } from "./download";
import { debugPrintDigest, decodeMultihash } from "./hash";
import { listMultihashes, newClient, putArtifactFile } from "./s3";
import {
  IncompleteArtifactSubmission,
  isSubmissionValidated,
  toApi,
} from "./submission";
import { Artifact } from "./api";
import {
  allSlugsInSubmissions,
  completeArtifactSubmissions,
  writeArtifactSubmissions,
} from "./validate";
import { uploadMetadata } from "./db";

const validate = async ({
  params,
  submissions,
}: {
  params: Params;
  submissions: ReadonlyArray<IncompleteArtifactSubmission>;
}): Promise<void> => {
  const completedSubmissions = await completeArtifactSubmissions(submissions);
  await writeArtifactSubmissions(completedSubmissions, params);
};

const upload = async ({
  params,
  submissions,
}: {
  params: Params;
  submissions: ReadonlyArray<IncompleteArtifactSubmission>;
}): Promise<void> => {
  core.info("Starting the upload process");

  const s3Client = newClient(params);
  const existingMultihashes = await listMultihashes({
    client: s3Client,
    bucket: params.s3Bucket,
    prefix: params.s3Prefix,
  });

  core.info(
    `Found ${existingMultihashes.size} artifact files in the R2 bucket`
  );

  let filesUploaded = 0;

  const artifactMetadataList: Artifact[] = [];

  core.startGroup("Fetching files and uploading to R2");

  for (const submission of submissions) {
    if (!isSubmissionValidated(submission)) {
      throw new Error(
        `Submission is missing mandatory fields which can be generated: ${submission.slug}\nYou must run in \`validate\` mode first to compute missing fields`
      );
    }

    for (const fileSubmission of submission.files) {
      const multihash = decodeMultihash(fileSubmission.multihash);

      // We can skip files that have already been uploaded to R2.
      if (existingMultihashes.has(fileSubmission.multihash)) {
        core.info(
          `Skipping artifact file: ${submission.slug}/${fileSubmission.filename}`
        );
        continue;
      }

      const downloadResult = await downloadAndVerify(
        fileSubmission.source_url,
        multihash
      );

      core.info(`Downloaded file: ${fileSubmission.source_url}`);

      if (downloadResult.isValid) {
        core.info(
          `Validated file hash: ${submission.slug}/${fileSubmission.filename}`
        );
        core.info(
          `Uploading to R2: ${submission.slug}/${fileSubmission.filename}`
        );

        await putArtifactFile({
          client: s3Client,
          bucket: params.s3Bucket,
          filePath: downloadResult.path,
          multihash,
          prefix: params.s3Prefix,
          mediaType: fileSubmission.media_type,
        });

        await fsPromises.unlink(downloadResult.path);

        filesUploaded += 1;
      } else {
        throw new Error(
          `Downloaded file does not match the hash included in the submission: ${
            submission.slug
          }/${fileSubmission.filename}\nURL: ${
            fileSubmission.source_url
          }\nExpected: ${debugPrintDigest(
            multihash
          )}\nActual: ${debugPrintDigest(downloadResult.actualDigest)}`
        );
      }
    }

    artifactMetadataList.push(toApi(submission, params));
  }

  core.endGroup();

  core.info(`Uploaded ${filesUploaded} files to R2`);

  // Upload metadata to the database.
  await uploadMetadata({
    artifacts: artifactMetadataList,
    authSecret: params.submissionWorkerSecret,
    workerDomain: params.submissionWorkerDomain,
  });

  core.setOutput("artifacts", artifactMetadataList);

  core.info(`Wrote metadata for ${artifactMetadataList.length} artifacts`);
};

const main = async (): Promise<void> => {
  const params = getParams();
  const rawSubmissions = await getSubmissions({
    repoPath: params.repo,
    submissionPath: params.path,
    baseRef: params.baseRef,
  });

  const setOfAllSlugs = allSlugsInSubmissions(rawSubmissions);

  const submissions = new Array<IncompleteArtifactSubmission>();

  for (const { json, fileName } of rawSubmissions) {
    submissions.push(
      Joi.attempt(json, schema, {
        abortEarly: false,
        convert: false,
        context: {
          mode: params.mode,
          slugFromFileName: path.parse(fileName).name,
          setOfAllSlugs,
        },
      })
    );
  }

  core.info(`All submissions match the schema!`);

  switch (params.mode) {
    case "validate":
      return await validate({ params, submissions });
    case "upload":
      return await upload({ params, submissions });
  }
};

const run = async (): Promise<void> => {
  try {
    main();
  } catch (e) {
    if (e instanceof Error) core.setFailed(e.message);
  }
};

run();
