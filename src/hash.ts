import fs from "fs";

import hasha from "hasha";
import * as multihash from "multiformats/hashes/digest";
import { MultihashDigest } from "multiformats/hashes/interface";

// Definitions for multihash algorithms can be found here:
// https://github.com/multiformats/multicodec/blob/master/table.csv
export interface MultihashAlgorithm<Code extends number = number> {
  readonly name: string;
  readonly code: Code;
  hashFile(file: fs.PathLike): Promise<Uint8Array>;
}

export const hashFile = async <Code extends number>(
  file: fs.PathLike,
  algorithm: MultihashAlgorithm<Code>
): Promise<MultihashDigest<Code>> => {
  const digest = await algorithm.hashFile(file);
  return multihash.create(algorithm.code, digest);
};

const invalidCodeError = (code: number): Error =>
  new Error(
    `A hash algorithm with the multihash code 0x${code.toString(
      16
    )} is not supported.\nFor more information, see this repo: https://github.com/multiformats/multicodec`
  );

const multihashCodes = {
  blake2b512: 0xb240,
} as const;

const supportedCodes: Set<number> = new Set(Object.values(multihashCodes));

type MultihashCodes = typeof multihashCodes;

export type SupportedCode = MultihashCodes[keyof MultihashCodes];

export const algorithmByCode = (
  code: number
): MultihashAlgorithm<SupportedCode> => {
  switch (code) {
    case multihashCodes.blake2b512:
      return blake2b512 as MultihashAlgorithm<SupportedCode>;
    default:
      throw invalidCodeError(code);
  }
};

const isSupportedCode = (code: number): code is SupportedCode =>
  supportedCodes.has(code);

export const isSupportedAlgorithm = (
  algorithm: MultihashAlgorithm
): algorithm is MultihashAlgorithm<SupportedCode> =>
  isSupportedCode(algorithm.code);

export const isSupportedDigest = (
  digest: MultihashDigest
): digest is MultihashDigest<SupportedCode> => isSupportedCode(digest.code);

export const algorithmName = (code: number): string =>
  algorithmByCode(code).name;

export const decodeMultihash = (hex: string): MultihashDigest =>
  multihash.decode(Buffer.from(hex, "hex"));

export const encodeMultihash = (multihash: MultihashDigest): string =>
  Buffer.from(multihash.bytes).toString("hex");

export const encodedHashFromMultihash = (multihash: MultihashDigest): string =>
  Buffer.from(multihash.digest).toString("hex");

export const debugPrintDigest = (digest: MultihashDigest): string =>
  `${algorithmName(digest.code)}:${Buffer.from(digest.digest).toString("hex")}`;

// A `MultihashAlgorithm` implemented using Node's `crypto` module.
class HashaMultihashAlgorithm<Code extends number>
  implements MultihashAlgorithm<Code>
{
  readonly name: string;
  readonly code: Code;
  private readonly opensslAlgorithm: string;

  constructor(name: string, code: Code, opensslAlgorithm: string) {
    this.name = name;
    this.code = code;
    this.opensslAlgorithm = opensslAlgorithm;
  }

  hashFile(file: fs.PathLike): Promise<Uint8Array> {
    return hasha.fromFile(file.toString(), {
      algorithm: this.opensslAlgorithm,
      encoding: "buffer",
    });
  }
}

export const blake2b512: MultihashAlgorithm<MultihashCodes["blake2b512"]> =
  new HashaMultihashAlgorithm(
    "blake2b-512",
    multihashCodes.blake2b512,
    "blake2b512"
  );
