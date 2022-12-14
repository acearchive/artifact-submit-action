import fs from "fs";
import stream from "stream";
import { Params } from "./params";
import {
  S3Client,
  PutObjectCommand,
  paginateListObjectsV2,
} from "@aws-sdk/client-s3";
import { MultihashDigest } from "multiformats/hashes/interface";
import { encodeMultihash } from "./hash";

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

const pageSize = 200;

const listObjectKeys = async ({
  client,
  bucket,
  prefix,
}: {
  client: S3Client;
  bucket: string;
  prefix: string;
}): Promise<Set<string>> => {
  const paginator = paginateListObjectsV2(
    { client, pageSize: pageSize },
    {
      Bucket: bucket,
      Prefix: prefix,
    }
  );

  const keys = new Set<string>();

  for await (const page of paginator) {
    if (page.Contents === undefined) continue;

    for (const obj of page.Contents) {
      if (obj.Key === undefined) continue;
      keys.add(obj.Key);
    }
  }

  return keys;
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

export const listMultihashes = async ({
  client,
  bucket,
  prefix,
}: {
  client: S3Client;
  bucket: string;
  prefix: string;
}): Promise<Set<string>> => {
  const multihashes = new Set<string>();

  const keys = await listObjectKeys({ client, bucket, prefix });
  for (const key of keys) {
    multihashes.add(multihashFromKey({ key, prefix }));
  }

  return multihashes;
};
