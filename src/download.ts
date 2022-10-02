import fs from "fs";
import afs from "fs/promises";
import path from "path";
import https from "https";
import contentType from "content-type";

import { MultihashDigest } from "multiformats/hashes/interface";
import { equals as digestEquals } from "multiformats/hashes/digest";
import { algorithmByCode, hashFile, SupportedCodes } from "./hash";

const downloadFile = async (
  url: URL
): Promise<{ path: fs.PathLike; contentType?: string }> => {
  const tempDirPath = await afs.mkdtemp("artifact-submit-action-");
  const tempFile = fs.createWriteStream(path.join(tempDirPath, "file"));

  return new Promise((resolve) => {
    https.get(url, (response) => {
      response.pipe(tempFile);

      tempFile.on("finish", () => {
        tempFile.close();

        resolve({
          path: tempFile.path,
          contentType:
            response.headers.contentType === undefined
              ? undefined
              : contentType.parse(response).type,
        });
      });
    });
  });
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

export default async <Code extends SupportedCodes>(
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
