# Ark behaviour audit: release-trial (e99a6bf4)

323 animals, 150 species; 1 days every 20 s; flyers every 1 s for 1 h.

| Problem | Check | Target | Value |
|---|---|---|---|
| 1 Flight | Species that ever fly (of catalogue flyers) | all flyers | 37 / 43 |
| 1 Flight | Airborne time with wings closed | 0% | 100% |
| 1 Flight | Flight clips the scene may play | yes | no |
| 1 Flight | Bird models with a wing shader | > 0 or rigs | 0 |
| 1 Flight | Flyer species with a working wing rig | all rigged flyers | 0 / 0 |
| 1 Flight | …with a flap clip made / passed / held | passed | 0 / 0 / 0 |
| 2 Roaming | Airborne time spent circling (≥1 full turn a minute inside 20 m) | < 10% | 43.9% |
| 2 Roaming | Full turns per airborne minute | < 0.5 | 1.48 |
| 2 Roaming | Flyers following another (≥50% of air time together) | flocking species only | 72 (not flocking: 20, other species: 0) |
| 2 Roaming | Height above ground in the air (m) | varied by species | p10 3, median 6.5, p90 14.9, sd 5 |
| 2 Roaming | Distinct cruise heights (2 m bands, species medians) | many | 3 |
| 2 Roaming | Landing spots per flyer (pass B) | several | 28 |
| 2 Roaming | Distance per animal-day (m) | > 0, by species | median 6974.5, p90 15112.2, animalsThatNeverMove 41 |
| 2 Roaming | Rest spots per animal-day (2 m cells) | several | 104 |
| 3 Grazing | Grazer awake time labelled graze, at the grass | majority | 24.8% |
| 3 Grazing | Grazer awake time head-down grazing (drawn) | majority | 0% |
| 3 Grazing | Grazer awake time standing / walking | minority | 53.2% / 22% |
| 3 Grazing | Grazers that never grazed in the period | 0 | 1 / 55 |
| 4 Land↔water | Amphibious animals with any transition | all | 42 / 44 |
| 4 Land↔water | Transitions walked / flown / snapped | walked > 0, snapped 0 | 4302 / 2239 / 1600 |
| 4 Land↔water | Ducks and kin: transitions (walked) | > 0 each day | 1380 (928) over 6 animals |
| 4 Land↔water | An entry/exit motion (wade, hop in, climb out) | yes | no |
| 5 Heads | Rigged species with a neck or head bone (published) | most | neck 113, head 113 of 123 rigged; published with one 110 |
| 5 Heads | A head turns on its own (look-at) | yes | no |
| 6 Predators | Predators with prey aboard; nearest prey at spawn (m) | min ≥ 20 | 44; min 1.2, p10 3.2, median 20.9 |
| 6 Predators | Predators with prey spawned within 5 / 10 / 20 m | 0 | 7 / 16 / 20 |
| 6 Predators | Encounters (prey within 25 m of an awake predator) | – | 39,562 |
| 6 Predators | …where the prey reacts at all (looks); flees | most; most flee | 3.5%; 0 |
| 6 Predators | Median seconds to react | < 3 | 60 |
| 7 Variety | Species with 3+ aboard: moments all in one state | rarely | 99.1% |
| 7 Variety | Species always in the same state | 0 | 51 / 56 |
| 7 Variety | Mean distinct states in a group of 4 | ≥ 2 | 1.01 |
| 7 Variety | State changes made by the whole group in the same step | low | 65.9% |
| Env | On the wrong surface (animals; share of samples) | 0 | 63; 2.2% |
| Env | Floating / sinking (animals) | 0 / 0 | 78 / 0 |
| Env | Overlapping another (animals; share of samples) | 0 | 319; 40.8% |
| Env | Grazers that reached grass / drinkers a water edge / perchers a perch (never) | 0 never | 1 of 55 / 90 of 219 / 6 of 99 |

State mix: sleep 40.9, forage 11.3, rest 7.4, swim 6.8, awake 6.6, asleep 5.8, wander 4.5, graze 4.2, fly 3.3, perch 2.7, groom 1.6, drink 1.1, breathe 0.9, burrow 0.8, soar 0.7, idle 0.3, crawl 0.3, hide 0.3, bask 0.2, visit_flowers 0.2, to_roost 0.1, climb 0, dive 0
