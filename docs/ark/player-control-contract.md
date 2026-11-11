# Ark player control: the build contract (phase 1)

The approved design is AnimalDex `docs/ark/player-control-design.md` (branch `ark-player-control-design`). This file
fixes the names every piece of the build shares: the web scene and the `ark-live` server (landing), the database
(AnimalDex migration), and the apps' bridge (iOS, Android). Change a name here first, then in every repo.

Nothing here is deployed. `ark-live` runs locally only until the owner decides hosting (DECISIONS.md #14).

## 1. Islands

- Island ids are short lowercase words. **Today's single island is `ark`** (DECISIONS.md #15). Part C adds `wild` and
  `town`; every table, message and atlas already carries the id.
- On the wire an island is a byte: `0 = ark`, `1 = wild`, `2 = town` (`ISLAND_IDS` in `src/ark-live/islands.ts`).

## 2. The control ticket

- Minted by the database (`voyage_control_ticket_v1`), checked by `ark-live`. Single use, 120 s.
- Text: `v1.<user_uuid>.<animal_uuid>.<island>.<exp_unix_seconds>.<nonce_uuid>.<sig>`
- `sig` = base64url, no padding, of HMAC-SHA256 over the UTF-8 text `v1.<user>.<animal>.<island>.<exp>.<nonce>` (everything
  before the last dot), keyed with the **decoded bytes** of a base64 secret (32 random bytes).
  - Postgres: `hmac(convert_to(payload, 'UTF8'), decode(key_b64, 'base64'), 'sha256')`, then `encode(…, 'base64')`
    with `+/` → `-_` and `=` stripped. The key is the vault secret named `ark_live_ticket_key`.
  - `ark-live`: env `ARK_LIVE_TICKET_KEY` (the same base64 text). `src/ark-live/ticket.ts` signs and verifies with WebCrypto.
- Contract test vector (both sides must produce it): key_b64 `AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=` (bytes 0..31),
  payload `v1.00000000-0000-0000-0000-000000000001.00000000-0000-0000-0000-000000000002.ark.1800000000.00000000-0000-0000-0000-000000000003`.
  Expected signature: `0I-cssxARS7s--E_j4I-LoM4L34Ds9fYrif0ZG9gGpA` (also in `src/lib/ark-live-ticket.test.ts` and the SQL test).

## 3. Database (AnimalDex migration `20261120100000_ark_player_control.sql`, with its rollback)

Flag: `voyage_config.player_control` (off by default). Every RPC below refuses while it is off, except the reads.

Tables (all RLS on, no client policies unless stated):
- `voyage_control_locks(animal_id pk, session_id, user_id, island, heartbeat_at, expires_at)`: one controller per animal; a lock
  whose `expires_at` has passed is free.
- `voyage_control_sessions(id pk, user_id, animal_id, island, started_at, ended_at, end_reason, distance_m, max_speed,
  rejections, client, app_version, handoff jsonb)`: the private audit (D3 quotas are summed from it).
- `voyage_control_tickets(nonce pk, user_id, animal_id, island, expires_at, redeemed_at)`: single use.
- `voyage_animal_state(animal_id pk, island, version, released_at, release jsonb, plan jsonb, zone, stranded_from, stamina,
  exposure, updated_at)`: the stored record (design §3.2). Public through `voyage_animal_states_v1()` (no user ids).
- `voyage_control_trace(animal_id, step, island, x, z, y, mode, band, written_at, pk (animal_id, step))`: one sample per
  34.5 s step (design §3.4).

RPCs:
- `voyage_control_ticket_v1(p_animal_id uuid) returns jsonb` (role `authenticated`): checks the flag, D1 ownership (own
  arrivals plus first-generation Ark-born young credited to the caller; never grandchildren), the age rule, not sessile,
  D3 (cooldown 10 min after a session that reached its 20 min, at most 60 min per animal per real day), D2 (the caller
  holds no other live lock). Returns `{ok: true, ticket, expires_at, island, animal_id}` or `{ok: false, reason}` with
  `reason` one of `off`, `not_yours`, `age`, `sessile`, `cooldown`, `daily_limit`, `busy`, `other_animal`, `no_key`.
- `ark_live_start_v1(p_ticket_nonce uuid, p_session_id uuid, p_user_id uuid, p_animal_id uuid, p_island text, p_client text,
  p_app_version text) returns jsonb` (role `ark_live` only): redeems the nonce once, takes the lock (30 s TTL), inserts the
  session. Returns `{ok, reason?, animal: {id, slug, kind_species_profile_id, zone, area, island, enclosure_id, label, named,
  asleep_hint}, quota: {session_limit_s, day_used_s, day_limit_s}}`.
- `ark_live_heartbeat_v1(p_session_ids uuid[]) returns integer` (`ark_live`): extends each live lock by 30 s.
- `ark_live_trace_v1(p_rows jsonb) returns integer` (`ark_live`): inserts trace rows; refuses a step at or before the
  tick's committed point.
- `ark_live_end_v1(p_session_id uuid, p_reason text, p_stats jsonb, p_state jsonb) returns jsonb` (`ark_live`): ends the
  session, upserts `voyage_animal_state` (version + 1), deletes the lock.
- `voyage_animal_states_v1(p_island text default 'ark') returns jsonb` (anon, authenticated): every stored record on that
  island, no user ids.
- pg_cron `voyage-control-expire` each minute: sessions whose lock expired end with `end_reason = 'lost'` and a coarse
  record (`plan = {kind: 'homing', legs: []}`) at their last trace sample.

`ark-live` calls the `ark_live_*` RPCs through PostgREST with a JWT whose `role` claim is `ark_live` (a NOLOGIN role
granted to `authenticator`), never the service role.

## 4. App bridge (page ↔ the apps' WebView, `public/ark/embed.html`)

Page → host:
- `{type: "ark:control-request", animal_id}`: the viewer pressed Control on one of their animals in the page; the host
  mints a ticket and answers with `ark:control-ticket`.
- `{type: "ark:control", active: boolean, animal_id}`: control started or ended. While active the host turns off its own
  panel swipe and back-edge gestures and hides its own card.
- `{type: "ark:haptic", kind: "takeoff" | "land" | "contact" | "bump" | "warn"}`: a light tap (optional).

Host → page:
- `{type: "ark:control-ticket", animal_id, ticket, expires_at, island}` or `{type: "ark:control-ticket", animal_id, error}`
  (`error` is the RPC's `reason`, or `network`).
- `{type: "ark:control-start", animal_id}`: the host's own card's Control button was pressed; the page then asks for a
  ticket with `ark:control-request` as above (one path for both).
- `{type: "ark:control-stop"}`: the host wants control ended (the panel is closing).

The WebView never holds the user's Supabase token.

## 5. Where `ark-live` is

- The page reads the server's URL from `?live=<ws url>` (development), else the build's `NEXT_PUBLIC_ARK_LIVE_URL`, else
  none: no Control button and no live layer (formula animals only, as today).
- Local development: `node ark-live/dist/server.mjs` (or `npx tsx ark-live/server.mts`) on `ws://localhost:8787`.
  With `ARK_LIVE_DEV=1` it serves `GET /dev/ticket?user=<id>&animal=<id>` for local testing only.

## 6. The wire protocol

Implemented in `src/ark-live/protocol.ts` (pure, shared by the server and the page). Binary little-endian for the hot
messages (ping, pong, pose, snapshot, correction, meter, npc), JSON text frames for the rare ones (hello, control,
release, view, joined, left, events). The layouts are in that file's header comment.
