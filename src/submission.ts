import path from "path";
import { Artifact } from "./api";
import {
  algorithmName,
  decodeMultihash,
  encodedHashFromMultihash,
} from "./hash";
import { Params } from "./params";
import { keyFromMultihash } from "./s3";

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
  multihash?: string;
  sourceUrl: URL;
  hidden: boolean;
  aliases: ReadonlyArray<string>;
}>;

export type ValidatedFileSubmission = Omit<
  ArtifactFileSubmission,
  "multihash"
> & {
  multihash: NonNullable<ArtifactFileSubmission["multihash"]>;
};

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

export type ValidatedArtifactSubmission = Omit<ArtifactSubmission, "files"> & {
  files: ReadonlyArray<ValidatedFileSubmission>;
};

export const isSubmissionValidated = (
  submission: ArtifactSubmission
): submission is ValidatedArtifactSubmission =>
  submission.files.every(
    (fileSubmission) => fileSubmission.multihash !== undefined
  );

export const toApi = (
  input: ValidatedArtifactSubmission,
  params: Params
): Artifact => ({
  slug: input.slug,
  title: input.title,
  summary: input.summary,
  description: input.description,
  files: input.files.map((fileInput) => {
    const multihash = decodeMultihash(fileInput.multihash);

    return {
      name: fileInput.name,
      fileName: fileInput.fileName,
      mediaType: fileInput.mediaType,
      hash: encodedHashFromMultihash(multihash),
      hashAlgorithm: algorithmName(multihash.code),
      multihash: fileInput.multihash,
      storageKey: keyFromMultihash({
        prefix: params.s3Prefix,
        multihash: fileInput.multihash,
      }),
      url: new URL(
        // We need URL paths use forward slashes, even on Windows.
        path.posix.join("artifacts", input.slug, fileInput.fileName),
        params.baseUrl
      ).toString(),
      hidden: fileInput.hidden,
      aliases: fileInput.aliases,
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
