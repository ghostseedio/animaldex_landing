# Lost from the Ark: contract (2026-11-15)

Owner, 2026-11-15: "can we show recently extinct species too somewhere", then "should show in app too somehow".

A species is **lost** when voyage-world removes its last animal and logs `voyage_events.kind = 'extinction'`
(payload `{cause, lastAnimalId}`). It comes **back** when a capture brings one aboard again (3.3). Two so far:
Green Peach Aphid (Ark day 95, 12 Nov) and Common Water Flea (Ark day 117, 13 Nov), both of old age.

Truthful only: list a species only because the server logged it; say "Back aboard" only while `back_aboard` is true
(a living animal of the species exists now); say how the last one went only from `cause` / `eaten_by`. When the read is
missing or fails, show nothing (never an empty "Lost" header, never a guess).

## 1. The read

`voyage_extinctions_v1(p_voyage text = 'first', p_limit int = 50)` — AnimalDex
`supabase/migrations/20261124100000_voyage_extinctions.sql` (rollback in `supabase/rollbacks/`). Anon SECURITY
DEFINER, `GRANT EXECUTE` to anon/authenticated/service_role. **Not applied yet**: rehearsed only
(`db-migrate.sh rehearse 20261124100000`, 2026-11-15: 2 rows, as above). Until applied every surface hides the section.

```json
{
  "extinctions": [
    {
      "species_profile_id": "a9257dd9-0baa-45a3-b3f0-4846577b6ce9",
      "name": "Common Water Flea",
      "scientific_name": "Daphnia pulex",
      "model_slug": "common-water-flea",
      "page_slug": "common-water-flea",
      "ark_day": 117,
      "at": "2026-11-13T12:07:12Z",
      "cause": "died_old",
      "eaten_by": null,
      "aboard": 0,
      "back_aboard": false
    }
  ],
  "as_of": "2026-11-15T02:04:17Z"
}
```

- One row per species (its newest extinction), newest first, at most `p_limit` (1..200).
- `cause`: `died_old` | `eaten` | `starved` | null. `eaten_by` `{species_profile_id, name, model_slug}` only for `eaten`
  (the eater of the last one, from its `eaten` row), else null.
- `model_slug`: the icon, `animals/<model_slug>.webp` in the public `animals` bucket (missing art: the generic figure).
- `page_slug`: `species_profiles.landing_page_slug`. Through the web route it is null unless the web has that page.
- Never a user, owner, bringer or step id.

Web route: `GET /api/ark/extinct` → the same fields plus `available` (`false` + `[]` until the function exists or when
the read fails). Cached 60 s at the edge. Decoder and words: landing `src/lib/ark-extinct.ts`.

Apps can call the RPC directly with the anon key (PostgREST `POST /rest/v1/rpc/voyage_extinctions_v1`,
`{"p_voyage":"first"}`) or the web route; a 404 / PGRST202 means "not yet": hide.

## 2. The embed (apps get this with no native work)

`/ark/embed.html?hud=1` (what both apps load) now draws **Lost from the Ark** under the bars' living list: one folded
line "Lost from the Ark · 2 ▾" that opens to the rows (greyed icon, name, "Extinct on Ark day 117 · 13 Nov", how the
last one went, a lime "Back aboard" tag). It appears only once `/api/ark/extinct` answers with at least one species.
Words come from `/api/ark/words` (`ark.lost`), all 45 Ark languages.

Messages (same channels as the rest: `webkit.messageHandlers.ark`, `window.AndroidArk.postMessage`, parent frame):

| Direction | Message |
|---|---|
| host → page | `{type: "ark:extinct"}` — ask for the list |
| page → host | `{type: "ark:extinct", available, extinctions: [...]}` — the read's rows exactly as in §1 (snake_case) |
| page → host | `{type: "ark:open-species", species_profile_id, page_slug, name}` — a lost row was tapped |

An app that does not handle `ark:open-species` yet: the tap does nothing (the row still shows everything). With no host
(the page opened on its own) the page goes to `/animals/<page_slug>`.

## 3. Where it should appear natively (for the iOS / Android lanes)

Not built natively yet. Suggested, in priority order:

1. **Handle `ark:open-species`** (smallest win): open that species' species/catalog view by `species_profile_id`
   (iOS: the same route the Ark card's species link uses in `AnimalDex/Views/Ark/ArkPanelViews.swift` /
   `ArkRuntimeBridge.swift`; Android: `feature/ark/ArkRuntime.kt` message switch → the species screen).
2. **Species / card views**: when the species is in the list and `back_aboard` is false, one line under its Ark count:
   "Extinct on the Ark since Ark day 117 · 13 Nov." + "Last one died of old age." + a "Catch one to bring it back"
   button that opens the camera (capture). When `back_aboard` is true: a small "Back aboard" tag and
   "Back aboard: it died out on Ark day 117 · 13 Nov." Read once per screen (RPC or `ark:extinct`), never cached as
   truth for longer than a few minutes.
3. **Native Ark chrome** (if the panel ever gets a native species list): a "Lost from the Ark" section after the living
   list, newest first, as the embed draws it; a row opens the species view.

Words: `ark.lost` in landing `src/data/locales/en.json` (and `id.json`, `ark/*.json`), keys `title, intro, when, back,
diedOld, eatenBy, eaten, starved, speciesLine, speciesBack, notAboard, bringBack, listLabel`; `{day}` is the whole Ark
day, `{date}` the UTC day and short month in the reader's locale, `{animal}` a species name. Copy them into the app
catalogs rather than re-translating.

## 4. Web surfaces (landing branch `ark-extinct`)

- `/ark`: the population overlay's panel (`ark-population-hud.tsx` → `ark-lost-list.tsx`), folded line after the living
  list; a row links to `/animals/<page_slug>`. Counts elsewhere unchanged.
- Species pages: "In the Ark" (`species-ark-section.tsx` → `species-ark-lost.tsx`): the line, how the last one went,
  and "Catch one to bring it back" (the page's app link, placement `species_card`); re-checked in the browser so a
  return shows "Back aboard" without waiting for the daily rebuild. The count line says "No {animal} is aboard now."
  instead of "…yet" for a lost species.
- Home Ark band: skipped (the band is picture-first with no paragraph by design, CC 3; a line would be clutter).
