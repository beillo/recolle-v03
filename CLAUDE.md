# CLAUDE.md

Guidance for working in this repository, written so a new session with no prior conversation context can pick up correctly.

## What this project is
Read README.md first. Short version: an independent, geolocalized dataset about urban waste collection problems, built from public and scraped data, kept structurally separate from the operator being audited. This is v0.3, a from-scratch rewrite; v0.1 and v0.2 live untouched in a separate repository, beillo/Recolle, and must never be modified from here.

## The build follows a staged plan
Etapas 0 through 6, each with an explicit exit gate. A stage does not start before the previous one's exit gate is met. Etapa 0 (closing the old repo's loose ends) and Etapa 1 (this repository's foundation) are complete or in progress, the stages after that are, in order: capture real data by hand, build a minimal map reading a flat file, only then add a database, only then add one automated data source, only then a recurring agent over a market newsletter. Do not skip ahead, do not add a database or automation before the stage that calls for it.

## Two decisions are deliberately still open
Frontend stack: decided at the map stage, with a written justification.
Database, Postgres with PostGIS or Firebase: decided once a real list of required queries exists from captured data, not before. Do not assume either one.

## Verification rule
Documentation has been wrong before, in this exact project, more than once (framework version, map tile provider, category values in the running code). The code is always the source of truth. If a claim about the code or the data has not been checked against the actual code, say so explicitly instead of stating it as fact.

## Decision log
Every decision that shapes the project, technical or strategic, gets a dated entry in docs/decisions.md with the reasoning. Past entries are never edited, a changed decision gets a new entry.

## Style
No em dash in any generated text or documentation. Comma or colon instead.

## Out of scope for now
Citizen reporting stays as the legacy v0.2 flow only, never a dependency of this pipeline. Verification report generator, alerts panel, and the scraping engine (Firecrawl) are not built until the stage that calls for them. The beach and sea vertical is a separate, later idea, not part of this build.
