# Signature behaviours wave 2 (lane SIG2, 2026-11-23)

Seven lane worktrees (mammals, reptiles, small bodies, aquatic, flights, tails, look states) were committed as WIP on their own branches, then rebased onto main 002592eb as one branch, `sig2`. Every new row was then looked at in a picture strip (`scripts/ark-behaviours-clips.mjs`, `scripts/ark-sig2-mammals-clips.mjs`; frames under `~/AnimalDex-work/sig2/`) and shipped only if the act reads at phone distance with ground contact and no body drawn through another.

Held rows stay in their data files and are named in `data/ark/signature-holds.json` (recipes), `look-states.json` `held` and `tail-postures.json` `skipped`, each with why: the generators keep them out of the scene's tables and the log. The mechanism tests put them back first (`src/lib/ark-signature-held-rows.ts`, `src/lib/ark-look-states-held.ts`), so the code stays checked until a fix releases them. All of this is client scene data: no engine (server) behaviour changes, so there is no `voyage_config` flag.

## Shipped

| Species | Recipe | Frames |
|---|---|---|
| capybara, domestic sheep, zebu | sleep: huddle | `mam/sleep-*-strip.jpg`: pressed together, gaps under a body length |
| coffee hawk-moth, hummingbird clearwing, pink-spotted hawkmoth, privet hawk-moth, yam hawk-moth, greater bee fly, marmalade hoverfly | flower_hover | `small/sm-moth-strip.jpg`: hovering at the flower |
| American bullfrog | edge_ambush | `small/sm-frog-strip.jpg`: still at the water's edge |
| American toad | sit_snap | `small/sm-toad-strip.jpg`: sitting, the snap |
| veiled chameleon | night pale green; contest inflate and flare | `other/lsland-*`, `other/lsdewlap-veiled-chameleon.jpg` |
| magnificent frigatebird, grey crowned crane | throat pouch / sac swells | `other/lssac-*` |
| red deer | autumn neck | `other/lsseasonland-*` |
| domestic dog, eastern chipmunk, hamadryas baboon, olive baboon | tail posture | `other/tails-*` |

## Held, and why

| Recipe | Species | Why |
|---|---|---|
| sleep:huddle | ring-tailed-lemur, tufted-capuchin, bolivian-squirrel-monkey, common-marmoset, coppery-titi-monkey, stump-tailed-macaque, long-tailed-macaque | tree sleepers: the sleep layer leaves them 1.2-2.2 m apart on separate branches (lemur 1.41 m mean gap for a 0.73 m body, capuchin 2.18 m for 0.44 m): no huddle in the frames |
| sleep:huddle | barbary-macaque | four drawn inside each other (gap 0) on a cliff face, a fifth 6 m off: a merged blob, not a huddle |
| sleep:huddle | sugar-glider | drawn 4-23 m apart (mean gap 11.9 m for a 0.19 m body) |
| sleep:huddle | guinea-pig | drawn 2.6-11.7 m apart (mean gap 6.65 m for a 0.24 m body) |
| sleep:huddle | collared-peccary | mean gap 0.92 m for a 0.88 m body: spread out, not pressed together as the sentence says |
| sleep:cluster | kuhls-pipistrelle-bat | a few dots on the ground by a rock: no nursery colony in a building to be seen at phone distance |
| stone_hammer | long-tailed-macaque, tufted-capuchin | no stone_hammer episode in 24 Ark hours for 4 animals in the harness (its rock goal never met where they live): nothing to look at |
| worm_dig | javan-ferret-badger | night, a dark body under leaves: unreadable; its root_dig already carries the same sentence |
| nest_build | eastern-gray-squirrel, red-squirrel, desert-cottontail | no nest_build episode in 24 Ark hours in the harness (the drey's site is 15-20 m up a limb) |
| nest_build | malaysian-field-rat, red-river-hog | the act runs but no nest reads at phone distance (the rat a dot at night, the hog's material and nest not visible) |
| border_spar | carpenter-ant | 2 cm ants: the boxing is not readable at any harness distance |
| claw_spar | mangrove-crab | the crabs are not in the frame (a rock pool's rim fills it) |
| spider_dance | pantropical-jumping-spider, peterss-jumping-spider, two-striped-telamonia | the spider leaves the frame during the dance (grass blades or an empty wall): unreadable |
| molehills | southern-mole-cricket | no mound or dig ever plays (the cricket is not micro-placed there, no act in 60 s); the harness close-up shows only its own dark 2.6 cm body from 5 cm above, grass drawn through it, which reads as a black disk, not a behaviour |
| bank_burrow | giant-mud-crab | the dig is a small pitch on an open sandy bed under water: no burrow or bank reads |
| wrestle | golden-stag-beetle | the beetles are not in the frame; a stone fills the corner |
| night_hawk | european-hornet | at night the insect at the light is a tiny purple shape, not readable as a hornet (the glowing bar across the harness's first frame is the lamp post's lit shaft by the camera; lamp posts are not built in islands mode, so it is harness only) |
| wrestle | american-bullfrog | the two bullfrogs are drawn through each other while wrestling |
| sit_snap | chinese-mantis, orchid-mantis, stick-mantis, red-assassin-bug, minute-pirate-bug, giant-house-spider, tiger-wolf-spider | the micro animal is not in the frame (leaves or an empty wall): the toad's sit_snap reads, these could not be checked |
| dig_burrow | vampire-crab | the crab is not visible in the dig frames |
| dig_burrow~nest | aldabra-giant-tortoise, leopard-tortoise | the tortoise tips nose-down with its legs working but no pit or soil shows; the last frame sinks it into the grass |
| dig_burrow | russian-tortoise, sulcata-tortoise | no dig_burrow episode in the harness's search window |
| wallow~turtle | aldabra-giant-tortoise, asian-forest-tortoise, galapagos-tortoise | the 'bury' block stands it on dry grass, no mud or water: not a wallow (the Galapagos episode has no act at all) |
| probe_feed~turtle | hawksbill-sea-turtle | the episode is swim and turn only: no probe |
| probe_feed | indonesian-blue-tongued-skink | its probe frames draw it floating on top of a plant's leaves |
| beach_nest~bank | mugger-crocodile, amboina-sailfin-lizard | the episode is crawl/turn/walk: no nest dug or laid shows |
| incubate_sit~reptile | siamese-crocodile, philippine-crocodile, red-tegu | no mound shows to guard, and it stands off the ground (shadow under its feet) in the scan and walk after |
| pounce~lizard | oriental-garden-lizard, brazilian-lava-lizard, bocages-wall-lizard, leopard-gecko, common-house-gecko, common-wall-gecko, mediterranean-house-gecko, tropical-house-gecko | the episode is freeze/scan/walk with no dash or snap; the wall clingers' sit-and-wait (micro-ambush.ts) runs only for micro-placed animals, and on the live v2 map a gecko perches (map/place.ts: not trueMicro), so it never plays there; the harness's micro shot crashed for the same reason |
| sally_chase | brilliant-blue, broad-bodied-chaser, common-flangetail, great-eggfly, greater-bee-fly, hackberry-emperor, mourning-cloak, pied-paddy-skimmer, red-admiral, scarlet-skimmer, tropical-carpenter-bee, two-tailed-pasha | a true micro animal (an insect under 12 cm, map/species.ts trueMicro) is off the behaviour schedule, so the template never plays on the Ark: the harness waited 900 s for a male in the act and found none |
| patrol_low | common-rose, fox-moth, giant-scoliid-wasp, little-wood-satyr | a true micro animal (an insect under 12 cm, map/species.ts trueMicro) is off the behaviour schedule, so the template never plays on the Ark: the harness waited 900 s for a male in the act and found none |
| hawk_insects | slender-skimmer | a true micro dragonfly is off the behaviour schedule: its hawking never plays, so no sentence for it |
| display_flight | common-wood-pigeon, eurasian-collared-dove, spotted-dove | the harness waited 900 s on the schedule for a male in the act and found none: never seen, so never checked for ground contact or a readable climb |
| look state | common-house-gecko | night tone: the animal is a few pixels in the grass in its frames, off and on look the same |
| look state | common-wall-gecko | night tone: the animal is a few pixels in the grass in its frames, off and on look the same |
| look state | mediterranean-house-gecko | night tone: the animal is a few pixels in the grass in its frames, off and on look the same |
| look state | tropical-house-gecko | night tone: the animal is a few pixels in the grass in its frames, off and on look the same |
| look state | crested-gecko | night tone: the animal is a few pixels in the grass in its frames, off and on look the same |
| look state | goldfish | its frames show open water and the bed, never the fish: not checked |
| look state | siamese-fighting-fish | its frames show open water and the bed, never the fish: not checked |
| look state | guppy | its frames show open water and the bed, never the fish: not checked |
| look state | neon-tetra | its frames show open water and the bed, never the fish: not checked |
| look state | black-skirt-tetra | its frames show open water and the bed, never the fish: not checked |
| look state | tiger-barb | its frames show open water and the bed, never the fish: not checked |
| look state | freshwater-angelfish | its frames show open water and the bed, never the fish: not checked |
| look state | yellow-tang | its frames show open water and the bed, never the fish: not checked |
| look state | three-spot-gourami | its frames show open water and the bed, never the fish: not checked |
| look state | carolina-wolf-spider | night tone: the animal is a few pixels in the grass in its frames, off and on look the same |
| look state | green-iguana | the dewlap or throat is not told apart off and on at phone distance (the anoles a sliver in the grass) |
| look state | green-anole | the dewlap or throat is not told apart off and on at phone distance (the anoles a sliver in the grass) |
| look state | brown-anole | the dewlap or throat is not told apart off and on at phone distance (the anoles a sliver in the grass) |
| look state | oriental-garden-lizard | the dewlap or throat is not told apart off and on at phone distance (the anoles a sliver in the grass) |
| look state | common-green-forest-lizard | the dewlap or throat is not told apart off and on at phone distance (the anoles a sliver in the grass) |
| look state | american-bullfrog | the sac or puffed throat does not show off and on (the siamang out of frame) |
| look state | marsh-frog | the sac or puffed throat does not show off and on (the siamang out of frame) |
| look state | great-plains-toad | the sac or puffed throat does not show off and on (the siamang out of frame) |
| look state | siamang | the sac or puffed throat does not show off and on (the siamang out of frame) |
| look state | european-starling | the sac or puffed throat does not show off and on (the siamang out of frame) |
| look state | long-tailed-macaque | full cheeks do not read off and on (the hamster and mandrill out of frame) |
| look state | campbells-dwarf-hamster | full cheeks do not read off and on (the hamster and mandrill out of frame) |
| look state | eastern-chipmunk | full cheeks do not read off and on (the hamster and mandrill out of frame) |
| look state | mandrill | full cheeks do not read off and on (the hamster and mandrill out of frame) |
| look state | mallard | its season state is not told apart in its frames, or the animal is out of frame |
| look state | mandarin-duck | its season state is not told apart in its frames, or the animal is out of frame |
| look state | black-headed-gull | its season state is not told apart in its frames, or the animal is out of frame |
| look state | great-crested-grebe | its season state is not told apart in its frames, or the animal is out of frame |
| look state | winter-white-dwarf-hamster | full cheeks do not read off and on (the hamster and mandrill out of frame) |
| look state | southeastern-five-lined-skink | its season state is not told apart in its frames, or the animal is out of frame |
| look state | two-spotted-spider-mite | its season state is not told apart in its frames, or the animal is out of frame |
| look state | white-tailed-deer | its season state is not told apart in its frames, or the animal is out of frame |
| look state | common-eastern-firefly | its season state is not told apart in its frames, or the animal is out of frame |
| look state | koi | its frames show open water and the bed, never the fish: not checked |
| look state | raccoon-dog | its season state is not told apart in its frames, or the animal is out of frame |
| tail posture | South American Coati | in its walking frames the raised tail is a faint stub among the ferns: it does not read as a flag at phone distance |
| tail posture | Toque Macaque | its frames show the tail low along the ground: no S or C reads |
| aquatic (clean_client, pair_patrol, bed_tunnel, bloom, mixed_follow) | wrasse, angelfish, acara, catfish, moon jelly, tang, surgeonfish, moray | not merged into `sig2` (branch `sig2-aquatic-rb` 36a07a08): in `~/AnimalDex-work/sig2/aqua-sheet.jpg` the jellies and the catfish are not in frame, the cleaner stays metres from its client, the tunnel shows bare bed |

## Next

- Micro insects (sally_chase, patrol_low, hawk_insects, sit_snap, spider_dance) need the micro layer to put them on a schedule, or a harness view that finds them; the gecko sit-and-wait needs v2 placement to make geckos micro.
- The tree sleepers need the sleep layer to seat a troop on one branch; the reptile nest and wallow variants need a pit or mud mark under the body.

## SIG3 (2026-11-23): first tranche

The sleep layer now seats a huddling (or piling) group member at its leader's roost even when the v2 map gave it a
place of its own (`behaviour-schedule.ts` rawRoostOf): five guinea pigs had each slept in their own worm hole 2.6-11.7
body lengths apart, the tree sleepers each on their own branch. A roost's row or cluster keeps its own perches. Strips:
`~/AnimalDex-work/sig3/mam/sleep-*-strip.jpg`, `tree3-sheet.jpg` (`scripts/ark-sig2-mammals-clips.mjs`).

| Released | Frames (gap to the nearest, body lengths) |
|---|---|
| guinea-pig, collared-peccary | 0.55-0.99 on the ground, as the shipped sheep (0.53-0.94) |
| ring-tailed-lemur, tufted-capuchin, coppery-titi-monkey, stump-tailed-macaque, bolivian-squirrel-monkey | 0.2-0.5 on one limb (one awake member further off) |
| russian-tortoise, sulcata-tortoise (dig_burrow) | nose down, forelegs working, a dug patch and dust left on the ground (`~/AnimalDex-work/sig3/dig-*/rt_dig-strip.jpg`); SIG2 had searched for `dig_burrow~tortoise`, a template that does not exist |

Still held, with the new why in `signature-holds.json`: long-tailed macaque (single file along the limb, standing),
common marmoset (drawn half inside the trunk), Barbary macaque (unchanged blob), sugar glider (its text names no
sleeping together), the lizards' and geckos' `pounce~lizard` (a fake insect catch; the real way is the `dash` hunt act on
a server meal), the doves' `display_flight` (no open-air target from a woodland perch). The long-tailed macaque's,
marmoset's, Barbary macaque's, squirrel monkey's, titi's and stump-tail's huddles were already in `sleep.json` from the
generator's own reading of their sleep text; this change is what makes them read.

## SIG3 (2026-11-23): second tranche

- **Doves' display_flight (released, 3 rows: wood pigeon, collared dove, spotted dove).** The old open-air target needed clear air under the crowns, so a dove perched in woodland never found one. A new `sky` target picks a point ahead of the bird and rises above whatever is highest on the way there (ground, flight floor, canopy top). The template is now perch, take off, climb steeply over the trees, glide down in a wide arc, return. It is exempt from the turn budget (`airTurns`). Each dove has its own English line.
- **Aldabra giant tortoise dig_burrow~nest (released).** Variant ids such as `dig_burrow~nest` now leave the dug-soil mark too (`recipeBase` in `index.ts`). Line: "{aAnimal} is digging a nest in the soil to lay its eggs".
- **Leopard tortoise nest and wallow~turtle: still held.** The leopard tortoise's episode stops after one dig, and the tortoise sinks into the grass. The wallow's hollow mark now draws, but it sits on dry grass with no mud.
- **House gecko pounce~lizard via `dash`: not made live.** At 22:00 WIB, with hunting fully on since 21:41, the server has no meal or escape by any gecko or lizard, although their food links have insect prey aboard. The harness frames (freeze, dash, eat) read for the gecko, but `dash` stays out of `LIVE_HUNT_ACTS` until a real gecko meal is seen to drive it. When that happens, gate it to `plan === "reptile"`. The wolf spider's dash has position jumps.
- **Marmoset and long-tailed macaque huddles: still held.** Their leaders sleep on v2 map points that carry no limb heading, so the marmosets end up inside the trunk and the macaques stand in single file. Seating the members along the map tangent made the other huddles' bodies coincide, so it was reverted.
- **SIG2-reason rows re-run:** nest_build (squirrels) and stone_hammer (long-tailed macaque, tufted capuchin) still find no episode in 24 Ark hours with the hold removed. beach_nest~bank is still crawl/turn/walk. All stay held.
- **Rows held but already in the table, so still live:** the marmoset, long-tailed and Barbary macaque huddles, the golden stag beetle's wrestle and the slender skimmer's hawk_insects. A hold only keeps a new row out; it does not remove one.
## SIG3 (2026-11-23): third tranche

- **Held rows that were live and read wrong, now switched off:**
  - **Golden stag beetle wrestle.** The pair its cluster gives were 7.5–10 m apart, "wrestling" across the clearing. A micro animal's pair act (`micro-acts.ts`) now plays only when the other one is drawn within four of the larger's body lengths.
  - **Marmoset and Barbary macaque huddles.** A held `sleep:<social>` row now takes the generator's huddle out of the sleep layer too (`ark-signature-recipes.mts`), so each sleeps a little apart.
  - **Slender skimmer hawk_insects.** Left as it is: a micro dragonfly is off the schedule, so its hawking never plays.
- **A huddle faces one way across its limb.** A raised sleep point now carries a heading for a huddle: the sampler point's own facing, or across a v2 map limb (the map point's tangent, kept on the Spot as `along`). Leader and members settle to it (`arrivalYaw` reads the place's `heading`).
  - **Long-tailed macaque huddle released.** The five sit side by side across their branch; they used to sit nose to tail in single file.
  - Capuchins, stump-tails and squirrel monkeys now face one way too.
  - Seating the huddle along the map limb itself was tried and reverted: lemurs past the limb's end were drawn two on one spot.
  - **Marmoset still held.** The five sit round a thick sloping limb, some under it.
- **Leopard tortoise nest dig released.** Its height off the ground does not change while it digs (0.21 m digging, 0.23 m walking). The "sink" came from the strip's camera sitting inside the grass. The grass press now also takes an animal digging in place, which clears its patch. Line: "{aAnimal} is digging a nest in the soil for its eggs". Its episode is the dig alone: its slot ends before the laying.
- **Gecko dash:** due for a re-check at about 22:00 WIB on 2026-11-24, after a day of real hunting. No meal is faked.
