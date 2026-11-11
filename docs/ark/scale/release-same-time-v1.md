Ark scale run "release-same-time", 2026-11-11T08:06:39.151Z, GPU metal, 3000 ms per view, Mac load average at the end 10.0 / 13.5 / 20.9.

| device | population | tier | animals | load to quiet s | ready ms | decode ms | behaviour build ms | JS heap MB | long tasks at load (longest ms) |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| desktop | 1x | high | 3140 | 78.5 | 5065 | 14 | 331 | 73 | 11 (4514) |
| desktop | 3x | high | 9420 | 134.7 | 14000 | 24 | 313 | 316 | 334 (13411) |
| phone | 1x | low lite | 3140 | 160.2 | 20924 | 42 | 1485 | 86 | 433 (20362) |
| phone | 3x | low lite | 9420 | 297.0 (not quiet) | 52420 | 67 | 1102 | 202 | 1816 (51584) |

| device | population | view | interval p50 ms | p95 ms | fps | scene CPU ms | GPU drain ms | draw calls | triangles | near / far / live | herd figures / specks | heap MB | long tasks (longest ms) |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---:|---|
| desktop | 1x | island_far | 16.7 | 33.4 | 49.67 | 18.14 | 15.6 | 637 | 6326296 | 0 / 150 / 2447 | 635 / 58 | 83 | 0 (0) |
| desktop | 1x | house_fields | 16.7 | 33.4 | 46 | 20.29 | 15.8 | 483 | 8030326 | 150 / 1 / 2447 | 685 / 8 | 159 | 0 (0) |
| desktop | 1x | forest_floor | 33.3 | 33.4 | 37.79 | 25.57 | 15.8 | 572 | 5855814 | 82 / 68 / 2447 | 80 / 0 | 201 | 1 (54) |
| desktop | 3x | island_far | 33.3 | 33.4 | 30.67 | 35.05 | 15.6 | 567 | 7380408 | 0 / 150 / 6225 | 900 / 2295 | 99 | 19 (92) |
| desktop | 3x | house_fields | 66.6 | 116.7 | 15 | 55.27 | 15.2 | 439 | 8968850 | 150 / 4 / 6225 | 900 / 2271 | 150 | 70 (127) |
| desktop | 3x | forest_floor | 50 | 66.6 | 20.77 | 49 | 16.3 | 458 | 7057410 | 42 / 113 / 6225 | 736 / 131 | 175 | 36 (131) |
| phone | 1x | island_far | 49.9 | 50.1 | 22.42 | 41.61 | 5.6 | 110 | 715526 | 0 / 80 / 2339 | 160 / 641 | 154 | 7 (95) |
| phone | 1x | house_fields | 116.7 | 200 | 7.78 | 113.6 | 5.5 | 89 | 799101 | 40 / 40 / 2339 | 160 / 641 | 71 | 40 (216) |
| phone | 1x | forest_floor | 66.7 | 133.3 | 12.86 | 71.5 | 2.6 | 102 | 620212 | 20 / 60 / 2339 | 116 / 0 | 134 | 62 (134) |
| phone | 3x | island_far | 166.7 | 466.6 | 4.81 | 182.96 | 9 | 96 | 992429 | 0 / 80 / 5697 | 160 / 3563 | 110 | 26 (462) |
| phone | 3x | house_fields | 133.4 | 283.4 | 6.49 | 154.98 | 6.2 | 84 | 1070041 | 40 / 40 / 5697 | 160 / 3536 | 311 | 34 (317) |
| phone | 3x | forest_floor | 133.3 | 300.1 | 6.7 | 150.74 | 6.6 | 80 | 695725 | 4 / 79 / 5697 | 160 / 1088 | 234 | 36 (302) |
