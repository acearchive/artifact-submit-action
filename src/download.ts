import fs from "fs";
import afs from "fs/promises";
import path from "path";
import stream from "stream/promises";

import contentType from "content-type";
import fetch from "node-fetch";
import { MultihashDigest } from "multiformats/hashes/interface";
import { equals as digestEquals } from "multiformats/hashes/digest";

import { algorithmByCode, hashFile, SupportedCode } from "./hash";

export const header = {
  contentType: "Content-Type",
};

const downloadFile = async (
  url: URL
): Promise<{ path: fs.PathLike; mediaType?: string }> => {
  const tempDirPath = await afs.mkdtemp("artifact-submit-action-");
  const tempFile = fs.createWriteStream(path.join(tempDirPath, "file"));

  const response = await fetch(url.toString());

  if (response.body !== null) {
    await stream.pipeline(response.body, tempFile);
  }

  const responseContentType = response.headers.get(header.contentType);

  return {
    path: tempFile.path,
    mediaType:
      responseContentType === null
        ? undefined
        : contentType.parse(responseContentType).type,
  };
};

export type FileValidationSuccess = Readonly<{
  isValid: true;
  path: fs.PathLike;
}>;

export type FileValidationFail = Readonly<{
  isVaild: false;
  algorithmMatches: boolean;
  actualDigest: MultihashDigest;
}>;

export type FileValidationResult = FileValidationSuccess | FileValidationFail;

export default async <Code extends SupportedCode>(
  url: URL,
  expectedDigest: MultihashDigest<Code>
): Promise<FileValidationResult> => {
  const downloadedFile = await downloadFile(url);
  const actualDigest = await hashFile(
    downloadedFile.path,
    algorithmByCode(expectedDigest.code)
  );

  if (actualDigest.code !== expectedDigest.code) {
    return {
      isVaild: false,
      algorithmMatches: false,
      actualDigest,
    };
  }

  if (digestEquals(actualDigest, expectedDigest)) {
    return {
      isVaild: false,
      algorithmMatches: true,
      actualDigest,
    };
  }

  return {
    isValid: true,
    path: downloadedFile.path,
  };
};
