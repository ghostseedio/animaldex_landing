Ark scale run "runtime-budget", 2026-11-11T07:49:03.901Z, GPU metal, 3000 ms per view, Mac load average at the end 27.5 / 26.7 / 34.7.

| device | population | tier | animals | load to quiet s | ready ms | decode ms | behaviour build ms | JS heap MB | long tasks at load (longest ms) |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| desktop | 1x | high | 3140 | 111.6 | 4092 | 20 | 249 | 52 | 6 (3489) |
| desktop | 3x | high | 9420 | 77.0 | 4744 | 22 | 313 | 123 | 6 (4095) |
| phone | 1x | low lite | 3140 | 40.3 | 15440 | 40 | 1736 | 47 | 16 (14339) |
| phone | 3x | low lite | 9420 | 27.8 | 10343 | 65 | 1003 | 45 | 11 (9772) |

| device | population | view | interval p50 ms | p95 ms | fps | scene CPU ms | GPU drain ms | draw calls | triangles | near / far / live | herd figures / specks | heap MB | long tasks (longest ms) |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|---:|---|
| desktop | 1x | island_far | 16.7 | 33.4 | 42.67 | 15.62 | 16.1 | 793 | 6298004 | 0 / 150 / 1195 | 635 / 58 | 80 | 1 (77) |
| desktop | 1x | house_fields | 33.3 | 50 | 28.18 | 21.51 | 29.8 | 675 | 7730146 | 120 / 40 / 1195 | 685 / 8 | 54 | 15 (123) |
| desktop | 1x | forest_floor | 33.3 | 33.4 | 38.33 | 21.83 | 16 | 748 | 5695074 | 69 / 81 / 1195 | 80 / 0 | 84 | 0 (0) |
| desktop | 3x | island_far | 33.3 | 33.4 | 30.17 | 16.79 | 24.5 | 783 | 7336568 | 0 / 150 / 1179 | 900 / 2295 | 113 | 1 (86) |
| desktop | 3x | house_fields | 16.8 | 33.4 | 39.89 | 22.94 | 13.2 | 713 | 8423054 | 97 / 53 / 1179 | 900 / 2271 | 86 | 2 (51) |
| desktop | 3x | forest_floor | 33.3 | 33.4 | 39.12 | 22.46 | 15.6 | 826 | 7352226 | 69 / 81 / 1179 | 736 / 131 | 142 | 1 (50) |
| phone | 1x | island_far | 16.7 | 16.7 | 60 | 13.41 | 4.1 | 116 | 691069 | 0 / 63 / 200 | 160 / 641 | 35 | 0 (0) |
| phone | 1x | house_fields | 16.7 | 33.3 | 56.67 | 17.48 | 3.1 | 101 | 731862 | 24 / 25 / 200 | 160 / 641 | 44 | 0 (0) |
| phone | 1x | forest_floor | 16.7 | 33.3 | 56.03 | 13.26 | 3.6 | 86 | 574665 | 15 / 25 / 200 | 116 / 0 | 61 | 0 (0) |
| phone | 3x | island_far | 16.7 | 33.3 | 56.34 | 15.9 | 6.9 | 96 | 951148 | 0 / 44 / 200 | 160 / 3563 | 67 | 0 (0) |
| phone | 3x | house_fields | 33.2 | 33.4 | 39.45 | 23.43 | 5.2 | 82 | 983599 | 21 / 11 / 200 | 160 / 3536 | 48 | 0 (0) |
| phone | 3x | forest_floor | 16.8 | 33.4 | 39.89 | 24.29 | 5.6 | 87 | 677155 | 13 / 23 / 200 | 160 / 1088 | 42 | 0 (0) |
