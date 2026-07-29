# Brick 10L — Shoreline Markers: Source Resolution Report

**Status: SEED DEFERRED — no verified source**

## STEP 0 — Live Schema

Table: `public.shoreline_markers`

| Column | Type | Nullable | Default |
|---|---|---|---|
| id | text | NOT NULL | — |
| marker_number | text | NOT NULL | — |
| latitude | numeric(9,6) | NOT NULL | — |
| longitude | numeric(9,6) | NOT NULL | — |
| description | text | NULL | — |
| lake | text | NOT NULL | `'Lake Eufaula'::text` |
| created_at | timestamptz | NOT NULL | `now()` |

**Indexes:**
- `shoreline_markers_pkey` PRIMARY KEY btree (id)
- `shoreline_markers_marker_number_idx` btree (marker_number)
- `shoreline_markers_lake_idx` btree (lake)

**Foreign keys on `shoreline_markers`:** NONE (no FK to `properties`)
**Foreign keys referencing `shoreline_markers`:** NONE

**Row count: 0**

## Source Resolution

Three acceptable sources were checked:

### (a) Existing rows already referenced by properties/monitoring_events
- `properties.nearest_shoreline_marker` (text, nullable) — contains 0 rows; no properties exist in the DB.
- `monitoring_events` — no column references `shoreline_markers.id`.
- `shoreline_markers` itself — 0 rows.
- **RESULT: no existing cross-referenced rows.**

### (b) Committed fixture file in the repo
- Searched all `.ts`, `.sql`, `.json`, `.csv`, `.geojson` files (excluding node_modules).
- No file contains hardcoded marker coordinates, `marker_number` values, `SM-` designations, or INSERT statements targeting `shoreline_markers`.
- **RESULT: no fixture file found.**

### (c) Derive from properties table geometry
- `properties.latitude` and `properties.longitude` exist as nullable `numeric` columns.
- Both columns are NULL for all rows (0 properties in the DB).
- Shoreline marker coordinates are Corps of Engineers buoy/stake positions on the lake — they are NOT derivable from property lat/lng. They are independent physical survey points.
- **RESULT: no geometry to derive from; derivation is also semantically incorrect.**

## Conclusion

**No verified source exists.** Writing a seed file would require fabricating coordinates —
a FAIL CONDITION per the spec. Seed deferred pending real survey/Corps data.

## Unblocking Path

To unblock 10L seeding, provide ONE of:
- A CSV/JSON fixture with real Corps of Engineers shoreline marker numbers + GPS coordinates for Lake Eufaula
- Actual `properties` rows with `nearest_shoreline_marker` values (which can cross-reference real marker IDs once inserted)
- A public GIS source for USACE marker positions on Lake Eufaula that can be committed as a fixture file
