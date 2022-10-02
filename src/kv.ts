import fetch from "node-fetch";
import { version as apiVersion, Artifact } from "./api";
import { JsonValue } from "./submission";

const putKey = async ({
  accountId,
  secretToken,
  namespace,
  key,
  obj,
}: {
  accountId: string;
  secretToken: string;
  namespace: string;
  key: string;
  obj: JsonValue;
}): Promise<void> => {
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespace}/values/${key}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${secretToken}`,
        ["Content-Type"]: "application/json",
      },
      body: JSON.stringify(obj),
    }
  );
};

const putArtifactMetadata = async ({
  accountId,
  secretToken,
  namespace,
  artifact,
}: {
  accountId: string;
  secretToken: string;
  namespace: string;
  artifact: Artifact;
}): Promise<void> => {
  await putKey({
    accountId,
    secretToken,
    namespace,
    key: `api:v${apiVersion}:artifacts:${artifact.slug}`,
    obj: artifact,
  });
};

export default putArtifactMetadata;
