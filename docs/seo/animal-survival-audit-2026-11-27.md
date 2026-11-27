# "Animal survival" SEO audit, 27 November 2026

Owner's request: "do 'animal survival' too", after the "animal simulation" audit
(`docs/seo/animal-simulation-audit-2026-11-27.md`), with the same rule: the home page, `/ark` and other main pages
stay visual, so the words go on pages of their own, in metadata and in posts.

## Verdict

Before this pass no page on animaldex.app said "animal survival". In 31 searches about animal survival, no
animaldex.app page came back. The site has survival content (12 blog posts on how particular animals survive, and the
Ark's live survival ranking), but nothing tied it to the phrase. The ranking's title led with "Ark Survival", a phrase
that belongs to the game ARK: Survival Evolved.

## Limits

- Rankings were read with a search tool, not Google; the `site:` operator was ignored, so absence from these results
  does not prove a page is missing from Google's index. Search Console still cannot be read (see the simulation audit,
  §7.1).
- Figures quoted in the new post are the survival ranking's, read on 27 November 2026 at 05:45 UTC.

## 1. Coverage before this pass

| Page | Indexed | Says "animal survival" | Notes |
|---|---|---|---|
| `/tier-list/ark-survival` | yes | no | Title "Ark Survival: Who Lives and Who Dies in the Ark"; 12,077 words, 879 KB; real live data |
| `/ark/endangered` | no (noindex, deliberate) | no | 148 words |
| 12 posts, e.g. `/blog/how-tigers-survive-as-solo-apex-hunters`, `/blog/what-is-the-most-resilient-animal` | yes | no | One animal each; no hub links them |
| `/qualities` | yes | no | A "Survival" category among qualities |
| Home, `/ark` | yes | no | Untouched on purpose |

## 2. Who ranks, by kind of search

| Cluster | Examples | Held by | Opening |
|---|---|---|---|
| Learn how animals survive | how do animals survive, survival strategies, adaptations, winter, extreme conditions | National Geographic, NPS, FWS, NWF, Britannica, IFAW, PBS | Low: strong educational sites |
| Play a survival game | animal survival game / simulator, online, no download | Steam, App Store, Epic, CrazyGames, itch.io (small indie titles) | Low, and the wrong intent: nobody plays as an animal in the Ark |
| Data and rankings | animal survival rate, best survival rate, which animals survive longest, survival tier list, apocalypse | Thin listicles, TierMaker templates, game fan lists; the tool found no survival figures | **High: the Ark has real figures** |
| Simulation | animal / ecosystem / predator-prey survival simulation | NetLogo, Wolfram, theses and PDFs, indie games | **High: no live model with real species** |
| Brand + Ark | ark survival, animaldex ark survival | ARK: Survival Evolved, its wikis, Dododex | None: the game owns "Ark survival" |

The closest competitors to what the Ark offers: The Great Circle (a game with 75+ species), EcoBuilder (Imperial
College, real models, made-up species), the Wolfram and NetLogo predator-prey demos, and Animalia Survival (real
African species, played). None has live survival data for real species.

## 3. Changed in this pass

- **`/animal-survival`** (en + id), in the simulation-page set (`src/components/seo/simulation-page.tsx`,
  `pages.animalSurvival`). It shows the Ark's counts and the last 7 days from the survival ranking's own hourly report:
  share alive or recovering, deaths by cause, the safest place, and the six vertebrate species closest to the end,
  each opening the Ark on it. Below that: what decides survival, hunts that fail, old age, hearts, species in danger and
  rescue, links to the 7 per-animal survival posts, "watched, not played", and "not a scientific model". Six questions
  with FAQ schema. Rendered on its first request, never in the build, and cached an hour. In the Ark sitemap.
- **`/blog/animal-survival-rates-real-species`**: one week of the Ark's survival record, place by place (farms 100%,
  zoo 98.6%, homes 98%, wild island 79.2%, town wildlife 63.7%) and cause by cause (old age 1,318 deaths, predators
  81, hunger 6), every figure dated 27 November 2026.
- **`/tier-list/ark-survival` search title and description** (en + id): "Animal Survival Tier List: Who Lives, Who
  Dies". The visible heading is unchanged. Keywords add "animal survival tier list", "animal survival rate".
- **Links:** `/animal-simulation` and `/ecosystem-simulation` link to `/animal-survival` (closing links, and the
  ecosystem page's populations section); the food-web post links to it.
- Not changed: home, `/ark`, footer, species pages (they already carry one simulation link), the 12 survival posts.

## 4. Decisions

| # | Question | Choice | Why |
|---|---|---|---|
| V1 | A new page, or retitle the survival ranking? | Both: a topic page, and the ranking's search title | The ranking answers "survival tier list / rate"; the topic page answers "animal survival" and the simulation searches, and links both ways |
| V2 | Chase "how do animals survive"? | No new post for it | National Geographic, NPS, FWS and Britannica hold it. The page lists the 12 existing per-animal posts instead (7 linked) |
| V3 | Chase "animal survival game"? | Answer it honestly in a question, never claim a game | Nobody plays as an animal in the Ark; the page says "watched, not played" |
| V4 | Show the week live, or quote fixed numbers on the page? | Live, from the ranking's report | The page stays true every hour; the post carries the dated figures |
| V5 | Render `/animal-survival` in the build? | No, on first request | Its figures need the event log, which the build may not read (the tier list does the same) |
| V6 | Describe hearts exactly? | Only "an animal with a heart left can recover and come back" | The realism lane is changing when hearts return (old age to be final); the general sentence stays true |
| V7 | Change the ranking's visible heading "Ark Survival: Who Lives and Who Doesn't"? | No | Visible text on a main ranking page; the search title carries the phrase |

## 5. Still to do

1. **Search Console** (owner): add `surviv` to the query filter in the simulation audit's §7.1.
2. **Measure** four weeks after deploy: impressions for "animal survival", "survival rate", "survival tier list",
   "survival simulation", per page.
3. **Refresh the post** when the week looks different (hunting began only around 25 November): a new dated week, not
   an edit of the old figures.
