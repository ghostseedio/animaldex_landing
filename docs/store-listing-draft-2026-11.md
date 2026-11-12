# Store listing draft, November 2026 (for owner approval)

Lane S1, 2026-11-12. **A draft only.** Nothing here has been entered in App Store Connect or Play Console, and nothing should be until the owner approves it. It is written for the release that ships the Ark panel in the apps (3.3; `ark_panel` is on since 2026-11-12), in en-US. Translate it after approval, with the same per-locale keyword research the 3.1 package used (`~/Documents/animaldex/app-store-3.1/STRATEGY.md`), never by machine translation.

**Positioning:** "Catch animals in real life and turn them into AI companions in a 3D world." AnimalDex is a living research world, not a gamified video game.

**Honesty rules applied throughout:**
- The world is described as built from each animal's field guide.
- It is never called scientifically accurate.
- No population sizes or real-world science claims.
- The Ark's numbers are said to depend on what people photograph.
- The AI disclosure and the 13+ line from the live listing are kept word for word.

Why it changes, in short (detail in `docs/seo-positioning-audit.md` 5.2):
- The live App Store listing (3.2) leads with "Take any idea to an animal" and never mentions the Ark.
- The live Play listing is still 3.1 and calls the app "a wildlife collection game" with "BATTLE IN THE ARENA".

## 0. Check before this is used (owner)

The world copy claims only what is switched on. Before submitting, confirm that each of these is on in production. If one is off, use the fallback wording beside it.

| Claim in the copy | Needs | If it is off |
|---|---|---|
| "The animals people catch bring their kind into the Ark", "The animals you catch join" (promo) | `capture_arrivals` on | "Animals people have caught live in the Ark", and rewrite the promo text's first sentence |
| "A predator hunts only what its field guide names as food", "populations rise and fall", "different each time you come back" | the world tick running on a schedule (`tick_enabled`, the 10-minute cron `20261118110000`), `thrive`, `hunting = 'encounter'` | Drop the section "A WORLD THAT KEEPS MOVING" and keep "animals live by rules drawn from their field guides" |
| "tap an animal to meet it, follow it, or read its life story" | the same in the apps' Ark panel (it is true on the web today) | "look around in 3D and tap an animal to meet it" |
| "a wild island and, across a strait, a town and a zoo" | islands on (switched on 2026-11-12) | "one shared 3D world" |
| The Pro list | the products live at submission (copied from the live 3.2 listing) | update the numbers |

## 1. App Store (en-US)

**App name** (26/30). Keep it: "talk to animals" is an Apple autocomplete phrase (3.1 research), and the name is the strongest ranking field.
```
AnimalDex: Talk to Animals
```
Alternative if the owner wants the new positioning in the name (28/30): `AnimalDex: Animal Companions`. It loses the "talk to animals" match.

**Subtitle** (27/30)
```
AI companions in a 3D world
```
Alternatives: `Catch animals. Meet them in 3D` (30/30) · `Real animals, one 3D world` (26/30).

**Keywords** (97/100 bytes). No word repeats the name or subtitle (Apple indexes those already).
```
wildlife,simulation,ecosystem,food chain,species,identifier,nature,zoo,safari,bird,insect,habitat
```

**Promotional text** (149/170). It can change without a review.
```
New: the Ark. The animals you catch join one shared 3D world, where animals eat, raise young and grow old by rules drawn from each one's field guide.
```

**Description** (3422/4,000)
```
Catch animals in real life and turn them into AI companions in a 3D world.

Photograph or film a real animal, in the wild, at a zoo, on a farm or at home. AnimalDex identifies it, and it becomes yours: an AI companion you can talk to, whose kind lives in the Ark, a shared 3D world built from each animal's field guide.

CATCH REAL ANIMALS
Point your camera at an animal, or pick a photo or video from your camera roll. AnimalDex names the species and adds it to your animals with its field guide: what it eats, where it lives, when it is awake and how it raises its young. Wild sightings stand apart from zoo, farm and pet ones.

TALK TO IT
Every animal you catch answers as itself, from how its kind really lives. Ask a red fox what it hunts at dusk, an owl why it waits so long before it moves, or a manta ray how it feeds. Replies can be read aloud in the animal's own voice, and hundreds of species play their own real field recordings while they type. Your animals remember what you tell them, and you can see, correct or forget anything they remember.

ONE SHARED 3D WORLD
The animals people catch bring their kind into the Ark (up to a pair of each species for each person): a wild island and, across a strait, a town and a zoo. Everyone shares it and sees it the same way. Look around in 3D, tap an animal to meet it, follow it, or read its life story.

A WORLD THAT KEEPS MOVING
In the Ark, animals live by rules drawn from their field guides. A predator hunts only what its field guide names as food. Two adults of a kind raise young when there is food. Animals grow old. So populations rise and fall as animals eat, breed and age, and the world is different each time you come back.

NATURE FROM THE ANIMALS' SIDE
Every conversation starts from the animal's own way of living: what it eats, what hunts it, how it raises its young. You learn about nature from its point of view, not from a list of facts.

HONEST ABOUT WHAT IT IS
The Ark is a simulation built from each animal's field guide. Its rules are simplified so a small shared world can run, and it is not a scientific model. Which animals live there depends on what people have photographed, so its numbers say nothing about real-world populations.

ANIMALDEX PRO
Pro is an optional subscription, monthly or yearly, that includes:
- 30 spoken replies a day in each animal's own voice (free accounts get 3)
- 100 messages a day in the app (free accounts get 30)
- Narrated story videos of your own photos
- Unlimited photo and video captures
- 42 Credits every month on the monthly plan
- The full field guide on every card, and camera sessions of up to 15 animals
Eligible new subscribers to the yearly plan start with a free week.

Payment is charged to your Apple Account at confirmation of purchase. The subscription renews automatically unless cancelled at least 24 hours before the end of the current period. Any unused part of a free trial ends when you subscribe. Manage or cancel it in your App Store account settings.

The animals are AI. They are characters built from real natural history, not real animals speaking, and they can be wrong. Identifications can be wrong too. AnimalDex is for ages 13 and up and asks for your birth year before you talk. Always keep a safe distance from wildlife and never disturb it.

Terms of Use (EULA): https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

Catch an animal. Meet it in the Ark.
```

**What's New** (write it at submission from the release notes). Open with: "The Ark is here: every animal you catch can now be met in one shared 3D world."

**Categories:** primary Education (as now). **Secondary: owner decision** (the live one is Games › Adventure, which contradicts "not a gamified video game"). My recommendation is Reference.

## 2. Google Play (en-US)

**App name** (26/30)
```
AnimalDex: Talk to Animals
```

**Short description** (73/80). The tagline itself.
```
Catch animals in real life and turn them into AI companions in a 3D world
```
Alternative (76/80): `Catch real animals, talk to them, and watch them live in one shared 3D world`

**Full description** (3219/4,000). The same story, with Google Play billing text and no EULA line.
```
Catch animals in real life and turn them into AI companions in a 3D world.

Photograph or film a real animal, in the wild, at a zoo, on a farm or at home. AnimalDex identifies it, and it becomes yours: an AI companion you can talk to, whose kind lives in the Ark, a shared 3D world built from each animal's field guide.

CATCH REAL ANIMALS
Point your camera at an animal, or pick a photo or video from your camera roll. AnimalDex names the species and adds it to your animals with its field guide: what it eats, where it lives, when it is awake and how it raises its young. Wild sightings stand apart from zoo, farm and pet ones.

TALK TO IT
Every animal you catch answers as itself, from how its kind really lives. Ask a red fox what it hunts at dusk, an owl why it waits so long before it moves, or a manta ray how it feeds. Replies can be read aloud in the animal's own voice, and hundreds of species play their own real field recordings while they type. Your animals remember what you tell them, and you can see, correct or forget anything they remember.

ONE SHARED 3D WORLD
The animals people catch bring their kind into the Ark (up to a pair of each species for each person): a wild island and, across a strait, a town and a zoo. Everyone shares it and sees it the same way. Look around in 3D, tap an animal to meet it, follow it, or read its life story.

A WORLD THAT KEEPS MOVING
In the Ark, animals live by rules drawn from their field guides. A predator hunts only what its field guide names as food. Two adults of a kind raise young when there is food. Animals grow old. So populations rise and fall as animals eat, breed and age, and the world is different each time you come back.

NATURE FROM THE ANIMALS' SIDE
Every conversation starts from the animal's own way of living: what it eats, what hunts it, how it raises its young. You learn about nature from its point of view, not from a list of facts.

HONEST ABOUT WHAT IT IS
The Ark is a simulation built from each animal's field guide. Its rules are simplified so a small shared world can run, and it is not a scientific model. Which animals live there depends on what people have photographed, so its numbers say nothing about real-world populations.

ANIMALDEX PRO
Pro is an optional subscription, monthly or yearly, that includes:
- 30 spoken replies a day in each animal's own voice (free accounts get 3)
- 100 messages a day in the app (free accounts get 30)
- Narrated story videos of your own photos
- Unlimited photo and video captures
- 42 Credits every month on the monthly plan
- The full field guide on every card, and camera sessions of up to 15 animals
Eligible new subscribers to the yearly plan start with a free week.

Payment is charged to your Google Play account. The subscription renews automatically until you cancel it, which you can do at any time in Google Play > Payments & subscriptions.

The animals are AI. They are characters built from real natural history, not real animals speaking, and they can be wrong. Identifications can be wrong too. AnimalDex is for ages 13 and up and asks for your birth year before you talk. Always keep a safe distance from wildlife and never disturb it.

Catch an animal. Meet it in the Ark.
```

**Tags / category:** Education (as now). Don't add game tags.

## 3. Screenshot plan

Real screens only, from a 3.3 build. Real captures from the owner's account (`@lendawg` public cards, as in the store screenshot harness) and the live Ark, with no fixtures. On the Ark the "real data only" rule applies: production never shows a fixture. Captions are short, sentence case and honest. The first three slots are what search results show, so they carry the whole tagline: catch → companion → 3D world.

**App Store (10 slots, iPhone 6.9" and 6.3", iPad 13"):**

| # | Real screen | Caption (headline / sub) |
|---|---|---|
| 1 | The capture camera locked on a real wild animal (the owner's Komodo dragon or manta from Labuan Bajo), shutter visible | **Catch real animals** / Photograph or film one you meet |
| 2 | The reveal card for that animal: photo, name, scientific name, field-guide lines (diet, habitat). No tier or stat pentagon | **It becomes yours** / With its field guide |
| 3 | The chat with that animal, a real reply about how it lives (e.g. how it hunts), voice button visible | **Talk to it** / It answers as itself |
| 4 | The Ark panel, wide shot of the wild island with many real animals | **One shared 3D world** / Built from each animal's field guide |
| 5 | The Ark close-up: the user's own species in the world, its card open | **Your animal lives here** / Tap to meet, follow, read its story |
| 6 | The Ark: a predator and prey of the same food chain in one frame (only if encounter is on and capturable honestly) | **Food chains from field guides** / A predator hunts only what it eats |
| 7 | The Ark: the town and zoo across the strait | **A wild island and a town** / Wild sightings and zoo animals |
| 8 | An animal's life story in the Ark (arrival, young, meals) | **Every animal has a story** / Read it in the Ark |
| 9 | "What I remember about you" | **They remember you** / See, correct or forget anything |
| 10 | The chat, a reply that answers from the animal's point of view about nature (e.g. why owls hunt at night) | **Nature from their side** / Learn how they see the world |

Don't use: advice demos (promotion, podcast), the Diary, Debates, XP, tiers, the stat pentagon or the old "usual answer" card. No population numbers in captions. A live count in the Ark HUD is fine, because it is the screen.

**Google Play (8 phone screenshots, 1080×1920):** slots 1, 2, 3, 4, 5, 7, 8, 10 above, from the Android 3.3 build.

**Play feature graphic (1024×500):** a real render of the wild island from the live Ark (the clip recorder, `scripts/ark-clips.mts` in the landing repo, records the live Ark with `?record=1`), with the wordmark and the short tagline "Catch real animals. Meet them in 3D." No device frame, no price, no awards.

## 4. Preview video storyboard

**App Store App Preview** (15–30 s, about 26 s, 886×1920, app screen captures only per Guideline 2.3.4, silent-safe captions, the same spec as the 3.2 preview):

| Time | Shot (all in-app) | Caption |
|---|---|---|
| 0–3 s | The capture camera: brackets lock on a real animal, shutter | Catch real animals |
| 3–6 s | The reveal card fills in: name, scientific name, field guide | It becomes yours |
| 6–11 s | The chat: the animal's reply types out about how it lives; the voice waveform plays | Talk to it |
| 11–14 s | From the card, open the animal in the Ark panel (the web capture page has "See it in the Ark"; use the app's equivalent): the camera flies to it | One shared 3D world |
| 14–19 s | Follow that species in the wild island: it walks, feeds; others around it | Built from field guides |
| 19–23 s | Another real moment from the live world: young with a parent, a flock, or a predator and prey | Food chains, families, a life |
| 23–26 s | Pull back over both islands, the HUD count visible | Different every time you come back* |
| 26–28 s | End card: wordmark, "Catch animals in real life. Meet them in a 3D world." and, small, "Built from each animal's field guide. Simplified, not a scientific model." | |

\* Only if the world tick runs on a schedule (section 0). Otherwise "A world you can explore".

**Google Play promo video** (YouTube, 30–60 s): the same cut. Play allows real-world footage, so it may open with 2–3 s of the owner's own trip footage (the Komodo or manta clips) before the in-app camera picks the animal up. Nothing staged, no stock footage, no AI-generated footage.

## 5. Decisions

| # | Question | Options | Choice | Why |
|---|---|---|---|---|
| S1 | Keep the app name? | "AnimalDex: Talk to Animals" · "AnimalDex: Animal Companions" | Keep it, and give the alternative | The name ranks most. "Talk to animals" is an autocomplete term, and the companion half of the tagline is the same idea. |
| S2 | Subtitle | "AI companions in a 3D world" · "Catch animals. Meet them in 3D" · "Real animals, one 3D world" | "AI companions in a 3D world" | Name plus subtitle read as the tagline ("Talk to Animals — AI companions in a 3D world"), and it adds new indexable words (AI, companions, 3D, world). |
| S3 | Mention Pro? | Keep the 3.2 Pro block · drop it | Keep it verbatim, flagged to verify | It is accurate today, and Apple expects auto-renew terms in the listing. |
| S4 | Claims about a changing world | Unconditional · gated | Gated on the flags in section 0 | The honesty rule: claim only what runs in production. |
| S5 | Which animals in the media | Fixtures · real captures | Real captures and the live Ark only | The owner's real-data-only rule (2026-11-11). |
| S6 | Retire "Every animal has a lesson"? | Keep as sign-off · retire | Retire it from the store copy | It is the advice positioning's slogan. The new sign-off is "Catch an animal. Meet it in the Ark." |
