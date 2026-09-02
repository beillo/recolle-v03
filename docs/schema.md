# Schema v1

Draft schema for the manual capture stage (Etapa 2). Not final, meant to be tested against 20 to 30 real posts and revised into schema v2 once contact with real data shows what needs to change.

## Fields

| Field | Type | Notes |
|---|---|---|
| id | string | Unique identifier for the record, a short sequence number is enough |
| categoria | enum | `container_issue`, `illegal_dumping`, `bulk_waste`, `urban_damage`, `circular_item`, `other`. Inherited from the v0.2 enum, confirmed against its actual code |
| severidad | integer | 1 to 3 |
| localizacion | string | Neighborhood level, not street level (Monte Alto, Agra do Orzan, Os Mallos, Cidade Vella, Os Castros...), inferred by the person capturing the record, the post text rarely states it directly |
| fecha | date | Date of the original post |
| fuente | object | `{ tipo, url }`, tipo is the source type, e.g. "facebook_group", url points to the original post |
| descripcion | string | Free text, the post's original text, kept verbatim. Categoria, localizacion, and severidad are not extracted automatically from this field, they are filled by human interpretation during capture, because posts do not follow a consistent pattern |
| imagen | string | Relative path to the image file inside `data/images/`, downloaded and stored locally during capture. No external hosting at this stage |
| confidence | float | 0 to 1, how confident the person capturing the record is in the categoria and localizacion they assigned |
| zona | string | Reserved, not filled during manual capture, evaluate after seeing real data whether it duplicates localizacion |

## Open questions to test against real data

- Is `severidad` fillable in a consistent way from a single post, or does it need more context than the post gives
- Does `localizacion` come out usable at neighborhood level, or do posts frequently omit any location cue
- Does `confidence` mean anything when a human is the one judging, or is it redundant at this stage
- Does `zona` add anything `localizacion` doesn't already cover

## Note after the first batch, 2026-09-02

This batch, records 017 to 031, came from an Apify scrape of the source group rather than manual copy. Two consequences for the schema. First, the structured output supplied `fecha` and `fuente.url` reliably for the first time, both were weak points when capturing by hand. Second, it introduced an OCR caption per image, `ocrText`, a data point the formal schema does not have. It carried real signal here, naming the discarded object where the post text gave only an address, and it is worth considering as a field in a future version.
