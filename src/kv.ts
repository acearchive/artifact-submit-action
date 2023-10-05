import fetch from "node-fetch";
import { Artifact } from "./api";
import { isJsonObject, isString, JsonObject, JsonValue } from "./submission";

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
  // As of time of writing, the bulk API is documented to accept up to 10,000 KV
  // pairs at once, with a maximum total request size of 100MB. For simplicity's
  // sake, we do not attempt to batch multiple bulk API calls and work under the
  // assumption that we will never exceed these limits.

  const response = await fetch(
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

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`${response.status} ${response.statusText}\n${bodyText}`);
  }
};

const getKeyMetadata = async ({
  accountId,
  secretToken,
  namespace,
  key,
}: {
  accountId: string;
  secretToken: string;
  namespace: string;
  key: string;
}): Promise<JsonValue | undefined> => {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespace}/metadata/${encodeURIComponent(
      key
    )}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretToken}`,
        ["Content-Type"]: "application/json",
      },
    }
  );

  if (response.status === 404) {
    return undefined;
  }

  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`${response.status} ${response.statusText}\n${bodyText}`);
  }

  const responseBody = (await response.json()) as JsonObject;
  return responseBody["result"];
};

const artifactListKey = `artifacts:v${Version.artifacts}:`;

const artifactKey = (artifactId: string): string =>
  `artifacts:v${Version.artifacts}:${artifactId}`;

const slugKey = (slug: string): string => `slugs:v${Version.slugs}:${slug}`;

export const putArtifacts = async ({
  accountId,
  secretToken,
  namespace,
  artifacts,
}: {
  accountId: string;
  secretToken: string;
  namespace: string;
  artifacts: ReadonlyArray<Artifact>;
}): Promise<void> => {
  const objects: Array<KVObject> = [];

  for (const artifact of artifacts) {
    objects.push({
      key: artifactKey(artifact.id),
      obj: artifact,
    });

    objects.push({
      key: slugKey(artifact.slug),
      metadata: {
        id: artifact.id,
      },
    });

    for (const slugAlias of artifact.aliases) {
      objects.push({
        key: slugKey(slugAlias),
        metadata: {
          id: artifact.id,
        },
      });
    }
  }

  const sortedArtifacts = [...artifacts];

  // We sort the artifacts here so that the API worker doesn't need to. The
  // order isn't important, but it does need to be deterministic. We sort by the
  // artifact ID, since that doesn't change, and we specify the locale to sort
  // in so that the sort order doesn't change.
  sortedArtifacts.sort((a, b) =>
    a.id.localeCompare(b.id, "en", { usage: "sort" })
  );

  objects.push({
    key: artifactListKey,
    obj: sortedArtifacts,
  });

  await putKeys({
    accountId,
    secretToken,
    namespace,
    objects,
  });
};
