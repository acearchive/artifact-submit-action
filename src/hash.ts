import fs from "fs";
import crypto from "crypto";
import stream from "stream";

import multihash from "multiformats/hashes/digest";
import { MultihashDigest } from "multiformats/hashes/interface";

import { pipeAsync } from "./utils";

// Definitions for multihash algorithms can be found here:
// https://github.com/multiformats/multicodec/blob/master/table.csv
export interface MultihashAlgorithm<Code extends number = number> {
  readonly name: string;
  readonly code: Code;
  hash(input: stream.Readable): Promise<Uint8Array>;
}

export const hash = async <Code extends number>(
  input: stream.Readable,
  algorithm: MultihashAlgorithm<Code>
): Promise<MultihashDigest<Code>> => {
  const digest = await algorithm.hash(input);
  return multihash.create(algorithm.code, digest);
};

export const hashFile = async <Code extends number>(
  file: fs.PathLike,
  algorithm: MultihashAlgorithm<Code>
): Promise<MultihashDigest<Code>> => {
  const fileStream = fs.createReadStream(file);
  return hash(fileStream, algorithm);
};

// A `MultihashAlgorithm` implemented using Node's `crypto` module.
class NodeMultihashAlgorithm<Code extends number>
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

  async hash(input: stream.Readable): Promise<Uint8Array> {
    const hasher = crypto.createHash(this.opensslAlgorithm);
    await pipeAsync(input, hasher);
    hasher.end();
    return hasher.digest();
  }
}

const multihashCodes = {
  blake2b512: 0xb240,
} as const;

const supportedCodes = Object.values(multihashCodes);

type MultihashCodes = typeof multihashCodes;

export type SupportedCodes = typeof supportedCodes[number];

export const algorithmByCode = <Code extends SupportedCodes>(
  code: Code
): MultihashAlgorithm<Code> => {
  switch (code) {
    case multihashCodes.blake2b512:
      return blake2b512 as MultihashAlgorithm<Code>;
    default:
      throw new TypeError("there is no algorithm with this code");
  }
};

export const blake2b512: MultihashAlgorithm<MultihashCodes["blake2b512"]> =
  new NodeMultihashAlgorithm(
    "blake2b-512",
    multihashCodes.blake2b512,
    "blake2b512"
  );
