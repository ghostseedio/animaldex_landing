# Ark credits

Every third-party asset the Ark scene uses, with its licence. Only CC0, public domain, CC BY and CC BY-SA, or another licence free for commercial use, checked before download. Nothing NC or ND, because Pro is paid. The graphics lane adds its own section (terrain, water, sky) to this file.

## Sound

### Where the sounds come from

The Ark plays the same recordings as the chat's animal sounds. Nothing new is downloaded for them.
- **Bucket:** `animal-chat-sounds`.
- **Records:** `AnimalDex/scripts/animal-sounds/`.
- **Audit:** 2026-11-11, in the liveliness lane's report.

**Species recordings.**
- **Path:** `v1/<species_profile_id>/manifest.json` with `"kind": "species"`.
- **What they are:** real field recordings of that one species, from iNaturalist, Wikimedia Commons and GBIF.
- **Coverage:** 657 of the 2,680 Ark species.
- **Who recorded what:** each manifest's `credits` (recordist, licence, source, page). The full list is `AnimalDex/scripts/animal-sounds/data/published-species.csv`.
- **Held back:** the 18 banks held by the chat's final listen never call in the Ark (`ARK_HELD_SOUND_BANKS` in `src/lib/ark-sound.ts`).

**Habitat beds.**
- **Path:** `v1/habitat/<habitat>/sprite-<sha8>.m4a`.
- **What they are:** real recordings of a place, shared by every species of that habitat.
- **Use in the Ark:** ambient beds only. Never an animal's voice.

**Licences in use.** The habitat beds' credits are in the table below; the species banks' are in the published CSV.

| Licence | What it requires |
|---|---|
| CC0 | Nothing. Credited anyway. |
| Public domain | Nothing. Credited anyway. |
| CC BY (2.5, 3.0, 4.0) | Credit the recordist and licence, and link the original. |
| CC BY-SA (1.0, 2.5, 3.0, 4.0) | Credit and link as for CC BY. Our trimmed, level-matched cuts of these recordings stay under CC BY-SA. |

### How the Ark credits them on screen

The credit lines come from the manifests themselves. `soundCreditLines()` in `src/lib/ark-sound.ts` dedupes them by recordist, licence and source, and sorts them.

1. **Sounds panel:** opened from the sound toggle. It lists every recording heard in this visit, as "Recordist (licence, source)", each linking to its original `page`. It shows both the calls (species banks) and the beds (habitat banks).
2. **Tap card:** when the tapped animal has its own voice, the card adds one "Sounds:" line with its recordists. A breed calling with its kind's voice (A1) credits the kind's recordists.
3. **Clips and the livestream:** sounds used in a recorded clip are listed in the clip's description from the same function.

A recording that would play without its manifest's credits is not played. The parser drops any credit without a recordist, licence and source.

### Habitat beds used as ambience

Copied from `AnimalDex/scripts/animal-sounds/data/published-habitats.csv`.

| Ark bed | Habitat bank | Credits |
|---|---|---|
| waves | shore (`sprite-9f77a0de`) | Jarrod stanley (CC0); Ganesh Mohan T (CC BY-SA 4.0); earthcalling (public domain); Dsw4 (CC BY 3.0); me (CC BY-SA 3.0). All Wikimedia Commons. |
| wind | grassland (`sprite-5cea18c0`) | Beeld en Geluid (CC BY-SA 3.0, Wikimedia Commons) |
| river | river (`sprite-6be9222a`) | Dirtslayer (PD); Amada44 (CC BY-SA 4.0); Thomas Bresson (CC BY 4.0); stephan (PD); Dsw4 (PD), all Wikimedia Commons. National Park Service (PD). |
| pond | pond (`sprite-b8de66d4`) | Burkhard Mücke (CC BY-SA 4.0); thoschi (CC0); Andrew Migneault (CC BY-SA 4.0); Amuzujoe (CC BY-SA 4.0). All Wikimedia Commons. |
| forest by day | forest-canopy (`sprite-a6e8f999`) | Robert EA Harvey (CC BY-SA 4.0); luc de bruijn (CC BY 3.0); Gravity Sound (CC BY 4.0); W.carter (CC BY-SA 4.0). All Wikimedia Commons. |
| forest by day, rainforest | rainforest (`sprite-124204c6`) | Robert EA Harvey (CC BY-SA 4.0); Mijesty (CC BY-SA 4.0); Gravity Sound (CC BY 4.0); Beeld en Geluid (CC BY-SA 3.0). All Wikimedia Commons. |
| underwater | open-ocean (`sprite-0809ccac`) | L. Ginzkey (CC BY 2.5); Crone T, Wilcock W, Barclay A, Parsons J (CC BY 2.5). Both Wikimedia Commons. |
| underwater, reef | reef (`sprite-8e0e78d2`) | H.dav.are (CC BY-SA 4.0); Caldas-Morgan M, Alvarez-Rosario A, Rodrigues Padovese L (CC BY 4.0). Both Wikimedia Commons. |
| polar wind | snow-ice (`sprite-e229331d`) | Beeld en Geluid (CC BY-SA 3.0, 2 recordings); National Park Service (PD); Ludwig Berger (CC BY-SA 4.0) |
| desert wind | desert (`sprite-5e750224`) | Tvabutzku1234 (CC0); Beeld en Geluid (CC BY-SA 3.0); 胡蘿蔔 (CC0). All Wikimedia Commons. |

### Still needed

Rain, the night beds (crickets, frogs), the dawn chorus, thunder (inside the storm bed) and mountain wind now have recordings of their own: see "Ambient beds" below. Nothing else is needed for the beds. `ARK_AMBIENT_SOURCES` in `src/lib/ark-sound.ts` still lists them as needed; the engine takes those beds from `src/ark-scene/ambient-beds.ts` instead.

### Ambient beds (the Ark's own files)

Looping beds in `public/ark/sound/ambient/<id>.webm` (Opus) and `<id>.m4a` (AAC), chosen by `selectAmbientBeds` in `src/ark-scene/ambient-beds.ts` from the table in `ambient-beds.json`. Each is a cut of one real recording (night insects mixes two), made by `scripts/ark-ambient/make_beds.py` from `scripts/ark-ambient/beds.recipe.json`: crossfaded loop, loudness-normalised, mono. Every licence was checked on its source page on 2026-11-11, before download. Downloads went to their own folder and nothing in them was run.

Only public domain (US National Park Service; pdsounds.org authors' public domain releases; a recordist's own Public Domain Mark) and CC0. Nothing needs attribution, and we credit everyone anyway: `ambientCredits()` gives the Sounds panel one line per recordist, from the same table.

| Bed | Recording | Recordist | Licence | Source page |
|---|---|---|---|---|
| rain | Light rain, distant thunder, 5 July 2016, deep woods, Midwest USA (38 s on, no thunder in the cut) | kvgarlic (freesound.org/people/kvgarlic) | CC0 1.0 | https://commons.wikimedia.org/wiki/File:Light_Rain_Distant_Thunder_July_5th_2016.wav |
| storm | Rain and thunder, 13 November 2008 | ezwa (pdsounds.org) | Public domain (author's release) | https://commons.wikimedia.org/wiki/File:Rain_and_thunder_(1).ogg |
| night_insects | Country night noise, 9 May 2008 | hc (pdsounds.org) | Public domain (author's release) | https://commons.wikimedia.org/wiki/File:Country_night_noise.ogg |
| night_insects | Crickets, Mojave National Preserve | National Park Service | Public domain (US government work) | https://www.nps.gov/subjects/sound/sounds-crickets.htm |
| night_frogs | Western chorus frogs in Moraine Park, Rocky Mountain NP | J. Job, National Park Service | Public domain (US government work) | https://www.nps.gov/romo/learn/photosmultimedia/sounds-wildlife-soundscapes.htm |
| dawn_chorus | Dawn chorus near Mammoth Hot Springs, Yellowstone, 28 June 2014 | Jennifer Jerrett, National Park Service | Public domain (US government work) | https://www.nps.gov/yell/learn/photosmultimedia/sounds-dawnchorus.htm |
| forest_day | Morning soundscape from Finch Lake, Rocky Mountain NP, 20 June 2016 | J. Job, National Park Service | Public domain (US government work) | https://www.nps.gov/romo/learn/photosmultimedia/sounds-ambient-soundscapes.htm |
| wind_trees | Strong wind in the trees, Lower Geyser Basin, Yellowstone, 21 March 2015 | Peter Comley, National Park Service | Public domain (US government work) | https://www.nps.gov/yell/learn/photosmultimedia/sounds-soundscapes.htm |
| mountain_wind | Wind soundscape from Gem Lake, Rocky Mountain NP, 25 May 2016 | J. Job, National Park Service | Public domain (US government work) | https://www.nps.gov/romo/learn/photosmultimedia/sounds-ambient-soundscapes.htm |
| surf | Glassy winter surf, Silver Strand, Coronado, California, 30 November 2012 | Rolf Yngve (radio aporee ::: maps) | Public Domain Mark 1.0, set by the recordist | https://archive.org/details/aporee_15707_18266 |
| shore | Waves on the shore of Lake Ontario, Webster NY, autumn 2008 | Dsw4 | Public domain (author's release, PD-self) | https://commons.wikimedia.org/wiki/File:Waves.ogg |
| rapids | Stream soundscape from the Black Canyon Trail, Rocky Mountain NP, 25 May 2016 | J. Job, National Park Service | Public domain (US government work) | https://www.nps.gov/romo/learn/photosmultimedia/sounds-ambient-soundscapes.htm |
| waterfall | Siklawica waterfall, Tatra Mountains, Zakopane, Poland, 4 November 2025 | alas23/sala (radio aporee ::: maps) | Public Domain Mark 1.0, set by the recordist | https://archive.org/details/aporee_70170_81768 |
| pond | Dawn wetland soundscape, Moraine Park, Rocky Mountain NP, 18 May 2016 | J. Job, National Park Service | Public domain (US government work) | https://www.nps.gov/romo/learn/photosmultimedia/sounds-ambient-soundscapes.htm |

**Where each licence is stated:**
- **NPS:** "The files are in the public domain and may be downloaded" (Sound Gallery, https://www.nps.gov/subjects/sound/gallery.htm); "The recordings found here are in the public domain and may be downloaded and used without limitation; however, please credit the National Park Service" (Rocky Mountain library, https://www.nps.gov/romo/learn/photosmultimedia/soundlibrary.htm); "The files available here were recorded in the park and are in the public domain" (Yellowstone library, https://www.nps.gov/yell/learn/photosmultimedia/soundlibrary.htm). Yellowstone recordings co-credited to MSU's Acoustic Atlas were left out, because MSU is not the federal government.
- **Wikimedia Commons:** each file page's licence template (`cc-zero`, `PD-self`, or `PD-pdsounds.org` + `PD-author`), read through the Commons API on 2026-11-11, and each page checked for deletion or copyright-violation tags. None had any.
- **radio aporee ::: maps (Internet Archive):** the item's licence, set by the recordist when uploading: Public Domain Mark 1.0. This marks the recording free of known restrictions. It is not the formal CC0 waiver, so it is the one licence here an owner might want to swap out; the shore recording (Dsw4, PD-self) could stand in for surf.

**Looked at and not used:**
- **Jarrod stanley's uploads on Commons** ("Ocean Waves on a Tropical Beach", "James River Rapids", "Georgia Rapids", "Florida Rapids", the Iguazu falls): marked CC0, but nominated for deletion on 2026-10-28 as copyright violations (re-uploads of YouTube videos). Not used. **The chat's shore habitat bank (`sprite-9f77a0de`, credited "Jarrod stanley (CC0)" above) may hold one of these: worth checking before the Ark plays it.**
- **Vojníkov weir (Juandev, Commons):** tagged `PD-ineligible`, a doubtful claim for a field recording.
- **BigSoundBank (CC0):** the site refuses automated downloads. **Freesound:** needs a login. Neither was used.
- **Snowmelt into Okanagan Lake (Extemporalist, CC0):** recorded too quietly to use.
