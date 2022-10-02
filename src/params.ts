import { URL } from "url";

import Joi from "joi";
import * as core from "@actions/core";

export type Params = Readonly<{
  upload: boolean;
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
  kvNamespace: string;
}>;

const schema = Joi.object({
  upload: Joi.boolean(),
  path: Joi.string().uri({ relativeOnly: true }).required(),
  baseUrl: Joi.string().uri({ scheme: "https" }).required(),
  s3Endpoint: Joi.string().uri(),
  s3Bucket: Joi.string().required(),
  s3Prefix: Joi.string().required(),
  s3Region: Joi.string().required(),
  s3AccessKeyId: Joi.string().required(),
  s3SecretAccessKey: Joi.string().required(),
  cloudflareAccountId: Joi.string().required(),
  cloudflareApiToken: Joi.string().required(),
  kvNamespace: Joi.string().required(),
});

export default (): Params => {
  const s3AccessKeyId = core.getInput("s3_access_key_id", { required: true });
  const s3SecretAccessKey = core.getInput("s3_secret_access_key", {
    required: true,
  });
  const cloudflareAccountId = core.getInput("cloudflare_account_id", {
    required: true,
  });
  const cloudflareApiToken = core.getInput("cloudflare_api_token", {
    required: true,
  });

  // Not all of these are strictly secrets, but exposing less information is
  // preferable.
  core.setSecret(s3AccessKeyId);
  core.setSecret(s3SecretAccessKey);
  core.setSecret(cloudflareAccountId);
  core.setSecret(cloudflareApiToken);

  return Joi.attempt(
    {
      upload: core.getInput("upload", { required: true }),
      path: core.getInput("path", { required: true }),
      baseUrl: core.getInput("base_url", { required: true }),
      s3Endpoint: core.getInput("s3_endpoint"),
      s3Bucket: core.getInput("s3_bucket", { required: true }),
      s3Prefix: core.getInput("s3_prefix", { required: true }),
      s3Region: core.getInput("s3_region", { required: true }),
      s3AccessKeyId,
      s3SecretAccessKey,
      cloudflareAccountId,
      cloudflareApiToken,
      kvNamespace: core.getInput("kv_namespace", { required: true }),
    },
    schema,
    { abortEarly: false }
  );
};
