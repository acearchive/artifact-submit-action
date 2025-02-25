import fs from "fs";
import stream from "stream";
import { Params } from "./params";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { MultihashDigest } from "multiformats/hashes/interface";
import { encodeMultihash, reprDigest, reprDigestAlgorithmName } from "./hash";

export const newClient = (params: Params): S3Client => {
  return new S3Client({
    region: params.s3Region,
    endpoint: params.s3Endpoint?.toString(),
    credentials: {
      accessKeyId: params.s3AccessKeyId,
      secretAccessKey: params.s3SecretAccessKey,
    },
  });
};

const putObject = async ({
  client,
  bucket,
  body,
  key,
  mediaType,
  contentLength,
}: {
  client: S3Client;
  bucket: string;
  body: stream.Readable;
  key: string;
  prefix: string;
  mediaType?: string;
  contentLength?: number;
}): Promise<void> => {
  await client.send(
    new PutObjectCommand({
      Key: key,
      Body: body,
      Bucket: bucket,
      ContentType: mediaType,
      ContentLength: contentLength,
    })
  );
};

export const keyFromMultihash = ({
  multihash,
  prefix,
}: {
  multihash: string;
  prefix: string;
}): string => prefix + multihash;

export const multihashFromKey = ({
  key,
  prefix,
}: {
  key: string;
  prefix: string;
}): string => key.substring(prefix.length);

export const putArtifactFile = async ({
  client,
  bucket,
  filePath,
  multihash,
  prefix,
  mediaType,
}: {
  client: S3Client;
  bucket: string;
  filePath: fs.PathLike;
  multihash: MultihashDigest;
  prefix: string;
  mediaType?: string;
}): Promise<void> => {
  const fileStats = await fs.promises.stat(filePath);
  await putObject({
    client,
    bucket,
    body: fs.createReadStream(filePath),
    key: keyFromMultihash({ prefix, multihash: encodeMultihash(multihash) }),
    prefix,
    mediaType,
    contentLength: fileStats.size,
  });
};

export const checkArtifactExists = async ({
  multihash,
  slug,
  filename,
  baseUrl,
}: {
  multihash: MultihashDigest;
  slug: string;
  filename: string;
  baseUrl: URL;
}): Promise<boolean> => {
  const artifactUrl = new URL(`${baseUrl}/${slug}/${filename}`);

  const response = await fetch(artifactUrl.href, {
    method: "HEAD",
    headers: {
      "Want-Repr-Digest": `${reprDigestAlgorithmName(multihash.code)}=9`,
    },
  });

  if (response.ok) {
    return true;
  }

  if (response.status === 404) {
    return false;
  }

  const actualReprDigest = response.headers.get("Repr-Digest");

  if (!actualReprDigest) {
    throw new Error(
      `No Repr-Digest header returned while checking if artifact exists at: ${artifactUrl.href}`
    );
  }

  if (actualReprDigest === reprDigest(multihash)) {
    return true;
  }

  return false;
};
