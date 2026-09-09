# Decisions Log

Format: date, decision, reasoning. Append only, never edit past entries, add a new entry if a decision changes.

## 2025-11
Project starts as a citizen-reporting app for urban waste blackspots (v0.1). B2B2C model: citizens report, municipal managers use the data.

## 2026 H1
v0.1 evolves into v0.2, a React and Firebase app with the same B2B2C model.

## 2026-07, AddVenture acceleration, CITIC
Structural flaw identified in the B2B2C model: no citizen data means no value for managers, no revenue means no way to attract citizens, a deadlock. Pivot decided: v0.3, an automated B2B pipeline built on scraped and public data, removing the dependency on citizen participation entirely. Independence from the audited operator becomes the explicit differentiator against IoT incumbents.

## 2026-07-09
Demo day at AddVenture, CITIC, A Coruna. v0.3 presented as a pipeline concept and pitch deck, not a running build.

## 2026-08-17
Project reopened as a portfolio and technical study, not for active sale or commercialization. v0.3 build plan changes from polishing v0.2 to a fresh, incremental build across Etapas 0 to 6, starting from an empty repository, no application code carried over from v0.2.

## 2026-08-20
Etapa 0 closed. Real risks fixed: an open Firestore write rule with no authentication, and an Anthropic API key committed in March, revoked and purged from git history. A prior assumption, a Firestore rules expiry date, is corrected, that was never the actual risk.

## 2026-08-23
v0.3 built in a new, separate GitHub repository, recolle-v03, rather than as tags or releases inside the existing beillo/Recolle. This repository should explain the project on its own, without carrying the reorg history, mixed line endings, and v0.1/v0.2 code of the old repo. v0.1 and v0.2 stay frozen and untouched in beillo/Recolle as the historical record.

## 2026-08-23
Database choice, Postgres with PostGIS or continue with Firebase, deliberately deferred to Etapa 4, decided against a real list of required queries once data exists, not before.

## 2026-08-23
Frontend stack choice deferred to the map stage (Etapa 3), decided with a written justification once there is real data to render, not before. Already stated in CLAUDE.md, missing here until now.

## 2026-09-02
Manual capture and Apify scraping were tested in parallel, Apify adopted as the capture method going forward. Reasoning: the structured output solved three concrete gaps that manual copy and paste left open, `fecha`, `fuente.url`, and OCR text on images, and two posts captured both ways matched, validating accuracy. No login cookie or session token was present in the scraped output, checked directly against the export file rather than assumed.

## 2026-09-02
Human review of the 6 records the automated batch flagged as ambiguous or defaulted found two real miscategorizations, both corrected: id 020 to `illegal_dumping`, hazardous waste, batteries, and id 023 to `bulk_waste`, an item beside a container in a way that reads as dumped rather than offered. The remaining flagged records, 022, 028, 030 and 031, were confirmed as `circular_item` on review, no change needed. This is the first batch where `categoria` received actual human judgment rather than a default, closing the gap the previous batch, 017 to 031, the initial import, left open.

## 2026-09-02
Frontend stack for the minimal map (Etapa 3) chosen: React with Vite and Leaflet, same combination as v0.2. Reasoning: reuses existing familiarity from the previous version, keeps frontend development as one of the project's explicit learning objectives, and Etapa 3's own constraint, no database yet, means the choice carries low risk either way, a flat file works the same regardless of framework. CartoDB Positron tiles kept for consistency with v0.2, revisit later if the dark brand palette calls for a different basemap.

## 2026-09-02
Brand identity for v0.3 is expected to change, but timing is not yet decided, deliberately left open. The palette (#0A0A0A, #00C188, #E5E5E5), Poppins typography, and Lucide icons applied to the Etapa 3 map are carried over from the original v0.1/v0.2-era brand documentation, not a v0.3-specific decision, and should be treated as provisional. The known tension between the light CartoDB Positron basemap and the dark UI shell, noted when the frontend stack was chosen, stays open and may resolve differently once the new identity exists, or may not resolve at all. No visual choice made so far in this repository should be assumed final; revisit brand tokens across the app once the new identity is defined.

## 2026-09-03
Two modeling decisions taken while consolidating the Etapa 4 query list, full reasoning in `docs/queries.md`. First, coordinate is stored as a plain attribute on the record, `lat` and `lng` directly on the record, not as a separate place entity with its own identity; normalising place into a joined table or collection was considered and rejected. Second, the report's unit of analysis is both zona and point, with zona as the primary aggregation unit, matching the 4.7 hotspot by zone framing and the verification report deliverable, and point level precision kept as a secondary need for map display and any future radius based feature.

## 2026-09-04
Field level consequence of the 2026-09-03 coordinate decision settled: the record carries `lat`, `lng` and `precision` directly. `precision` is promoted to a first class field rather than treated as geocoding metadata, because the 4.7 radius query is specified as filtered by coordinate precision, so a radius query that cannot read precision cannot be answered correctly. The two provenance fields the geocoding step produces, `query`, the normalised string actually sent to Photon, and `match`, the string Photon returned, are preserved as well, so the migration from `app/src/data/zonaCoords.json` and `app/src/data/localizacionCoords.json` into `data/records.json` loses no information. Whether `query` and `match` stay in the final model is deliberately left open and decided later, once the database exists and it is clear whether they are read by anything other than a human auditing a coordinate. Precision values in use today are four: `neighbourhood`, assigned in code to records placed from a confirmed zona centroid, and `landmark`, `address` and `street`, assigned per entry by the localizacion geocoding step. This is a statement of the target model, not of the running code, which still joins the two lookup files at runtime.

## 2026-09-04
Database decision, deferred since 2026-08-23, resolved: Postgres with PostGIS, not Firebase. Decided against the query list in `docs/queries.md`, not preference. Reasoning: the flat record modeling decision from 2026-09-03 is neutral between the two, a Postgres row with `lat`, `lng`, `precision` as columns is as flat as a Firestore document with the same fields, so it does not favor Firestore as it first appeared to. The radius query filtered by coordinate precision is listed under "Confirmed, required by checklist item 4.7" in `docs/queries.md`, not under the predicted, unvalidated section, so it is a real requirement even though zona is the primary analysis unit, and it is materially cheaper in PostGIS, `ST_DWithin` with a spatial index, than in Firestore, which needs geohashing, a composite index, and client side post filtering. Count and time-since-last per zona are a wash between the two at the current volume, 15 records. What decided it: the project's learning objective has included SQL and Postgres since before v0.3 started, the project is now a portfolio and technical study rather than a deadline-driven MVP, and this was the standing default since January, never discarded on merit, only deferred until a real query list existed.

## 2026-09-04
Hosting for Postgres decided: Supabase, not local Docker and not a native Windows install. Checked directly rather than assumed: neither Docker Desktop nor a native Postgres install is present on this machine. Reasoning: the project's learning objective is SQL itself, not database server administration, so a local install would add friction unrelated to that goal. Supabase ships PostGIS pre-enabled, closing most of the operational-burden gap that had counted in Firebase's favor during the engine decision above. Running local also sets up a second migration later, from local-only to hosted, if the map or the verification report ever need to be reachable outside this machine, which a hosted start avoids. The free tier covers the current data volume with room to spare.

## 2026-09-07
Concello da Coruna "avisos e incidencias de movilidad" adopted as the second data source, closing Etapa 5 for the MVP. Filtered to physical interventions only, a real cut or works on the street: 2 of the 8 sampled notices kept, ids 032 and 033, and 6 excluded. The exclusions are the reason the filter exists rather than a detail: two bus line changes and one permanent 30 km/h rule dating from 2021 are not incidents at all, and two pedestrianisations are street improvements, so filing them as `urban_damage` would have recorded the opposite of what happened. One street direction change was held out as ambiguous rather than forced into a category. The source is structurally different from the Facebook one and the difference is worth stating plainly: it publishes its own coordinate per notice, so no geocoding is involved, it gives every notice a stable permalink, which satisfies the unique `fuente_url` the "does this post exist" query in `docs/queries.md` depends on, and it has no pagination and no archive. Volume is small by nature, 8 live notices today, a standing register of long running conditions rather than a growing feed like the Facebook group. Field level consequences are recorded in `docs/schema.md` under "Source variations".

## 2026-09-09
Second Apify batch for the Facebook source, fetched via `scripts/fetch-apify.js` against the last successful run of the `apify/facebook-groups-scraper` actor, added: 73 new records, ids 034 to 106, on top of the existing 17. Of 100 posts fetched, 15 were already in the database, deduped by `fuente_url`, leaving 87 new. Of those, 13 were excluded as out of scope for this dataset: 7 job postings including one, id-less, whose OCR revealed a job ad image behind text that looked like a location at first glance, 4 posts with no text and no usable attachment, 2 lost-and-found posts (a bag, an earring) which are neither an item offered nor waste, and one generic recurring donation-drive announcement naming no specific item or place. This leaves 74 with real content, one of which, "en Calle Postas con Avenida Plaza de Toros llevan un tiempo abandonadas" plus an OCR hit of a bicycle, was categorised `bulk_waste` rather than `circular_item`, same reasoning as record 023 in the first batch: phrased as abandoned, not offered.

Scope decided in conversation: unlike the first batch, out-of-A-Coruna-city posts are kept when they appear, first seen here with Culleredo and Oleiros locations. Images are downloaded locally to `data/images/`, same as the first batch, not left on Facebook's CDN, which expires. 4 records placed via a confirmed zona centroid, 3 newly matching Os Mallos and one more Zalaeta. The remaining 69 needed Photon geocoding, which came out far less reliable at this volume than the first batch suggested: sending raw post text produced a 71 percent failure rate and several confident but wrong matches in other regions entirely, Madrid, Valencia, Huesca, another Galician town sharing a street name. Every query was hand cleaned to a bare street or place name, and every successful match was checked against the expected comarca before being accepted, rejecting matches outside it the same way the Puentedeume collision was guarded against in the first batch. Two matches that first looked like false positives, O Burgo and Mera, were accepted after confirming they are real localities inside Culleredo and Oleiros respectively, not different places. 63 of 73 records got a coordinate this way; 10 stayed unplaced with a `reason`, same pattern as id 025.

Applied directly to the live Supabase database via the `execute_sql` MCP tool now available in this session, no SQL Editor copy-paste needed. `db/seed.sql` and `data/records.json` both updated to match, so the flat file stays the record of what is actually in the database, not a partial history.

Observed but not fixed here: record 033 (the Concello batch) has `zona` set to `Os Mallos` but `precision` of `street`, not `neighbourhood`, because its coordinate came from the source's own tag, not a zona centroid. The app's `source` classification in `app/src/data/records.js`, `precision === 'neighbourhood' ? 'zona' : 'localizacion'`, assumed those two facts always travel together, so this record is plotted correctly but counted as `localizacion` sourced rather than `zona` sourced in the map's header stats. Left as a known gap, not corrected in this session.
