import Joi from "joi";

export const version = 1;

const decadeFromYear = (year: number): number => year - (year % 10);

export const schema = Joi.object({
  version: Joi.number().integer().equal(version).required(),
  slug: Joi.string()
    .pattern(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
    .min(16)
    .max(64)
    .empty("")
    .required(),
  title: Joi.string().trim().max(100).empty("").required(),
  summary: Joi.string().trim().max(150).empty("").required(),
  description: Joi.string().trim().max(1000).empty(""),
  files: Joi.array()
    .unique(
      (a, b) =>
        a.fileName === b.fileName ||
        // If two files have the same URL but different hashes, something weird
        // is going on.
        (a.sourceUrl === b.sourceUrl && a.multihash !== b.multihash)
    )
    .items(
      Joi.object({
        name: Joi.string().max(100).empty("").required(),
        fileName: Joi.string()
          .pattern(
            /^[a-z0-9][a-z0-9-]*[a-z0-9](\/[a-z0-9][a-z0-9-]*[a-z0-9])*(\.[a-z0-9]+)*$/
          )
          .empty("")
          .required(),
        mediaType: Joi.string()
          .pattern(
            /^(application|audio|font|image|model|text|video|message|multipart)\/[\w\d.+-]+$/
          )
          .empty(""),
        multihash: Joi.string().hex().empty("").required(),
        sourceUrl: Joi.string()
          .uri({ scheme: ["http", "https"] })
          .empty("")
          .required(),
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
  fromYear: Joi.number().integer().max(new Date().getUTCFullYear()).required(),
  toYear: Joi.number()
    .integer()
    .greater(Joi.ref("fromYear"))
    .max(new Date().getUTCFullYear()),
  decades: Joi.array()
    .unique()
    .sort({ order: "ascending" })
    .items(
      Joi.number()
        .integer()
        .multiple(10)
        .equal(Joi.ref("...fromYear", { adjust: decadeFromYear }))
        .required(),
      Joi.number()
        .integer()
        .multiple(10)
        .min(Joi.ref("...fromYear", { adjust: decadeFromYear }))
        .max(Joi.ref("...toYear", { adjust: decadeFromYear }))
    )
    .default([]),
  aliases: Joi.array().unique().items(Joi.link("/slug")).default([]),
});
