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

## Schema v2

Everything above is v1, kept as historical record and not edited. v2 is the schema as the data actually is, checked against `data/records.json` on 2026-09-02: 15 records, ids 017 to 031, 23 image files. It supersedes v1 and the dated notes that preceded this section, whose content is folded in here.

### Fields

| Field | Type | Notes |
|---|---|---|
| id | string | Three digit zero padded sequence. The file currently starts at 017: ids 001 to 016 were set aside for a manual capture batch that was never run, so no record below 017 exists |
| categoria | enum | Six values, unchanged from v1: `container_issue`, `illegal_dumping`, `bulk_waste`, `urban_damage`, `circular_item`, `other`. Three are in use so far, `circular_item` on 13 records, `illegal_dumping` on 1, `bulk_waste` on 1. v1 claims these were confirmed against the v0.2 code, that claim has not been verified from this repository, the v0.2 code lives in `beillo/Recolle` |
| severidad | integer or null | `null` when categoria is `circular_item`, an item offered for reuse has no severity. A real 1 to 3 human judgment for every other categoria. Only two records carry a value, 020 at 2 and 023 at 1, both assigned by human review, not by default |
| localizacion | string | The location as the post states it, which in practice is street and number or a landmark, not the neighborhood v1 assumed. Neighborhood now lives in `zona`. This resolves the v1 open question about the two fields overlapping: they do not, they sit at different granularity |
| fecha | date | `YYYY-MM-DD`, the date part of the post timestamp. Reliable when the source is structured, the Apify export carries a real timestamp per post. Unreliable from manual copy and paste, where it was one of the fields most often lost or guessed |
| fuente | object | Three keys now, `{ tipo, url, grupo }`. v1 had two. `tipo` is the source type, e.g. `facebook_group`, `url` points to the original post, `grupo` names the source group |
| descripcion | string | The post's original text, verbatim, newlines included. Categoria, localizacion, severidad and zona are not parsed out of it automatically, they are human judgment at capture time, because posts follow no consistent pattern |
| imagen | array of strings | An array, not the single string v1 specified: posts routinely carry several photos. Repo relative paths under `data/images/`, downloaded and stored locally at capture time, no external hosting. One image is `{id}.jpg`, several are `{id}-1.jpg`, `{id}-2.jpg` and so on |
| confidence | float | 0 to 1, how confident the capturer is in the categoria and localizacion assigned. Text based only: it reflects the post text and, where the source supplies it, the OCR caption. The image itself is not examined, image based confidence stays out of scope at this stage. Two values in use, 0.9 on 10 records and 0.6 on 5 |
| zona | string or null | Populated at capture time, not reserved as v1 said. Holds a confirmed neighborhood from the list below, or `null` when the post names no confirmed one. Five records carry a value |

### Confirmed zona values

A name appearing in post text is not enough, it gets confirmed before it is used:

- Os Mallos, confirmed 2026-09-09, records 072, 081 and 103
- Monte Alto
- Novo Mesoiro
- Riazor, confirmed 2026-09-02, record 019
- Zalaeta, confirmed 2026-09-02, records 020 and 029, joined 2026-09-09 by record 040
- Peruleiro, confirmed 2026-09-02, record 031

The neighborhood names in the v1 `localizacion` row above are illustrations of granularity, not confirmations, and three of them, Agra do Orzan, Cidade Vella and Os Castros, appear in no record.

One collision to guard against, already seen: record 017 reads "C/Puentedeume", a street in A Coruna, not the concello Pontedeume. A plain name match against a list holding both bairros and concellos would file it in the wrong place. Its `zona` is deliberately `null`.

### Not yet a field: ocrText

Apify captures carry an OCR caption per image, one line describing what the photo appears to show. It is not part of the schema and does not appear in `data/records.json`. It earned its keep in this batch, naming the discarded object on records whose post text gave only a street address, and it fed the `confidence` value on those. Worth considering as a formal field in a future version.

### Source variations, added 2026-09-07 with the second source

The Concello da Coruna avisos de movilidad source, adopted in Etapa 5, does not fit the shape the Facebook batch established. Three differences, none of which change the field list above:

- **`fuente` may have two keys, `{ tipo, url }`.** `grupo` is Facebook specific, it names the group a post came from, and a source that is not a group has nothing to put there. The three key form described above is the Facebook case, not a requirement. `db/schema.sql` already allows this, `fuente_grupo` is nullable, no change was needed there.
- **A source may supply its own coordinate.** The Concello page publishes a latitude and longitude per notice in RDFa meta tags, so `lat`, `lng` and `precision` are read straight from the source and the Photon fallback is not used at all. `precision` is still set, `street` for these records, and `query` and `match` stay null because there is no geocoding provenance to record. The A Coruna envelope check still runs against the supplied coordinate. A coordinate that arrives with the record is not automatically trusted.
- **`nota`, a new optional key.** Free text carrying a caveat about the source that has nowhere else to live. Used once so far, on record 033, to record that the Concello's `endDate` of 2051-01-01 is a sentinel meaning no end date set, not a real closure date. It exists in `data/records.json` only. There is no `nota` column in `db/schema.sql`, so the same text is carried as a SQL comment in `db/seed.sql`. If it earns a second and third use it should become a real column rather than stay a JSON only field.

### Not part of records: the submissions table

Added 2026-09-10 with the map's side panel. `public.submissions`, defined in `db/submissions.sql`, holds citizen reports. It is deliberately not this schema and deliberately not the same table:

- A record is scraped, human reviewed and audited. A submission is an unverified claim from an anonymous browser. The dataset's whole value is the first thing, so the second one is quarantined.
- Shared field: `categoria` uses the same six value enum, so a reviewed submission can be promoted without translating anything. `localizacion`, `descripcion`, `lat` and `lng` mean what they mean here.
- Fields that exist only there: `estado`, one of `pending`, `accepted` or `rejected`, and `promoted_to`, which points at the `records.id` a submission became, if it ever became one.
- Nothing moves from `submissions` into `records` automatically. Promotion is a human act, and when it happens the record is a normal record with a `fuente` naming the submission.
