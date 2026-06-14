# Principle Source Distribution

_Generated: 2026-06-14_

This audit reflects live Supabase behavior data and how the website resolves species principles.

## Summary

- `species_behavior_principles` rows: **1,016**
- Catalog rows with `core_lesson`: **1,016**
- Website species pages: **981**
- Website species with DB lesson coverage: **914 / 981 (93.2%)**
- Website species missing DB lesson: **67**
- DB lessons without website page: **90**

## Source Breakdown (`species_behavior_principles`)

| Source | Count | Share |
| --- | ---: | ---: |
| `manual_curated_batch_005_v1` | 140 | 13.78% |
| `manual_curated_batch_004_v1` | 132 | 12.99% |
| `manual_curated_batch_006_v1` | 72 | 7.09% |
| `manual_curated_batch_776_850_v1` | 68 | 6.69% |
| `manual_curated_batch_926_1000_v1` | 68 | 6.69% |
| `manual_curated_batch_851_925_v1` | 67 | 6.59% |
| `manual_curated_batch_007_v1` | 66 | 6.50% |
| `manual_curated_batch_008_v1` | 66 | 6.50% |
| `manual_curated_batch_476_550_v2` | 60 | 5.91% |
| `manual_curated_batch_701_775_v1` | 59 | 5.81% |
| Other manual / cleanup / seed batches | 128 | 12.60% |

## Website Resolution Model

- **Primary source:** Supabase `species_catalog_v1` behavior fields (`principle_name`, `core_lesson`, `biological_basis`, `short_motto`, `best_use_cases`)
- **Fallback source:** Local inference in `species-behavioral-principles.ts` for the 67 species without catalog rows
- **Cluster browse layer:** `/principles/*` still uses the 10 inferred survival-strategy clusters
- **Species lesson layer:** `/animal-lessons/[slug]` uses catalog behavior data directly

914 website species previously mismatched local inference against DB principles. Animal pages and lesson pages now prefer catalog data when available.

## Priority Guidance

1. Backfill the 67 website-only species missing DB lessons (mostly generic pages like `cat`, `chameleon`, `cicada`).
2. Add website pages for the 90 catalog-only lesson rows, prioritizing numbered active catalog species.
3. Keep manual curated batches focused on flagship and high-intent SEO anchors.
4. Re-run `node scripts/generateBehaviorLessonsGapReport.js` after each behavior import batch.

## Backfill Queue

- **CSV:** [behavior-lessons-backfill-priority.csv](./behavior-lessons-backfill-priority.csv) (67 rows, P0–P3 prioritized)
- **Summary:** [behavior-lessons-backfill-priority.md](./behavior-lessons-backfill-priority.md)
- **Regenerate:** `node scripts/generateBehaviorLessonsBackfillCsv.js`

