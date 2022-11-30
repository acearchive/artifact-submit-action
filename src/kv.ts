import fetch from "node-fetch";
import { Artifact } from "./api";
import { JsonValue } from "./submission";

const Version = {
  artifacts: 2,
  slugs: 1,
} as const;

type KVObject = Readonly<{
  key: string;
  obj?: JsonValue;
  metadata?: Record<string, string>;
}>;

const putKeys = async ({
  accountId,
  secretToken,
  namespace,
  objects,
}: {
  accountId: string;
  secretToken: string;
  namespace: string;
  objects: ReadonlyArray<KVObject>;
}): Promise<void> => {
  await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespace}/bulk`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${secretToken}`,
        ["Content-Type"]: "application/json",
      },
      body: JSON.stringify(
        objects.map((obj) => ({
          key: obj.key,
          value: obj.obj === undefined ? "" : JSON.stringify(obj.obj),
          ...(obj.metadata !== undefined && { metadata: obj.metadata }),
        }))
      ),
    }
  );
};

export const putArtifact = async ({
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
  const objects: ReadonlyArray<KVObject> = [
    {
      key: `artifacts:v${Version.artifacts}:${artifact.id}`,
      obj: artifact,
    },
    ...[artifact.slug, ...artifact.aliases].map((slug) => ({
      key: `slugs:v${Version.slugs}:${slug}`,
      metadata: {
        id: artifact.id,
      },
    })),
  ];

  await putKeys({
    accountId,
    secretToken,
    namespace,
    objects,
  });
};
