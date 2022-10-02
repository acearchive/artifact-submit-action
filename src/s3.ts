import fs from "fs";
import stream from "stream";
import { Params } from "./params";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { MultihashDigest } from "multiformats/hashes/interface";

export const newClient = (params: Params): S3Client => {
  return new S3Client({
    region: params.region,
    endpoint: params.endpoint?.toString(),
    credentials: {
      accessKeyId: params.accessKeyId,
      secretAccessKey: params.secretAccessKey,
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
  prefix?: string;
  mediaType?: string;
  contentLength?: number;
}): Promise<void> => {
  await client.send(
    new PutObjectCommand({
      // Key: prefix + Buffer.from(multihash.bytes).toString("hex"),
      Key: key,
      Body: body,
      Bucket: bucket,
      ContentType: mediaType,
      ContentLength: contentLength,
    })
  );
};

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
  prefix?: string;
  mediaType?: string;
}): Promise<void> => {
  const fileStats = await fs.promises.stat(filePath);
  await putObject({
    client,
    bucket,
    body: fs.createReadStream(filePath),
    key: prefix + Buffer.from(multihash.bytes).toString("hex"),
    prefix,
    mediaType,
    contentLength: fileStats.size,
  });
};
