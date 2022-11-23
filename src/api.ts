export const version = 1;

export type ArtifactFile = Readonly<{
  name: string;
  fileName: string;
  mediaType?: string;
  hash: string;
  hashAlgorithm: string;
  multihash: string;
  storageKey: string;
  url: string;
  hidden: boolean;
  aliases: ReadonlyArray<string>;
}>;

export type ArtifactLink = Readonly<{
  name: string;
  url: string;
}>;

export type Artifact = Readonly<{
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
