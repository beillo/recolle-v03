# Etapa 4 query list

Deliverable for item 4.1, the formal input to the database decision in 4.2. It is the list of queries the product needs, written against the data that actually exists in `data/records.json` on 2026-09-03, 15 records, ids 017 to 031. Where a query cannot yet be validated against real data, it says so instead of asserting it.

## Confirmed, existing app depends on these

- List all valid geocoded records. Trivial, the flat file already does this.
- Filter by categoria. The map already colours by it.
- Get single record by id, for the marker popup.
- Does this post exist, by `fuente.url`. Missing from the running app, but required before Etapa 5 runs the automated source a second time: it decides insert versus update.

## Confirmed, required by checklist item 4.7

- Count records grouped by zona.
- Time since last record per zona.
- Records within a radius, filtered by coordinate precision. Not a plain radius query, precision must be part of the filter: 5 records come from bairro centroid and 9 from geocoded `localizacion` with declared precision levels landmark, address and street. Mixing them in an unweighted radius returns meaningless results.

## Predicted, not yet empirically validated

Hotspot and recurrence detection is a legitimate long term requirement, but it cannot be validated with the current sample, for three separate reasons.

- 13 of the 15 records are `circular_item`, donation items rather than abandoned waste. A hotspot of `circular_item` is a well functioning donation group, not a waste problem. Excluding `circular_item` leaves 2 records, 1 `illegal_dumping` and 1 `bulk_waste`, too few to validate anything.
- "Same place across different dates", the recurrence query, currently cannot be distinguished from "same bairro". Records sharing a zona share its centroid coordinate exactly, see 020 and 029 in Zalaeta.
- The full dataset spans three days, 31/08 to 02/09, so recurrence is not observable in the current sample regardless of how place identity is resolved.

## Operational

- Review queue: records that failed geocoding, and why. Currently 1, id 025.
- Dataset coverage and health: counts of records missing zona, missing coordinate, missing severidad. Needed because the product's value proposition is auditing completeness independently of the operator, so its own data completeness has to be declarable.

## Deferred to Etapa 5

- Filter by `fuente.grupo`. Irrelevant with a single source today, mandatory once a second automated source exists.

## Modeling decisions, 2026-09-03

- Coordinate is stored as a plain attribute on the record, `lat` and `lng` fields directly on the record, not as a separate place entity with its own identity. The alternative, normalising place into a joined table or collection, was considered and rejected.
- The report's unit of analysis is both zona and point, with zona as the primary aggregation unit, matching the 4.7 hotspot by zone framing and the verification report deliverable. Point level precision is kept as a secondary need, for map display and any future radius based feature.
