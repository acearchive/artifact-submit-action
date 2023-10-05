import * as core from "@actions/core";
import fetch from "node-fetch";

import { Artifact } from "./api";

const metadataSubmitUrl = "https://submit.acearchive.lgbt/submit";
const authUser = "artifact-submit-action";

export const uploadMetadata = async (
  artifacts: ReadonlyArray<Artifact>,
  authSecret: string
) => {
  core.startGroup("Uploading metadata for artifacts...");

  for (const artifact of artifacts) {
    core.info(`Uploading metadata for artifact: ${artifact.slug}`);

    const authCredential = `${authUser}:${authSecret}`;

    const resp = await fetch(metadataSubmitUrl, {
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
