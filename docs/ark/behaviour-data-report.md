# Ark behaviour data: what the stored data says animals do (rich-behaviours brief, step 1)

Branch `ark-behaviour-recipes` (landing). Written before the recipe engine was built, as the brief asks. Visual only: nothing here changes the server or the ecology.

**Generator:** `scripts/ark-behaviour-recipes.mts` (inputs: `scripts/ark-behaviour-load.mts`; rules: `scripts/ark-behaviour-text.mts`). Deterministic phrase rules, no AI calls. **Output:** `data/ark/behaviour-recipes.json`: every species, every behaviour found, each with its stored field and a verbatim phrase (whole words, cut from the sentence the rule matched).

## Headline

- **2,555 species are aboard** (2,626 with a model; 71 excluded), the same set as the behaviour lane's profiles.
- **The text is rich for some species and thin for most.** The median species has **one** behaviour beyond calls in its stored text. **624 species (24%) have nothing but calls**; they get body-plan defaults, flagged (list by plan below).
- **What the brief's specific behaviours can draw on:**
  - Fishing birds: plunge-diving 21, talons-first 7, wading 29, spearing 21, scooping 5. Kingfishers, gannets, terns, the osprey, herons and pelicans are all covered, by phrase or by taxon rule.
  - Other fishing: underwater chases 33 and dives 23 (penguins, cormorants, seals, puffins). River fishing (bears, the fishing cat) is only 3 by phrase.
  - Male contests 134; displays 393; courtship 231. Red deer, bighorn sheep, elephant seals, hippos and lizards' push-ups are all in the text.
  - Sex differences are stored for 2,103 species: size 1,151, features 486 (antlers, mane, crest, dewlap, train…), duller sex 185.
  - Nest building 310, with materials for 214; nests on beaches or in sand 12; incubating 467.
  - Digging 332, burying in sand 49.
  - Flocks 213, schools 65, herds 113, swarms 29, mixed flocks 25. V-formation 5 by phrase. "Murmuration" never appears; the starling's text says "coordinated flocks" and "very large flocks".
  - Basking 148, wallowing 37, dust-bathing 4, wing-drying 4.
  - Shaking off water, bathing, rolling and floating on the back are almost absent from the text, so they come from body-plan rules.
- **Seasons:** a mating season is written for 346 species (rut, breeding, courtship, or birth months). Another 935 have only the months they are best seen, a weaker sign. 1,274 have none.

## 1. Inventory: every stored field that describes behaviour

Coverage is of the 2,555 aboard. Breeds read their parent species' text, as in the behaviour lane's export (264 breeds).

| Field (stored as) | Species | Sentences | What it says about behaviour | Example |
|---|---|---|---|---|
| sleep_pattern (`species_field_guide`) | 2,520 | 4,045 | activity, roosts, basking, rumination, posture, torpor, flocks at dusk | red deer: "Crepuscular, often feeding at dawn and dusk, with rutting activity intense in autumn" |
| best_time_of_day | 2,520 | 2,467 | when it is active | "Daytime" |
| best_months | 2,520 | 2,556 | the season it is seen (and often breeds) | barn swallow: "April to September, during breeding season." |
| best_weather | 2,520 | (not used) | conditions for seeing it; no behaviour | "Clear, sunny days" |
| typical_habitat | 2,516 | 3,314 | where it does things (wallows, nesting beaches) | pigs: "mud or water for wallowing" |
| where_to_look | 2,520 | 3,435 | signs and behaviour (wallows, probe holes, dust-bathing hollows). Sentences telling people what to do ("Wait quietly…") are skipped | kiwi: "look for small probe holes in soft soil" |
| diet_summary | 2,520 | 3,131 | how it feeds (plunges, dabbles, sallies, probes) | yellow-legged gull: "It plunges for fish near the surface" |
| predators_summary | 2,520 | 4,918 | how it escapes (freeze, flee to cover, water or a tree, curl, ink); read only for defences | Annam pond turtle: "A disturbed turtle drops into the water and hides on the bottom" |
| female_offspring_notes | 2,520 | 4,103 | nests and materials, incubation, carrying young, feeding the young, birth season | tui: "The female builds a bulky nest of twigs and grass in a tree fork" |
| sex_difference_notes | 2,520 | 3,847 | size and look by sex, displays, contests | red deer: "Stags are much larger than hinds and grow branched antlers every year" |
| signature_traits[] | 2,500 | 10,393 | short behaviour labels | great cormorant: "Wing-drying posture" |
| interesting_facts[] | 2,500 | 10,182 | the richest behaviour text | red-necked wallaby: "Males spar by standing upright and grappling, pushing and kicking at each other" |
| species_spotlight | 2,520 | 5,111 | behaviour in a sentence or two | bighorn sheep: "In the autumn rut, rams rear and run at each other to collide horn to horn" |
| species_subtitle_story | 2,520 | 5,549 | a scene of it doing something | Chinese pond heron: "crouches motionless at the edge of a paddy or pond … then shoots its neck out to seize a fish" |
| biological_basis (`species_behavior_principles`) | 2,555 | 2,709 | the behaviour behind its Power, in plain biology | common kingfisher: "perch near water, watch for fish, then dive rapidly with pointed bills to catch prey below the surface" |
| behavioral_evidence[] observation and biological_function | 568 | 4,341 | observed behaviour with its function. The "interpretation" lines are lessons for people and are not used. 2,537 rows exist; most are empty arrays | red deer: "When two stags roar at one another without either withdrawing, the contest proceeds to a parallel walk and then to physical combat" |
| signature_explanation (`species_system_dynamics`) | 2,554 | 15,018 | researched behaviour, mixed with modelling language. Sentences about the model ("a bimodal system", "frequency", "mode") are skipped | Javan rhinoceros: "It digs and enlarges wallows" |
| activity_phrase (`voyage_species_traits`) | 2,096 | 2,093 | when it is active (the activity itself is already in the profiles) | "Adults are active on oak foliage by day in warm weather" |
| sociality_phrase | 711 | 709 | groups, roosts, harems | southern elephant seal: "A dominant bull may keep a harem of dozens of cows" |
| season_phrase | 305 | 310 | the breeding (mostly birth) season | red deer: "a hind gives birth in late May or June to one spotted calf" |

**Structured fields used as they are** (not text):
- The body plan: from the rig manifest, via the behaviour lane's `data/ark/behaviour-profiles.json`.
- From the profiles: movement, social structure, diet, roost and places. The profiles' sources are those lanes' (`voyage_species_traits`, the B1 microhabitat inventory, `layers.json`).
- Size, speed and dominance (`canonical_game_stats`); `voyage_food_links` (who eats whom); the sea depth bands; the taxonomy (class, order, family).

**Read but not used for behaviour:**
- `lifespan_estimate`;
- `best_weather`;
- the Power's lessons (`core_lesson`, `principle_expression`, the evidence "interpretation");
- the System Dynamics archetype names, which are metaphors ("A Roar That Declares Body Size");
- Trials, which describe what people do.

**Reads:** read-only SELECTs from production, in pages of 400 (the queries are in the header of `ark-behaviour-load.mts`). Plus the local exports already in the handover folder: the behaviour lane's `species.json` and the intelligence lane's `export.json`.

## 2. Method

- **Rules.** `RULES` in `ark-behaviour-text.mts`: one phrase rule per behaviour (64 behaviours). Each rule can also have:
  - a context the sentence must contain (fishing needs water or fish; gliding needs trees or membranes);
  - body-plan gates (no plunge-diving fish);
  - exclusions;
  - a threat check (fleeing counts only when something frightens it).
- **Sentences.** Sentences about larvae, caterpillars, nymphs and tadpoles are left out: the Ark shows the adult.
- **Not its own behaviour.** A match is passed over when:
  - it is negated ("does not hibernate", "unlike…", "avoids the cost of migration", "more like a goose than a dabbler");
  - the sentence is about what its predators do, or what its prey does ("lunges into a swarm", "swept through a school");
  - it is a System Dynamics sentence about the model;
  - it is a where-to-look sentence addressed to people.
- **Phrases.** A phrase is the whole sentence, or the clause round the match cut at word boundaries. This fixes the behaviour lane's clipper bug ("nsects", "ardvarks"), which this generator does not share.
- **Sex.**
  - The system: hermaphrodite, sex-changer, parthenogenetic, or the workers of an eusocial insect.
  - Which sex is bigger and by about how much. A drawn-length ratio comes from the words: "slightly" 1.05, the default 1.12, "much" 1.2, a weight percentage through its cube root, "twice" 1.45.
  - Each clause's subject owns the features named in it ("Stags … grow branched antlers"; "Hinds have no antlers").
  - The duller sex.
  - A stated sex ratio.
- **Seasons.** Months and seasons (northern) in sentences about mating (rut, breeding season, courtship, lek, spawning) or about nesting (eggs, birth). "May" counts only when written with a capital, never "may feed".
- **Nests.** The kind (cup, dome, platform, mud, cavity, scrape, mound, floating, bubble, burrow, bower) and the materials, both read from the sentences about its nest.

## 3. Checks: reading samples

Three rounds of seeded samples. Each round read about 4–6 hits per behaviour against the stored sentence.

- **Round 1** (about 300 hits) found these word collisions:
  - "stab" in *stable*; "spar" in *sparse* and *Sparrowhawk*; "mous" in *moustache*; "impal" in *impala*; "box" in *nest boxes*; "porpois" in the name *porpoise*; "May" in *may feed*.
  - Metaphors: "tools" for claws, "a spear bill".
  - Prey's behaviour: "lunges into a swarm", "swept through a school".
  - Instructions to people: "Wait quietly at a fruiting tree".
  - Young's behaviour: "chicks may drop into the water".
  - Breeding-season confusion: the traits' `season_phrase` is the birth season, not the rut.
  - Antler ownership: females were credited with antlers from "Stags … grow branched antlers; hinds have no antlers".
- **Round 2** (about 120 hits, key behaviours) fixed the remaining issues:
  - context rules for fishing, gliding and leaps;
  - kingfisher dives ("dive rapidly … to catch prey below the surface");
  - floating on the back;
  - carrying young on the belly;
  - hippos' "gaping … at any rival";
  - elephant seals' "fight for breeding access".
- **Round 3** (241 hits, a new seed): **21 read as wrong (91% right)**. Its fixes removed 9 of those:
  - land leaps counted as breaching;
  - buried eggs counted as burying itself;
  - "more important than display";
  - "survived a brief freeze";
  - a guppy's "flashes colour" counted as inking.
- **What is left**, mostly harmless for a recipe:
  - "huge flocks" of geese and pigeons read as murmuration. The recipe gates murmurations to small birds (§7).
  - "a spear bill" (a shape);
  - one "nuthatches and flycatchers" mention.

## 4. Coverage per behaviour

Species aboard with at least one phrase, the top body plans, the fields the first phrase came from, and an example.

| Behaviour | Label | Species | Top plans | First phrase from | Example |
|---|---|---|---|---|---|
| `plunge_dive` | plunge-diving from the air or a perch | 21 | flying_bird 21 | diet 6, traits 6, story 4 | american-white-pelican: "Groups swim in a line or horseshoe, beating their wings on the water to push fish into the shallows, then plun" (story) |
| `feet_first` | feet-first fishing (talons) | 7 | flying_bird 7 | traits 3, basis 1, spotlight 1 | african-fish-eagle: "African Fish Eagles perch near lakes and rivers, use ringing calls, sharp vision, and strong talons to hunt fi" (basis) |
| `hover` | hovering | 92 | fish 38, flying_bird 29, flying_insect 25 | sd 18, diet 17, traits 14 | american-kestrel: "Hovers into the wind or bobs its tail while perched on wires" (traits) |
| `wade` | wading in the shallows | 29 | flying_bird 25, quadruped 3, walking_bird 1 | story 7, traits 5, spotlight 4 | american-avocet: "Tall legs for wading through saline ponds, marshes, and flats" (traits) |
| `spear` | spearing or stabbing prey with the bill | 21 | flying_bird 21 | diet 6, spotlight 4, traits 3 | anhinga: "Snake-neck profile: the long neck becomes a spear above a submerged body" (traits) |
| `scoop` | scooping fish with a pouch or bill | 5 | flying_bird 5 | spotlight 1, story 1, diet 1 | american-white-pelican: "Unlike the brown pelican it never dives from the air: it swims, dips its huge pouched bill into the water and " (spotlight) |
| `bill_sweep` | sweeping or filtering with the bill | 17 | flying_bird 17 | evidence 14, facts 1, diet 1 | american-avocet: "American Avocets often feed by sweeping the bill through water like a moving filter" (facts) |
| `dabble` | dabbling and up-ending | 27 | flying_bird 27 | evidence 14, diet 5, spotlight 2 | ancona-duck: "Ducks often tip their bodies forward, submerging their heads and necks to filter food from the water, while th" (evidence) |
| `bank_fishing` | fishing from the bank or at the river | 3 | quadruped 3 | spotlight 1, evidence 1, diet 1 | fishing-cat: "Scooping fish out of the shallows with a paw" (spotlight) |
| `chase_fish` | chasing fish underwater (schools, bait balls) | 33 | flying_bird 17, fish 6, flightless_bird 5 | traits 11, basis 6, diet 5 | african-penguin: "It hunts by pursuit diving, usually to less than 30 metres though dives past 100 metres are recorded, and smal" (diet) |
| `surface_dive` | diving from the surface | 23 | flying_bird 14, fish 4, quadruped 4 | basis 8, spotlight 3, sd 3 | belted-kingfisher: "The Belted Kingfisher uses a shaggy crest, a heavy bill, and a loud rattling call before it dives for fish" (story) |
| `hawking` | catching insects in the air | 58 | flying_bird 53, flying_insect 5 | diet 25, sd 9, traits 8 | acorn-woodpecker: "It often catches flying insects in the air, sallying out from a high perch like a flycatcher" (facts) |
| `pounce` | stalking and pouncing | 30 | quadruped 21, arachnid 5, flying_bird 3 | story 11, traits 6, diet 4 | bengal-cat: "Crouched motionless beside a gap in a fence, a cat may wait for many minutes, then pounce in under a second wh" (story) |
| `ambush` | waiting in ambush | 169 | fish 44, legless 30, flying_bird 16 | traits 33, diet 30, sd 20 | african-lion: "Lionesses often hunt together, coordinating movements to encircle and ambush prey, especially larger animals" (evidence) |
| `probe` | probing mud, sand or soil | 33 | flying_bird 28, quadruped 4, flightless_bird 1 | diet 8, traits 6, sd 6 | african-sacred-ibis: "It feeds by walking slowly and probing mud, soft soil and shallow water with its long, down-curved bill, and s" (diet) |
| `worm_pull` | pulling worms from the ground | 14 | flying_bird 14 | diet 11, facts 2, basis 1 | american-robin: "Earthworms, insects, berries, and fruit" (diet) |
| `drumming` | drumming or hammering on wood | 19 | quadruped 7, flying_bird 6, insect 4 | facts 7, sleep 4, sexdiff 3 | banner-tailed-kangaroo-rat: "It drums its hind feet on the ground in rhythmic bursts, and studies suggest neighbours can recognise one anot" (facts) |
| `tool_use` | tool use | 21 | flying_bird 11, primate 6, cephalopod_jelly 1 | facts 7, sd 3, basis 3 | abyssinian-ground-hornbill: "small mammals and carrion with a heavy bill used as a tool rather than a trap" (sd) |
| `caching` | food caching and hoarding | 70 | quadruped 33, flying_bird 24, insect 4 | facts 13, diet 12, sd 9 | acorn-woodpecker: "Acorn Woodpecker feeds on acorns, insects, sap, fruit, and cached nuts from drilled holes" (diet) |
| `graze_rumination` | chewing the cud | 36 | quadruped 36 | sleep 32, sd 2, facts 2 | african-forest-buffalo: "Through the heat of the day the herd lies up in shade, ruminating" (sd) |
| `bask` | basking in the sun | 148 | lizard 70, turtle 23, flying_insect 15 | sleep 101, sd 13, facts 9 | ackie-monitor: "Ackie Monitors are diurnal, basking before hunting and retreating into rock when risk or temperature demands i" (sleep) |
| `wing_dry` | spreading wings to dry or sun | 4 | flying_bird 4 | traits 2, spotlight 2 | anhinga: "Wing drying: the return to air is part of the method" (traits) |
| `dust_bathe` | dust or sand bathing | 4 | quadruped 2, walking_bird 2 | facts 3, look 1 | desert-kangaroo-rat: "It dust-bathes in loose sand, which keeps its fur from becoming matted with oil" (facts) |
| `wallow` | wallowing in mud or water | 37 | quadruped 34, turtle 2, amphibian 1 | habitat 18, sleep 13, look 2 | african-forest-buffalo: "On forest trails, look for large cloven hoofprints, cattle-like dung and muddy wallows" (look) |
| `bathe` | bathing in water | 0 |  |  |  |
| `roll` | rolling on the ground | 0 |  |  |  |
| `groom` | grooming or preening itself | 95 | flying_bird 41, quadruped 25, primate 20 | facts 22, sd 17, evidence 16 | american-dipper: "Its preen gland is reported to be about ten times the size of that of other songbirds of similar weight" (facts) |
| `allogroom` | grooming each other | 14 | flying_bird 6, primate 5, quadruped 2 | spotlight 4, evidence 4, basis 2 | black-tailed-prairie-dog: "Tunnels, lookout posts, social grooming, alarm calls, and coteries turn grassland into communication infrastru" (spotlight) |
| `shake_off` | shaking off water | 0 |  |  |  |
| `stretch_yawn` | stretching and yawning | 2 | primate 1, quadruped 1 | traits 1, story 1 | hamadryas-baboon: "Adult males yawn widely to display long canines" (traits) |
| `sleep_posture` | a particular sleeping posture | 28 | flying_bird 12, quadruped 3, primate 3 | sleep 17, spotlight 3, sd 3 | black-giant-squirrel: "To reach fruit at the tip of a thin branch, the squirrel can hang upside down by its hind feet, leaving its fo" (story) |
| `float_back` | floating on its back | 1 | quadruped 1 | traits 1 | sea-otter: "Floating on the back turns the body into a workbench" (traits) |
| `flock` | flocking | 213 | flying_bird 190, walking_bird 16, flying_insect 7 | sleep 95, facts 45, traits 14 | african-grey-parrot: "Flocks have been watched gathering in swampy forest clearings in the Congo Basin to eat soil and drink" (facts) |
| `murmuration` | murmurations (swirling flocks at the roost) | 5 | flying_bird 4, walking_bird 1 | spotlight 2, facts 1, sd 1 | common-wood-pigeon: "In autumn, birds from the north and east of Europe move south-west in huge flocks, and very large numbers cros" (spotlight) |
| `v_formation` | flying in V or line formation | 5 | flying_bird 5 | sleep 1, traits 1, evidence 1 | black-headed-gull: "In the evening birds fly in long lines to roost communally on open water such as reservoirs" (sleep) |
| `school` | schooling or shoaling | 65 | fish 64, quadruped 1 | sleep 23, traits 9, facts 7 | atlantic-cod: "Schooling movement" (traits) |
| `herd` | moving in herds | 113 | quadruped 113 | offspring 26, look 23, sleep 18 | african-bush-elephant: "Females carry calves through a long pregnancy and raise them with help from the herd" (offspring) |
| `swarm` | swarming | 29 | insect 15, flying_insect 9, fish 5 | offspring 4, facts 4, sleep 4 | american-paddlefish: "With these it finds plankton swarms in muddy water and in darkness" (spotlight) |
| `mixed_flock` | mixed-species flocks or groups | 25 | flying_bird 19, primate 3, quadruped 2 | facts 14, sd 4, sleep 2 | black-capped-bulbul: "It is often reported travelling with the mixed feeding flocks of other birds that move through Sri Lankan fore" (facts) |
| `follow` | following others (single file, a leader, the mother) | 53 | quadruped 29, flying_bird 19, crustacean 2 | offspring 39, spotlight 5, sd 3 | aardvark: "Females usually give birth to a single young in a burrow, where the baby is protected before following the mot" (offspring) |
| `migration` | migration | 157 | flying_bird 73, fish 26, flying_insect 13 | facts 44, sleep 38, habitat 17 | african-forest-elephant: "Calves learn migration paths, feeding sites, and social signals from the herd" (offspring) |
| `hibernation` | hibernation, torpor or brumation | 74 | quadruped 32, flying_bird 10, flying_insect 7 | sleep 42, facts 12, spotlight 6 | alpine-marmot: "Hibernation in a grass-lined chamber lasts from about October to April" (sleep) |
| `glide` | gliding between trees | 8 | quadruped 5, lizard 1, legless 1 | traits 4, diet 1, sexdiff 1 | feathertail-glider: "minute body. feather-like tail. gliding membrane. and fine steering control" (traits) |
| `brachiate` | swinging or hanging from branches | 8 | primate 6, quadruped 2 | basis 4, sd 2, evidence 1 | hoolock-gibbon: "Hoolock Gibbons travel through forest canopy by brachiation and use loud duet songs to maintain pair bonds and" (basis) |
| `stott` | stotting or pronking | 3 | quadruped 3 | spotlight 2, traits 1 | mule-deer: "When alarmed it often escapes by stotting, bounding with all four feet leaving and landing together" (spotlight) |
| `breach` | breaching, leaping or tail-slapping | 6 | fish 5, quadruped 1 | facts 2, sd 1, spotlight 1 | atlantic-tarpon: "They are famous for dramatic leaps above the water" (facts) |
| `run_on_water` | running across the water | 6 | flying_bird 4, lizard 1, fish 1 | sd 4, facts 1, diet 1 | african-jacana: "A jacana walks on water lilies" (sd) |
| `dig` | digging | 332 | quadruped 131, flying_bird 47, lizard 31 | offspring 71, sd 65, traits 35 | aardvark: "Their rhythm is sleep underground, emerge, listen, dig, lick, and keep moving" (sleep) |
| `sand_bury` | burying itself in sand or mud | 49 | fish 18, turtle 11, crustacean 7 | sleep 24, sd 12, facts 6 | african-clawed-frog: "When a pond dries out it can bury itself in the mud and wait, or cross land in wet weather to reach new water" (facts) |
| `nest_build` | nest building | 310 | flying_bird 196, quadruped 54, flying_insect 13 | offspring 217, facts 24, sleep 21 | african-fish-eagle: "Females lay eggs in large stick nests near water, and both parents help guard and feed the young" (offspring) |
| `beach_nest` | digging a nest on the beach or in sand | 12 | turtle 9, crustacean 2, lizard 1 | habitat 6, offspring 4, story 1 | desert-iguana: "Mating follows spring emergence; in early summer females lay eggs in sandy soil or burrows, with young indepen" (offspring) |
| `incubate` | incubating or brooding eggs | 467 | flying_bird 341, walking_bird 38, lizard 23 | offspring 414, facts 16, sd 15 | abyssinian-ground-hornbill: "and the female incubates for about five to six weeks while the male brings her food" (offspring) |
| `carry_young` | carrying young | 76 | quadruped 24, primate 20, fish 10 | offspring 44, facts 12, sd 8 | african-jacana: "and carries the chicks under his wings" (sd) |
| `provision` | bringing food to the young | 193 | flying_bird 172, walking_bird 10, quadruped 7 | offspring 174, diet 6, facts 5 | acorn-woodpecker: "Incubation lasts roughly 11 days, and the whole group, including grown young from earlier years, feeds the chi" (offspring) |
| `courtship` | courtship | 231 | flying_bird 113, fish 19, walking_bird 16 | facts 48, sexdiff 28, spotlight 27 | african-penguin: "African Penguins breed in colonies along southern African coasts, form pair bonds, and forage at sea while fac" (basis) |
| `display` | displays (posture, crest, wings, tail, throat) | 393 | flying_bird 158, quadruped 52, lizard 36 | sexdiff 95, sleep 52, facts 49 | aardwolf: "Mane raised in defensive display" (traits) |
| `male_combat` | male combat, rut or rivals' contests | 134 | quadruped 58, flying_insect 14, insect 12 | facts 42, sexdiff 26, sd 25 | african-lion: "Coalitions of two or more males (often brothers) jointly take over and defend prides and territories against r" (evidence) |
| `scent_mark` | scent marking | 25 | quadruped 19, primate 6 | facts 7, traits 4, sd 4 | african-civet: "Scent-marking glands used to communicate presence and territory" (traits) |
| `freeze` | freezing when alarmed | 218 | quadruped 58, flying_bird 32, fish 32 | sd 63, predators 57, sleep 24 | acorn-barnacle: "Experiments have shown it can survive part of its body water freezing during winter low tides" (facts) |
| `flee_cover` | fleeing to cover | 41 | quadruped 14, fish 10, walking_bird 4 | predators 26, sd 6, spotlight 3 | australasian-swamphen: "Groups mob a harrier noisily, and a frightened bird runs for cover, taking flight only when pressed" (predators) |
| `flee_water` | fleeing into water | 16 | turtle 5, quadruped 4, lizard 3 | sd 3, story 3, predators 2 | annam-pond-turtle: "A disturbed turtle drops into the water and hides on the bottom" (predators) |
| `flee_tree` | fleeing up a tree | 13 | quadruped 9, lizard 3, primate 1 | predators 8, evidence 2, facts 2 | asian-water-monitor: "They are excellent swimmers, climb trees, and move effectively on land, often escaping into water when threate" (evidence) |
| `curl_shell` | curling up or withdrawing into a shell | 18 | turtle 6, quadruped 4, other 4 | predators 10, sd 3, story 3 | asian-forest-tortoise: "It withdraws into its shell when disturbed" (predators) |
| `ink` | inking or colour flashes | 6 | cephalopod_jelly 6 | predators 3, sd 2, facts 1 | common-octopus: "If attacked, it can jet away and release ink" (sd) |
| `call` | calling or singing | 699 | flying_bird 345, quadruped 177, amphibian 39 | facts 182, traits 142, sleep 136 | abyssinian-ground-hornbill: "Ground walking and thunderous calls" (traits) |

**Body plans aboard:**

| Plan | Species |
|---|---|
| quadruped | 604 |
| flying_bird | 598 |
| fish | 301 |
| flying_insect | 173 |
| insect | 152 |
| lizard | 110 |
| legless | 92 |
| primate | 79 |
| arachnid | 77 |
| other | 68 |
| amphibian | 67 |
| turtle | 62 |
| walking_bird | 62 |
| crustacean | 55 |
| cephalopod_jelly | 28 |
| flightless_bird | 20 |
| bat | 7 |

## 5. Sex

| System | Species | Note |
|---|---|---|
| separate sexes | 2,478 | seeded 1:1 unless a ratio is stated |
| colony workers | 36 | ants, bees, wasps, termites: almost all seen are female workers (2% males) |
| hermaphrodite | 20 | snails, slugs, barnacles, earthworms, sea slugs: no sex drawn |
| changes sex | 10 | wrasses, parrotfish, barramundi, sea bass: drawn by size (the bigger are the later sex) |
| parthenogenetic | 11 | stick and leaf insects, whiptails, rotifers, water fleas: all or nearly all female |

- **Size:**
  - male bigger in 734;
  - female bigger in 417 (raptors, spiders, many insects and fish);
  - alike or not stated in 1,404.
- **Features:** 486 species name a visual feature by sex.
- **Duller sex:** 185 species say which sex is duller (usually the female).
- **Stated ratio:** 67 differ from 1:1.

## 6. Seasons

| Season found | Mating (contests, courtship) | Nesting (building, eggs) |
|---|---|---|
| written as mating (rut, breeding, courtship, spawning) | 167 | 102 |
| written as nesting or birth only | 179 | 244 |
| only the months it is best seen | 935 | 935 |
| none (all year, at a lower rate) | 1,274 | 1,274 |

## 7. Nests

- **310 species** have a nest-building phrase (196 flying birds, 54 quadrupeds, 13 flying insects…).
- **Kinds:** cup 37, dome 45, platform 31, mud 13, cavity 22, scrape 8, mound 8, bower 6, bubble 5, floating 3, burrow 1. "Other" is 131: a nest is named but not its shape; the recipe falls back to the plan's usual nest.
- **Materials:**

| Material | Species |
|---|---|
| twigs | 92 |
| grass | 43 |
| leaves | 31 |
| reeds | 27 |
| hair | 24 |
| mud | 18 |
| feathers | 14 |
| bark | 10 |
| saliva | 10 |
| bubbles | 6 |
| moss | 5 |
| pebbles (penguins) | 5 |
| seaweed | 4 |
| silk | 3 |
| sand | 1 |
| lichen | 1 |

## 8. Species with nothing: body-plan defaults (flagged)

624 species have no behaviour beyond calls.

| Plan | Species |
|---|---|
| quadruped | 150 |
| fish | 81 |
| flying_insect | 74 |
| insect | 64 |
| other | 41 |
| flying_bird | 38 |
| arachnid | 34 |
| amphibian | 29 |
| legless | 27 |
| crustacean | 18 |
| primate | 18 |
| lizard | 16 |
| cephalopod_jelly | 13 |
| turtle | 8 |
| walking_bird | 7 |
| bat | 3 |
| flightless_bird | 2 |

Examples:
- the addax, the alpine ibex, the American lobster, the Amazon river dolphin, the Andean condor;
- the Asiatic black bear, the atlas moth, the arapaima and the Akita (the Akita is a breed, but its parent's text is thin too).

Their recipes come from the body plan, flagged `{default}` in the data:

| Plan | Defaults (each flagged) |
|---|---|
| quadruped | self-groom, stretch and yawn, shake off after water (swimmers and waders), roll (hoofed grazers) |
| primate | groom and allogroom (in a group), stretch and yawn |
| flying, walking and flightless birds | preen, stretch a wing, bathe at the water's edge and shake off |
| bat | groom, hang to sleep |
| lizard | bask (sun) |
| turtle | bask, withdraw when alarmed |
| amphibian | sit and wait, drop into the water when alarmed |
| insect and flying insect | groom the antennae and legs |
| arachnid | sit and wait |
| crustacean | sit and wait, back into cover when alarmed |
| fish | school (social species) or hover |
| legless | sit and wait |
| other, cephalopod and jelly | none (they drift; the sea lane's motion) |

**Taxon rules (flagged `{rule}`).** Where the text is thin but the family says what it does (not a guess at a single species' habits), a recipe can also come from a taxon rule:

| Taxon | Recipe |
|---|---|
| kingfishers (Alcedinidae) | plunge from a perch |
| gannets and boobies (Sulidae), terns (Sternidae) | plunge from the air |
| the osprey (Pandionidae), sea and fish eagles | talons-first |
| herons and egrets (Ardeidae) | wade and spear |
| pelicans | scoop |
| bears near water | fish at the river |
| otters (Lutrinae), seals (Phocidae, Otariidae), dolphins (Delphinidae), penguins (Spheniscidae), cormorants | chase fish |
| deer (Cervidae) | antler clashes in the rut |
| goats and sheep (Caprinae) | head-butting |
| hippos | jaw sparring |
| iguanas, agamas, anoles and spiny lizards | push-up display |
| moles, rabbits, aardvarks, armadillos | dig |
| fowl (Phasianidae) | dust-bathe |
| geese, swans and cranes | V or line formation |

Each such recipe says which rule made it.

## 9. What this means for the recipes (next steps on this branch)

**Strong data:**
- fishing birds;
- penguins and seals chasing fish;
- deer, sheep and goats in the rut;
- displays and courtship;
- nest building with materials;
- basking;
- digging;
- flocks, schools and herds.

**Thin, so mostly rule-based:**
- river fishing (3);
- dust-bathing (4);
- wing-drying (4);
- murmuration (5, the starling among them);
- V-formation (5 by phrase, geese and cranes by rule);
- shaking off, bathing and rolling (0 by phrase).

**Not found at all:** nothing the brief names is wholly absent. Shaking off water, bathing and rolling rest entirely on body-plan rules.

**Seeded sex:** 2,478 species get a seeded sex, at their stated ratio. Visual differences are possible where the text names them: size for 1,151, colour or plumage for 185, features for 486. The harness question (requiring a male and female pair) is answered in `docs/ark/behaviour-recipes.md` once it has been run.
