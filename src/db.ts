import * as core from "@actions/core";
import fetch from "node-fetch";

import { Artifact } from "./api";
import { isJsonArray, Metadata } from "./submission";

const authUser = "artifact-submit-action";

// This uploads the artifact metadata to the database via a Cloudflare Worker
// named submission-worker.
export const uploadArtifactMetadata = async ({
  artifacts,
  authSecret,
  workerDomain,
}: {
  artifacts: ReadonlyArray<Artifact>;
  authSecret: string;
  workerDomain: string;
}) => {
  core.startGroup("Uploading metadata for artifacts");

  for (const artifact of artifacts) {
    core.info(`Uploading metadata for artifact: ${artifact.slug}`);

    const authCredential = `${authUser}:${authSecret}`;

    const resp = await fetch(`https://${workerDomain}/submit`, {
      method: "POST",
      body: JSON.stringify(artifact),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(authCredential).toString(
          "base64"
        )}`,
      },
    });

    if (!resp.ok) {
      throw new Error(
        `Failed uploading metadata for artifact: ${artifact.slug}\nReturned ${resp.status} ${resp.statusText}`
      );
    }
  }

  core.endGroup();
};

export const uploadGlobalMetadata = async ({
  metadata,
  authSecret,
  workerDomain,
}: {
  metadata: Metadata;
  authSecret: string;
  workerDomain: string;
}) => {
  core.startGroup("Updating global metadata");

  if (isJsonArray(metadata.tags)) {
    core.info(`${metadata.tags.length} tags found`);
  }

  core.endGroup();

  const authCredential = `${authUser}:${authSecret}`;

  const resp = await fetch(`https://${workerDomain}/metadata`, {
    method: "PUT",
    body: JSON.stringify(metadata),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(authCredential).toString("base64")}`,
    },
  });

  if (!resp.ok) {
    throw new Error(
      `Failed uploading global metadata\nReturned ${resp.status} ${resp.statusText}`
    );
  }
};
