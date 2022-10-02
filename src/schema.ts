import Joi from "joi";

const CurrentVersion = 1;

const InputSchema = Joi.object({
  version: Joi.number().integer().equal(CurrentVersion).required(),
  slug: Joi.string()
    .pattern(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
    .min(16)
    .max(64)
    .required(),
  title: Joi.string().trim().max(100).required(),
  summary: Joi.string().trim().max(150).required(),
  description: Joi.string().trim().max(1000),
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
        name: Joi.string().max(100).required(),
        fileName: Joi.string()
          .pattern(
            /^[a-z0-9][a-z0-9-]*[a-z0-9](\/[a-z0-9][a-z0-9-]*[a-z0-9])*(\.[a-z0-9]+)*$/
          )
          .required(),
        mediaType: Joi.string().pattern(
          /^(application|audio|font|image|model|text|video|message|multipart)\/[\w\d.+-]+$/
        ),
        multihash: Joi.string().hex().required(),
        sourceUrl: Joi.string()
          .uri({ scheme: ["http", "https"] })
          .required(),
      })
    ),
  links: Joi.array()
    .unique((a, b) => a.url === b.url)
    .items(
      Joi.object({
        name: Joi.string().required(),
        url: Joi.string().uri({ scheme: "https" }).required(),
      })
    ),
  people: Joi.array().unique().items(Joi.string()),
  identities: Joi.array().unique().items(Joi.string()),
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
        .min(Joi.ref("fromYear"))
        .max(Joi.ref("toYear"))
        .multiple(10)
    ),
  aliases: Joi.array().unique().items(Joi.link("/slug")),
});
