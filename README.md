# Recolle

Recolle turns scattered public information about urban waste collection into a geolocalized dataset that is structurally independent from the operator being audited. The core output is a blackspot map and a verification report a municipality, concessionaire, or facilities manager can use to check whether a waste service is actually working, without relying on data the operator itself produced.

## Why this exists

Waste management data in Spain is either owned by the operator running the service (IoT sensors from MOVISAT, Sensoneo, MOBA, and similar) or not collected at all. Nobody audits the audited. Independence from the operator is the whole value proposition, a client cannot be the party being measured.

The regulatory wedge is concrete: Ley 7/2022 requires separate biowaste collection in Spain, with a hard threshold of under 15% impropios by 2027 to count as compliant. Galicia has active public funding tied to this. Demand here is regulatory, not discretionary.

## What this repository is

This is v0.3, a clean rewrite. It is not a continuation of the earlier prototype and app, those live untouched at `beillo/Recolle` (v0.1, v0.2) as a separate, frozen historical record.

Two prior versions preceded this one:

- **v0.1 to v0.2**: a citizen-reporting app (B2B2C). Abandoned, a structural deadlock: no citizen data means no value for managers, no revenue means no way to attract citizens.
- **v0.3 (this repo)**: an automated B2B pipeline. Public and scraped data feeds a dataset that does not depend on citizen participation to exist.

As of August 2026 this project is being developed as a portfolio and technical study, not toward active commercialization. See `docs/decisions.md` for why, and for every decision made along the way with its date and reasoning.

## How this repo is built

Development follows a staged, incremental plan: real data captured by hand first, a schema tested against it, a minimal map reading a flat file, only then a database, only then automation. Each stage closes before the next starts. Stack decisions, frontend and database, are made deliberately late, once real data exists to test them against, not assumed upfront.

See `CLAUDE.md` for how to work in this repository.

## Status

Empty repository, foundation stage in progress. No application code yet.
