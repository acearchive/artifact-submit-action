import path from "path";
import { Artifact } from "./api";
import { algorithmName, decodeMultihash } from "./hash";
import { Params } from "./params";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { readonly [property: string]: JsonValue }
  | ReadonlyArray<JsonValue>;

export type JsonObject = Readonly<Record<string, JsonValue>>;

export type ArtifactFileSubmission = Readonly<{
  name: string;
  fileName: string;
  mediaType?: string;
  multihash: string;
  sourceUrl: URL;
}>;

export type ArtifactLinkSubmission = Readonly<{
  name: string;
  url: URL;
}>;

export type ArtifactSubmission = Readonly<{
  version: number;
  slug: string;
  title: string;
  summary: string;
  description?: string;
  files: ReadonlyArray<ArtifactFileSubmission>;
  links: ReadonlyArray<ArtifactLinkSubmission>;
  people: ReadonlyArray<string>;
  identities: ReadonlyArray<string>;
  fromYear: number;
  toYear?: number;
  decades: ReadonlyArray<number>;
  aliases: ReadonlyArray<string>;
}>;

export const toApi = (input: ArtifactSubmission, params: Params): Artifact => ({
  slug: input.slug,
  title: input.title,
  summary: input.summary,
  description: input.description,
  files: input.files.map((fileInput) => {
    const multihash = decodeMultihash(fileInput.multihash);

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
    url: linkInput.url.toString(),
  })),
  people: input.people,
  identities: input.identities,
  fromYear: input.fromYear,
  toYear: input.toYear,
  decades: input.decades,
  aliases: input.aliases,
});