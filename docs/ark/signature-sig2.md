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
| molehills | southern-mole-cricket | only a dark hole patch; the cricket is not visible |
| bank_burrow | giant-mud-crab | the dig is a small pitch on an open sandy bed under water: no burrow or bank reads |
| wrestle | golden-stag-beetle | the beetles are not in the frame; a stone fills the corner |
| night_hawk | european-hornet | at night the insect at the light is a tiny purple moth-like shape: not readable as a hornet |
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
