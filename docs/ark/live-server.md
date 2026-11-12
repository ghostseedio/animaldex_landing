# `ark-live`: the Ark's real-time server for player control

Status (2026-11-12): **built and run locally only. Not deployed; hosting is the owner's decision** (AnimalDex
`docs/ark/DECISIONS.md` #14). Design: AnimalDex `docs/ark/player-control-design.md`; names shared by every repo:
`docs/ark/player-control-contract.md`.

## What it is

| Part | Where | Node-specific? |
|---|---|---|
| The room core: tickets, sessions, the pose validator, meters, limits, AOI snapshots, traces, release, crossings | `src/ark-live/` (pure TypeScript, shared with the page) | No (portable to a Cloudflare Durable Object, design §2.7) |
| The WebSocket transport (RFC 6455, written in-house: no dependency) | `ark-live/ws.ts` | Yes |
| The HTTP server, rooms per island, the 10 Hz tick, `/health`, `/stats`, development endpoints | `ark-live/server.mts` | Yes |
| The production store (the `ark_live_*` RPCs as the `ark_live` role) | `ark-live/store-supabase.ts` | Yes (fetch) |
| The development store (the same rules in memory) | `src/ark-live/memory-store.ts` | No |
| The load test (bots driving animals with the page's own mover, and watchers) | `ark-live/bots.mts` | Yes |

## Run it locally

```
npm ci
node ark-live/build.mjs                                   # → ark-live/dist/server.mjs (1.7 MB)
ARK_LIVE_DEV=1 ARK_LIVE_SNAPSHOT=$PWD/src/ark-scene/fixtures/snapshot-v2.json node ark-live/dist/server.mjs
```

- The first start bakes the island's atlas (1 m cells; 50–170 s on a busy Mac) into `ark-live/dist/.cache/`; later
  starts load it in under a second.
- Development tickets: `GET /dev/ticket?animal=<id>` (any local user; never in production). Records: `GET /dev/states`.
- The page: `/ark?live=ws://localhost:8787&devticket=1` (development builds only), or the apps' embed with `&live=`.
- Load test: `npx tsx ark-live/bots.mts --controllers 50 --watchers 50 --seconds 40`.

## Measured needs (2026-11-12, local, Apple M3 Max, loopback; machine under heavy load from other work)

Bots drive real body plans (fox, deer, cheetah, eagle, mallard, otter, camel, gibbon) with the page's mover at 10 Hz;
watchers only receive. Egress counts the wire's framing (66 B a message).

| Clients | Server CPU (cores) | Memory (RSS) | Egress per client | Egress total | Tick (mean) |
|---|---|---|---|---|---|
| 10 controllers + 10 watchers | 0.015 | 145 MB | 2.2 KB/s | 44 KB/s | 0.4 ms |
| 50 + 50 | 0.052 | 150 MB | 5.3 KB/s | 0.53 MB/s | 2.5 ms |
| 100 + 100 | 0.097 | 149 MB | 5.3 KB/s | 1.05 MB/s | 6.7 ms |
| 193 + 100 (the room cap is 200 controllers) | 0.165 | 156 MB | 5.3 KB/s | 1.6 MB/s | 12.5 ms |
| 10 + 300 (mostly watching) | 0.033 | 157 MB | 2.1 KB/s | 0.65 MB/s | 2.9 ms |

- **Idle:** about 140 MB (the atlas, the species tables, the sampler), no CPU.
- **Egress per player** stays at 2.2 KB/s with 10 players in view and is capped at about 5.3 KB/s from 32 in view (the
  AOI cap), as the design estimated (2.1 and 5.2 KB/s before phase 2's NPC offsets, which add about 0.8 KB/s). That is
  8 MB an hour per player at small scale, 19 MB an hour at scale.
- **CPU** grows a little faster than linearly with clients (each viewer's nearest-32 sort). An e2 vCPU is roughly 2–3×
  slower than one M3 Max core (est.), so 100 + 100 clients would need about 0.2–0.3 of an e2 vCPU.
- **Phase 1's corrections** in the bot runs were the bots' own fixed 100 ms steps (fixed); the real-island test drives
  ten body plans for 90 s each through the validator with no corrections (`src/lib/ark-live-island.test.ts`).

## Hosting options for the owner (nothing chosen; each adds a recurring cost)

The existing web VM (e2-small, 2 vCPU shared, 0.5 vCPU sustained, 2 GB) already runs the website's container.

| Option | Fixed cost | Egress at 10 players (24 h a day / 25 % of the day) | Notes |
|---|---|---|---|
| A. A second container on the web VM, capped (e.g. `--cpus 0.5 --memory 384m`) | none | Premium tier $0.19/GiB: 53 GiB → about $10 / about $2.5 a month | Fits the measured needs up to about 50 players. Shares the VM with the site: the caps and the room limits keep the site responsive. |
| B. Its own e2-small in Seoul (the design's D12 for public launch) | $15.69/month | as A | Isolated from the site. |
| C. Cloudflare Durable Objects | $5/month base | egress free | Cheapest at scale; a new vendor and deploy path; the room core is ready to port. |

The design's tables (§2.7) give 100 and 1,000 players. Measured egress matches its per-client figures, so they stand.

## Phases 2 and 3 on the server

- **Shared reactions (phase 2):** `ark-live` builds the NPC world from the snapshot (`ARK_LIVE_SNAPSHOT_URL`, the site's
  public read) and re-builds it when the animals aboard change; released animals' records are read each minute. The
  build takes about a second on a free desktop core (52 s measured on this overloaded Mac) and, for now, runs on the
  server's own thread: **move it to a worker thread before production**, or the tick pauses while it builds.
- **Hunting (phase 3):** contact is checked at 10 Hz on the server's poses; the database decides (see the contract §8).

