# Behavior Lessons Backfill Priority

_Generated: 2026-06-14T13:53:14.326Z_

## Summary

- Website species missing DB lesson rows: **67**
- CSV output: `docs/seo/behavior-lessons-backfill-priority.csv`
- Suggested import source tag: `manual_website_gap_backfill_v1`

| Tier | Count | Guidance |
| --- | ---: | --- |
| P0 | 25 | Import first: flagship / high-intent symbolism / mega-fauna |
| P1 | 6 | Second wave after P0 review |
| P2 | 6 | Batch editorial pass |
| P3 | 30 | Lower urgency generic archetypes |

## Top 20 Priority Rows

| Rank | Tier | Score | Animal | Slug | Draft principle | Draft source |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | P0 | 102 | Cat | `cat` | Threshold Independence | manual |
| 2 | P0 | 102 | Dolphin | `dolphin` | Echo Social Intelligence | manual |
| 3 | P0 | 102 | Fox | `fox` | Clever Adaptation | manual |
| 4 | P0 | 102 | Raven | `raven` | Pattern Messenger | manual |
| 5 | P0 | 102 | Snake | `snake` | Coiled Transformation | manual |
| 6 | P0 | 99 | Octopus | `octopus` | Distributed Nervous Intelligence | manual |
| 7 | P0 | 98 | Elephant | `elephant` | Living Archive | manual |
| 8 | P0 | 98 | Orangutan | `orangutan` | Memory | manual |
| 9 | P0 | 97 | Chameleon | `chameleon` | Directional Surveillance | systems_intelligence |
| 10 | P0 | 97 | Crocodile | `crocodile` | Estuary Pressure Valve | systems_intelligence |
| 11 | P0 | 97 | Eagle | `eagle` | Thermal Recon | systems_intelligence |
| 12 | P0 | 97 | Leopard | `leopard` | Stealth Generalist | systems_intelligence |
| 13 | P0 | 97 | Wolf | `wolf` | Cooperative Territory Governor | systems_intelligence |
| 14 | P0 | 94 | Jellyfish | `jellyfish` | Drift-based Capture | systems_intelligence |
| 15 | P0 | 93 | Gorilla | `gorilla` | Forest Power Diplomat | systems_intelligence |
| 16 | P0 | 93 | Lion | `lion` | Pride-based Pressure Broker | systems_intelligence |
| 17 | P0 | 93 | Tiger | `tiger` | Solitary Ambush Accountant | systems_intelligence |
| 18 | P0 | 91 | Sea Turtle | `sea-turtle` | Reptile Endurance | inferred |
| 19 | P0 | 91 | Shark | `shark` | Fish Precision | inferred |
| 20 | P0 | 87 | Giant Tortoise | `giant-tortoise` | Reptile Precision | inferred |

## CSV Columns

- `priority_*`: editorial queue ordering only; not imported to Supabase.
- `principle_name` through `best_use_cases`: draft payload for `species_behavior_principles`.
- Manual profiles come from `src/data/species-behavioral-principles.ts`.
- Review species-specific `principle_name` values before import.
- Join to catalog by `landing_page_slug` / `normalized_identity_key` when inserting behavior rows.