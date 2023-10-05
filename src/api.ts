import { LanguageCode } from "iso-639-1";

// These type definitions represent the shape of the objects we need to send to
// submission-worker so they can be added to the database.
//
// TODO: Use Node `github:` dependencies to deduplicate these type definitions
// across repos.

export type ArtifactFile = Readonly<{
  name: string;
  filename: string;
  media_type?: string;
  hash: string;
  hash_algorithm: string;
  multihash: string;
  storage_key: string;
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
  from_year: number;
  to_year?: number;
  decades: ReadonlyArray<number>;
  aliases: ReadonlyArray<string>;
}>;
