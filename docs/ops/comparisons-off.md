# Comparisons: no new pairs from the web (16 Nov 2026)

Species comparison copy and artwork cost about $100 a month. From this change
set the web side creates **no new pairs**; every published comparison page,
the snapshot and the `species_comparisons` reads stay exactly as they were.

## What the web does now

- `COMPARISONS_GENERATE` (env, default **off**). Only `COMPARISONS_GENERATE=on`
  lets the web ask the generator for a pair it does not have
  (`src/lib/comparison-generation-guard.ts` `comparisonsGenerateEnabled`).
- Choke point: `getOrGenerateSpeciesComparison` in `src/data/species-comparisons.ts`
  returns `null` before any network call while the flag is off. It is the only
  web code that reaches the generator (a test pins that:
  `src/lib/comparison-generation-guard.test.ts`).
- `POST /api/comparisons/generate` refuses with `403 {error: "generation_off"}`
  before the sign-in, intent and rate-limit checks; existing pairs still return
  `ready` for free. The repaint path (`refreshImage`) goes through the same POST
  and is off too.
- `GET /api/comparisons/generate?slug=…` answers `{status: "pending", intent: null,
  generationOff: true}` for a missing pair, so the generating screen on
  `/compare/<slug>` shows "This matchup isn't written yet" with a link to the
  published comparisons instead of a Generate button
  (`comparisons.generating.offTitle/offDescription` in `en.json` and `id.json`).
- `/admin/ai-spend` says in its "new comparisons per day" section whether web
  generation is on; rows there now come from the apps only.

Every other landing trigger was checked and is read-only: the `/comparisons/[slug]`
SSG pages, the comparison builder (it only navigates), the page-video and
would-you-rather sources (`src/lib/content-video/page-sources.ts` read the
static entries and the snapshot), the social content and trend radar, the
discover timeline (`round3_species_comparison_slug` is read, never made), and
the refresh scripts (`scripts/refreshPublishedSeoComparisons.mts`,
`scripts/refreshClosedSeoNamespaceSlugs.mts`) which read `species_comparisons`
and write JSON. Hybrids/fusions are a different generator
(`src/lib/animal-fusions-server.ts`, `species_principle_fusion_recipes`) and are
not touched by this flag.

## The generator is the apps' edge function

The web never writes `species_comparisons` itself: it POSTs to the Supabase
edge function `get-or-generate-species-comparison` (iOS repo,
`supabase/functions/get-or-generate-species-comparison/`) with the service
key, and that function writes the copy (Claude → OpenAI → Gemini) and the VS
image (`gpt-image-1` → Gemini). The apps call the same function with a user JWT.

The function has **no read-only mode**: with a service or user token a missing
pair always generates, and a "hit" whose `featured_image_url` is not a generated
VS image gets a paid image backfill. So the web flag above is the only thing
stopping web spend today, and the apps still generate on demand.

### Server flag to add in the apps repo (not done here; the iOS repo is the source of truth)

In `get-or-generate-species-comparison/index.ts`, before the generate branch:

```ts
// Env (Supabase function secret): SPECIES_COMPARISON_GENERATE = "on" | "off" | "apps_only"
//   on        – today's behaviour
//   apps_only – only a user JWT may generate; a service-role caller (the web) gets 409 generation_disabled on a miss
//   off       – nobody generates; every miss is 409 generation_disabled, hits are served, no image backfill
const mode = (Deno.env.get("SPECIES_COMPARISON_GENERATE") ?? "on").toLowerCase();
if (!existing && (mode === "off" || (mode === "apps_only" && caller.kind === "service"))) {
    return json({error: "generation_disabled"}, 409);
}
if (mode !== "on") skipImageBackfill = true; // a hit never spends either
```

- `caller.kind` is what the function already derives when it checks the
  Authorization header (service role vs user JWT vs anon).
- Set it with `supabase secrets set SPECIES_COMPARISON_GENERATE=apps_only`
  (deploy the function by name only, per the release-3.2 note).
- The web maps a non-OK answer to `null` → `502 generation_failed`, which the
  generating screen already shows as "didn't finish"; with the web flag off it
  never gets that far.
- Suggested default for the apps: `apps_only` while the apps' own comparison
  spend is reviewed on `/admin/ai-spend` (area "Comparisons").

## Turning the web back on

Set `COMPARISONS_GENERATE=on` in `/opt/animaldex/shared/app.env` and redeploy.
The old protections (sign-in, intent token, same-origin, bot UA, 5/hour per
IP, `COMPARISON_USER_DAILY_LIMIT` 5, `COMPARISON_DAILY_GENERATION_LIMIT` 40)
all still apply behind the flag.
