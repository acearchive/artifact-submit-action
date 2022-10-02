import { URL } from "url";
import * as core from "@actions/core";

type Params = Readonly<{
  repo: URL;
  path: string;
  endpoint: URL;
  bucket: string;
  access_key_id: string;
  secret_access_key: string;
}>;

export default (): Params => {
  const raw_repo = core.getInput("repo", { required: true });
  const raw_path = core.getInput("path", { required: true });
  const raw_endpoint = core.getInput("endpoint", { required: true });
  const raw_bucket = core.getInput("bucket", { required: true });
  const raw_access_key_id = core.getInput("access_key_id", { required: true });
  const raw_secret_access_key = core.getInput("secret_access_key", {
    required: true,
  });

  core.setSecret(raw_access_key_id);
  core.setSecret(raw_secret_access_key);

  return {
    repo: new URL(raw_repo),
    path: raw_path,
    endpoint: new URL(raw_endpoint),
    bucket: raw_bucket,
    access_key_id: raw_access_key_id,
    secret_access_key: raw_secret_access_key,
  };
};
