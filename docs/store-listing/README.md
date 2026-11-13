# AnimalDex 3.3 store listing copy

One file per language: `en.md` (en-US, the source), `fr.md` (fr-FR), `id.md` (id-ID), `es.md` (es-ES), `pt.md` (pt-BR). Every field carries its character count (captions also a word count). Nothing here is applied automatically: paste each field into the console box named below.

## Which field goes where

| # | Field in each file | App Store Connect (App Information / version page) | Play Console (Main store listing / Release) | Limit |
|---|---|---|---|---|
| 1 | App Store subtitle | App Information → Localizable Information → **Subtitle** | – | 30 characters |
| 2 | Play short description | – | Main store listing → **Short description** | 80 characters |
| 3 | App Store keywords | version page → General → **Keywords** | – | 100 characters, comma-separated, no spaces after commas, no words already in the app name |
| 4 | Full description | version page → **Description** (also the **Promotional Text** stays empty) | Main store listing → **Full description** | 1,200 characters (our own cap; Apple allows 4,000) |
| 5 | What's New | version page → **What's New in This Version** | – | 4,000 (we use the four lines from `~/AnimalDex/docs/release-3.3/whats-new.md`) |
| 6 | Screenshot captions | the text baked into the five screenshots, in order: Talk, Catch, World, Step, Debate | the same images on Play | at most six words each |
| 7 | PPO first-screenshot captions | Product Page Optimization → one treatment each: **World**, **Catch**, **Talk**; only the first screenshot differs from the default page | – | at most six words |
| 8 | Play release notes | – | Release → 3.3.0 (27) → **Release notes** (`<id-ID>`, `<fr-FR>`, `<es-ES>`, `<pt-BR>`, `<en-US>` blocks) | 500 characters |
| 9 | Social bio line | – | – | profile bios (Instagram 150, X 160, TikTok 80 — the line fits all three) |

Product names and ids (from `~/AnimalDex/docs/release-3.2/store-console-steps.md`): App Store subscriptions `pro_monthly` and `pro_annual` (display name "AnimalDex Pro", group Pro, same level); Play subscriptions `pro_monthly` (base plan `monthly`) and `pro_annual` (base plan `annual`, offer `annual-free-trial`). The description's Pro line only says Pro is optional and that eligible new yearly subscribers start with a free week; prices are not in the copy, so a price change needs no copy change.

## Copy rules (hard)

- Never "guaranteed" (or guarantee / garanti / garantía / garantido / dijamin).
- No other AI product is named.
- Never "life advice" (or its translations). The animals answer from how their species lives.
- The animals are AI characters and can be wrong; identifications can be wrong too. Every description ends with that line, the age line (13 and up) and the wildlife line (keep a safe distance from wildlife).
- The Ark is "based on each animal's field guide" (fr "d'après le guide de terrain de chaque animal", id "berdasarkan panduan lapangan masing-masing hewan", es "según la guía de campo de cada animal", pt "com base no guia de campo de cada animal"). Never "scientifically accurate" in any language.
- The slogan "Every animal has a lesson." appears exactly once per description: en as is; fr "Chaque animal a une leçon."; id "Setiap hewan punya pelajaran." (the fixed Indonesian form); es "Cada animal tiene una lección."; pt "Todo animal tem uma lição." It sits before the closing AI/age/wildlife lines. The bio line (field 9) also carries it, by design.
- The first line of every description is the translation of "Ask any animal anything, and it answers from how its kind really lives."
- "Ark" stays "Ark" in every language, as in the apps (fr "l'Ark", es "el Ark", pt "a Ark", id "Ark"). Score: "Score Ark" / "Puntuación Ark" / "Pontuação Ark" / "Skor Ark". Power: "Pouvoir" / "Poder" / "Poder" / "Kekuatan". Diary: "Journal" / "Diario" / "Diário" / "Buku Harian". Settings, as labelled in the app: "Paramètres" / "Configuración" / "Ajustes" / "Pengaturan". (The website's Indonesian pages say "Bahtera" for the Ark; the store copy follows the app and keeps "Ark", with "bahtera" only as a keyword.)
- Indonesian uses "Anda", as the app does.
- Translate for native tone, not word for word, and keep every limit. Re-count after any edit: the counts printed in the files are for the text as written.

## Notes and known gaps

- **Keywords.** The brief's English base was `ask an animal,animal chat,ai animal,wildlife identifier,animal facts,zoo,petdex,animal pokedex,ark`. The hard rule "no words already in the app name" rules out "animal" (the name "AnimalDex: Talk to Animals" already matches it, and App Store search indexes keywords word by word), so each field is single words with "animal", "an", "talk" and "to" removed. The phrase matches still work because the title supplies "animal(s)". "ark" is kept everywhere; fr/es/pt also carry the local spelling (arche / arca).
- **English captions are seven words by a strict count.** "Ask a Komodo dragon why it waits", "Point. Scan. It's yours to talk to." and "Do one small thing. Earn its Power." were given as the English text and are kept verbatim; the four translations are at most six words each.
- **What's New fallbacks** (from `whats-new.md`): if the `ark_panel` switch is off when 3.3 goes live, drop lines 1 and 2 and use "Your Ark Score now counts what your steps bring to the shared Ark, from 0 to 100." Line 4 assumes the server's `ark_digest` flag is on; if not, it can wait for 3.3.1. In Arabic, Hebrew, Persian and Urdu the swipe is from the left (not covered here).
- **The live App Store description** (fetched 13 Nov 2026) is 3,227 characters and says the slogan twice (opening and closing). This set replaces it with a ≤1,200-character version that says it once and adds the Ark paragraph; the Pro bullet list, the Apple renewal paragraph and the EULA link are not in the 1,200 characters. If App Review asks for the auto-renewal terms in the description, append the live description's "Payment is charged to your Apple Account…" paragraph and the EULA line after the wildlife line; that takes the English to about 1,500 characters.
- **The count "3,225"** in the World caption is the Ark's animal count at the time of writing; refresh it from the live Ark before the screenshots are rendered.
- **App Store localizations** should be entered for each storefront language: en-US (and en-GB if the page exists), fr-FR, id, es-ES, pt-BR. Play uses en-US, fr-FR, id-ID, es-ES, pt-BR.
