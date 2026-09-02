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
