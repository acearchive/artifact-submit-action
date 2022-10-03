import { URL } from "url";

import Joi from "joi";
import * as core from "@actions/core";

export type Params = Readonly<{
  upload: boolean;
  repo: string;
  path: string;
  baseUrl: URL;
  s3Endpoint?: URL;
  s3Bucket: string;
  s3Prefix: string;
  s3Region: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  cloudflareAccountId: string;
  cloudflareApiToken: string;
  kvNamespaceId: string;
}>;

const schema = Joi.object({
  upload: Joi.boolean().label("upload"),
  repo: Joi.string().required().label("GITHUB_WORKSPACE"),
  path: Joi.string().uri({ relativeOnly: true }).required().label("path"),
  baseUrl: Joi.string().uri({ scheme: "https" }).required().label("base_url"),
  s3Endpoint: Joi.string().uri().label("s3_endpoint"),
  s3Bucket: Joi.string().required().label("s3_bucket"),
  s3Prefix: Joi.string().required().label("s3_prefix"),
  s3Region: Joi.string().required().label("s3_region"),
  s3AccessKeyId: Joi.string().required().label("s3_access_key_id"),
  s3SecretAccessKey: Joi.string().required().label("s3_secret_access_key"),
  cloudflareAccountId: Joi.string().required().label("cloudflare_account_id"),
  cloudflareApiToken: Joi.string().required().label("cloudflare_api_token"),
  kvNamespaceId: Joi.string().required().label("kv_namespace_id"),
});

export const getParams = (): Params => {
  const s3AccessKeyId = core.getInput("s3_access_key_id", { required: true });
  const s3SecretAccessKey = core.getInput("s3_secret_access_key", {
    required: true,
  });
  const cloudflareApiToken = core.getInput("cloudflare_api_token", {
    required: true,
  });

  // The S3 access key ID isn't strictly a secret, but we're redacting it anyways.
  core.setSecret(s3AccessKeyId);
  core.setSecret(s3SecretAccessKey);
  core.setSecret(cloudflareApiToken);

  return Joi.attempt(
    {
      upload: core.getInput("upload", { required: true }),
      repo: process.env.GITHUB_WORKSPACE,
      path: core.getInput("path", { required: true }),
      baseUrl: core.getInput("base_url", { required: true }),
      s3Endpoint: core.getInput("s3_endpoint"),
      s3Bucket: core.getInput("s3_bucket", { required: true }),
      s3Prefix: core.getInput("s3_prefix", { required: true }),
      s3Region: core.getInput("s3_region", { required: true }),
      s3AccessKeyId,
      s3SecretAccessKey,
      cloudflareAccountId: core.getInput("cloudflare_account_id", {
        required: true,
      }),
      cloudflareApiToken,
      kvNamespaceId: core.getInput("kv_namespace_id", { required: true }),
    },
    schema,
    { abortEarly: false }
  );
};
