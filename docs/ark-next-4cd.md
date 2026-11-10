# Ark next, Parts 4c and 4d: share links and SEO (summary)

Branch `ark-seo`, from `origin/ark-life-web-v2`. Plan: AnimalDex `docs/ark-next.md`, Part 4. It builds on the `/admin` audit (Part 4a, section 8 "SEO infrastructure").

Nothing here is deployed. No migration was applied, and no paid API was called.

## Before you merge

- **Ship it with life v2.** The new `/ark` copy describes Ark life v2: meals, young, old age, starvation, and 1 Ark year per 14 real days. On 2026-11-10, production answers `voyage_public_v2` with "missing" and only v1 is live. Merge this together with `ark-life-web-v2` and the server's life v2, not before.
- **The diet line is built but hidden.** `voyage_food_links` is not live: on 2026-11-10 production answers PGRST205. Species pages therefore show only the count and the link. When the table is applied, the line appears with the next daily rebuild. It is read with the service key, because the table is closed to anon and authenticated.
- **`ark_share` is a TODO.** Part 1's helper (`lib/ark-measure-client`, `trackArk`) is not on this branch. The TODO is in `ark-share.tsx`. The share links already carry `from=share`, which Part 1 reads as the source `share_link`.

## 4c. Share links

- **Share cards.** There is a new `ark` kind in the satori + sharp pipeline (`src/lib/og/og-cards.ts`, `src/lib/og/og-card.tsx`).
  - `/api/og/ark.png` shows the Ark: "N animals of M species aboard", with up to six of its most numerous species standing on the Ark's sand, each with its count.
  - `/api/og/ark/<slug>.png` shows one species: its icon, its name, and "1 aboard · needs a mate". A real species that is not aboard says "Not aboard yet". Anything that is not a real species slug returns 404, so the endpoint never renders arbitrary text.
  - Both are cached for 10 minutes (`max-age=600`, `stale-while-revalidate=3600`), because the counts are live. The metadata appends `?v=<count>`, so a scraper fetches a fresh card when the count changes.
- **Metadata.** `/ark` `generateMetadata` reads `searchParams.focus`. With `?focus=<species>`, the title is "The {animal} in the Ark", and OG and Twitter use that species' card. The canonical stays `/ark`, so focus links are never separate indexable pages.
- **Share buttons.** One sits on the tap card (labelled on desktop, icon only on a phone) and one in the population panel's header.
  - They use the Web Share API with a copy-link fallback, like the capture card's share. The "Link copied" note is portalled to `<body>`, because the band's blur would otherwise trap it.
  - Links look like `/ark?focus=<slug>&from=share` and `/ark?from=share`, with `/id/ark` on the Indonesian page.
  - The share words give counts and the species name only.

## 4d. SEO

### Google Search Console

**Not available locally.** `GOOGLE_SEARCH_CONSOLE_CREDENTIALS` is not in the landing repo's `.env` or `.env.local`; it is set only on the VM. No query was run, and no volumes are given here.

To get the numbers, run read-only on the VM through `src/app/api/admin/growth/_lib/search-console.ts`, with a POST to `searchAnalytics/query` on `sc-domain:animaldex.app`, for the last 90 days:
- `dimensions: ["query"]`, filtered with `query contains` simulation / simulator / "virtual animal" / ecosystem / "animal world".
- `dimensions: ["page","query"]`, filtered with `page contains /animals/`, `rowLimit 250`.

### `/ark`

- **Indexable.** Before, it was `noindex, nofollow`.
- **Server-rendered words under the world** (`ark/ark-about.tsx`):
  - what the Ark is
  - live counts
  - how animals arrive (a step that worked; what anyone talked about is never shown)
  - how stored diets and breeding drive it, "based on each animal's field guide", with the line that it is "a game based on each animal's field guide, not a scientific model"
  - every species aboard, by region, with its count, linked to its species page when that page exists
- **hreflang** for `en`, `id` and `x-default`. `/id/ark` is a real Indonesian page: the whole `ark` section of `id.json` was translated, so the Indonesian page has no English left.
- **Sitemap:** `/ark` and `/id/ark` are listed (`build-sitemap.ts`, with a test).
- **JSON-LD:** `VideoGame` (genre Simulation, a web browser game, free, `isPartOf` the AnimalDex `MobileApplication`) and a `BreadcrumbList`.

### Site-wide

- **Home page:**
  - One band, "A live animal world, built by steps that worked", with a link to `/ark`.
  - One added entry in the `MobileApplication` / `SoftwareApplication` `featureList`, one `about` Thing ("Animal world simulation"), and one sentence added to the schema description.
  - The existing positioning is untouched.
- **Meta (`en` + `id`):** one sentence added to the site description, and the keywords "animal world simulation", "virtual animal world", "animal ecosystem simulation" and "shared animal world" (plus their Indonesian equivalents).
- **How it works (the store-style description):** one paragraph in Your step, "When a step works, one of that animal's kind joins the Ark…", in `en` + `id`.
- **Robots:** unchanged. It already allows `/ark` and `/api/og`.

### Species pages: "In the Ark"

Built in `animals/[slug]/species-ark-section.tsx`, between "Where" and the quick facts. It shows:
- the count aboard, rendered on the server from the page's daily snapshot and refreshed in the browser from `/api/ark/voyage`
- the stored diet links in plain words ("Eats, by its field guide: …", "Eaten by: …"), only from `voyage_food_links` and hidden while that table is not live
- "See the {animal} in the Ark" → `/ark?focus=<slug>`, or "See the Ark" when none is aboard

A species with no Ark model (not in `voyage_species`) and none aboard gets no section, so a page never promises an animal can come aboard when it can't. All reads use the page's existing daily window, so there are no extra rebuilds.

## Before / after

Measured on the dev server's server-rendered HTML (`curl`), on 2026-11-10, against the live Ark (2 animals). Word count is the visible text outside script, style and svg.

| Page | Title | Description | H1 | Words | JSON-LD | Indexable |
|---|---|---|---|---|---|---|
| `/` before | AnimalDex: Take Any Idea to an Animal. Every Animal Has a Lesson | "Talk to animals about any idea… a new way of seeing." (188) | Talk to animals. / Take any idea to an animal. (A/B heroes) | 489 | Organization, WebSite, SoftwareApplication, MobileApplication | yes |
| `/` after | same | same + "Steps that work bring animals into the Ark, a shared animal world." (255) | same | 538 | same types; Ark feature + about added | yes |
| `/ark` before | The Ark \| AnimalDex | "One shared world of animals…" (103) | Every animal here came from a step that worked | 252 | none | **no** (noindex, nofollow; no hreflang) |
| `/ark` after | The Ark: A Live, Shared Animal World Simulation \| AnimalDex | "A live, shared 3D animal world… by rules based on its field guide." (154) | same | 560 | VideoGame, BreadcrumbList | **yes**; hreflang en/id/x-default; OG `/api/og/ark.png` |
| `/id/ark` before | The Ark \| AnimalDex | English | English | 242 | none | no |
| `/id/ark` after | Bahtera: Simulasi Dunia Hewan Bersama yang Hidup \| AnimalDex | Indonesian (165) | Setiap hewan di sini datang dari langkah yang berhasil | 512 | VideoGame, BreadcrumbList | yes |
| `/animals/komodo-dragon` | unchanged | unchanged | Komodo Dragon | 2210 → 2254 | unchanged | yes |
| `/animals/red-tailed-hawk` | unchanged | unchanged | Red-tailed Hawk | 1797 → 1841 | unchanged | yes |
| `/animals/gray-wolf` | unchanged | unchanged | Gray Wolf | 1707 → 1757 | unchanged | yes |

JSON-LD: every block parses, and the types and properties were checked against schema.org. `VideoGame` inherits from `SoftwareApplication` and `Game`. It has not been run through Google's Rich Results Test, which needs a public URL.

## Verification

- `tsc --noEmit`: clean.
- `next lint`: nothing new.
- `npm test`: 1763 tests pass (after rebasing onto 756322cc), including the new `src/lib/ark-seo.test.ts` (focus resolution, share URLs, card paths, diet-link mapping) and a sitemap test.
- Dev server: `curl` of `/ark`, `/ark?focus=komodo-dragon`, `/id/ark`, three species pages, `/sitemap.xml` and `/robots.txt`.
- The share cards were rendered and looked at:
  - the live Ark
  - the Komodo Dragon (aboard)
  - the Gray Wolf (not aboard)
  - a 47-species fixture, to check the six-species layout (a local render only)
- Share buttons were clicked in the browser on desktop and at 375 px: both paths (Web Share and copied link) produce the right URL and words. There is no horizontal scroll.

## Privacy

Only counts and species names appear anywhere: the page words, the cards, the share text and the JSON-LD. No bringer label, username, problem or chat.
