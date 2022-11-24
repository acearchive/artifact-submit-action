import fetch from "node-fetch";
import { Artifact, version } from "./api";
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

export const putArtifactMetadata = async ({
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
  // Duplicate the artifact metadata for each artifact slug alias so that it is
  // accessible from previous URLs as well.
  for (const slug of [artifact.slug, ...artifact.aliases]) {
    await putKey({
      accountId,
      secretToken,
      namespace,
      key: `artifacts:v${version}:${slug}`,
      obj: artifact,
    });
  }
};
