import Joi from "joi";
import * as core from "@actions/core";

export type Mode = "validate" | "upload";

export type Params = Readonly<{
  mode: Mode;
  repo: string;
  path: string;
  baseUrl: URL;
  secondaryBaseUrl?: URL;
  baseRef: string;
  s3Endpoint?: URL;
  s3Bucket: string;
  s3Prefix: string;
  s3Region: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  submissionWorkerDomain: string;
  submissionWorkerSecret: string;
}>;

const schema = Joi.object({
  mode: Joi.string().required().label("mode").valid("validate", "upload"),
  repo: Joi.string().required().label("GITHUB_WORKSPACE"),
  path: Joi.string().uri({ relativeOnly: true }).required().label("path"),
  baseUrl: Joi.string().uri({ scheme: "https" }).required().label("base_url"),
  secondaryBaseUrl: Joi.string()
    .uri({ scheme: "https" })
    .label("secondary_base_url"),
  baseRef: Joi.string().required().label("base_ref"),
  s3Endpoint: Joi.string().uri().label("s3_endpoint"),
  s3Bucket: Joi.string().required().label("s3_bucket"),
  s3Prefix: Joi.string().required().label("s3_prefix"),
  s3Region: Joi.string().required().label("s3_region"),
  s3AccessKeyId: Joi.string().required().label("s3_access_key_id"),
  s3SecretAccessKey: Joi.string().required().label("s3_secret_access_key"),
  submissionWorkerDomain: Joi.string()
    .required()
    .label("submission_worker_domain"),
  submissionWorkerSecret: Joi.string()
    .required()
    .label("submission_worker_secret"),
});

export const getParams = (): Params => {
  const s3AccessKeyId = core.getInput("s3_access_key_id", { required: true });
  const s3SecretAccessKey = core.getInput("s3_secret_access_key", {
    required: true,
  });
  const submissionWorkerSecret = core.getInput("submission_worker_secret", {
    required: true,
  });

  // The S3 access key ID isn't strictly a secret, but we're redacting it anyways.
  core.setSecret(s3AccessKeyId);
  core.setSecret(s3SecretAccessKey);
  core.setSecret(submissionWorkerSecret);

  return Joi.attempt(
    {
      mode: core.getInput("mode", { required: true }),
      repo: process.env.GITHUB_WORKSPACE,
      path: core.getInput("path", { required: true }),
      baseUrl: core.getInput("base_url", { required: true }),
      secondaryBaseUrl: core.getInput("secondary_base_url"),
      baseRef: core.getInput("base_ref", { required: true }),
      s3Endpoint: core.getInput("s3_endpoint"),
      s3Bucket: core.getInput("s3_bucket", { required: true }),
      s3Prefix: core.getInput("s3_prefix", { required: true }),
      s3Region: core.getInput("s3_region", { required: true }),
      submissionWorkerDomain: core.getInput("submission_worker_domain", {
        required: true,
      }),
      s3AccessKeyId,
      s3SecretAccessKey,
      submissionWorkerSecret,
    },
    schema,
    { abortEarly: false }
  );
};
