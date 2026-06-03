# Catalog-to-Website Parity Report

_Generated: 2026-06-02T15:21:47.918Z_

## Data sources

- **Catalog:** supabase species_profiles (catalog_status=active, animaldex_number set, non-hidden)
- **Website:** `speciesEntries` in `src/data/species.ts`
- **Match keys:** `landing_page_slug`, `normalized_identity_key`, `scientific_name`, `species_profile_id`

## Coverage summary

- Catalog species count: **101**
- Website species count: **981**
- Matched count: **28**
- Missing website pages: **73**
- Website-only pages (no numbered catalog match): **64**
- Coverage: **27.72%**

> Primary scope: **active**, **numbered** (`animaldex_number` set), **non-hidden** catalog species from Supabase `species_profiles`.

## Missing website pages

Active catalog species without a matching website animal page.

| animaldex_number | display_name | slug / normalized_identity_key | scientific_name | principle_name | priority_score | priority_reasons |
| --- | --- | --- | --- | --- | --- | --- |
| 108 | Asiatic Black Bear | asiatic-black-bear / asiatic_black_bear | Ursus thibetanus | — | 27 | symbolism:bear; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 157 | Epaulette Shark | epaulette-shark / epaulette_shark | Hemiscyllium ocellatum | — | 27 | symbolism:shark; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 215 | Spectacled Bear | spectacled-bear / spectacled_bear | Tremarctos ornatus | — | 27 | symbolism:bear; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 252 | Steppe Eagle | steppe-eagle / steppe_eagle | Aquila nipalensis | — | 27 | symbolism:eagle; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 280 | Spinner Dolphin | spinner-dolphin / spinner_dolphin | Stenella longirostris | — | 27 | symbolism:dolphin; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 360 | Ethiopian Wolf | ethiopian-wolf / ethiopian_wolf | Canis simensis | — | 27 | symbolism:wolf; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 418 | Coconut Octopus | coconut-octopus / coconut_octopus | Amphioctopus marginatus | — | 27 | symbolism:octopus; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 421 | Lowland Streaked Tenrec | lowland-streaked-tenrec / lowland_streaked_tenrec | Hemicentetes semispinosus | — | 27 | symbolism:owl; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 600 | Indochinese Tiger | indochinese-tiger / indochinese_tiger | Panthera tigris corbetti | — | 27 | symbolism:tiger; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 614 | Bornean Pygmy Elephant | bornean-pygmy-elephant / bornean_pygmy_elephant | Elephas maximus borneensis | — | 27 | symbolism:elephant; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 19 | Purple Finch | purple-finch / purple_finch | Haemorhous purpureus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 30 | Greater Rhea | greater-rhea / greater_rhea | Rhea americana | — | 5 | active-catalog; principle:unavailable (no website page) |
| 50 | African Palm Civet | african-palm-civet / african_palm_civet | Nandinia binotata | — | 5 | active-catalog; principle:unavailable (no website page) |
| 59 | Oriental Pied Hornbill | oriental-pied-hornbill / oriental_pied_hornbill | Anthracoceros albirostris | — | 5 | active-catalog; principle:unavailable (no website page) |
| 64 | Southern African Porcupine | southern-african-porcupine / southern_porcupine | Hystrix africaeaustralis | — | 5 | active-catalog; principle:unavailable (no website page) |
| 72 | Eastern Collared Lizard | eastern-collared-lizard / eastern_collared_lizard | Crotaphytus collaris | — | 5 | active-catalog; principle:unavailable (no website page) |
| 75 | Yellow Mongoose | yellow-mongoose / yellow_mongoose | Cynictis penicillata | — | 5 | active-catalog; principle:unavailable (no website page) |
| 85 | Grey Seal | grey-seal / grey_seal | Halichoerus grypus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 104 | Lesser Grison | lesser-grison / lesser_grison | Galictis cuja | — | 5 | active-catalog; principle:unavailable (no website page) |
| 106 | Neotropic Cormorant | neotropic-cormorant / neotropic_cormorant | Nannopterum brasilianum | — | 5 | active-catalog; principle:unavailable (no website page) |
| 118 | Gaur | gaur / gaur | Bos gaurus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 148 | Southern Lechwe | southern-lechwe / southern_lechwe | Kobus leche | — | 5 | active-catalog; principle:unavailable (no website page) |
| 166 | Giant Otter | giant-otter / giant_otter | Pteronura brasiliensis | — | 5 | active-catalog; principle:unavailable (no website page) |
| 199 | Olive Ridley Sea Turtle | olive-ridley-sea-turtle / olive_ridley_sea_turtle | Lepidochelys olivacea | — | 5 | active-catalog; principle:unavailable (no website page) |
| 209 | Southern Three-banded Armadillo | southern-three-banded-armadillo / southern_three_banded_armadillo | Tolypeutes matacus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 216 | Geoffroy's Cat | geoffroys-cat / geoffroys_cat | Leopardus geoffroyi | — | 5 | active-catalog; principle:unavailable (no website page) |
| 218 | Water Chevrotain | water-chevrotain / water_chevrotain | Hyemoschus aquaticus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 232 | Giant Malabar Squirrel | giant-malabar-squirrel / giant_malabar_squirrel | Ratufa indica | — | 5 | active-catalog; principle:unavailable (no website page) |
| 253 | Tibetan Fox | tibetan-fox / tibetan_fox | Vulpes ferrilata | — | 5 | active-catalog; principle:unavailable (no website page) |
| 255 | Greater Mouse-deer | greater-mouse-deer / greater_mouse_deer | Tragulus napu | — | 5 | active-catalog; principle:unavailable (no website page) |
| 261 | Moon Rat | moon-rat / moon_rat | Echinosorex gymnura | — | 5 | active-catalog; principle:unavailable (no website page) |
| 262 | Sally Lightfoot Crab | sally-lightfoot-crab / sally_lightfoot_crab | Grapsus grapsus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 265 | American Crocodile | american-crocodile / american_crocodile | Crocodylus acutus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 270 | Macaroni Penguin | macaroni-penguin / macaroni_penguin | Eudyptes chrysolophus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 279 | Wattled Crane | wattled-crane / wattled_crane | Bugeranus carunculatus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 281 | Marsh Deer | marsh-deer / marsh_deer | Blastocerus dichotomus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 285 | Black-footed Cat | black-footed-cat / black_footed_cat | Felis nigripes | — | 5 | active-catalog; principle:unavailable (no website page) |
| 286 | Smooth-coated otter | smooth-coated-otter / smooth_coated_otter | Lutrogale perspicillata | — | 5 | active-catalog; principle:unavailable (no website page) |
| 293 | Spotted Linsang | spotted-linsang / spotted_linsang | Prionodon pardicolor | — | 5 | active-catalog; principle:unavailable (no website page) |
| 313 | Pere David's Deer | pere-davids-deer / pere_davids_deer | Elaphurus davidianus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 319 | Southern Caracara | southern-caracara / southern_caracara | Caracara plancus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 355 | Swinhoe's Pheasant | swinhoes-pheasant / swinhoes_pheasant | Lophura swinhoii | — | 5 | active-catalog; principle:unavailable (no website page) |
| 425 | Giant Weta | giant-weta / giant_weta | Deinacrida heteracantha | — | 5 | active-catalog; principle:unavailable (no website page) |
| 430 | Kodkod | kodkod / kodkod | Leopardus guigna | — | 5 | active-catalog; principle:unavailable (no website page) |
| 441 | Fanaloka | fanaloka / fanaloka | Fossa fossana | — | 5 | active-catalog; principle:unavailable (no website page) |
| 452 | Persian Leopard | persian-leopard / persian_leopard | Panthera pardus tulliana | — | 5 | active-catalog; principle:unavailable (no website page) |
| 455 | Cozumel Coati | cozumel-coati / cozumel_coati | Nasua narica nelsoni | — | 5 | active-catalog; principle:unavailable (no website page) |
| 473 | Goodfellow's Tree-kangaroo | goodfellows-tree-kangaroo / goodfellows_tree_kangaroo | Dendrolagus goodfellowi | — | 5 | active-catalog; principle:unavailable (no website page) |
| 476 | Philippine Tarsier | philippine-tarsier / philippine_tarsier | Carlito syrichta | — | 5 | active-catalog; principle:unavailable (no website page) |
| 483 | Red-lipped Batfish | red-lipped-batfish / red_lipped_batfish | Ogcocephalus darwini | — | 5 | active-catalog; principle:unavailable (no website page) |
| 499 | Common Cusimanse | common-cusimanse / common_cusimanse | Crossarchus obscurus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 509 | Alpine Musk Deer | alpine-musk-deer / alpine_musk_deer | Moschus chrysogaster | — | 5 | active-catalog; principle:unavailable (no website page) |
| 525 | East African Oryx | east-african-oryx / east_african_oryx | Oryx beisa | — | 5 | active-catalog; principle:unavailable (no website page) |
| 582 | Red-bellied Titi | red-bellied-titi / red_bellied_titi | Plecturocebus moloch | — | 5 | active-catalog; principle:unavailable (no website page) |
| 604 | Rakali | rakali / rakali | Hydromys chrysogaster | — | 5 | active-catalog; principle:unavailable (no website page) |
| 647 | Hispaniolan Solenodon | hispaniolan-solenodon / hispaniolan_solenodon | Solenodon paradoxus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 663 | Honduran White Bat | honduran-white-bat / honduran_white_bat | Ectophylla alba | — | 5 | active-catalog; principle:unavailable (no website page) |
| 672 | Silvery Gibbon | silvery-gibbon / silvery_gibbon | Hylobates moloch | — | 5 | active-catalog; principle:unavailable (no website page) |
| 688 | Anegada Rock Iguana | anegada-rock-iguana / anegada_rock_iguana | Cyclura pinguis | — | 5 | active-catalog; principle:unavailable (no website page) |
| 717 | Oncilla | oncilla / oncilla | Leopardus tigrinus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 777 | Roloway Monkey | roloway-monkey / roloway_monkey | Cercopithecus roloway | — | 5 | active-catalog; principle:unavailable (no website page) |
| 808 | Dibbler | dibbler / dibbler | Parantechinus apicalis | — | 5 | active-catalog; principle:unavailable (no website page) |
| 821 | Pygmy Three-toed Sloth | pygmy-three-toed-sloth / pygmy_three_toed_sloth | Bradypus pygmaeus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 834 | Maned Sloth | maned-sloth / maned_sloth | Bradypus torquatus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 840 | Darwin's Fox | darwins-fox / darwins_fox | Lycalopex fulvipes | — | 5 | active-catalog; principle:unavailable (no website page) |
| 842 | Ili Pika | ili-pika / ili_pika | Ochotona iliensis | — | 5 | active-catalog; principle:unavailable (no website page) |
| 854 | Golden Lancehead | golden-lancehead / golden_lancehead | Bothrops insularis | — | 5 | active-catalog; principle:unavailable (no website page) |
| 869 | Cuban Solenodon | cuban-solenodon / cuban_solenodon | Solenodon cubanus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 905 | Pink Fairy Armadillo | pink-fairy-armadillo / pink_fairy_armadillo | Chlamyphorus truncatus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 909 | Tenkile | tenkile / tenkile | Dendrolagus scottae | — | 5 | active-catalog; principle:unavailable (no website page) |
| 972 | Yeti Crab | yeti-crab / yeti_crab | Kiwa hirsuta | — | 5 | active-catalog; principle:unavailable (no website page) |
| 1001 | Black Widow | black-widow-animaldex-repair / black_widow_animaldex_repair | Latrodectus mactans | — | 5 | active-catalog; principle:unavailable (no website page) |
| 1005 | Sulcata Tortoise | sulcata-tortoise-animaldex-repair / sulcata_tortoise_animaldex_repair | Centrochelys sulcata | — | 5 | active-catalog; principle:unavailable (no website page) |

## Website-only pages

Pages with no matching numbered catalog profile (active or seeded).

| slug | name | normalized_identity_key | species_profile_id | scientific_name | principle_name |
| --- | --- | --- | --- | --- | --- |
| anglerfish | Anglerfish | anglerfish |  | Lophiiformes | Stealth |
| argentine-horned-frog | Argentine Horned Frog | argentine-horned-frog |  | Ceratophrys ornata | Precision |
| basilisk-lizard | Basilisk Lizard | basilisk-lizard |  | Basiliscus basiliscus | Precision |
| burrowing-parrot | Burrowing Parrot | burrowing-parrot |  | Cyanoliseus patagonus | Efficiency |
| carp | Carp | carp |  | Cyprinus carpio | Precision |
| cat | Cat | cat |  | Felis catus | Adaptability |
| chameleon | Chameleon | chameleon |  | Chamaeleonidae | Precision |
| cicada | Cicada | cicada |  | Cicadoidea | Precision |
| cockroach | Cockroach | cockroach |  | Blattodea | Adaptability |
| common-mudpuppy | Common Mudpuppy | common-mudpuppy |  | Necturus maculosus | Precision |
| cormorant | Cormorant | cormorant |  | Phalacrocoracidae | Precision |
| crab | Crab | crab |  | Brachyura | Efficiency |
| crocodile | Crocodile | crocodile |  | Crocodylidae | Efficiency |
| deer | Deer | deer |  | Cervidae | Precision |
| dik-dik | Dik-dik | dik-dik |  | Madoqua kirkii | Efficiency |
| dolphin | Dolphin | dolphin |  | Delphinidae | Communication |
| dragonfly | Dragonfly | dragonfly |  | Anisoptera | Precision |
| drill-monkey | Drill Monkey | drill-monkey |  | Mandrillus leucophaeus | Precision |
| eagle | Eagle | eagle |  | Aquila and related eagle genera | Efficiency |
| elephant | Elephant | elephant |  | Elephantidae | Memory |
| finch | Finch | finch |  | Fringillidae and related finch groups | Precision |
| firefly | Firefly | firefly |  | Lampyridae | Observation |
| fox | Fox | fox |  | Vulpes and related canids | Adaptability |
| gharial | Gharial | gharial |  | Gavialis gangeticus | Efficiency |
| giant-tortoise | Giant Tortoise | giant-tortoise |  | Chelonoidis spp. and Aldabrachelys gigantea | Precision |
| giant-waxy-monkey-tree-frog | Giant Waxy Monkey Tree Frog | giant-waxy-monkey-tree-frog |  | Phyllomedusa bicolor | Precision |
| giraffe | Giraffe | giraffe |  | Giraffa camelopardalis | Adaptability |
| goose | Goose | goose |  | Anserini | Teamwork |
| gorilla | Gorilla | gorilla |  | Gorilla spp. | Memory |
| hartebeest | Hartebeest | hartebeest |  | Alcelaphus buselaphus | Precision |
| hippopotamus | Hippopotamus | hippopotamus |  | Hippopotamus amphibius | Precision |
| jellyfish | Jellyfish | jellyfish |  | Scyphozoa and related medusozoans | Efficiency |
| kangal | Kangal | kangal |  | Canis lupus familiaris | Precision |
| kookaburra | Kookaburra | kookaburra |  | Dacelo novaeguineae | Adaptability |
| leopard | Leopard | leopard |  | Panthera pardus | Observation |
| lion | Lion | lion |  | Panthera leo | Teamwork |
| lizard | Lizard | lizard |  | Lacertilia | Adaptability |
| mantled-guereza | Mantled Guereza | mantled-guereza |  | Colobus guereza | Precision |
| mata-mata-turtle | Mata Mata Turtle | mata-mata-turtle |  | Chelus fimbriata | Stealth |
| norwegian-forest-cat | Norwegian Forest Cat | norwegian-forest-cat |  | Felis catus | Precision |
| nyala | Nyala | nyala |  | Tragelaphus angasii | Efficiency |
| octopus | Octopus | octopus |  | Octopoda | Adaptability |
| orangutan | Orangutan | orangutan |  | Pongo spp. | Memory |
| otter | Otter | otter |  | Lutrinae | Adaptability |
| owl | Owl | owl |  | Strigiformes | Observation |
| penguin | Penguin | penguin |  | Spheniscidae | Teamwork |
| pigeon | Pigeon | pigeon |  | Columba livia domestica | Memory |
| poison-dart-frog | Poison Dart Frog | poison-dart-frog |  | Dendrobatidae | Observation |
| raven | Raven | raven |  | Corvus corax | Precision |
| robin | Robin | robin |  | Erithacus and Turdus relatives | Precision |
| sable | Sable | sable |  | Martes zibellina | Efficiency |
| sailfish | Sailfish | sailfish |  | Istiophorus platypterus | Efficiency |
| sea-turtle | Sea Turtle | sea-turtle |  | Chelonioidea | Endurance |
| seahorse | Seahorse | seahorse |  | Hippocampus spp. | Precision |
| seal | Seal | seal |  | Pinnipedia | Precision |
| shark | Shark | shark |  | Selachimorpha | Precision |
| siberian-cat | Siberian Cat | siberian-cat |  | Felis catus | Precision |
| snake | Snake | snake |  | Serpentes | Efficiency |
| striped-polecat | Striped Polecat | striped-polecat |  | Ictonyx striatus | Observation |
| termite | Termite | termite |  | Isoptera within Blattodea | Efficiency |
| tiger | Tiger | tiger |  | Panthera tigris | Stealth |
| uakari | Uakari | uakari |  | Cacajao calvus | Precision |
| wolf | Wolf | wolf |  | Canis lupus | Teamwork |
| yak | Yak | yak |  | Bos grunniens | Endurance |

## Priority gaps

Highest-value missing catalog pages (flagship + symbolism + SEO heuristics).

| rank | animaldex_number | display_name | slug / normalized_identity_key | scientific_name | principle_name | priority_score | priority_reasons |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 108 | Asiatic Black Bear | asiatic-black-bear / asiatic_black_bear | Ursus thibetanus | — | 27 | symbolism:bear; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 2 | 157 | Epaulette Shark | epaulette-shark / epaulette_shark | Hemiscyllium ocellatum | — | 27 | symbolism:shark; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 3 | 215 | Spectacled Bear | spectacled-bear / spectacled_bear | Tremarctos ornatus | — | 27 | symbolism:bear; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 4 | 252 | Steppe Eagle | steppe-eagle / steppe_eagle | Aquila nipalensis | — | 27 | symbolism:eagle; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 5 | 280 | Spinner Dolphin | spinner-dolphin / spinner_dolphin | Stenella longirostris | — | 27 | symbolism:dolphin; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 6 | 360 | Ethiopian Wolf | ethiopian-wolf / ethiopian_wolf | Canis simensis | — | 27 | symbolism:wolf; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 7 | 418 | Coconut Octopus | coconut-octopus / coconut_octopus | Amphioctopus marginatus | — | 27 | symbolism:octopus; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 8 | 421 | Lowland Streaked Tenrec | lowland-streaked-tenrec / lowland_streaked_tenrec | Hemicentetes semispinosus | — | 27 | symbolism:owl; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 9 | 600 | Indochinese Tiger | indochinese-tiger / indochinese_tiger | Panthera tigris corbetti | — | 27 | symbolism:tiger; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 10 | 614 | Bornean Pygmy Elephant | bornean-pygmy-elephant / bornean_pygmy_elephant | Elephas maximus borneensis | — | 27 | symbolism:elephant; active-catalog; seo-popularity; principle:unavailable (no website page) |
| 11 | 19 | Purple Finch | purple-finch / purple_finch | Haemorhous purpureus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 12 | 30 | Greater Rhea | greater-rhea / greater_rhea | Rhea americana | — | 5 | active-catalog; principle:unavailable (no website page) |
| 13 | 50 | African Palm Civet | african-palm-civet / african_palm_civet | Nandinia binotata | — | 5 | active-catalog; principle:unavailable (no website page) |
| 14 | 59 | Oriental Pied Hornbill | oriental-pied-hornbill / oriental_pied_hornbill | Anthracoceros albirostris | — | 5 | active-catalog; principle:unavailable (no website page) |
| 15 | 64 | Southern African Porcupine | southern-african-porcupine / southern_porcupine | Hystrix africaeaustralis | — | 5 | active-catalog; principle:unavailable (no website page) |
| 16 | 72 | Eastern Collared Lizard | eastern-collared-lizard / eastern_collared_lizard | Crotaphytus collaris | — | 5 | active-catalog; principle:unavailable (no website page) |
| 17 | 75 | Yellow Mongoose | yellow-mongoose / yellow_mongoose | Cynictis penicillata | — | 5 | active-catalog; principle:unavailable (no website page) |
| 18 | 85 | Grey Seal | grey-seal / grey_seal | Halichoerus grypus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 19 | 104 | Lesser Grison | lesser-grison / lesser_grison | Galictis cuja | — | 5 | active-catalog; principle:unavailable (no website page) |
| 20 | 106 | Neotropic Cormorant | neotropic-cormorant / neotropic_cormorant | Nannopterum brasilianum | — | 5 | active-catalog; principle:unavailable (no website page) |
| 21 | 118 | Gaur | gaur / gaur | Bos gaurus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 22 | 148 | Southern Lechwe | southern-lechwe / southern_lechwe | Kobus leche | — | 5 | active-catalog; principle:unavailable (no website page) |
| 23 | 166 | Giant Otter | giant-otter / giant_otter | Pteronura brasiliensis | — | 5 | active-catalog; principle:unavailable (no website page) |
| 24 | 199 | Olive Ridley Sea Turtle | olive-ridley-sea-turtle / olive_ridley_sea_turtle | Lepidochelys olivacea | — | 5 | active-catalog; principle:unavailable (no website page) |
| 25 | 209 | Southern Three-banded Armadillo | southern-three-banded-armadillo / southern_three_banded_armadillo | Tolypeutes matacus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 26 | 216 | Geoffroy's Cat | geoffroys-cat / geoffroys_cat | Leopardus geoffroyi | — | 5 | active-catalog; principle:unavailable (no website page) |
| 27 | 218 | Water Chevrotain | water-chevrotain / water_chevrotain | Hyemoschus aquaticus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 28 | 232 | Giant Malabar Squirrel | giant-malabar-squirrel / giant_malabar_squirrel | Ratufa indica | — | 5 | active-catalog; principle:unavailable (no website page) |
| 29 | 253 | Tibetan Fox | tibetan-fox / tibetan_fox | Vulpes ferrilata | — | 5 | active-catalog; principle:unavailable (no website page) |
| 30 | 255 | Greater Mouse-deer | greater-mouse-deer / greater_mouse_deer | Tragulus napu | — | 5 | active-catalog; principle:unavailable (no website page) |
| 31 | 261 | Moon Rat | moon-rat / moon_rat | Echinosorex gymnura | — | 5 | active-catalog; principle:unavailable (no website page) |
| 32 | 262 | Sally Lightfoot Crab | sally-lightfoot-crab / sally_lightfoot_crab | Grapsus grapsus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 33 | 265 | American Crocodile | american-crocodile / american_crocodile | Crocodylus acutus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 34 | 270 | Macaroni Penguin | macaroni-penguin / macaroni_penguin | Eudyptes chrysolophus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 35 | 279 | Wattled Crane | wattled-crane / wattled_crane | Bugeranus carunculatus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 36 | 281 | Marsh Deer | marsh-deer / marsh_deer | Blastocerus dichotomus | — | 5 | active-catalog; principle:unavailable (no website page) |
| 37 | 285 | Black-footed Cat | black-footed-cat / black_footed_cat | Felis nigripes | — | 5 | active-catalog; principle:unavailable (no website page) |
| 38 | 286 | Smooth-coated otter | smooth-coated-otter / smooth_coated_otter | Lutrogale perspicillata | — | 5 | active-catalog; principle:unavailable (no website page) |
| 39 | 293 | Spotted Linsang | spotted-linsang / spotted_linsang | Prionodon pardicolor | — | 5 | active-catalog; principle:unavailable (no website page) |
| 40 | 313 | Pere David's Deer | pere-davids-deer / pere_davids_deer | Elaphurus davidianus | — | 5 | active-catalog; principle:unavailable (no website page) |

## Appendix: full numbered catalog (active + seeded)

Broader parity check for all numbered, non-hidden catalog species (field guide + app-active).

- Catalog species count: **992**
- Matched count: **919**
- Missing website pages: **73**
- Coverage: **92.64%**

| animaldex_number | display_name | slug / normalized_identity_key | catalog_status | priority_score |
| --- | --- | --- | --- | --- |
| 108 | Asiatic Black Bear | asiatic-black-bear / asiatic_black_bear | active | 27 |
| 157 | Epaulette Shark | epaulette-shark / epaulette_shark | active | 27 |
| 215 | Spectacled Bear | spectacled-bear / spectacled_bear | active | 27 |
| 252 | Steppe Eagle | steppe-eagle / steppe_eagle | active | 27 |
| 280 | Spinner Dolphin | spinner-dolphin / spinner_dolphin | active | 27 |
| 360 | Ethiopian Wolf | ethiopian-wolf / ethiopian_wolf | active | 27 |
| 418 | Coconut Octopus | coconut-octopus / coconut_octopus | active | 27 |
| 421 | Lowland Streaked Tenrec | lowland-streaked-tenrec / lowland_streaked_tenrec | active | 27 |
| 600 | Indochinese Tiger | indochinese-tiger / indochinese_tiger | active | 27 |
| 614 | Bornean Pygmy Elephant | bornean-pygmy-elephant / bornean_pygmy_elephant | active | 27 |
| 19 | Purple Finch | purple-finch / purple_finch | active | 5 |
| 30 | Greater Rhea | greater-rhea / greater_rhea | active | 5 |
| 50 | African Palm Civet | african-palm-civet / african_palm_civet | active | 5 |
| 59 | Oriental Pied Hornbill | oriental-pied-hornbill / oriental_pied_hornbill | active | 5 |
| 64 | Southern African Porcupine | southern-african-porcupine / southern_porcupine | active | 5 |
| 72 | Eastern Collared Lizard | eastern-collared-lizard / eastern_collared_lizard | active | 5 |
| 75 | Yellow Mongoose | yellow-mongoose / yellow_mongoose | active | 5 |
| 85 | Grey Seal | grey-seal / grey_seal | active | 5 |
| 104 | Lesser Grison | lesser-grison / lesser_grison | active | 5 |
| 106 | Neotropic Cormorant | neotropic-cormorant / neotropic_cormorant | active | 5 |
| 118 | Gaur | gaur / gaur | active | 5 |
| 148 | Southern Lechwe | southern-lechwe / southern_lechwe | active | 5 |
| 166 | Giant Otter | giant-otter / giant_otter | active | 5 |
| 199 | Olive Ridley Sea Turtle | olive-ridley-sea-turtle / olive_ridley_sea_turtle | active | 5 |
| 209 | Southern Three-banded Armadillo | southern-three-banded-armadillo / southern_three_banded_armadillo | active | 5 |
| 216 | Geoffroy's Cat | geoffroys-cat / geoffroys_cat | active | 5 |
| 218 | Water Chevrotain | water-chevrotain / water_chevrotain | active | 5 |
| 232 | Giant Malabar Squirrel | giant-malabar-squirrel / giant_malabar_squirrel | active | 5 |
| 253 | Tibetan Fox | tibetan-fox / tibetan_fox | active | 5 |
| 255 | Greater Mouse-deer | greater-mouse-deer / greater_mouse_deer | active | 5 |

_…and 43 more in the full report data._
