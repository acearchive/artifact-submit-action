import { URL } from "url";

import Joi from "joi";
import * as core from "@actions/core";

export type Params = Readonly<{
  repo: URL;
  path: string;
  baseUrl: URL;
  endpoint?: URL;
  bucket: string;
  prefix: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}>;

const schema = Joi.object({
  repo: Joi.string().uri().required(),
  path: Joi.string().uri({ relativeOnly: true }).required(),
  baseUrl: Joi.string().uri({ scheme: "https" }).required(),
  endpoint: Joi.string().uri(),
  bucket: Joi.string().required(),
  region: Joi.string().required(),
  accessKeyId: Joi.string().required(),
  secretAccessKey: Joi.string().required(),
});

export default (): Params => {
  const accessKeyId = core.getInput("access_key_id", { required: true });
  const secretAccessKey = core.getInput("access_key_id", { required: true });

  core.setSecret(accessKeyId);
  core.setSecret(secretAccessKey);

  return Joi.attempt(
    {
      repo: core.getInput("repo", { required: true }),
      path: core.getInput("path", { required: true }),
      baseUrl: core.getInput("baseUrl", { required: true }),
      endpoint: core.getInput("endpoint"),
      bucket: core.getInput("bucket", { required: true }),
      region: core.getInput("region", { required: true }),
      accessKeyId,
      secretAccessKey,
    },
    schema,
    { abortEarly: false }
  );
};
