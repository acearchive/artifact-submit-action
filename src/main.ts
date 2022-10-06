import * as core from "@actions/core";
import Joi from "joi";

import { getParams } from "./params";
import { getSubmissions } from "./repo";
import { schema } from "./schema";
import { downloadAndVerify } from "./download";
import { putArtifactMetadata, putArtifactMetadataList } from "./kv";
import { debugPrintDigest, decodeMultihash } from "./hash";
import { listMultihashes, newClient, putArtifactFile } from "./s3";
import { ArtifactSubmission, toApi } from "./submission";
import { Artifact } from "./api";

const main = async (): Promise<void> => {
  const params = getParams();
  const rawSubmissions = await getSubmissions(params.repo, params.path);

  core.info(`Found ${rawSubmissions.length} JSON files in: ${params.path}`);

  const submissions = new Array<ArtifactSubmission>();

  for (const rawSubmission of rawSubmissions) {
    submissions.push(
      Joi.attempt(rawSubmission, schema, {
        abortEarly: false,
        convert: false,
      })
    );
  }

  core.info(`All submissions match the schema!`);

  if (!params.upload) return;

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

    await putArtifactMetadata({
      accountId: params.cloudflareAccountId,
      secretToken: params.cloudflareApiToken,
      namespace: params.kvNamespaceId,
      artifact: artifactMetadata,
    });

    core.info(`Wrote artifact metadata: ${submission.slug}`);
  }

  await putArtifactMetadataList({
    accountId: params.cloudflareAccountId,
    secretToken: params.cloudflareApiToken,
    namespace: params.kvNamespaceId,
    artifacts: artifactMetadataList,
  });

  core.setOutput("artifacts", artifactMetadataList);

  core.info(`Wrote metadata for ${artifactMetadataList.length} artifacts.`);

  core.info(`Uploaded ${filesUploaded} files to S3.`);
};

const run = async (): Promise<void> => {
  try {
    main();
  } catch (e) {
    if (e instanceof Error) core.setFailed(e.message);
  }
};

run();
