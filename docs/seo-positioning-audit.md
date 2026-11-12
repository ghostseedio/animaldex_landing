# SEO and positioning audit (lane S1, 2026-11-12)

Audited against production `https://animaldex.app` running landing main `970b0461`, the iOS app on `/Users/lennybeadle/AnimalDex` main, the Android app on `/Users/lennybeadle/AnimalDex-android` main, the ASO packages in `~/Documents/animaldex/` (`app-store-3.1`, 2026-10-24; `app-store-3.2` and `google-play-3.2`, 2026-11-07), and the store listings live on 2026-11-12 (App Store 3.2, Google Play 3.1). The draft store listings are in `docs/store-listing-draft-2026-11.md`.

**The new positioning (owner, 2026-11-12)**

- Tagline: "Catch animals in real life and turn them into AI companions in a 3D world".
- AnimalDex is a living research world, not a gamified video game. It is a shared simulation of animal species where populations change over time through food chains and ecosystems. People understand nature from the animals' points of view and their stories, through the AI chat.
- Honesty: the world is built from each animal's field guide. Never call it scientifically accurate. Make no claims about population sizes or real-world science that the data doesn't support.

Sections: 1 Website positioning · 2 Design (old vs current) · 3 Technical SEO · 4 Keywords · 5 Apps and store listings · Decisions.

---

## 1. Website positioning

### 1.1 The short version

The site is not mainly a *game* problem. Its front door is an **advice product**: "Take any idea to an animal", "Every animal has a lesson", "Should I take the promotion?", "Start a podcast". That framing runs through the home page, the metadata, the share card, the header, How it works and both store listings. The new positioning is a **world**: you catch real animals, they become AI companions, and they live in a shared 3D simulation whose food chains and populations change over time. You learn about nature from the animals' own points of view. Today the Ark is the fourth block on the home page, one text paragraph with a ghost button, and it is missing from the header, the footer, How it works, the home page's structured data headline and every share card except its own.

Game language survives in about twenty SEO landing pages and in two places that matter more: the Ark's structured data says it is a `VideoGame`, and the Ark's own honesty note calls it "a game".

### 1.2 What contradicts the new positioning (quoted, with file and line)

Paths are relative to the landing repo `src/`. `en.json` is `src/data/locales/en.json`; the Indonesian strings in `id.json` mirror every one of these.

**The front door is an advice product, not a world**

| Where | String | Problem |
|---|---|---|
| `en.json:2474` (`meta.fullTitle`), the home `<title>` and `og:title` | "AnimalDex: Take Any Idea to an Animal. Every Animal Has a Lesson" | Advice framing. It never mentions catching, companions, a world or 3D. |
| `en.json:2476` (`meta.description`), the default description on every page without its own | "Talk to animals about any idea, plan or decision and get a genuinely different take…" (255 chars) | The same framing. The Ark is the last clause. It is also too long (see 3.1). |
| `en.json:2483`ff (`meta.keywords`), sent on every page that has none of its own (`/ark`, `/talk`, `/animals`, `/how-it-works`) | "take any idea to an animal, …advice fatigue, AI that disagrees with you, perspective-driven AI, …" | It tells crawlers the site is about advice. Google ignores the tag, but other engines and tools don't, and it shows the drift. |
| `en.json:95–96` (hero A H1) | "Talk to animals." / "Every animal has a lesson." | The lesson framing. The H1 never says catch, companion or world. |
| `en.json:383` (hero B H1) | "Take any idea to an animal." | Pure advice. |
| `en.json:102` (`home.supporting`, the WebSite schema description) | "Take any idea to an animal for a genuinely different take. Every animal has a lesson…" | The same. |
| `en.json:369` (hero A bubble) | "Don't push harder. Reach in another way." | A coaching line. |
| `en.json:342` (H2) | "Two animals. Two lessons." over "Should I take the promotion?" | An advice demo. It reads as an AI-assistant site. |
| `en.json:378` (`home.flow.grow`) and `:113` | "Earn its Power" / "Do the step, and its Power is yours." | Self-improvement framing. |
| `en.json:218` (download band) | "Meet them all." | Collection framing (it is the old "Collect 'em all" in a softer form). |
| `app/[locale]/(composited)/(home)/page.tsx:119` (`appSchemaDescription`, the SoftwareApplication and MobileApplication schema) | "Take any idea, plan or decision to an animal and get a genuinely different take… Steps that work bring animals into the Ark" | The Ark is a reward for advice, not the product. |
| `page.tsx:203–208` (schema `audience`) | "People with an idea, a plan or a decision", "Curious minds who want a different take" | It tells Google the audience is advice seekers. |
| `app/[locale]/layout.tsx:24–26` and `page.tsx:100` (default share card for every page without its own) | `/images/og-every-animal-has-a-lesson.png`: "TALK TO ANIMALS. EVERY ANIMAL HAS A LESSON." with an owl and a cheetah answering "Should I take the promotion?" | Every shared link to the home page, and to any page without its own card, shows an advice chat. |
| `data/how-it-works.ts:50` | "How AnimalDex works: every animal has a lesson" | How it works never mentions the Ark. Its H2s are "Six things every animal does", "From a photo to a Power", "Safety comes first", "Bring an animal a real problem". |
| `data/public-navigation.ts:116` and `(composited)/_components/header.tsx:31` | Header: "Find your animals" (→ `/what-animal-am-i`, a personality quiz), "Sign in", "Get the app", "Talk to an animal" | **No Ark in the header.** "Find your animals" goes to a quiz, not to the world. |
| `data/public-navigation.ts:135–152` (footer) | Talk to an animal · Find your animals · Get the app · How it works / Browse animals · Side by side · Animal tier lists · Animal hybrids / Help center · Contact · Articles | **No Ark in the footer.** Of the 50 public pages I fetched, only the home page and the species pages (one `/ark?focus=` link each) link to `/ark`. |
| `data/advice-fatigue.ts` (whole article, featured first on the home bento, `page.tsx:156`) | "Advice fatigue: why agreeable AI leaves you stuck…" | The home page's lead article is about AI advice. |

**Game language on the Ark itself**

| Where | String | Problem |
|---|---|---|
| `app/[locale]/(composited)/ark/page.tsx:191–207` (JSON-LD) | `"@type": "VideoGame"`, `genre: ["Simulation"]`, `applicationCategory: "GameApplication"` | It tells Google the Ark is a video game, the one thing the owner says it is not. Use `WebApplication` (or `SoftwareApplication`) with `applicationCategory: "EducationalApplication"` / `"ReferenceApplication"`, plus `about` for the ecology topics. |
| `en.json:4384` (`ark.seo.lifeNote`, crawlable text on /ark) | "The rules are simplified so that a small shared world can run. The Ark is a game based on each animal's field guide, not a scientific model." | The honesty is right; the word "game" is wrong. Suggested: "The rules are simplified so a small shared world can run. The Ark is a simulation built from each animal's field guide, not a scientific model." |
| `en.json:4029` (`/ark` H1, also the LCP element) | "Captures bring them aboard. Steps keep them thriving." | It frames the world around the advice loop ("steps"). It should say what the world is: animals living, eating and raising young. |
| `en.json:447–448` (home Ark block) | "A live animal world, filled by captures… Steps that work keep yours thriving." | The same. It is good copy otherwise; this is the block to promote to the hero. |
| App Store category (live, see 5.2) | Education · **Games · Adventure** | The secondary category puts the app in Games. |

**Game language in SEO landing pages** (crawlable, in the sitemap, ranking for something)

| Page | String (source) |
|---|---|
| `/comparisons` | Title "Compare Any Two Animals — Who Would Win?" (`en.json:1832`) |
| `/videos` | Title "Animal Videos: Battles, Rankings and Wild Facts in Under a Minute" (`app/[locale]/(composited)/videos/page.tsx:18`); "Comparison battle", "Cuttlefish vs Octopus: Battle of the Ocean Geniuses" |
| `/animal-collection-game` | "AnimalDex is an animal collection game where real sightings become collectible progress… set-completion goals" (`data/collector-pages.ts:20`) |
| `/top-trumps-animal-game` | "AnimalDex is a Top Trumps-style animal game experience with card-style comparison energy, progression mechanics…" (`data/collector-pages.ts:107`) |
| `/use-cases` | "Species collecting game with animal debates and trading", "for users who want a game with stakes" (`data/use-cases.ts:396`) |
| `/animal-collection-app` | "Is AnimalDex an animal card game or a learning app? It is both. AnimalDex keeps a premium card-game feel…" (`data/answer-pages.ts:381`) |
| `/capture-animals-app` | "…mixed with a collection game", "game-style stats", "S-tier captures… Some are legendary" (`data/blog/capture-animals-app.ts:111`) |
| `/legendary-earth-beasts` | Title "…& S-Tier AnimalDex Captures"; H2 "Real species. Mythic places. S-tier captures." (`legendary-earth-beasts/page.tsx:116`) |
| `/advice-fatigue` | "AnimalDex is a coaching engine disguised as a collection game." (`data/advice-fatigue.ts:221`), "This is why AnimalDex is also a collection game." (`:243`) |
| `/tier-list` | "Animal Tier List: Fastest, Strongest & Smartest Animals" (`rankings/page.tsx:86`, `en.json:505`) |
| `/pokemon-like-animal-game`, `/pokemon-like-animal-app`, `/pokemon-animals` | Pokémon framing. The first already turns it ("AnimalDex is something else: take any idea to a real animal…"), but it turns to advice, not to the world. |
| `/animal-card-collection`, `/animal-card-deck-creator`, `/custom-animal-card-deck`, `/sell-custom-animal-cards`, `/animal-breed-price-estimator`, `/animal-breed-grading-app` | Cards, decks, grading and pet prices: products the app no longer leads with. |
| `/earn-on-animaldex`, `/creator-rewards`, `/support` | "Capture XP", "debate wins", "+5 XP", "Capture Level" |

My recommendation (decision D3): **don't delete or redirect these pages before the Search Console export arrives** (section 4). Some of them are probably the site's best traffic. Change their first paragraph and title tail so a searcher who lands there learns what AnimalDex is now, and remove claims the app no longer makes (battles, trading, grading, selling decks).

**Honesty risks** (claims the data may not support)

| Where | String | Risk |
|---|---|---|
| `animal-frequencies/animal-frequencies-view.tsx:49` | Title "Animal Frequencies: The Science Behind Animal Behaviour Rhythms and Signatures" | "The science behind" claims scientific grounding for an AnimalDex construct. |
| `en.json:4378` (`ark.seo.liveCounts`) | "Its world has seven regions, from the open ocean to the polar ice." | The Ark now has two islands (the wild island and the town and zoo). Check that "seven regions" is still true after world v2 before it is repeated anywhere new. |
| Brief wording to avoid | "real food chains", "populations evolve" | The food links come from each species' field guide, and the population is whatever players have photographed. On 2026-11-12 the /ark share card's top species aboard were Domestic Cat 309, Domestic Dog 262, Domestic Chicken 88, House Fly 60, Common House Gecko 36, Domestic Horse 32. Say "food chains drawn from each animal's field guide" and "populations that rise and fall as animals eat, breed and age". Never compare Ark numbers with real-world populations, and never imply the mix reflects nature. |
| Every new claim that the world "changes over time" | | Make it only for what is switched on in production when the copy ships. Ask the owner to confirm the ecology flags: the world tick, thrive, capture arrivals, `hunting = 'encounter'`, and whether the 10-minute tick cron is applied (`ark-release-deploy-state` says it still needs owner approval). If the world only advances when it is read, say "the world moves on between your visits", not "every minute". |

### 1.3 What is missing

1. **The tagline itself.** "Catch animals in real life and turn them into AI companions in a 3D world" appears nowhere on the site. No page says "companion" in an H1 or title (the only "companion" uses are the app's internal bond copy).
2. **The 3D world on the home page.** There is no image, no loop and no live count on the home page. The live /ark has real numbers to show ("3,152 animals of 953 species aboard, brought by 647 founders" on 2026-11-12), and the home page shows none of them.
3. **The animals' point of view as the learning promise.** The site promises "a lesson" for your life, not understanding nature through the animal's eyes. Species pages are titled "Facts, Meaning & Symbolism" (`animals/[slug]/page.tsx:116`); symbolism is the opposite of a field-guide point of view.
4. **"Living research world" language.** Nothing describes the Ark as a place to watch and study: what happened today, who ate whom, which populations grew. The /ark copy explains the rules well (`ark.seo.lifeBody`, `lifeRules`) but not why a curious person would come back.
5. **Stories.** The Ark has life stories and founders' stories (the `public_story` work), but no page or section surfaces "an animal's story" as content.
6. **The field-guide honesty line in the marketing.** It appears only at the bottom of /ark. One short line belongs on the home page and in the store listings: "Built from each animal's field guide. Simplified, not a scientific model."
7. **An Ark entry in the navigation, the footer, How it works and the sitemap's priority pages.** `/ark` is in the sitemap (third URL) but has no `lastmod` and almost no internal links pointing to it.

### 1.4 What already fits (keep it)

- `/ark` metadata: "The Ark: A Live, Shared Animal World Simulation" / "A live, shared 3D animal world. Animals come aboard with people's captures, then eat, raise young and grow old by rules based on their field guides." (`en.json` `ark.seo.metaTitle/metaDescription`). This is honest and close to the new positioning. Only the H1 and "game" need changing.
- `ark.seo.lifeRules` and `lifeBody`: concrete and honest about how predation, breeding and ageing work.
- The AI disclosure on the home page ("The animals are AI. Replies are AI-generated.") and the store listing's "characters built from real natural history, not real animals speaking". Keep both everywhere.
- The capture-first truth: animals come from real photos you take, and wild sightings stand apart from zoo, farm and pet ones.

---

## 2. Design: the old landing (2026-10-13) against the current one

**Method.** The old landing is main `964f6b49` (2026-10-13 04:29 +0700, the last main commit on or before 2026-10-15). I ran it in a worktree with `next dev` and no environment variables, so its three live counters render as "—" (on production they showed real numbers). The current landing is production (`970b0461`), shot with `?hero=a` and `?hero=b` because the home page is running a 50/50 hero test (`src/lib/hero-variant.ts`). All shots are headless Chromium in dark mode: desktop 1440×900 at 1×, phone 390×844 at 2×.

| | |
|---|---|
| Desktop, first screen: old (left) and current hero A (right) | ![](seo-audit/design-desktop-fold-old-vs-current-a.jpg) |
| Phone, first screen: old, current A, current B | ![](seo-audit/design-mobile-fold-old-vs-current-a-b.jpg) |
| Desktop, whole page at the same scale: old (left, 7,793 px) and current A (right, 4,842 px) | ![](seo-audit/design-desktop-full-old-vs-current-a.jpg) |

Single shots: `seo-audit/old-2026-10-13-home-desktop-fold.jpg`, `seo-audit/current-home-hero-a-desktop-fold.jpg`, `seo-audit/current-home-hero-b-desktop-fold.jpg`, `seo-audit/old-2026-10-13-home-mobile-full.jpg`, `seo-audit/current-home-hero-a-mobile-full.jpg`.

### 2.1 What made the old one feel crafted

1. **The product was the hero image.** The right half of the hero was a real 3D CSS phone: a chassis with a modelled side edge (`rotateY(90deg) translateZ(...)`), turned by scroll progress (`rotateY(-20 - p·10) rotateX(8 + p·6) rotateZ(8)`), with the real capture camera on screen (an Atlantic Puffin, the 1x/2x/5x zoom, the shutter). Five real UI cards floated around it at different depths: Field guide · Leopard Gecko, AI analysis · British Shorthair, Catalog, Pack builder, Scenario result (old `src/app/[locale]/(composited)/(home)/page.tsx` lines 398–416 and `_components/phone.tsx`). You could see what the app is before reading a word. The current hero shows cut-out species art floating on a glow, or two text boxes. Neither shows the app, the card or the 3D world.
2. **A typographic hierarchy with four distinct levels and a second voice.** In the old hero, "COLLECT THE" (5.5rem) sat over a huge photo-textured "WILD." (up to 11.5rem, `leading-[0.78]`), then "BUILD YOUR *ANIMAL**DEX*." in the **italic** condensed face, then a plain sentence-case paragraph in Inter at 18px (old page.tsx lines 317–333). The italic gave the brand a second voice. All eight italic faces were removed on 2026-11-01 (`src/app/fonts.ts` lines 17–31 now say "No 400 face or any italic is preloaded"), so every heading on the current page is the same upright, uppercase, condensed extrabold. "TALK TO ANIMALS. / EVERY ANIMAL HAS A LESSON." are two lines in one register at two sizes, and nothing on the first screen is a sentence a reader can parse.
3. **A brand mark with character.** The header used the chrome italic **AnimalDex** wordmark (the bevelled, slanted logo from the app icon family). Commit `bb019736` (2026-11-01) retired it for a flat lockup in Barlow Condensed 800 ("the chrome wordmark is retired from the UI"). The flat lockup is a font set in two colours. It is the single largest loss of brand distinctiveness, visible on every page.
4. **Brand ornament used with restraint.** There was a laurel-wreath seal under the hero ("MADE FOR EXPLORERS. BUILT FOR COLLECTORS.", lines 418–436), a scatter of dark-green animal silhouettes across the hero background (the icon canvas), and a custom cursor. A tilted, two-row kinetic marquee (Learn · Discover · Compete · Respectfully · Scan · Collect) worked as a section break. These are small pieces that only this brand has.
5. **Dense, realistic information design inside the mock-ups.** The "AI SCAN RESULT" card for the Red-lipped Batfish had a conservation chip, tier, confidence 99.8%, rarity 54%, DOM/SPD/INT stat bars, a common-region mini-map (Galápagos, Ecuador, Seafloor) and an Applied insight tile. The "Community discovery feed" had three real user cards. That density reads as a real, deep product. The current stills (Capture, Talk, Earn its Power) are clean but sparse: one animal, one line and one button each.
6. **People in the imagery.** The "Which explorer are you?" row used real photography of people (a photographer, an animal lover, a creator) over numbered cards (01–04). The current page has no human in it.
7. **The Keep exploring cards had editorial structure.** Each card had an eyebrow category (ANIMAL COMPARISON, ANIMAL POWERS, SCANNER GUIDE, RARE ANIMALS, SPECIES PROFILE, ANIMAL MIND), a title, a one-line dek and a verb CTA (Compare →, Learn →, Decode →), with rounded corners and varied sizes. Now it is title only (`page.tsx` lines 152–162 note "Pictures and a title only (2026-11-01)"), with a gradient fade and square tiles 4px apart (`gap-1`).
8. **More section rhythm.** It alternated left-aligned text beside a big mock (Wait… animals can teach me? / Make encounters memorable / Grow with nature), then a full-bleed band, then the marquee, then cards, then the FAQ. The current page stacks the same centred uppercase H2 over centred content five times.
9. **A richer footer.** It had four numbered columns (01 AnimalDex, 02 Explore animals, 03 Animal wisdom, 04 Resources) with 24 links. Now there are three columns and 11 links. That is a craft signal, and an SEO one too (see 3.7).

**What not to bring back.** The old copy was the game positioning the owner now rejects: "Collect the Wild.", "Collect 'em all!", "Like Pokémon but for animals" (old `src/data/locales/en.json` lines 80, 209, 166), "Compete", battle "Scenario result · won 3 cr", tier letters, and "BREEDING EST. PRICE £350 – £900" on a cat card. Bring back the craft, not the words.

### 2.2 What makes the current one feel generic ("vibe-coded")

1. **A default AI-landing hero.** It is a centred radial neon glow behind a blurred jungle photo, a giant uppercase two-line slogan, one pill CTA with an arrow glyph, and two ghost pills ("App Store", "Google Play" as plain text with no store marks; `page.tsx` lines 262–280). It is the same composition as thousands of generated landing pages.
2. **Floating cut-outs with no ground, scale or light.** In hero A, seven species icons orbit a centre octopus (`HomeAnimalOrbit`). An elephant is smaller than an owl, nothing casts a consistent shadow, and the art style (soft, airbrushed, isolated on transparency) reads as stock AI clip art next to the real photo behind it. The speech bubble "Don't push harder. Reach in another way." is a black rectangle in the display face.
3. **Hero B is a chat-SaaS template.** It has a chip row of example prompts ("Start a podcast", "Move abroad", "Quit sugar", "Three things due tomorrow"), then a two-column "THE USUAL ANSWER / YOUR LION'S TAKE" comparison box with an "EXAMPLE" tag and an "AI" tag. Nothing in it is about animals, nature or a world. It could be any AI-assistant landing page.
4. **Gradient and glow defaults everywhere they appear.** The download band is `bg-[radial-gradient(circle_at_20%_0%,rgba(167,244,50,0.16)…),radial-gradient(circle_at_100%_100%…),linear-gradient(135deg…)]` with a `blur-3xl` animated `ctaGlow` blob behind it (`page.tsx` lines 462–463). The bento's lead card is two cut-outs on another radial gradient (line 545), so it reads as a placeholder for a missing image. The tiles fade to black with `bg-gradient-to-t from-canvas-950`. These are Tailwind defaults with nothing done to them.
5. **One type register for everything.** Every H2 is `font-display font-black uppercase` at 4–6rem, centred ("TWO ANIMALS. TWO LESSONS.", "A LIVE ANIMAL WORLD, FILLED BY CAPTURES", "KEEP EXPLORING", `page.tsx` line 261 `sectionTitle`). There are no eyebrows on most sections, no deks, and body copy at 14–16px in grey. Shouting at one volume reads as a template.
6. **Text-glyph arrows and inline-SVG chat icons as the icon system.** There are "→" characters in eight places on the page, and the hero's chat bubble icon is a hand-drawn 2-path SVG (lines 329–332). No icon family, nothing branded.
7. **The Ark, the thing the new positioning is about, has no picture.** "A live animal world, filled by captures" is an eyebrow, a heading, a paragraph and a ghost button (`page.tsx` lines 449–457). The single most visual product AnimalDex has (a 3D world with two islands and real players' animals) is shown as text.
8. **Square, tightly packed tiles.** The bento has `gap-1` and `rounded-[2px]` store buttons, beside pill buttons and rounded chat stills. Three corner languages on one page read as no system.
9. **Short and thin.** The page is 4,842 px against the old 7,793 px. Three of its eight blocks are a heading plus one element. Fewer sections are fine, but each remaining one carries less.

### 2.3 Recommendations for the landing redesign (S2)

- **Make the hero the product again, now the 3D world.** Use a real render or capture of `/ark` (an island with real players' animals), with a real capture card and a real chat line from that animal layered at depth, the way the old phone and cards were. A slow parallax or a short muted loop works too. Those three things are the new tagline: catch → companion → 3D world.
- **Bring back the brand mark.** Restore the chrome italic wordmark in the header (the file is still in the repo, per `bb019736`) or commission a proper flat redraw of it. Restore one italic face, 700 or 800 italic only, as the brand's second voice.
- **Use a four-level type scale:** an eyebrow (11–12px, tracked caps, neon), a display headline, a sentence-case dek in Inter at 18–20px, and body. Give the first screen one plain sentence that says what the app is.
- **One corner radius, one icon set, real store badges.** Pick a radius (the chat stills' radius is the natural one) and use it for tiles, bands and buttons. Use Apple's and Google's official badges instead of text pills.
- **Use field-guide craft as the visual language:** a specimen label, a scientific name in italic, a habitat line, a small range map, a population-trend sparkline from the Ark. It suits "a living research world built from field guides" and brings back the old scan card's density without game stats.
- **Put people and real places back:** real user captures from the feed (with permission and public-only, the way the old discovery feed did) and the trip footage.
- **Keep what the current page does well:** the real photo texture in the hero word, the restrained palette, a light page (about 0.8–0.9 MB, zero layout shift in the before run, see 3.9), and no stats or laurel for their own sake. Any 3D or video hero must be a poster image first, with the live scene loaded after LCP, or it will cost what `/ark` costs (see 3.9).

---

## 3. Technical SEO

Fetched from production on 2026-11-12 (10:30–11:10 UTC), as Googlebot and as a browser. Lighthouse 12.6.1 (headless Chrome, its default simulated throttling) ran 3 times per page and form factor. The tables give the **median**. All 18 runs are in `seo-audit/lighthouse-before-2026-11-12/summary.csv`, and the median run's full report is saved beside it (`<page>-<form>.html` and `.json.gz`).

### 3.0 Before numbers (Lighthouse, median of 3)

| Page | Form | Perf | A11y | Best pr. | SEO | FCP | LCP | TBT | CLS | Speed Index | Weight |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | mobile | **86** | 100 | 82 | 100 | 1.8 s | **3.9 s** | 23 ms | 0 | 3.3 s | 0.8–0.9 MB |
| `/` | desktop | 98 | 100 | 81 | 100 | 0.4 s | 1.0 s | 0 ms | 0 | 1.3 s | 0.9 MB |
| `/ark` | mobile | **49** | 96 | 82 | 100 | 2.9 s | **4.7 s** | **1,061 ms** | 0 | 6.7 s | 2.5 MB |
| `/ark` | desktop | 92 | 96 | 81 | 100 | 0.7 s | 0.8 s | 102 ms | 0 | 2.4 s | 3.0 MB |
| `/animals/red-fox` | mobile | 96 | 100 | 82 | 100 | 1.4 s | 2.3 s | 31 ms | 0 | 3.3 s | 1.5 MB |
| `/animals/red-fox` | desktop | 99 | 100 | 81 | 100 | 0.4 s | 0.8 s | 0 ms | 0 | 1.3 s | 1.5 MB |

Ranges across the 3 runs: home mobile LCP 3.7–4.1 s; `/ark` mobile performance 44–57, LCP 3.8–5.1 s, TBT 910–1,250 ms. The home hero test draws a variant at random for every fresh visitor, so the runs saw both heroes. Hero B's LCP is the photo-textured headline, and hero A's is an orbit image. Both land at 3.7–4.1 s on mobile.

These are lab numbers. Field Core Web Vitals (CrUX) come from the Search Console export I ask for in section 4.

### 3.1 Titles and meta descriptions

| Page | Title (length) | Description (length) | Finding |
|---|---|---|---|
| `/` | "AnimalDex: Take Any Idea to an Animal. Every Animal Has a Lesson" (64) | "Talk to animals about any idea, plan or decision…" (**255**) | Off-positioning (1.2). The description is cut at about 155–160 chars in results. |
| `/id` | "AnimalDex: Bawa Ide Apa Pun ke Seekor Hewan. Setiap Hewan Punya Pelajaran" (**73**) | (**302**) | Too long on both. |
| `/ark` | "The Ark: A Live, Shared Animal World Simulation \| AnimalDex" (59) | 148 | Good. Keep the shape and add "3D" and "food chains". |
| `/animals/red-fox` | "Red Fox: Facts, Meaning & Symbolism \| AnimalDex" (47) | 149 | Good length. "Meaning & Symbolism" is off-positioning, but this template carries 2,308 pages; change it only with Search Console data (D4). |
| `/talk` | "Talk to an animal \| AnimalDex" (29); `og:title` "Talk to an animal" with no brand | 152 | A thin title for the page that owns "talk to animals". |
| `/how-it-works` | "How AnimalDex works: every animal has a lesson" (46) | 173 | Off-positioning, and the description is long. |
| `/comparisons` | "Compare Any Two Animals — Who Would Win? \| AnimalDex" | | Game framing (1.2). |
| `/collect-real-animals-app`, `/animal-collection-game`, `/legendary-earth-beasts`, `/animal-frequencies` | 83–91 chars | | Over 60. They are cut in results. |

`meta keywords`: every page without its own gets the home page's 33-term advice list (`layout.tsx:78`, `en.json:2483`). Either drop the tag or give `/ark` its own list.

### 3.2 Headings

- **The home page has two `<h1>`s.** Both hero arms are in the HTML and CSS hides one ("Talk to animals. / Every animal has a lesson." and "Take any idea to an animal. / Every animal has a lesson."). Crawlers see both. Make the hidden arm's heading a `<p>` (or render only the visitor's arm).
- `/ark` has one H1, but it is the advice line (1.2), and the first H2 is an 11 px label holding "Who is aboard" (screen-reader only) plus "Aboard" (visible), so crawlers read "Who is aboard Aboard". The H1 is also the mobile LCP element, painted 1.6 s after the response (render delay).
- `/locations` has two H1s ("Find any animal near you", "Wildlife Location Guides").
- `/animals/red-fox` repeats the H1 as an H2 ("Red Fox") and has 15 H2s. Fine, but "AnimalDex stats" and "Featured in tier lists" are the game residue on every species page.

### 3.3 Canonical, hreflang and locales

- Locales are `en` and `id` only (`src/i18n.ts`), with `localePrefix: "as-needed"` and `alternateLinks: false`; page metadata owns hreflang.
- Checked: `/`, `/ark`, `/how-it-works`, `/talk` and `/animals` each have a self canonical plus `en`, `id` and `x-default` alternates, and every `/id/...` target returns 200. Species pages declare `en` and `x-default` only, and `/id/animals/red-fox` 308s to the English page. That is consistent (no hreflang to a redirect). **No problems found here.**
- `http://` and `www.` 301 to `https://animaldex.app/`; `/ark/` 308s to `/ark`. `/Ark` and `/animals/Red-Fox` 404 (case-sensitive). That is acceptable, but a lowercase redirect would catch hand-typed links.
- `/ark?focus=<species>` keeps `/ark` as canonical (`ark/page.tsx:159`). Good.
- The sitemap has no `xhtml:link` alternates. Fine while page metadata carries them, but only 81 `/id` URLs are listed against 9,070 English ones.

### 3.4 Sitemap and robots

- `robots.txt` allows everything except `/admin`, `/api/admin`, `/app`, `/api/app` and `/compare/`, and lists `sitemap.xml` and `video-sitemap.xml`. Fine.
- `sitemap.xml` is a single file: 9,151 URLs, 917 KB. By section: `/animal-powers/*` 2,758 · `/animals/*` 2,308 · `/comparisons/*` 1,003 · `/animal-hybrids/*` 558 · **`/p/*` 400** · `/locations/*` 213 · `/blog/*` 164 · `/videos/*` 161 · `/id/*` 81 and the rest. It is under the limits, but one file makes the Search Console "Sitemaps" report useless per section. Split it into a sitemap index by section (species, powers, comparisons, captures, blog, locations, id).
- **`/ark` has no `lastmod`**, though it changes every minute. Give it today's date (or the last tick).
- **`/p/capture-<uuid>` (400 URLs) are indexed and name the person.** Example: `/p/capture-6be56869-…` is `index, follow`, and its description reads "Domestic Duck … shared by @jakeduggan on AnimalDex. Spotted near Nam Hoa Lu · Ninh Binh · Vietnam." The site's own rule (commit `6711b6b3`, "people are never public") keeps `/u/<handle>` `noindex` (`u/[handle]/page.tsx:41`), yet these capture pages put a handle and a place in search results. **Owner decision (privacy), D7.** My recommendation is to drop the handle and the place from their title and description, or to `noindex` them.
- `/u/<handle>` and `/u/<handle>/ark` are `noindex, follow`, as intended.

### 3.5 Structured data

| Page | Types | Finding |
|---|---|---|
| `/` | Organization, WebSite, SoftwareApplication, MobileApplication | **The `SearchAction` is invalid:** `target` is `https://animaldex.app//blog` (a double slash, and no `{search_term_string}` placeholder; `page.tsx:177–181`). Remove it or point it at a real search URL. `SoftwareApplication` and `MobileApplication` describe the same app twice with an advice description. Keep one, rewritten to the new positioning. `screenshot` is the share card, not a screenshot. |
| `/ark` | **VideoGame**, BreadcrumbList | Change it (1.2). Suggested: `WebApplication` + `isPartOf` the app, `about` = ["Ecosystem simulation", "Food chain", "Animal behaviour", "Wildlife"], plus a `Dataset`-free description (no population claims). |
| `/animals/red-fox` | Thing, Article, FAQPage, BreadcrumbList | `Article.dateModified` is "2026-04-10" on a page rebuilt daily (stale). `Thing` could be `Taxon` (with `scientificName` / `taxonRank`). FAQPage rich results are limited to government and health sites since 2023, so they are harmless but bring no benefit. |
| `/talk` | none | Add `WebApplication` (or `WebPage` + `potentialAction`). |
| `/how-it-works` | WebPage | Fine. |

### 3.6 Open Graph and share images

- Home: `/images/og-every-animal-has-a-lesson.png` (362 KB): the advice chat (both cards: `seo-audit/share-cards-home-and-ark.jpg`). It is also the fallback for every page without its own (`layout.tsx:26`).
- `/ark`: `/api/og/ark.png?v=3152` (194 KB, 2.2 s to render). It shows "3,152 animals of 953 species aboard" with the top six species: Domestic Cat 309 · Domestic Dog 262 · Domestic Chicken 88 · House Fly 60 · Common House Gecko 36 · Domestic Horse 32. It is honest, but it shows pets and a fly on a beige grid, not the 3D world. **This is the card every Ark share uses.** Show a real render of the island with the live count instead.
- Species: `/api/og/species/<slug>.png` per page. Fine.
- `twitter:card` is `summary_large_image` throughout. Fine.

### 3.7 Internal linking

- **`/ark` is linked from**: one home-page button (`page.tsx:454`), each species page's "In the Ark" link (`/ark?focus=<slug>`), and `/u/<handle>/ark`. It is **not in the header, the footer, How it works, /talk, /animals or any article**. For the page the positioning is now about, that is the biggest linking gap.
- `/ark` links out to **873 species pages** (the server-rendered "Who is aboard" list) with 1,109 links in all and 10,875 DOM nodes. That is good for crawling species pages but heavy (see 3.9). Group it by region with the counts and link each region's species, the way it already does, but consider paginating the long tail.
- Species pages link well (74 internal links: related animals, comparisons, tier lists, blog).
- The header's only page link is "Find your animals", which goes to `/what-animal-am-i` (a quiz). The label suggests the catalog or the world.
- The footer dropped from 24 to 11 links on 2026-11-01. The removed hubs (Animal Powers, Qualities, Trials, Locations, Wildlife Guides, Symbolism) now get internal links only from the sitemap and in-page links.

### 3.8 Crawlable content on `/ark`

There is a lot of it, and it is honest. It is server-rendered under the scene (`ark-about`): about 58,800 characters of visible text, the H2s "Who is aboard", "How an animal comes aboard" and "A shared animal world, simulated from field guides", the arrival rules, diet and breeding rules, and the honesty note. Problems:

1. **The HTML is 5.2 MB** (570 KB brotli). 4.0 MB of it is one inline React Server Components payload: the whole live snapshot passed as props to the client scene, inside `self.__next_f.push(...)`. Lighthouse attributes **1.09 s of script evaluation to the document itself** on mobile.
2. **TTFB is 2.0–3.2 s** in Lighthouse (2.7 s by curl): the page is `force-dynamic` (`ark/page.tsx:85`), sends no `cache-control`, and reads the live Ark on every request. The home and species pages are ISR (`s-maxage=86400`).
3. The text is good but generic for search. Nothing on it targets "ecosystem simulation", "food chain", "wildlife simulation" or "animal population simulator" in a heading (section 4).

### 3.9 Page speed and Core Web Vitals

**`/ark` mobile (performance 49): the 3D scene and the snapshot**

- TBT 1,061 ms, main thread 3.6 s (script evaluation 1.8 s, parse and compile 0.7 s), boot-up 1.8 s.
- 1.9 MB of JavaScript transferred. The largest chunk is 472 KB (the scene), then 147 KB, 127 KB and 100 KB. Lighthouse estimates 518 KB of unused JS.
- The 4 MB inline payload above, and the 2+ s server response.
- Desktop (92) hides most of this. **Phones are where people meet the Ark** (the apps embed it too).
- Fixes, in order:
  1. Cache the public read: serve `/ark` as ISR, or with `s-maxage` of a few seconds, from the existing 30-second public cache.
  2. Stop passing the full snapshot through RSC props; fetch it from the client after first paint, from the cached endpoint.
  3. Lazy-load the scene chunk after LCP and after the first interaction or idle, behind a static poster image of the island.
  4. Render the "Who is aboard" list as plain HTML without hydrating it.

**Home mobile (LCP 3.9 s)**

- The LCP resource is discovered late. In hero B, the LCP is the H1 whose texture is a CSS `--hero-wild-texture` background, so the browser finds the image only after CSS: load delay 1.9 s, render delay 1.1 s. In hero A, it is an orbit image.
- 197 KB of Google Tag Manager is the largest single transfer, and a Cloudflare bot-challenge script (`/cdn-cgi/challenge-platform/.../jsd/main.js`) costs 109 ms of boot-up in the home run.
- Fixes:
  1. `preload` the hero texture with `fetchpriority="high"` (or drop the texture on mobile).
  2. Load gtag after `load` or on idle.
  3. Ask whether the Cloudflare JS detection is needed on public pages.

**All pages**

- Best practices is 81–82 everywhere because of two deprecation warnings (`StorageType.persistent`, `FencedFrame`), probably third-party (gtag or Cloudflare), plus missing source maps on `/ark`.
- 21 KB of legacy-JavaScript polyfills on every page (browserslist).
- `/ark` accessibility 96: the loading text "Bringing the Ark into view" (`text-[#5b5340]` on beige) fails contrast.

### 3.10 Mobile usability

- **`/ark` overflows the phone width.** At 360 and 390 px the HUD control row ("Lighter view", "Sound", "Wild island 708", "Town and zoo 2,444") is 576 px wide (`ml-auto flex shrink-0 items-center gap-2`), so the layout viewport grows to 592 px and the page scrolls sideways, with the island switcher cut off. This belongs to lane U1 (the HUD redesign). Screenshot: `seo-audit/ark-mobile-390-overflow.jpg`.
- `/ark`: 943 links smaller than 24 px in one dimension (the "Who is aboard" species list, 21 px tall). Tap targets under 24 px fail WCAG 2.2 target size. Give the list rows 44 px or more.
- Home: no overflow (the 46 off-screen elements are the intended horizontal snap carousel). 14–19 text nodes are under 12 px (11 px eyebrows, 10.4 px card labels, 10 px "Example").
- `/animals/red-fox`: tab strip scrolls horizontally by design; 28 small tap targets (the inline name chips, "Sign in" 39×15).
- The viewport meta is correct everywhere (`width=device-width, initial-scale=1`); Lighthouse SEO is 100 on all six runs.

### 3.11 Findings list for S3 (technical SEO), worst first

1. **`/ark` mobile performance 49 / TBT 1.06 s / LCP 4.7 s**: the 4 MB inline snapshot, 1.9 MB of JS, the 2–3 s uncached server response (3.8, 3.9).
2. **`/ark` is missing from the header, the footer and How it works**, and the home page links it once (3.7).
3. **The `/ark` JSON-LD says `VideoGame`**, and its crawlable note says "a game" (1.2, 3.5).
4. **Home metadata, H1s, share card and schema are the advice positioning**; two H1s; the description is 255 chars (3.1, 3.2, 3.5, 3.6).
5. **`/p/capture-*` pages index a person's handle plus a place** (3.4). Privacy, so it is an owner decision.
6. `/ark` overflows phone width, and its species list has 21 px tap targets (3.10). Hand to U1.
7. Home mobile LCP 3.9 s: the late-discovered hero texture, plus GTM and Cloudflare JS (3.9).
8. Invalid `SearchAction` (`//blog`, no placeholder); stale `dateModified` on species pages; `/talk` has no schema (3.5).
9. `/ark` has no `lastmod`; one 9,151-URL sitemap file; the `/ark` H2 reads "Who is aboard Aboard" (3.4, 3.2).
10. Default `meta keywords` leak the advice list to every page; titles over 60 chars on 4 landing pages (3.1).
11. The `/ark` share card shows pets and a fly instead of the world (3.6).
12. Best practices 81: third-party deprecations, plus source maps on `/ark` (3.9).

---

## 4. Keywords

**No search volumes here.** Search Console is not readable from this machine (its credentials live only on the production VM), and I have not invented numbers. The admin dashboard (`/admin/metrics`, via `src/app/api/admin/growth/_lib/search-console.ts`) already reads three cuts from it: clicks by date, the top 2,000 queries, and the top 1,000 pages. It has no query × page pairs and no country, device or index coverage. This section maps the owner's themes to what the site covers today. 4.3 lists exactly what to export.

### 4.1 Themes against current coverage

| Theme (owner's list) | Best page today | Term in title / H1 / H2? | Gap and recommendation |
|---|---|---|---|
| animal ecosystem simulation | `/ark` | "Simulation" in the title; "ecosystem" nowhere on `/ark` (only in two blog posts) | Add "ecosystem" and "food chains" to an `/ark` H2 and its description. Make `/ark` the target page (one URL, not a new thin page). |
| food chain simulator | none | "food chain" appears on **no** page | Add an `/ark` section "Who eats whom", generated from the real diet links (`ark.seo.lifeRules` already explains them). It can link each predator → prey pair to the species pages. Don't call it a "simulator" unless the user can change anything. |
| wildlife simulation | `/ark` | no | Same page. Add "wildlife" to the title tail, e.g. "The Ark: A Live 3D Wildlife and Ecosystem Simulation". |
| species population simulation | `/ark` ("3,152 animals of 953 species aboard") | no | Show the live counts per species with a trend line (from the Ark's own event log), and say plainly that they are Ark counts, not real-world populations. |
| animal identification app | `/animal-identifier-app`, `/best-animal-identification-app`, `/identify-birds`, `/identify-insects`, `/identify-reptiles`, `/identify-pets` | yes, in all titles | Well covered. Keep. Add one line linking identification to the world ("then it joins the Ark"). |
| talk to animals AI | `/talk` (title "Talk to an animal"), `/talk-to-animals` ("Talk to Any Animal with AI") | yes | Covered twice. Pick the canonical intent page: `/talk-to-animals` for the question, `/talk` for the product. Give `/talk` a fuller title and schema. |
| animal points of view | none | "point of view" and "perspective" appear on no public page (the meta keywords say "perspective-driven AI") | A strong, honest theme for the new positioning. Retitle species pages' talk section "The Red Fox's point of view", and later a hub "Nature from the animals' point of view" that links species chats. |
| species-specific searches | 2,308 `/animals/<slug>` pages, 2,758 `/animal-powers/<slug>`, 1,003 comparisons | "Facts, Meaning & Symbolism" titles | **Wait for the export (D4).** If species pages earn their clicks on "facts", "diet" and "habitat", a title such as "Red Fox: Facts, Diet, Habitat & Its Point of View" keeps the intent and drops symbolism. If they earn them on "meaning" and "spiritual meaning", keep those words. |

### 4.2 What I expect the export to show (to be checked, not claimed)

Hypotheses only:
- The traffic is probably on species, comparison ("X vs Y who would win") and Pokémon-counterpart pages, not on the home page.
- The "who would win" and "Pokémon" pages are probably the biggest game-framed traffic.

The export decides D3 and D4.

### 4.3 The export I need (please ask the owner)

From Google Search Console, property **animaldex.app** (the Domain property if there is one, else `https://animaldex.app/`), **Search type: Web**:

1. **Performance → Search results, last 3 months**, the "Export → Download CSV" zip: all six tabs (Queries, Pages, Countries, Devices, Search appearance, Dates).
2. The same export for **the last 16 months** (or since the property started).
3. **Query filters**, the same report filtered with "Query → Custom (regex)", one export each for the last 3 months, Queries + Pages tabs:
   - `simulat|ecosystem|food (chain|web)|population|wildlife sim`
   - `talk(ing)? to (an |any )?animal|speak to|animal (chat|ai)|ai animal`
   - `identif|scanner|what animal is|which animal`
   - `pok[eé]mon|who would win|vs |tier list|top trumps|collect`
   - `point of view|perspective|symbolism|spiritual meaning|meaning`
4. **Page filters**, the Queries tab for each of these pages (last 3 months): `/`, `/ark`, `/talk`, `/talk-to-animals`, `/animals/red-fox`, `/animals/lion`, `/comparisons`, `/pokemon-animals`.
5. **Indexing → Pages**: the export of "Why pages aren't indexed" (all reasons with example URLs), plus the indexed count.
6. **Sitemaps**: a screenshot of the list (submitted vs discovered per sitemap).
7. **Experience → Core Web Vitals**: the mobile and desktop exports (field data; it backs the lab numbers in 3.0).
8. **Enhancements** (Breadcrumbs, FAQ, Videos and others): any errors or warnings.

A screenshot of the `/admin/metrics` SEO panel for the last 28 days would be a useful stopgap, but it can't replace 1–5.

---

## 5. Apps: onboarding and store listings

### 5.1 Onboarding and sign-up (iOS and Android are 1:1)

**What a new person sees, in order**

1. **The welcome / sign-in screen** (iOS `AnimalDex/Views/WelcomeView.swift`, Android `feature/auth/AuthScreens.kt`).
   - A blurred, slowly drifting hero photo (`WelcomeHero`, with an 18-second scale drift) and a green radial glow.
   - Above the buttons, the looping **intro card** (iOS `Views/WelcomeIntroStage.swift`, Android `feature/auth/WelcomeIntroStage.kt`/`WelcomeIntroCard.kt`), described in the code as "the looping 'spot → collect → learn' card" (`WelcomeIntroStage.swift:5–9`). Brackets lock onto a silhouette, the shutter fires, the animal appears with its **dex number, an E–S tier badge and a five-stat pentagon** (dominance, speed, size, intelligence, rarity; `WelcomeIntroStage.swift:41–42, 876–877`; Android `WelcomeIntroCard.kt:308–310, 808–810`), then the card flips to its Power, its motto and "For you".
   - An ElevenLabs voiceover plays on the first lap, e.g. "Little Owl. Speed is its top stat… yet it waits for the quiet. Find your quiet hour, and give it everything." (`scripts/generate-welcome-voiceover.sh:22`).
   - The brand line: **"Talk to animals. / They won't just agree with you."** (iOS `WelcomeView.swift:80`, Android `AuthScreens.kt:106`).
   - Then Continue with Apple (iOS) or Google (Android), or Continue with email.
2. **Sign-up copy**: "Create an account to save your captures and talk with your animals. You get %lld free Credits, enough for %lld animal photos." (`WelcomeView.swift:542`). Then Terms, then the age check.
3. **The four onboarding pages** (iOS `Views/AnimalDexReflectionOnboardingView.swift:75–91`, Android `feature/onboarding/ReflectionOnboardingSequence.kt:60–88`):
   1. "Every animal has something to **teach**." / "Capture any animal you meet… and it becomes your card."
   2. "Then **talk** to it." / "It answers in its own voice, remembers what you tell it, and sees your life through how it lives."
   3. "One question. Two **takes**." / owl against kingfisher on "Should I take the promotion?" (`:1052–1054`).
   4. "Take any idea to an **animal**." / crocodile on "I want to start a podcast." (`:1137–1138`).
4. **Finish**: "Meet one now" (three animals to talk to) or "Capture your first animal".

**Against the new positioning**

| Element | Fits? | Note |
|---|---|---|
| Real capture first ("Capture any animal you meet…", the shutter in the intro card) | **Yes** | It is the "catch animals in real life" half of the tagline. Keep it. |
| "Talk to it… remembers what you tell it" | **Yes** | It is the "AI companions" half. Keep it. |
| Tier badge, dex number, five-stat pentagon with "dominance" and "rarity" in the intro card | **No** | Game framing (tiers and battle stats) on the very first screen. Replace with field-guide facts: diet, habitat, active at night. |
| "For you" / "Find your quiet hour…" voiceover and the self-help mottos | **No** | Self-help framing, where the positioning wants the animal's own life and point of view. |
| "Talk to animals. They won't just agree with you." | Partly | The brand line is about disagreement (advice), not the world. |
| Pages 3–4 (promotion, podcast) | **No** | The advice demos. |
| **The Ark / 3D world** | **Missing** | "Ark" appears 0 times in either platform's welcome or onboarding code. The new hero of the product never shows before the first capture. |
| "sees your life through how it lives" | Inverted | The new promise is to see *nature* through the animal's eyes, not your life. |

**Recommendation for S4/S5** (they own the build):
- Keep the shutter loop, but end it with the animal **walking into the 3D world**: a real Ark clip of that species (the marketing clip recorder exists, `scripts/ark-clips.mts`). Drop the tier and pentagon.
- Replace pages 3–4 with:
  - "It joins one shared 3D world": the Ark, the animals living, eating and raising young.
  - "See nature from its side": a chat line where the animal explains what it eats or how it survives, from its field guide.
- Keep the honesty line on the world page: "Built from each animal's field guide. Simplified, not a scientific model."

### 5.2 Store listings (report only)

**App Store, live** (iTunes lookup, US and GB, 2026-11-12): version **3.2**, released 2026-11-08, from `~/Documents/animaldex/app-store-3.2/metadata/en-US.md`.

| Field | Live text | Against the new positioning |
|---|---|---|
| Name | "AnimalDex: Talk to Animals" (26) | Fine. "Talk to animals" has search value per the 3.1 strategy. Keep it unless the export says otherwise. |
| Subtitle | "Take any idea to an animal" (26) | **Advice.** |
| Promotional text | "Got an idea, a plan or a decision? Take it to a lion, an owl or a manta ray…" | **Advice.** |
| Keywords | `decision,plan,perspective,ask,lion,owl,wolf,wildlife,identifier,nature,species,companion,chat,zoo` | Half advice terms; nothing on world, simulation or ecosystem. |
| Description | Opens "Every animal has a lesson. Take any idea to one and hear it." Sections: TAKE ANY IDEA · HEAR TWO MORE · ONE STEP AT A TIME · THEY REMEMBER YOU · YOUR DIARY · EVERY ANIMAL YOU MEET… · IN ITS OWN VOICE · PRO | **No Ark, no 3D, no world.** The good AI disclosure ("characters built from real natural history, not real animals speaking") and the 13+ line are there; keep both. |
| Screenshots (10) | Take any idea · Real behaviour · Hear two more · Pick a way · One step · Earn its Power · They remember · They text you · Your diary · Meet more | Nine of ten are chat screens on black. **No camera, no Ark, no real photo** except a kingfisher. |
| Preview (26.6 s) | The wolf's take on a running club → "Why a Gray Wolf sees it this way" → debate → Power earned → a wild wolf met → "Every animal has a lesson" | No world. |
| Categories | Education, **Games, Adventure** | Games/Adventure contradicts "not a gamified video game". **Owner decision (store), D8.** Reference or Lifestyle would fit better. |

**Google Play, live** (play.google.com, en-US, 2026-11-12): still **3.1** (listing "Updated on Oct 24, 2026"; the 3.2 package in `~/Documents/animaldex/google-play-3.2` is ready but not rolled out). Name "AnimalDex: Talk to Animals", 4.4 stars, 1K+ downloads. The full description has the strongest game language of any surface:
- "AnimalDex is an animal identifier, a **wildlife collection game** and a companion you can actually talk to"
- "Earn the Power, level the animal up, and **unlock battles** and Fusion"
- "**COLLECT 2,400+ ANIMALS** … a grade for your capture, a tier and a level"
- "**BATTLE IN THE ARENA** — Put a card against another collector's in a three-round battle"

Battles are being retired for Debates (the owner's design of 2026-10-30; the 3.2 packages drop them, and the 2026-10-30 battles audit found no pair of players able to battle), so the live Play listing **promises a feature people can't use**. That is a store-policy risk (metadata must match the app) as well as a positioning one. Even the prepared 3.2 Play text is advice-led ("AnimalDex is the fastest way to a genuinely different take on your idea").

**The 3.1 ASO package** (`~/Documents/animaldex/app-store-3.1`, 2026-10-24) is superseded by 3.2 on the App Store. Its keyword research (from Apple search hints) is still useful: "talk to animals" is an autocomplete phrase whose results are pet-translator apps. That argues for keeping the name.

**The drafts** for both stores, built on the new positioning, are in `docs/store-listing-draft-2026-11.md`, for owner approval. I did not touch App Store Connect or Play Console.

---

## Decisions

| # | Question | Options | Choice | Why |
|---|---|---|---|---|
| D1 | Which old landing to compare against? | 2026-10-05 (`f5e57689`, Sept 30 head) · 2026-10-13 (`964f6b49`) · 2026-10-17 (`7546b49f`) | `964f6b49`, the last main commit on or before 2026-10-15 | It is inside the owner's window and is the last state before the Oct 17 speed pass and the Nov 1 redesign, so it is the design the owner remembers. |
| D2 | How to render "current"? | Local `next dev` of `970b0461` · production | Production with `?hero=a` and `?hero=b` | Production *is* `970b0461`, it has real data, and the hero is an A/B test, so both arms are shown. The old build ran without env vars, so its three live counters show "—". |
| D3 | Delete or redirect the game-framed SEO pages? | Delete/redirect now · rewrite their intros now · wait for data | Rewrite intros and remove dead-feature claims; no deletes or redirects until the Search Console export | They likely carry traffic; removing them blind could cost the site's best pages. Claims about battles, trading and grading are wrong today, so fix those regardless. |
| D4 | Change the species title template ("Facts, Meaning & Symbolism")? | Now · after the export | After the export | It covers 2,308 pages. The export shows whether "meaning" or "facts" queries earn the clicks. |
| D5 | `/ark` structured data type | VideoGame · WebApplication · SoftwareApplication · WebPage only | `WebApplication` with `about` topics | The owner says it is not a video game. WebApplication is accurate for an interactive browser simulation. |
| D6 | Which Lighthouse numbers to report | A single run · median of 3 | Median of 3, all runs in the CSV | Mobile `/ark` swung 44–57 across runs, and the home hero is random per run. |
| D7 | `/p/capture-*` pages name a handle and place in search | Leave · strip the handle and place · noindex | **Owner decides (privacy).** My recommendation: strip the handle and the place from their title and description | It touches privacy, and it conflicts with "people are never public". |
| D8 | App Store secondary category "Games, Adventure" | Keep · Reference · Lifestyle | **Owner decides (store).** My recommendation: Reference | "Not a gamified video game"; a category change goes through review. |
| D9 | Store name | Keep "AnimalDex: Talk to Animals" · rename to a world/companion name | Keep the name; move the new positioning into the subtitle, promo text, description and media | The name is the strongest ranking field, and "talk to animals" is an autocomplete term (3.1 research). Re-test after the export. |
| D10 | Claim "populations evolve" and "real food chains"? | As the brief says · qualified | Qualified: "food chains drawn from each animal's field guide", "populations rise and fall as animals eat, breed and age", and only for ecology flags that are on in production | The honesty rule. The Ark's mix is what players photograph (cats and dogs lead), not nature. |
| D11 | Where to keep the Lighthouse reports | HTML + JSON · HTML only · gzipped | HTML as is (opens in a browser) + JSON gzipped (the JSON is embedded in the HTML too) | Keeps the branch at about 9 MB instead of about 13 MB. |
| D12 | How to send section 2 to S2 | Direct message · via the coordinator | Via the coordinator | S2 was not reachable by name from this lane. |

