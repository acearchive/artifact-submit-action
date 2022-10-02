import path from "path";
import { Artifact } from "./api";
import { algorithmName, fromHex, isSupportedCode } from "./hash";
import { Params } from "./params";

export type ArtifactFileInput = Readonly<{
  name: string;
  fileName: string;
  mediaType?: string;
  multihash: string;
  sourceUrl: string;
}>;

export type ArtifactLinkInput = Readonly<{
  name: string;
  url: string;
}>;

export type ArtifactInput = Readonly<{
  version: number;
  slug: string;
  title: string;
  summary: string;
  description?: string;
  files: ReadonlyArray<ArtifactFileInput>;
  links: ReadonlyArray<ArtifactLinkInput>;
  people: ReadonlyArray<string>;
  identities: ReadonlyArray<string>;
  fromYear: number;
  toYear?: number;
  decades: ReadonlyArray<number>;
  aliases: ReadonlyArray<string>;
}>;

export const toApi = (input: ArtifactInput, params: Params): Artifact => ({
  slug: input.slug,
  title: input.title,
  summary: input.summary,
  description: input.description,
  files: input.files.map((fileInput) => {
    const multihash = fromHex(fileInput.multihash);

    if (!isSupportedCode(multihash.code)) {
      throw new Error(
        `a hash algorithm with the multiformats multihash code 0x${multihash.code.toString(
          16
        )} is not supported`
      );
    }

    return {
      name: fileInput.name,
      fileName: fileInput.name,
      mediaType: fileInput.mediaType,
      hash: Buffer.from(multihash.digest).toString("hex"),
      hashAlgorithm: algorithmName(multihash.code),
      url: new URL(
        // We need URL paths use forward slashes, even on Windows.
        path.posix.join(input.slug, fileInput.multihash),
        params.baseUrl
      ).toString(),
    };
  }),
  links: input.links.map((linkInput) => ({
    name: linkInput.name,
    url: linkInput.url,
  })),
  people: input.people,
  identities: input.identities,
  fromYear: input.fromYear,
  toYear: input.toYear,
  decades: input.decades,
  aliases: input.aliases,
});
