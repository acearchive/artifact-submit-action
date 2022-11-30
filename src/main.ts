import * as core from "@actions/core";
import Joi from "joi";
import path from "path";
import fsPromises from "fs/promises";

import { getParams, Params } from "./params";
import { getSubmissions } from "./repo";
import { schema } from "./schema";
import { downloadAndVerify } from "./download";
import { putArtifact } from "./kv";
import { debugPrintDigest, decodeMultihash } from "./hash";
import { listMultihashes, newClient, putArtifactFile } from "./s3";
import {
  IncompleteArtifactSubmission,
  isSubmissionValidated,
  toApi,
} from "./submission";
import { Artifact } from "./api";
import { completeArtifactSubmissions, writeFileSubmissions } from "./validate";

const validate = async ({
  params,
  submissions,
}: {
  params: Params;
  submissions: ReadonlyArray<IncompleteArtifactSubmission>;
}): Promise<void> => {
  core.info("Adding IDs to new artifacts...");
  core.info("Updating file submissions missing hashes or media types...");

  // Add an artifact ID to artifacts which don't have one yet (new artifacts).
  //
  // Calculate the multihash for file submissions which don't have one and also
  // set the media type for file submissions which don't have one if the GET or
  // HEAD response returns a `Content-Type` header.
  const completedSubmissions = await completeArtifactSubmissions(submissions);
  await writeFileSubmissions(completedSubmissions, params);
};

const upload = async ({
  params,
  submissions,
}: {
  params: Params;
  submissions: ReadonlyArray<IncompleteArtifactSubmission>;
}): Promise<void> => {
  core.info("Starting the upload process...");

  const s3Client = newClient(params);
  const existingMultihashes = await listMultihashes({
    client: s3Client,
    bucket: params.s3Bucket,
    prefix: params.s3Prefix,
  });

  core.info(
    `Found ${existingMultihashes.size} artifact files in the S3 bucket.`
  );

  let filesUploaded = 0;

  const artifactMetadataList: Artifact[] = [];

  for (const submission of submissions) {
    if (!isSubmissionValidated(submission)) {
      throw new Error(
        `Submission has at least one file with no multihash: ${submission.slug}\nYou must run in \`validate\` mode first to compute missing multihashes.`
      );
    }

    for (const fileSubmission of submission.files) {
      const multihash = decodeMultihash(fileSubmission.multihash);

      // We can skip files that have already been uploaded to S3.
      if (existingMultihashes.has(fileSubmission.multihash)) {
        core.info(
          `Skipping artifact file: ${submission.slug}/${fileSubmission.fileName}`
        );
        continue;
      }

      const downloadResult = await downloadAndVerify(
        fileSubmission.sourceUrl,
        multihash
      );

      core.info(`Downloaded file: ${fileSubmission.sourceUrl}`);

      if (downloadResult.isValid) {
        core.info(
          `Validated file hash: ${submission.slug}/${fileSubmission.fileName}`
        );
        core.info(
          `Uploading to S3: ${submission.slug}/${fileSubmission.fileName}`
        );

        await putArtifactFile({
          client: s3Client,
          bucket: params.s3Bucket,
          filePath: downloadResult.path,
          multihash,
          prefix: params.s3Prefix,
          mediaType: fileSubmission.mediaType,
        });

        await fsPromises.unlink(downloadResult.path);

        filesUploaded += 1;
      } else {
        throw new Error(
          `Downloaded file does not match the hash included in the submission: ${
            submission.slug
          }/${fileSubmission.fileName}\nURL: ${
            fileSubmission.sourceUrl
          }\nExpected: ${debugPrintDigest(
            multihash
          )}\nActual: ${debugPrintDigest(downloadResult.actualDigest)}`
        );
      }
    }

    const artifactMetadata = toApi(submission, params);
    artifactMetadataList.push(artifactMetadata);

    await putArtifact({
      accountId: params.cloudflareAccountId,
      secretToken: params.cloudflareApiToken,
      namespace: params.kvNamespaceId,
      artifact: artifactMetadata,
    });

    core.info(`Wrote artifact metadata: ${submission.slug}`);
  }

  core.setOutput("artifacts", artifactMetadataList);

  core.info(`Wrote metadata for ${artifactMetadataList.length} artifacts.`);

  core.info(`Uploaded ${filesUploaded} files to S3.`);
};

const main = async (): Promise<void> => {
  const params = getParams();
  const rawSubmissions = await getSubmissions(params.repo, params.path);

  core.info(`Found ${rawSubmissions.length} JSON files in: ${params.path}`);

  const submissions = new Array<IncompleteArtifactSubmission>();

  for (const { json, fileName } of rawSubmissions) {
    submissions.push(
      Joi.attempt(json, schema, {
        abortEarly: false,
        convert: false,
        context: {
          mode: params.mode,
          slug: path.parse(fileName).name,
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
