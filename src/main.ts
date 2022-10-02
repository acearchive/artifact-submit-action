import core from "@actions/core";
import Joi from "joi";

import getParams from "./params";
import getSubmissions from "./repo";
import submissionSchema from "./schema";
import downloadAndVerify from "./download";
import putArtifactMetadata from "./kv";
import { debugPrintDigest, decodeMultihash } from "./hash";
import { listMultihashes, newClient, putArtifactFile } from "./s3";
import { toApi } from "./submission";

const main = async (): Promise<void> => {
  const params = getParams();
  const submissions = await getSubmissions(params.path);

  core.info(`Found ${submissions.length} JSON submission files in the repo.`);

  for (const submission of submissions) {
    Joi.attempt(submission, submissionSchema);
  }

  core.info(`All submission files are valid!`);

  if (!params.upload) return;

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

  for (const submission of submissions) {
    for (const fileSubmission of submission.files) {
      const multihash = decodeMultihash(fileSubmission.multihash);

      // We can skip files that have already been uploaded to S3.
      if (existingMultihashes.has(multihash)) {
        core.info(
          `Skipping artifact file already found in the S3 bucket: ${submission.slug}/${fileSubmission.fileName}`
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

    await putArtifactMetadata({
      accountId: params.cloudflareAccountId,
      secretToken: params.cloudflareApiToken,
      namespace: params.kvNamespace,
      artifact: toApi(submission, params),
    });

    core.info(`Wrote artifact metadata: ${submission.slug}`);
  }

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
