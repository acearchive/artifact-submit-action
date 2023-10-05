import Joi from "joi";
import ISO6391 from "iso-639-1";
import { artifactIdLength } from "./id";

export const version = 1;

const urlSlugPattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const fileNamePattern =
  /^[a-z0-9][a-z0-9-]*[a-z0-9](\/[a-z0-9][a-z0-9-]*[a-z0-9])*(\.[a-z0-9]+)*$/;
const mediaTypePattern =
  /^(application|audio|font|image|model|text|video|message|multipart)\/[\w\d.+-]+$/;

const decadeFromYear = (year: number): number => year - (year % 10);

// This schema should be kept in sync with the Yup schema in the
// `acearchive/acearchive.lgbt` repo.
export const schema = Joi.object({
  version: Joi.number().integer().equal(version).required(),
  id: Joi.string()
    .pattern(/^[a-zA-Z0-9]+$/)
    .length(artifactIdLength)
    .empty(""),
  slug: Joi.string()
    .pattern(urlSlugPattern)
    .min(12)
    .max(64)
    .equal(Joi.ref("$slugFromFileName"))
    .not(Joi.in("$setOfAllSlugs"))
    .empty("")
    .required(),
  title: Joi.string().trim().max(100).empty("").required(),
  summary: Joi.string().trim().max(150).empty("").required(),
  description: Joi.string().trim().max(1000).empty(""),
  files: Joi.array()
    .unique(
      (a, b) =>
        a.file_name === b.file_name ||
        // If two files have the same URL but different hashes, they can't both
        // be valid.
        (a.source_url === b.source_url && a.multihash !== b.multihash)
    )
    .items(
      Joi.object({
        name: Joi.string().max(256).empty("").required(),
        file_name: Joi.string().pattern(fileNamePattern).empty("").required(),
        media_type: Joi.string().pattern(mediaTypePattern).empty(""),
        multihash: Joi.when(Joi.ref("$mode"), {
          is: "validate",
          then: Joi.string().hex().empty(""),
          otherwise: Joi.string().hex().empty("").required(),
        }),
        source_url: Joi.string()
          // We allow HTTP URLs for importing only because we're validating their checksums
          // anyways.
          .uri({ scheme: ["http", "https"] })
          .empty("")
          .required(),
        lang: Joi.string()
          .equal(...ISO6391.getAllCodes())
          .empty(""),
        hidden: Joi.bool().default(false),
        aliases: Joi.array()
          .unique()
          .items(Joi.string().pattern(fileNamePattern).empty(""))
          .default([]),
      })
    )
    .default([]),
  links: Joi.array()
    .unique((a, b) => a.url === b.url)
    .items(
      Joi.object({
        name: Joi.string().empty("").required(),
        url: Joi.string().uri({ scheme: "https" }).empty("").required(),
      })
    )
    .default([]),
  people: Joi.array().unique().items(Joi.string().empty("")).default([]),
  identities: Joi.array().unique().items(Joi.string().empty("")).default([]),
  from_year: Joi.number().integer().max(new Date().getUTCFullYear()).required(),
  to_year: Joi.number()
    .integer()
    .greater(Joi.ref("from_year"))
    .max(new Date().getUTCFullYear()),
  decades: Joi.array()
    .unique()
    .sort({ order: "ascending" })
    .items(
      Joi.number()
        .integer()
        .multiple(10)
        .equal(Joi.ref("...from_year", { adjust: decadeFromYear }))
        .required(),
      Joi.number()
        .integer()
        .multiple(10)
        .min(Joi.ref("...from_year", { adjust: decadeFromYear }))
        .max(Joi.ref("...to_year", { adjust: decadeFromYear }))
    )
    .default([]),
  aliases: Joi.array()
    .unique()
    .items(Joi.string().pattern(urlSlugPattern).min(12).max(64).empty(""))
    .default([]),
});
