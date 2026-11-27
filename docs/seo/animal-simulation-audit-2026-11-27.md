# "Animal simulation" SEO audit (2026-11-27)

Audited production `https://animaldex.app` (landing main `8c7186b8`) fetched as Googlebot, the landing repo at
`bc2bf1f6`, and the search results for 30 queries around "animal simulation". Owner's rule for this pass: the home
page and the other main customer-facing pages stay visual, so no text was added to them.

## Verdict

The site did not cover the topic and does not rank for it.

- **No page said it.** "Animal simulation", "animal simulator", "wildlife simulation" and "simulation game" appeared
  on no public page, in no title, heading or description. The App Store listing is named **"AnimalDex: Animal
  Simulator"**, so the store sends people looking for an animal simulator to a site that never used the words.
- **No ranking seen.** animaldex.app appeared in none of the 30 topical searches, and `/ark` did not come back even in
  searches restricted to the domain. This is from a search tool, not Google itself (see Limits).
- **The gap is winnable in the long tail, not at the head.** "Animal simulator" is owned by Steam, the App Store, Poki
  and CrazyGames. Searches for a real-species or ecosystem simulation in a browser return thin pages: itch.io
  prototypes, a 72-word Netlify page, school PDFs.

## Limits

- **Search Console was not read.** Its credentials live only on the production VM, and reading it through the VM was
  blocked by the session's permission check. Nothing here is a measured Google position, impression or click.
- The search tool returns an unordered pool of links and ignores `site:`. Its results are indicative only.
- No search volumes are given, because none were measured.

## 1. Coverage before this pass

Counts of each word in the visible, server-rendered text (fetched as Googlebot, 2026-11-27).

| Page | Title | Words | "simulat…" | "ecosystem" | "food chain" | "predator" |
|---|---|---|---|---|---|---|
| `/` | AnimalDex: Catch Real Animals as AI Companions in a 3D World | 561 | 0 | 0 | 2 | 0 |
| `/ark` | AnimalDex Ark: a live 3D world of real animals | 3,809 | 3 | 0 | 1 | 1 |
| `/ark/how-it-works` | How the Ark Works: Food Chains, Breeding, Seasons | 1,861 | 0 | 0 | 2 | 5 |
| `/ark/food-chain` | The Ark's Food Chain: Who Eats Whom | 719 | 0 | 0 | 1 | 3 |
| `/about` | About AnimalDex: A Living Research World of Animals | 576 | 1 | 0 | 1 | 0 |
| `/tier-list/ark-survival` | Ark Survival: Who Lives and Who Dies in the Ark | 12,090 | 0 | 0 | 0 | 3 |
| `/tier-list/ark-fastest-breeders` | Ark Fastest Breeders: Which Animals Have the Most Young | 4,489 | 0 | 0 | 0 | 0 |

- `/ark` had "Simulation" in its title until 14 Nov (`b71b15fc`), when the title became the brand name "AnimalDex
  Ark". That was deliberate (people search "AnimalDex Ark"), so the title is left alone.
- The only places the topic was declared were invisible: `/ark`'s schema topics ("Ecosystem simulation") and two meta
  keyword entries on the Ark ranking pages.
- The blog has 132 posts and none is about a simulation.
- `/animal-simulation` and `/animal-simulator` returned 404.

## 2. What already works

| Check | State |
|---|---|
| `/ark` indexable | `index, follow`, self canonical, `en` / `id` / `x-default` alternates |
| `/ark` weight | 433 KB of HTML (5.2 MB on 12 Nov), first byte in 1.9 s |
| `/ark` schema | `WebApplication`, `EducationalApplication`, free, with ecology topics. No longer `VideoGame` |
| Sitemap | Index of sections; `/sitemaps/ark.xml` lists `/ark`, how it works, food chain and about |
| Navigation | The Ark is in the header and the footer; every page links `/ark`, how it works and the food chain |
| robots.txt | Allows everything public. `/api/` is disallowed, so Google's renderer cannot load the live scene data; the text under the world is server-rendered, so this costs nothing |

## 3. Who ranks, by kind of search

From the search tool (indicative). animaldex.app appeared in none.

| Searches | What comes back | Intent | Realistic for us? |
|---|---|---|---|
| animal simulation, animal simulator, animal simulation game, animal life simulator | Steam "Animal Simulator", App Store "Animal Simulator: Pet Games 3D", itch.io, PC Gamer, Roblox, Poki | Play as an animal | Not soon |
| animal simulator online, animal simulation online free, 3D animal simulation browser | Poki (13 URLs for one query), CrazyGames, itch.io. "3D animal simulation browser" is led by animal-cell anatomy models and a 2004 PDF | Play now, no download | Long tail only |
| wildlife simulation, wildlife simulator, realistic animal simulation | WolfQuest, itch.io alphas, university theses and graphics papers | Mixed game and research | Yes: weak first pages |
| ecosystem simulation, ecosystem simulator online, animal ecosystem simulation game, predator prey simulation | Wikipedia, NetLogo, Wolfram, Steam "Ecosystem", EcoBuilder, a 72-word Netlify page, itch.io prototypes | Educational model, or a game to watch | Yes: the closest match to the Ark |
| virtual animal world, virtual zoo online | Wikipedia mirrors, Webkinz, zoo webcam lists | Virtual pets, webcams | Weak match |

Pages that rank for the game searches are short (under 400 words) and win on an exact-match name, being playable, and
`VideoGame` schema with ratings. The ecosystem pages that surface have no description, no FAQ and made-up species. No
result offered real species in a browser.

## 4. Off the site

- **App Store:** "AnimalDex: Animal Simulator", subtitle "Catch, collect & talk to them"; the release notes say "a
  shared 3D wildlife simulation".
- **Google Play:** still "AnimalDex: Talk to Animals".
- **"AnimalDex Ark" as a search** collides with ARK: Survival (Dododex, the ARK wiki).
- **The landing repo is public** (`ghostseedio/animaldex_landing`). Its pull requests came back in searches for the
  Ark's own description, alongside the home page.

## 5. Changed in this pass

Nothing was added to the home page, `/ark`, the footer or the species pages.

| Change | Where |
|---|---|
| New page `/animal-simulation` (and `/id/animal-simulation`): what the simulation is, what it runs, how it differs from play-as-an-animal games, six questions | `src/components/seo/simulation-page.tsx`, `src/app/[locale]/(composited)/animal-simulation/` |
| New page `/ecosystem-simulation` (and `/id/…`): the food web, predators and prey, populations, background food, why there are no sliders, six questions | same component, `…/ecosystem-simulation/` |
| Both pages show the Ark's live figures (animals, species, people; births, arrivals, meals and deaths in the last 24 hours), a real render of the world that opens `/ark`, and `FAQPage`, `BreadcrumbList` and `WebPage` schema whose main entity is the Ark | `src/lib/seo/simulation-pages.ts` |
| Both pages in the Ark sitemap, English and Indonesian | `src/lib/build-sitemap.ts`, `src/lib/sitemap-sections.ts` |
| Internal links to them from two text pages | `/about` ("Go further"), `/ark/food-chain` ("How the links are made") |
| `/ark/how-it-works` meta description now says "animal simulation" (metadata only) | `pages.howItWorks.metaDescription`, en and id |
| The Ark's schema topics gain "Animal simulation" (invisible) | `ARK_TOPICS` in `src/lib/seo/structured-data.ts` |
| Tests: the phrases are in title, h1, description and intro; lengths fit a result; Indonesian matches English key for key; both pages are in the sitemap; the home page and `/ark` import none of it | `src/lib/seo/simulation-pages.test.ts` |

Every rule the pages state is one `/ark/how-it-works` already states. Both say plainly that the Ark is not a
scientific model and that nobody plays or controls an animal.

## 6. Decisions

| # | Question | Choice | Why |
|---|---|---|---|
| S1 | Put the words on `/ark`, or on pages of their own? | Pages of their own | Owner: the home page and main pages stay visual. `/ark` also holds the brand search |
| S2 | One page or two? | Two | "Animal simulation" (watch real animals) and "ecosystem simulation" (food web, predators, populations) are different searches with different results pages |
| S3 | Call it a "simulator"? | Use "simulation" in titles and h1s; answer "simulator" in the body and the questions | People search both, and the App Store name is "Animal Simulator", but nobody controls anything, so the pages say that |
| S4 | Add a footer link? | No | The footer is capped at 16 links by test, by the owner's cut on 1 Nov. See 7.2 |
| S5 | Show the population chart? | No | The event-log series ended at 3,623 while the live count said 3,986 on the same page |
| S6 | Read the event log during the build? | No | It is a long read on a cold process; the pages gain the last-day figures at their first hourly refresh |
| S7 | Which sitewide link (owner: "do whatever you recommend", 27 Nov)? | One small text link, "About this animal simulation", in the species pages' "In the Ark" block | It reaches about 2,300 pages that already talk about the Ark, adds four words, and leaves the footer cap and the home page alone |
| S8 | `/ark` search description? | "...is a live 3D animal simulation: ..." (en), "...adalah simulasi hewan 3D yang hidup: ..." (id), slogan kept first | Invisible on the page; the brand title "AnimalDex Ark" stays as it is |
| S9 | Supporting articles: how many, from what? | Two: simulation vs simulator, and a food web simulation read from 14 hours of the Ark's public log (26 Nov 2026) | Each figure is dated, so it stays true after the Ark moves on. A third (a real-species browser simulation) would repeat `/animal-simulation` |
| S10 | Make the blog's tables fit a phone? | No | All 72 blog tables share one style that scrolls sideways inside its box; changing it is a layout change for every post, not this ticket |

## 7. Still to do

1. **Read Search Console** (needs the owner, or permission to query it through the VM). Filter queries with
   `simulat|ecosystem|food (chain|web)|predator|virtual (zoo|world)|wildlife sim`, for 28 days and 16 months, with
   the page beside each query. Inspect `/ark` for its index status and Google's chosen canonical. Request indexing of
   the two new URLs.
2. ~~One sitewide link~~ **Done 27 Nov (S7):** "About this animal simulation" in the species pages' "In the Ark" block.
3. ~~`/ark` meta description~~ **Done 27 Nov (S8):** it now says "live 3D animal simulation" in English and Indonesian.
4. ~~Supporting articles~~ **Done 27 Nov (S9):** `/blog/animal-simulation-vs-animal-simulator-games` and
   `/blog/food-web-simulation-real-species`, both linking to the two pages and to `/ark`.
5. **A short clip of the Ark** on both pages, listed in the video sitemap. Game searches show video results.
6. **Google Play name** does not match the App Store's (store matter, owner decides).
7. **The public repo** (owner decides): make it private, or accept that its pull requests are indexed.
8. **Measure** four weeks after deploy: impressions and position for the query filter in 1, per page.
