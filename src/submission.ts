import path from "path";
import { Artifact } from "./api";
import {
  algorithmName,
  decodeMultihash,
  encodedHashFromMultihash,
} from "./hash";
import { Params } from "./params";
import { keyFromMultihash } from "./s3";
import { LanguageCode } from "iso-639-1";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { readonly [property: string]: JsonValue }
  | ReadonlyArray<JsonValue>;

export type JsonObject = Readonly<Record<string, JsonValue>>;

export const isJsonObject = (value: JsonValue): value is JsonObject =>
  typeof value === "object" && !Array.isArray(value) && value !== null;

export const isJsonArray = (
  value: JsonValue
): value is ReadonlyArray<JsonValue> => Array.isArray(value) && value !== null;

export const isString = (value: JsonValue): value is string =>
  typeof value === "string";

export type Metadata = JsonObject;

export type IncompleteFileSubmission = Readonly<{
  name: string;
  filename: string;
  media_type?: string;
  multihash?: string;
  source_url: URL;
  lang?: LanguageCode;
  hidden: boolean;
  aliases: ReadonlyArray<string>;
}>;

export type CompleteFileSubmission = Omit<
  IncompleteFileSubmission,
  "multihash"
> & {
  multihash: NonNullable<IncompleteFileSubmission["multihash"]>;
};

export type ArtifactLinkSubmission = Readonly<{
  name: string;
  url: URL;
}>;

export type IncompleteArtifactSubmission = Readonly<{
  version: number;
  id?: string;
  slug: string;
  title: string;
  summary: string;
  description?: string;
  files: ReadonlyArray<IncompleteFileSubmission>;
  links: ReadonlyArray<ArtifactLinkSubmission>;
  people: ReadonlyArray<string>;
  identities: ReadonlyArray<string>;
  from_year: number;
  to_year?: number;
  decades: ReadonlyArray<number>;
  collections: ReadonlyArray<string>;
  aliases: ReadonlyArray<string>;
}>;

export type CompleteArtifactSubmission = Omit<
  IncompleteArtifactSubmission,
  "id" | "files"
> & {
  id: string;
  files: ReadonlyArray<CompleteFileSubmission>;
};

export const isSubmissionValidated = (
  submission: IncompleteArtifactSubmission
): submission is CompleteArtifactSubmission =>
  submission.id !== undefined &&
  submission.files.every(
    (fileSubmission) => fileSubmission.multihash !== undefined
  );

export const toApi = (
  input: CompleteArtifactSubmission,
  params: Params
): Artifact => ({
  id: input.id,
  slug: input.slug,
  title: input.title,
  summary: input.summary,
  description: input.description,
  files: input.files.map((fileInput) => {
    const multihash = decodeMultihash(fileInput.multihash);

    return {
      name: fileInput.name,
      filename: fileInput.filename,
      media_type: fileInput.media_type,
      hash: encodedHashFromMultihash(multihash),
      hash_algorithm: algorithmName(multihash.code),
      multihash: fileInput.multihash,
      storage_key: keyFromMultihash({
        prefix: params.s3Prefix,
        multihash: fileInput.multihash,
      }),
      url: new URL(
        path.posix.join("artifacts", input.slug, fileInput.filename),
        params.baseUrl
      ).toString(),
      lang: fileInput.lang,
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
  from_year: input.from_year,
  to_year: input.to_year,
  decades: input.decades,
  collections: input.collections,
  aliases: input.aliases,
});
