import { LanguageCode } from "iso-639-1";

// These type definitions represent the shape of the objects stored in KV.
//
// Currently, these type definitions are duplicated verbatim across several
// repos. If you edit one of these types here, they need to be updated in these
// repos as well:
//
// - `acearchive/files-worker`
// - `acearchive/api-worker`
//
// TODO: Use Node `github:` dependencies to import these type definitions from
// this repo in other repos.

export type ArtifactFile = Readonly<{
  name: string;
  fileName: string;
  mediaType?: string;
  hash: string;
  hashAlgorithm: string;
  multihash: string;
  storageKey: string;
  url: string;
  lang?: LanguageCode;
  hidden: boolean;
  aliases: ReadonlyArray<string>;
}>;

export type ArtifactLink = Readonly<{
  name: string;
  url: string;
}>;

export type Artifact = Readonly<{
  id: string;
  slug: string;
  title: string;
  summary: string;
  description?: string;
  files: ReadonlyArray<ArtifactFile>;
  links: ReadonlyArray<ArtifactLink>;
  people: ReadonlyArray<string>;
  identities: ReadonlyArray<string>;
  fromYear: number;
  toYear?: number;
  decades: ReadonlyArray<number>;
  aliases: ReadonlyArray<string>;
}>;
