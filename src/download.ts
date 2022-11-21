import fs from "fs";
import fsPromises from "fs/promises";
import os from "os";
import path from "path";
import stream from "stream/promises";

import * as contentType from "content-type";
import { equals as digestEquals } from "multiformats/hashes/digest";
import { MultihashDigest } from "multiformats/hashes/interface";
import fetch from "node-fetch";

import { algorithmByCode, hashFile } from "./hash";

export const headFile = async (url: URL): Promise<{ mediaType?: string }> => {
  const response = await fetch(url.toString(), { method: "HEAD" });
  const responseContentType = response.headers.get("Content-Type");

  return {
    mediaType:
      responseContentType === null
        ? undefined
        : contentType.parse(responseContentType).type,
  };
};

export const downloadFile = async (
  url: URL
): Promise<{ path: fs.PathLike; mediaType?: string }> => {
  const tempDirPath = await fsPromises.mkdtemp(
    path.join(os.tmpdir(), "artifact-submit-action-")
  );
  const tempFile = fs.createWriteStream(path.join(tempDirPath, "file"));

  const response = await fetch(url.toString());

  if (response.body !== null) {
    await stream.pipeline(response.body, tempFile);
  }

  const responseContentType = response.headers.get("Content-Type");

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
  isValid: false;
  actualDigest: MultihashDigest;
}>;

export type FileValidationResult = FileValidationSuccess | FileValidationFail;

export const downloadAndVerify = async (
  url: URL,
  expectedDigest: MultihashDigest
): Promise<FileValidationResult> => {
  const downloadedFile = await downloadFile(url);
  const actualDigest = await hashFile(
    downloadedFile.path,
    algorithmByCode(expectedDigest.code)
  );

  if (!digestEquals(actualDigest, expectedDigest)) {
    return {
      isValid: false,
      actualDigest,
    };
  }

  return {
    isValid: true,
    path: downloadedFile.path,
  };
};
