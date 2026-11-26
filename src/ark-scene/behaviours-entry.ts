/**
 * The behaviours harness's page (development only; `scripts/ark-behaviours-clips.mjs` builds it into
 * `.ark-golden/behaviours/` and serves it, nothing deploys it). The live scene with a cast-only snapshot
 * (`?scene=birth|den|contest|dung`) on a controlled clock, and made-up record events (a litter, a mating) handed to
 * `addBirths` / `addMatings` exactly as the events controller would: the live world acts them from their time.
 * `window.__behaviours.shot(s, distance, follow)` sets the world time to `s` seconds after the event and frames it.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkCameraView, ArkSceneHandle} from "@/ark-scene/types";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import {disturbedNow} from "@/ark-scene/defence-moves";
import {actWindow} from "@/ark-scene/behaviour-group";
// (Reptile signatures, lane SIG2-REPTILES: the recipe scenes below.)
import recipeTable from "@/ark-scene/recipes.json";
import {pairEpisodeAt, pairMeetingsAt, scheduleWorld, SLOT_SECONDS, tripAt, tripEpisode, type ScheduleAnimal, type Trip} from "@/ark-scene/behaviour-schedule";
import {worldSampler} from "@/ark-scene/world-sampler";
import type {ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {ambushBouts} from "@/ark-scene/micro-ambush";
import {surfacePoint} from "@/ark-scene/micro";
import {SMALL_SCENES, smallMoments} from "@/ark-scene/behaviours-small";
import {TEMPLATES} from "@/ark-scene/recipe-templates";
import {speciesRecipes} from "@/ark-scene/behaviour-recipes";
import {flowDebug, flowWindow, flowNow, setFlowServer} from "@/ark-scene/flows/scene-adapter";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

type Raw = (typeof fixture)["animals"][number];
type Cast = {slug: string; name: string; n: number; young?: number; /** sig2-small: the slot it is placed at (a place on the island: a flower for a moth), else 90. */ slot?: number; /** sig2-small: the species' own activity (the profile's), else diurnal as the harness always had it. */ activity?: string};
type Scene = {zone: string; hours: number; cast: Cast[]; /** p3 (shake): on the town island (its millpond, its canal). */ town?: boolean; kind: "birth" | "mating" | "dung" | "defence" | "mob" | "look" | "lure" | "hatch" | "death" | "shake" | "group" | "recipe" | "micro" | "flight" | "tails" | "state" | "flow"; /** (recipe) the recipe's episode to find, and the row to give the first cast when its table has not got it yet ("recipe.weight[,...]"). */ recipe?: string; inject?: string; /** (recipe, micro) how far in body lengths, the camera's azimuth off its side and its polar angle. */ lengths?: number; azimuth?: number; polar?: number; /** (recipe) the first of the cast to frame. */ pick?: number};

const SCENES: Record<string, Scene> = {
    // Signature behaviours, wave 2, the small bodies (`behaviours-small.ts`).
    ...SMALL_SCENES,
    // A foal born in the open: licked, up on wobbly legs, suckling.
    birth: {zone: "grassland", hours: 9, kind: "birth", cast: [{slug: "plains-zebra", name: "Plains Zebra", n: 3, young: 1}]},
    // Cubs born in the den: tucked at her belly.
    den: {zone: "grassland", hours: 9, kind: "birth", cast: [{slug: "african-lion", name: "African Lion", n: 2, young: 2}]},
    // The rut: a rival stag first, then the mating.
    contest: {zone: "grassland", hours: 8, kind: "mating", cast: [{slug: "red-deer", name: "Red Deer", n: 6}]},
    // The webs of a garden's spiders, respun through the day.
    web: {zone: "farm_garden", hours: 7, kind: "dung", cast: [{slug: "black-and-yellow-garden-spider", name: "Black-and-yellow Garden Spider", n: 3}]},
    // A dormant kind: in its dens while the server says so (the marmots), the others about (the zebras).
    dormant: {zone: "grassland", hours: 10, kind: "dung", cast: [{slug: "alpine-marmot", name: "Alpine Marmot", n: 4}, {slug: "plains-zebra", name: "Plains Zebra", n: 3}]},
    // 3.3 batch (A): defence moves. The first cast is the species with the move, the second a predator of it by the ecology's own food
    // links, which the harness stands next to it (`threat`): the reactive layer does the rest.
    curl: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "european-hedgehog", name: "European Hedgehog", n: 2}, {slug: "amur-leopard", name: "Amur Leopard", n: 1}]},
    pangolin: {zone: "rainforest", hours: 10, kind: "defence", cast: [{slug: "sunda-pangolin", name: "Sunda Pangolin", n: 2}, {slug: "amur-leopard", name: "Amur Leopard", n: 1}]},
    pill: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "pill-millipede", name: "Pill Millipede", n: 2}, {slug: "common-frog", name: "Common Frog", n: 1}]},
    coil: {zone: "rainforest", hours: 10, kind: "defence", cast: [{slug: "ball-python", name: "Ball Python", n: 2}, {slug: "bobcat", name: "Bobcat", n: 1}]},
    millipede: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "giant-african-millipede", name: "Giant African Millipede", n: 2}, {slug: "cane-toad", name: "Cane Toad", n: 1}]},
    shell: {zone: "grassland", hours: 10, kind: "defence", cast: [{slug: "greek-tortoise", name: "Greek Tortoise", n: 2}, {slug: "bobcat", name: "Bobcat", n: 1}]},
    snail: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "giant-african-land-snail", name: "Giant African Land Snail", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    hermit: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "rugose-hermit-crab", name: "Rugose Hermit Crab", n: 2}, {slug: "asian-small-clawed-otter", name: "Asian Small-clawed Otter", n: 1}]},
    puff: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "southern-toad", name: "Southern Toad", n: 2}, {slug: "common-raccoon", name: "Common Raccoon", n: 1}]},
    monitor: {zone: "grassland", hours: 10, kind: "defence", cast: [{slug: "savannah-monitor", name: "Savannah Monitor", n: 2}, {slug: "coyote", name: "Coyote", n: 1}]},
    puffer: {zone: "coral_reef", hours: 10, kind: "defence", cast: [{slug: "stars-and-stripes-pufferfish", name: "Stars and Stripes Pufferfish", n: 2}, {slug: "blacktip-reef-shark", name: "Blacktip Reef Shark", n: 1}]},
    flash: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "scarlet-tiger-moth", name: "Scarlet Tiger Moth", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    eyes: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "polyphemus-moth", name: "Polyphemus Moth", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    peacock: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "peacock-butterfly", name: "Peacock Butterfly", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    owl: {zone: "rainforest", hours: 10, kind: "defence", cast: [{slug: "owl-butterfly", name: "Owl Butterfly", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    harnessed: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "harnessed-moth", name: "Harnessed Moth", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    blotched: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "green-blotched-moth", name: "Green-blotched Moth", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    lubber: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "eastern-lubber-grasshopper", name: "Eastern Lubber Grasshopper", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    taildrop: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "common-wall-lizard", name: "Common Wall Lizard", n: 2}, {slug: "bobcat", name: "Bobcat", n: 1}]},
    salamander: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "eastern-red-backed-salamander", name: "Eastern Red-backed Salamander", n: 2}, {slug: "common-rat-snake", name: "Common Rat Snake", n: 1}]},
    // SIG-DEFENCE (P5 M rows): the new moves, each species beside a predator of it by the ecology's food links.
    rear: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "carolina-wolf-spider", name: "Carolina Wolf Spider", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    crab: {zone: "seashore", hours: 10, kind: "defence", cast: [{slug: "shore-crab", name: "Shore Crab", n: 2}, {slug: "herring-gull", name: "Herring Gull", n: 1}]},
    scorpion: {zone: "rainforest", hours: 10, kind: "defence", cast: [{slug: "malaysian-forest-scorpion", name: "Malaysian Forest Scorpion", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    tamandua: {zone: "rainforest", hours: 10, kind: "defence", cast: [{slug: "southern-tamandua", name: "Southern Tamandua", n: 2}, {slug: "amur-leopard", name: "Amur Leopard", n: 1}]},
    whirl: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "daddy-long-legs-spider", name: "Daddy Long-legs Spider", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    webshake: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "black-and-yellow-garden-spider", name: "Black-and-yellow Garden Spider", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    thump: {zone: "grassland", hours: 10, kind: "defence", cast: [{slug: "european-rabbit", name: "European Rabbit", n: 2}, {slug: "red-fox", name: "Red Fox", n: 1}]},
    thumpdomestic: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "domestic-rabbit", name: "Domestic Rabbit", n: 2}, {slug: "red-fox", name: "Red Fox", n: 1}]},
    cottontail: {zone: "grassland", hours: 10, kind: "defence", cast: [{slug: "eastern-cottontail", name: "Eastern Cottontail", n: 2}, {slug: "red-fox", name: "Red Fox", n: 1}]},
    stamp: {zone: "woodland", hours: 10, kind: "defence", cast: [{slug: "white-tailed-deer", name: "White-tailed Deer", n: 2}, {slug: "coyote", name: "Coyote", n: 1}]},
    slug: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "leaf-eating-slug", name: "Leaf-eating Slug", n: 2}, {slug: "common-frog", name: "Common Frog", n: 1}]},
    tuck: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "common-house-spider", name: "Common House Spider", n: 2}, {slug: "american-toad", name: "American Toad", n: 1}]},
    beard: {zone: "grassland", hours: 10, kind: "defence", cast: [{slug: "central-bearded-dragon", name: "Central Bearded Dragon", n: 2}, {slug: "bobcat", name: "Bobcat", n: 1}]},
    spines: {zone: "river_lake", hours: 10, kind: "defence", cast: [{slug: "amazon-sailfin-catfish", name: "Amazon Sailfin Catfish", n: 2}, {slug: "giant-otter", name: "Giant Otter", n: 1}]},
    gecko: {zone: "farm_garden", hours: 10, kind: "defence", cast: [{slug: "common-house-gecko", name: "Common House Gecko", n: 2}, {slug: "bobcat", name: "Bobcat", n: 1}]},
    // 3.3 batch (B): magpies mobbing a fox near them, in turns (`mobbing.ts`; started by hand here, the cast is placed apart).
    mob: {zone: "grassland", hours: 9, kind: "mob", cast: [{slug: "australian-magpie", name: "Australian Magpie", n: 4}, {slug: "red-fox", name: "Red Fox", n: 1}, {slug: "coyote", name: "Coyote", n: 1}, {slug: "bobcat", name: "Bobcat", n: 1}, {slug: "tawny-owl", name: "Tawny Owl", n: 1}, {slug: "red-tailed-hawk", name: "Red-tailed Hawk", n: 1}]},
    // 3.3 batch (B): the tail habits (`tail-habit.ts`): a wagtail's pump, a wren's cocked tail, a swamphen's flick, a water tyrant's fan; a sparrow beside them has none.
    tail: {zone: "wetland", hours: 9, kind: "look", cast: [{slug: "grey-wagtail", name: "Grey Wagtail", n: 2}, {slug: "house-wren", name: "House Wren", n: 1}, {slug: "australasian-swamphen", name: "Australasian Swamphen", n: 1}, {slug: "masked-water-tyrant", name: "Masked Water Tyrant", n: 1}, {slug: "common-sandpiper", name: "Common Sandpiper", n: 1}, {slug: "house-sparrow", name: "House Sparrow", n: 1}]},
    // 3.3 batch (B): a killdeer's broken-wing display for a predator near it (`broken-wing.ts`; started by hand here).
    lure: {zone: "grassland", hours: 9, kind: "lure", cast: [{slug: "killdeer", name: "Killdeer", n: 5}, {slug: "coyote", name: "Coyote", n: 1}, {slug: "red-fox", name: "Red Fox", n: 1}, {slug: "bobcat", name: "Bobcat", n: 1}]},
    // 3.3 batch (B): a Muscovy duck's brood jumping from the tree hole on the record's hatching (`duckling-drop.ts`).
    drop: {zone: "river_lake", hours: 9, kind: "hatch", cast: [{slug: "muscovy-duck", name: "Muscovy Duck", n: 2, young: 4}]},
    // 3.3 fix (mating tap): a mating line's tap, the old way (the first animal alone) and the new (the pair framed);
    // two Common Wall Lizards (a real pair of today's record; they start close), and two Australasian Swamphens (another),
    // the farthest apart of eight.
    tapone: {zone: "farm_garden", hours: 10, kind: "mating", cast: [{slug: "common-wall-lizard", name: "Common Wall Lizard", n: 4}]},
    tappair: {zone: "farm_garden", hours: 10, kind: "mating", cast: [{slug: "common-wall-lizard", name: "Common Wall Lizard", n: 4}]},
    tapfarone: {zone: "wetland", hours: 10, kind: "mating", cast: [{slug: "australasian-swamphen", name: "Australasian Swamphen", n: 8}]},
    tapfarpair: {zone: "wetland", hours: 10, kind: "mating", cast: [{slug: "australasian-swamphen", name: "Australasian Swamphen", n: 8}]},
    // 3.3 fix (log): a death of the record (old age): its body where it died, and its line's tap (`live-deaths.ts`). A
    // second death, a roadside hawk not in the roster (it has left it, as the dead have), placed from its event alone.
    death: {zone: "grassland", hours: 10, kind: "death", cast: [{slug: "red-deer", name: "Red Deer", n: 3}]},
    // 3.3 fix (breeding taps): real breeders of the 2026-11-16 record. Two Common Flesh Flies mated (the tap framed the
    // pair from metres back: two specks); two Common Wall Lizards mated and laid two eggs (the clutch was never drawn);
    // a Pea Aphid born (a 3 mm young with its mother); two Common Buzzards' young hatched.
    breedfly: {zone: "farm_garden", hours: 10, kind: "mating", cast: [{slug: "common-flesh-fly", name: "Common Flesh Fly", n: 4}]},
    breedclutch: {zone: "farm_garden", hours: 10, kind: "mating", cast: [{slug: "common-wall-lizard", name: "Common Wall Lizard", n: 2}]},
    breedaphid: {zone: "farm_garden", hours: 10, kind: "birth", cast: [{slug: "pea-aphid", name: "Pea Aphid", n: 2, young: 1}]},
    breedbuzzard: {zone: "woodland", hours: 10, kind: "hatch", cast: [{slug: "common-buzzard", name: "Common Buzzard", n: 2, young: 1}]},
    // p3 (shake): out of the water and shaking it off (`water-shake.ts`): geese at the lake, a Labrador from the lake.
    shakegoose: {zone: "river_lake", hours: 10, kind: "shake", cast: [{slug: "greylag-goose", name: "Greylag Goose", n: 3}]},
    shakedog: {zone: "river_lake", hours: 10, kind: "shake", cast: [{slug: "labrador-retriever", name: "Labrador Retriever", n: 4}]},
    shakedog2: {zone: "wetland", hours: 10, kind: "shake", cast: [{slug: "labrador-retriever", name: "Labrador Retriever", n: 4}]},
    shaketown: {zone: "garden_wildlife", hours: 10, kind: "shake", town: true, cast: [{slug: "mallard", name: "Mallard", n: 6}]},
    shaketowngoose: {zone: "farm_garden", hours: 10, kind: "shake", town: true, cast: [{slug: "domestic-goose", name: "Domestic Goose", n: 6}]},
    shakeotter: {zone: "river_lake", hours: 10, kind: "shake", cast: [{slug: "european-otter", name: "European Otter", n: 2}]},
    // Group life (lane SIG-GROUP; `behaviour-group.ts`): the group's own act, from the cast's real animals aboard together, at a pinned hour.
    gsentinel: {zone: "farm_garden", hours: 10, kind: "group", cast: [{slug: "american-crow", name: "American Crow", n: 4}]},
    ghuddle: {zone: "river_lake", hours: 12, kind: "group", cast: [{slug: "capybara", name: "Capybara", n: 5}]},
    ggather: {zone: "farm_garden", hours: 17.9, kind: "group", cast: [{slug: "house-sparrow", name: "House Sparrow", n: 6}]},
    groost: {zone: "farm_garden", hours: 22, kind: "group", cast: [{slug: "house-sparrow", name: "House Sparrow", n: 6}, {slug: "ring-tailed-lemur", name: "Ring-tailed Lemur", n: 4}]},
    glick: {zone: "rainforest", hours: 8, kind: "group", cast: [{slug: "african-grey-parrot", name: "African Grey Parrot", n: 5}]},
    gchorus: {zone: "farm_garden", hours: 6.2, kind: "group", cast: [{slug: "australian-magpie", name: "Australian Magpie", n: 4}]},
    gcommute: {zone: "rainforest", hours: 12, kind: "group", cast: [{slug: "blue-fronted-amazon", name: "Blue-fronted Amazon", n: 6}]},
    gfeast: {zone: "rainforest", hours: 10, kind: "group", cast: [{slug: "northern-pig-tailed-macaque", name: "Northern Pig-tailed Macaque", n: 5}]},
    gbask: {zone: "river_lake", hours: 11, kind: "group", cast: [{slug: "red-eared-slider", name: "Red-eared Slider", n: 5}]},
    gpairs: {zone: "rainforest", hours: 12, kind: "group", cast: [{slug: "blue-fronted-amazon", name: "Blue-fronted Amazon", n: 7}]},
    // Reptile signatures (lane SIG2-REPTILES): a recipe's episode of one species, found from the schedule and framed close.
    // `inject` gives the cast's row the recipe while the table lacks it; every row's seasons are all year here.
    rt_dig: {zone: "grassland", hours: 9, kind: "recipe", recipe: "dig_burrow~tortoise", inject: "dig_burrow~tortoise.9", lengths: 3.2, cast: [{slug: "sulcata-tortoise", name: "Sulcata Tortoise", n: 3}]},
    rt_dig_russian: {zone: "grassland", hours: 9, kind: "recipe", recipe: "dig_burrow~tortoise", inject: "dig_burrow~tortoise.9", lengths: 3.2, cast: [{slug: "russian-tortoise", name: "Russian Tortoise", n: 3}]},
    rt_nest: {zone: "grassland", hours: 9, kind: "recipe", recipe: "dig_burrow~nest", inject: "dig_burrow~nest.9", lengths: 3.2, cast: [{slug: "aldabra-giant-tortoise", name: "Aldabra Giant Tortoise", n: 4}]},
    rt_nest_leopard: {zone: "grassland", hours: 9, kind: "recipe", recipe: "dig_burrow~nest", inject: "dig_burrow~nest.9", lengths: 3.2, cast: [{slug: "leopard-tortoise", name: "Leopard Tortoise", n: 4}]},
    rt_wallow: {zone: "wetland", hours: 9, kind: "recipe", recipe: "wallow~turtle", inject: "wallow~turtle.9", lengths: 3.2, cast: [{slug: "asian-forest-tortoise", name: "Asian Forest Tortoise", n: 3}]},
    rt_wallow_galapagos: {zone: "wetland", hours: 9, kind: "recipe", recipe: "wallow~turtle", inject: "wallow~turtle.9", lengths: 3.2, cast: [{slug: "galapagos-tortoise", name: "Galapagos Tortoise", n: 3}]},
    rt_reef: {zone: "coral_reef", hours: 9, kind: "recipe", recipe: "probe_feed~turtle", inject: "probe_feed~turtle.9", lengths: 3.2, cast: [{slug: "hawksbill-sea-turtle", name: "Hawksbill Sea Turtle", n: 3}]},
    rt_skink: {zone: "woodland", hours: 9, kind: "recipe", recipe: "probe_feed", inject: "probe_feed.9", lengths: 3.2, cast: [{slug: "indonesian-blue-tongued-skink", name: "Indonesian Blue-tongued Skink", n: 3}]},
    rt_bank: {zone: "river_lake", hours: 9, kind: "recipe", recipe: "beach_nest~bank", inject: "beach_nest~bank.9", lengths: 3.2, cast: [{slug: "mugger-crocodile", name: "Mugger Crocodile", n: 4}]},
    rt_bank_lizard: {zone: "river_lake", hours: 9, kind: "recipe", recipe: "beach_nest~bank", inject: "beach_nest~bank.9", lengths: 3.2, cast: [{slug: "amboina-sailfin-lizard", name: "Amboina Sailfin Lizard", n: 4}]},
    rt_guard: {zone: "river_lake", hours: 9, kind: "recipe", recipe: "incubate_sit~reptile", inject: "incubate_sit~reptile.9", lengths: 3.2, cast: [{slug: "siamese-crocodile", name: "Siamese Crocodile", n: 4}]},
    rt_guard_tegu: {zone: "grassland", hours: 9, kind: "recipe", recipe: "incubate_sit~reptile", inject: "incubate_sit~reptile.9", lengths: 3.2, cast: [{slug: "red-tegu", name: "Red Tegu", n: 4}]},
    rt_ambush: {zone: "farm_garden", hours: 9, kind: "recipe", recipe: "pounce~lizard", inject: "pounce~lizard.9", lengths: 5, cast: [{slug: "oriental-garden-lizard", name: "Oriental Garden Lizard", n: 3}]},
    // Reptile signatures: small clingers that hunt by sit-and-wait, on the cottage's wall at night (`micro-ambush.ts`) and on rocks.
    mi_wall: {zone: "farm_garden", hours: 21, kind: "micro", lengths: 6, cast: [{slug: "common-wall-gecko", name: "Common Wall Gecko", n: 6}]},
    mi_house: {zone: "farm_garden", hours: 21, kind: "micro", lengths: 6, cast: [{slug: "common-house-gecko", name: "Common House Gecko", n: 6}]},
    mi_med: {zone: "farm_garden", hours: 21, kind: "micro", lengths: 6, cast: [{slug: "mediterranean-house-gecko", name: "Mediterranean House Gecko", n: 6}]},
    mi_tropical: {zone: "farm_garden", hours: 21, kind: "micro", lengths: 6, cast: [{slug: "tropical-house-gecko", name: "Tropical House Gecko", n: 6}]},
    mi_leopard: {zone: "grassland", hours: 21, kind: "micro", lengths: 6, cast: [{slug: "leopard-gecko", name: "Leopard Gecko", n: 6}]},
    mi_lava: {zone: "grassland", hours: 11, kind: "micro", lengths: 6, cast: [{slug: "brazilian-lava-lizard", name: "Brazilian Lava Lizard", n: 6}]},
    mi_bocage: {zone: "grassland", hours: 11, kind: "micro", lengths: 6, cast: [{slug: "bocages-wall-lizard", name: "Bocage's Wall Lizard", n: 6}]},
    // Lane SIG-OTHER: territory, patrol and display flights (`sally_chase`, `patrol_low`, `display_flight`): a male in his episode, followed (`flightWatch`).
    sally: {zone: "river_lake", hours: 10, kind: "flight", cast: [{slug: "scarlet-skimmer", name: "Scarlet Skimmer", n: 14}]},
    sallyb: {zone: "woodland", hours: 10, kind: "flight", cast: [{slug: "red-admiral", name: "Red Admiral", n: 14}]},
    patrol: {zone: "grassland", hours: 10, kind: "flight", cast: [{slug: "fox-moth", name: "Fox Moth", n: 14}]},
    display: {zone: "woodland", hours: 10, kind: "flight", cast: [{slug: "common-wood-pigeon", name: "Common Wood Pigeon", n: 24}]},
    // Lane SIG-OTHER: tail postures (`tail-posture.ts`): a dog's wag, a coati's flag, a chipmunk's, the baboons' and the macaque's (`tailShot`).
    tails: {zone: "rainforest", hours: 10, kind: "tails", cast: [{slug: "domestic-dog", name: "Domestic Dog", n: 1}, {slug: "south-american-coati", name: "South American Coati", n: 1}, {slug: "eastern-chipmunk", name: "Eastern Chipmunk", n: 1}, {slug: "hamadryas-baboon", name: "Hamadryas Baboon", n: 1}, {slug: "olive-baboon", name: "Olive Baboon", n: 1}, {slug: "toque-macaque", name: "Toque Macaque", n: 1}]},
    // Lane SIG-OTHER: look states (`look-state.ts`): each species close up with its state off and on (`lsShot`: the strength forced, or the hour or the month moved).
    lsfish: {zone: "river_lake", hours: 12, kind: "state", cast: [{slug: "goldfish", name: "Goldfish", n: 1}, {slug: "guppy", name: "Guppy", n: 1}, {slug: "siamese-fighting-fish", name: "Siamese Fighting Fish", n: 1}, {slug: "tiger-barb", name: "Tiger Barb", n: 1}, {slug: "neon-tetra", name: "Neon Tetra", n: 1}, {slug: "black-skirt-tetra", name: "Black Skirt Tetra", n: 1}, {slug: "freshwater-angelfish", name: "Freshwater Angelfish", n: 1}]},
    lsland: {zone: "farm_garden", hours: 12, kind: "state", cast: [{slug: "common-house-gecko", name: "Common House Gecko", n: 1}, {slug: "tropical-house-gecko", name: "Tropical House Gecko", n: 1}, {slug: "crested-gecko", name: "Crested Gecko", n: 1}, {slug: "veiled-chameleon", name: "Veiled Chameleon", n: 1}, {slug: "carolina-wolf-spider", name: "Carolina Wolf Spider", n: 1}]},
    lsdewlap: {zone: "rainforest", hours: 12, kind: "state", cast: [{slug: "green-iguana", name: "Green Iguana", n: 1}, {slug: "green-anole", name: "Green Anole", n: 1}, {slug: "brown-anole", name: "Brown Anole", n: 1}, {slug: "oriental-garden-lizard", name: "Oriental Garden Lizard", n: 1}, {slug: "common-green-forest-lizard", name: "Common Green Forest Lizard", n: 1}, {slug: "veiled-chameleon", name: "Veiled Chameleon", n: 1}]},
    lssac: {zone: "wetland", hours: 12, kind: "state", cast: [{slug: "american-bullfrog", name: "American Bullfrog", n: 1}, {slug: "marsh-frog", name: "Marsh Frog", n: 1}, {slug: "great-plains-toad", name: "Great Plains Toad", n: 1}, {slug: "grey-crowned-crane", name: "Grey Crowned Crane", n: 1}, {slug: "european-starling", name: "European Starling", n: 1}, {slug: "magnificent-frigatebird", name: "Magnificent Frigatebird", n: 1}, {slug: "siamang", name: "Siamang", n: 1}]},
    lscheek: {zone: "rainforest", hours: 12, kind: "state", cast: [{slug: "long-tailed-macaque", name: "Long-tailed Macaque", n: 1}, {slug: "campbells-dwarf-hamster", name: "Campbell's Dwarf Hamster", n: 1}, {slug: "eastern-chipmunk", name: "Eastern Chipmunk", n: 1}, {slug: "mandrill", name: "Mandrill", n: 1}]},
    lsglow: {zone: "farm_garden", hours: 12, kind: "state", cast: [{slug: "common-eastern-firefly", name: "Common Eastern Firefly", n: 1}, {slug: "carolina-wolf-spider", name: "Carolina Wolf Spider", n: 1}]},
    lsindividual: {zone: "river_lake", hours: 12, kind: "state", cast: [{slug: "koi", name: "Koi", n: 4}, {slug: "guppy", name: "Guppy", n: 4}]},
    lsseasonwater: {zone: "river_lake", hours: 12, kind: "state", cast: [{slug: "mallard", name: "Mallard", n: 8}, {slug: "mandarin-duck", name: "Mandarin Duck", n: 1}, {slug: "black-headed-gull", name: "Black-headed Gull", n: 1}, {slug: "great-crested-grebe", name: "Great Crested Grebe", n: 1}]},
    lsseasonland: {zone: "woodland", hours: 12, kind: "state", cast: [{slug: "winter-white-dwarf-hamster", name: "Winter White Dwarf Hamster", n: 1}, {slug: "southeastern-five-lined-skink", name: "Southeastern Five-lined Skink", n: 1}, {slug: "two-spotted-spider-mite", name: "Two-spotted Spider Mite", n: 1}, {slug: "white-tailed-deer", name: "White-tailed Deer", n: 1}, {slug: "red-deer", name: "Red Deer", n: 1}, {slug: "raccoon-dog", name: "Raccoon Dog", n: 1}]},
    // Behaviour flows (docs/ark/behaviour-flows.md 8; `?flows=1` switches them on): pilot kinds eating their engine
    // background food where the schedule stands them, and a fox's kill from a sample server event.
    flowdeer: {zone: "grassland", hours: 16.4, kind: "flow", cast: [{slug: "red-deer", name: "Red Deer", n: 3}]},
    flowsparrow: {zone: "farm_garden", hours: 10, kind: "flow", cast: [{slug: "house-sparrow", name: "House Sparrow", n: 3}]},
    flowjay: {zone: "woodland", hours: 10, kind: "flow", cast: [{slug: "eurasian-jay", name: "Eurasian Jay", n: 2}]},
    flowfox: {zone: "grassland", hours: 16.4, kind: "flow", cast: [{slug: "red-fox", name: "Red Fox", n: 2}]},
    // A herd's droppings along its day.
    dung: {zone: "grassland", hours: 10, kind: "dung", cast: [{slug: "plains-zebra", name: "Plains Zebra", n: 6}, {slug: "african-lion", name: "African Lion", n: 2}]},
    // Decision 434: the dung users at a herd's fresh marks (`dung.ts` dungVisitPose).
    dungusers: {zone: "grassland", hours: 10, kind: "dung", cast: [{slug: "plains-zebra", name: "Plains Zebra", n: 6}, {slug: "dung-beetle", name: "Dung Beetle", n: 5}, {slug: "yellow-dung-fly", name: "Yellow Dung Fly", n: 4}]}
};

const castId = (k: number, i: number) => `0000feed-0000-4000-8000-${(k * 256 + i).toString(16).padStart(12, "0")}`;
const speciesId = (k: number) => `5bec1e50-0000-4000-8000-${k.toString(16).padStart(12, "0")}`;

const realDateNow = Date.now.bind(Date);
const realPerfNow = performance.now.bind(performance);
let fake: {date: number; perf: number} | null = null;
Date.now = () => (fake ? fake.date : realDateNow());
performance.now = () => (fake ? fake.perf : realPerfNow());
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const frames = (n: number) =>
    new Promise<void>((resolve) => {
        let left = n;
        const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
        requestAnimationFrame(tick);
    });

async function main() {
    const params = new URLSearchParams(location.search);
    const scene = {...SCENES[params.get("scene") ?? "birth"]};
    // (Reptile signatures: a recipe scene's recipe, injected row, cast and zone may be overridden: `?recipe=pounce&inject=pounce.9&slug=leopard-gecko&zone=grassland`.)
    if (scene.kind === "recipe") {
        if (params.get("recipe")) scene.recipe = params.get("recipe")!;
        if (params.get("inject")) scene.inject = params.get("inject")!;
        if (params.get("zone")) scene.zone = params.get("zone")!;
        if (params.get("hours")) scene.hours = Number(params.get("hours"));
        // (Lane SIG6: on the town island, `&town=1`.)
        if (params.get("town") === "1") scene.town = true;
        if (params.get("slug")) scene.cast = [{slug: params.get("slug")!, name: params.get("slug")!, n: Number(params.get("n") ?? 3)}];
    }
    (globalThis as {__arkQuality?: string}).__arkQuality = params.get("quality") ?? "high";
    if (params.get("flows") === "1") (globalThis as {__arkFlows?: boolean}).__arkFlows = true;
    if (params.get("grass") === "0") (globalThis as {__arkNoGrass?: boolean}).__arkNoGrass = true;
    const template = fixture.animals[0];
    const day = fixture.voyage.ark_day;
    const animals: Raw[] = [];
    const youngIds: string[] = [];
    scene.cast.forEach((c, k) => {
        for (let i = 0; i < c.n + (c.young ?? 0); i++) {
            const young = i >= c.n;
            if (young) youngIds.push(castId(k, i));
            animals.push({...template, id: castId(k, i), species_profile_id: speciesId(k), name: c.name, scientific_name: c.name, model_slug: c.slug, zone: scene.zone, activity: c.activity ?? "diurnal", sociality: "group", slot: c.slot ?? 90 + k, slot_rank: i, origin: young ? "born" : "arrived", born_ark_day: young ? day : 0} as Raw);
        }
    });
    // (Reptile signatures: the cast's row given the recipe (only that one, every season open) while the table lacks it.)
    if (scene.kind === "recipe" && scene.inject) {
        const rows = (recipeTable as unknown as {species: Record<string, string>}).species;
        for (const c of scene.cast) {
            const fields = (rows[c.slug] ?? "|s:50:m:112:-||||wade:walk:bask||").split("|");
            fields[0] = scene.inject;
            fields[2] = fields[3] = "abcdefghijkl";
            if (!fields[4]) fields[4] = "other:";
            rows[c.slug] = fields.join("|");
        }
    }
    // sig2-small: a recipe scene's Ark day pinned to the middle of the cast species' first mating month (June where none is stored),
    // so a season-bound recipe (a dance, a wrestle) is in season: the Ark's months come from its day (`behaviour-recipes.ts` seasonMonthAt).
    if (scene.kind === "recipe") (globalThis as {__arkPropsArkDay?: number}).__arkPropsArkDay = ((speciesRecipes(scene.cast[0].slug).mating[0] ?? 6) - 0.5) * (365 / 12);
    const decoded = decodeArkSnapshot({...fixture, animals});
    if (!decoded) throw new Error("fixture did not decode");
    let snapshot = decoded;
    // p3 (shake): a town scene: the cast on the town island, the town loaded beside the wild one (as rig-scenes-entry does).
    let islandOptions: Record<string, unknown> = {};
    if (scene.town) {
        snapshot = {...snapshot, animals: snapshot.animals.map((a) => ({...a, island: "town"}) as typeof a)};
        const [{arkIslandSnapshot}, {loadTownScene}] = await Promise.all([import("@/lib/ark-islands"), import("@/ark-scene/islands/scene")]);
        const split = arkIslandSnapshot as unknown as (s: typeof snapshot, island: "wild" | "town") => typeof snapshot;
        const town = await loadTownScene({tier: "high", animals: split(snapshot, "town").animals});
        islandOptions = {island: town, wildAnimals: split(snapshot, "wild").animals, openIsland: "town"};
        console.log("[behaviours] town origin", JSON.stringify(town.origin));
    }
    let ready = false;
    const handle: ArkSceneHandle = mountArk(document.getElementById("ark")!, {snapshot, modelBase: MODELS, iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp", recording: true, hours: scene.hours, onReady: () => (ready = true), ...islandOptions});
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.15, storm: 0, windDirection: 0.4, rain: 0, fog: 0});
    const t0 = Date.UTC(2026, 10, 20, scene.hours) / 1000 + 60;
    const setAt = async (epoch: number) => {
        const ms = epoch * 1000;
        if (!fake) {
            fake = {date: ms, perf: realPerfNow()};
            handle.setClockScale(1, ms);
        } else {
            fake.perf += ms - fake.date;
            fake.date = ms;
        }
        await frames(3);
    };
    await setAt(t0 - 20);
    const until = realPerfNow() + 120_000;
    while (realPerfNow() < until && (!ready || handle.loading())) await wait(200);
    console.log("[behaviours] loaded", ready, handle.loading());
    await setAt(t0 - 2);
    await wait(800);
    type Debug = {births: () => Array<Record<string, unknown>>; matings: () => Array<Record<string, unknown>>; traces: () => Array<{kind: string; x: number; z: number; alpha: number}>; entries: () => Array<{animal: {id: string; model_slug: string}; act: Record<string, unknown> | null}>; mobbing?: () => unknown[]; mobStart?: (bird: string, threat: string) => boolean; lureStart?: (bird: string, threat: string) => boolean; lures?: () => unknown[]; drops?: () => Array<{mother: string | null}>; seenNow?: () => Array<{name: string; line?: string; episode: string}>};
    const debug = (window as unknown as {__arkDebug: Debug}).__arkDebug;
    const a = castId(0, 0);
    let b = castId(0, 1);
    if (scene.kind === "birth") handle.addBirths?.([{key: "birth:harness", parents: [a, b], young: youngIds, t0}]);
    // 3.3 fix (mating tap): the pair apart at their mating's time, as most of the record's pairs are.
    const tapScene = (params.get("scene") ?? "").startsWith("tap") || params.get("scene") === "breedfly";
    if (tapScene) {
        // (The one of its kind farthest from the first, as the record's pairs are often apart.)
        const at = handle.locate(a);
        let far = 0;
        for (let i = 1; i < scene.cast[0].n; i++) {
            const p = handle.locate(castId(0, i));
            const d = at && p ? Math.hypot(p.x - at.x, p.z - at.z) : 0;
            if (d > far) {
                far = d;
                b = castId(0, i);
            }
        }
        console.log("[behaviours] the pair", far.toFixed(1), "m apart");
    }
    if (scene.kind === "mating") handle.addMatings?.([{key: "mated:harness", a, b, t0}]);
    if (scene.kind === "hatch") handle.addHatchings?.([{key: "hatch:harness", parents: [a, b], young: youngIds, t0}]);
    if (scene.kind === "death") {
        const of = (id: string, slug: string, name: string, slot: number) => ({id, species_profile_id: speciesId(9), name, model_slug: slug, zone: scene.zone as never, arrived_at: null, origin: "arrived" as const, generation: 0, slot, slot_rank: 0, activity: "diurnal" as const, sociality: null, status: null, area: null});
        handle.addDeaths?.([{key: "death:harness", animal: of(a, "red-deer", "Red Deer", 90), t0}, {key: "death:gone", animal: of(castId(9, 0), "roadside-hawk", "Roadside Hawk", 91), t0}]);
    }
    await setAt(t0 + 0.05);
    await frames(4);
    // (The first of the cast's predators that is out in the open now: not in its den, not on the wing.)
    let foe = castId(1, 0);
    let star = a;
    if (scene.kind === "mob" || scene.kind === "lure") {
        console.log("[behaviours] the bird", JSON.stringify(handle.locate(a)));
        for (let k = 1; k < scene.cast.length; k++) {
            const at = handle.locate(castId(k, 0));
            console.log("[behaviours] foe?", scene.cast[k].slug, JSON.stringify(at));
            // (A display needs a bird on dry ground: the first of the cast's birds that can.)
            const bird = scene.kind === "lure" ? Array.from({length: scene.cast[0].n}, (_, i) => castId(0, i)).find((id) => debug.lureStart?.(id, castId(k, 0))) : undefined;
            if (bird) star = bird;
            if (at && (bird || (scene.kind === "mob" && at.y > at.ground + 0.05 && at.y < at.ground + 6 && debug.mobStart?.(a, castId(k, 0))))) {
                foe = castId(k, 0);
                console.log("[behaviours] mobbing", scene.cast[k].slug, JSON.stringify(at));
                break;
            }
        }
    }
    const at0 = handle.locate(a);
    if (!at0) throw new Error("cast not placed");
    const view = (distance: number, at: {x: number; z: number}, polar = 1.15, azimuth = 0.7): ArkCameraView => ({target: {x: at.x, y: Math.max(handle.heightAt(at.x, at.z), 0) + 0.5, z: at.z}, distance, polar, azimuth});
    handle.setView(view(12, at0));
    let closeView: ArkCameraView | null = null;
    const pinned = new Set<string>();
    // (Behaviour flows: a sample server kill for the fox scene's first fox, 20 minutes in.)
    if (scene.kind === "flow" && scene.cast[0].slug === "red-fox") setFlowServer(a, {kills: [{at: t0 + 1200, prey: "Bank Vole"}], version: "harness-kill"});
    const api = {
        /** Behaviour flows: the first second in [from, to] (s after t0, every `every` s) the animal's flow step is one of `kinds`. */
        flowFind: (id: string, kinds: string[], from: number, to: number, every = 4) => {
            for (let s = from; s <= to; s += every) {
                const now = flowNow(id, t0 + s + 2.1);
                if (now && kinds.includes(now.kind)) return s;
            }
            console.log("[behaviours] flowFind none", JSON.stringify(flowDebug()), JSON.stringify(flowNow(id, t0 + from + 2.1)));
            return null;
        },
        /** Behaviour flows: what the animal's flow says now, and the beat its pose plays (the scene's own, after a `shot`). */
        flowCaption: (id: string) => {
            const e = debug.entries().find((x) => x.animal.id === id) as unknown as {sched?: {pose?: {beat?: string; moving?: boolean}}} | undefined;
            const now = flowNow(id, fake!.date / 1000);
            // (`?legs=1`: the trip's doing and the leg it is on, to trace a pose back to its leg.)
            const trip = (e as unknown as {sched?: {trip?: {doing?: string; start: number; arrive: number; shadow?: unknown; legs: Array<{mode: string; beat: string; seconds: number}>; stay: Array<{at: number; beat: string}>}}})?.sched?.trip;
            let leg = "-";
            if (params.has("legs") && trip) {
                const t = fake!.date / 1000;
                let at = trip.start;
                leg = "stay";
                for (const l of trip.legs) {
                    if (t < at + l.seconds) {
                        leg = `${l.mode}/${l.beat}`;
                        break;
                    }
                    at += l.seconds;
                }
                const tt = trip as unknown as {start: number; arrive: number; end: number; slot: number};
                leg = `[${flowWindow(id, tt.arrive, tt.end, 8)}] ${trip.doing ?? "-"}${trip.shadow ? " shadow" : ""} slot ${tt.slot} ${Math.round(tt.start - t)}..${Math.round(tt.arrive - t)}..${Math.round(tt.end - t)} ${leg} stay[${trip.stay.map((b) => b.beat).slice(0, 6).join(",")}]`;
            }
            return `${now ? `flow: ${now.line}${now.server ? " (server)" : ""}` : "flow: (off)"}   pose: ${e?.sched?.pose?.beat ?? "-"}${e?.sched?.pose?.moving ? " moving" : ""}   card: ${(handle.animalStatus?.(id)?.line ?? handle.animalStatus?.(id)?.activity ?? "-")}${params.has("legs") ? `   trip: ${leg}` : ""}`;
        },
        /** 3.3 fix (log): a death line's tap, from the island's overview: where the camera goes, after its flight. */
        tapDeath: async (key: string) => {
            handle.setView(view(150, at0, 0.9));
            await frames(3);
            const ok = handle.focusDeath?.(key) ?? false;
            for (let i = 0; i < 30; i++) {
                fake!.perf += 100;
                await frames(1);
            }
            return {ok, view: handle.view()};
        },
        deaths: () => (debug as unknown as {deaths?: () => unknown[]}).deaths?.() ?? [],
        info: () => ({drops: debug.drops?.() ?? [], births: debug.births(), matings: debug.matings(), young: youngIds, a: star, b, c: foe, ids: scene.cast.map((_, k) => castId(k, 0)), mobbing: debug.mobbing?.() ?? []}),
        dung: () => debug.traces().filter((t) => t.kind === "dung"),
        /** The first cast's kind dormant (or awake again), then what the scene shows of every animal. */
        dormant: async (on: boolean) => {
            handle.setDormant?.(on ? [speciesId(0)] : []);
            await frames(6);
            return debug.entries().map((e) => `${e.animal.model_slug} ${e.act ? `${String(e.act.meal)}${e.act.hidden ? " hidden" : ""}` : "about"} card:${handle.animalStatus?.(e.animal.id)?.line ?? handle.animalStatus?.(e.animal.id)?.activity ?? "-"}`);
        },
        /** The webs' mesh: where its first web is, how many threads, and the clock's place in the webs' cycle. */
        webs: () => {
            const lines = (debug as unknown as {scene: {getObjectByName: (n: string) => {geometry: {attributes: Record<string, {array: Float32Array; count: number}>}; visible: boolean} | undefined}}).scene.getObjectByName("props:webs");
            if (!lines) return null;
            const p = lines.geometry.attributes.position.array;
            return {x: p[0], y: p[1], z: p[2], vertices: lines.geometry.attributes.position.count, seed: lines.geometry.attributes.aSeed.array[0], visible: lines.visible};
        },
        /** The clock a little on (s), the view kept: the next moment of the same picture. */
        tick: async (seconds: number) => {
            fake!.perf += seconds * 1000;
            fake!.date += seconds * 1000;
            await frames(2);
            if (closeView) {
                (debug as unknown as {controls: {minDistance: number}}).controls.minDistance = closeView.distance;
                handle.setView(closeView);
            }
            await frames(1);
            return `+${seconds.toFixed(2)} s ${(debug.seenNow?.() ?? []).filter((x) => x.line).map((x) => `log: ${x.line!.replace("{aAnimal}", `a ${x.name}`)}`).join(" / ")}`;
        },
        /** An animal found where it is drawn now (a wide look first, so it is drawn), then framed close from its side. */
        find: async (id: string, distance: number) => {
            const far = handle.locate(id);
            if (far) handle.setView({target: {x: far.x, y: far.y, z: far.z}, distance: 40, polar: 0.9, azimuth: 0.7});
            await frames(4);
            const at = handle.locate(id);
            // (Closer than the page lets a visitor come: a wagtail is 15 cm long.)
            const rig = debug as unknown as {controls: {minDistance: number}; camera: {near: number; updateProjectionMatrix: () => void}};
            rig.controls.minDistance = Math.min(rig.controls.minDistance, distance);
            rig.camera.near = 0.03;
            rig.camera.updateProjectionMatrix();
            // (From the clearest side, `clearView`: a dung fly by a trunk was filmed through the trunk.)
            const clear = at ? handle.clearView?.({x: at.x, y: at.y, z: at.z}, distance, 1.45, at.yaw + Math.PI / 2) : null;
            closeView = at ? {target: {x: at.x, y: at.y, z: at.z}, distance, polar: clear?.polar ?? 1.45, azimuth: clear?.azimuth ?? at.yaw + Math.PI / 2} : null;
            if (closeView) handle.setView(closeView);
            await frames(4);
            return at ? `${id.slice(-3)} at ${at.x.toFixed(1)}, ${at.z.toFixed(1)} length ${at.length.toFixed(2)} rig ${JSON.stringify((debug as unknown as {rigState: (id: string) => unknown}).rigState(id))} ${(debug.seenNow?.() ?? []).filter((x) => x.line).map((x) => `log: ${x.line!.replace("{aAnimal}", `a ${x.name}`)}`).join(" / ")}` : "not found";
        },
        /**
         * Tiny animals seen (`tiny-lift.ts`): the animal chosen (its card open) and the view `distance` back from it, from the
         * clearest side (`clearView`: no trunk or rock between); `lift` false draws it at true size (the before picture).
         */
        chosen: async (id: string, distance: number | null, lift = true) => {
            (globalThis as {__arkTinyLift?: boolean}).__arkTinyLift = lift;
            if (!handle.locate(id)) return `${id.slice(-3)} not found`;
            // Chosen as a reader would (its card): the page's own flight frames it, from out along the surface it is on.
            handle.select(id);
            for (let i = 0; i < 40; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            if (distance !== null) {
                // Then pulled back along the same line of sight, as a reader zooming out with the card open.
                const rig = debug as unknown as {controls: {minDistance: number}};
                rig.controls.minDistance = Math.min(rig.controls.minDistance, distance);
                handle.setView({...handle.view(), distance});
            }
            await frames(12);
            const at = handle.locate(id);
            return `${id.slice(-3)} chosen, ${distance === null ? "the page's own close-up" : `${distance} m back`}, lift ${lift ? "on" : "off"}, length ${at ? at.length.toFixed(3) : "?"} m`;
        },
        /** The view on an animal where it is now, in the air too (after a `shot`, the clock standing). */
        closeOn: async (id: string, distance: number, polar = 1.35, azimuth = 0.7) => {
            const act = debug.entries().find((e) => e.animal.id === id)?.act as {x: number; z: number; base: number} | null | undefined;
            const at = act ? {x: act.x, y: act.base + 0.15, z: act.z} : handle.locate(id);
            const rig = debug as unknown as {controls: {minDistance: number}};
            rig.controls.minDistance = Math.min(rig.controls.minDistance, distance);
            if (at) handle.setView({target: {x: at.x, y: at.y, z: at.z}, distance, polar, azimuth});
            await frames(3);
        },
        /** The world at an absolute time (s), looking at a point from close by. */
        look: async (epoch: number, at: {x: number; y: number; z: number}, distance: number) => {
            await setAt(epoch);
            handle.setView({target: at, distance, polar: 1.35, azimuth: 0.4});
            await frames(6);
        },
        /** The world at `s` seconds after the event, from `distance`, on an animal (`follow`) or a point. */
        shot: async (s: number, distance: number, follow?: string, point?: {x: number; z: number}, azimuth = 0.7, polar = 1.15) => {
            await setAt(t0 + s - 2.5);
            for (let i = 1; i <= 25; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const who = point ?? handle.locate(follow ?? a) ?? at0;
            handle.setView(view(distance, {x: who.x, z: who.z}, polar, azimuth));
            await frames(3);
            // (The dung list is made every 2 s of the page's clock: a moment more for it.)
            fake!.perf += 2100;
            fake!.date += 2100;
            await frames(3);
            const acts = debug
                .entries()
                .filter((e) => e.act)
                .map((e) => `${e.animal.id.slice(-3)} ${e.animal.model_slug} ${String(e.act!.meal ?? "-")} ${String(e.act!.state ?? "")}${e.act!.hidden ? " hidden" : ""}${e.act!.lying ? ` lying ${Number(e.act!.lying).toFixed(2)}` : ""}`);
            const status = (id: string) => (handle.animalStatus?.(id)?.line ?? handle.animalStatus?.(id)?.activity ?? "-");
            const said = Array.from(new Set((debug.seenNow?.() ?? []).filter((x) => x.line).map((x) => `log: ${x.line!.replace("{aAnimal}", `a ${x.name}`).replace("{animals}", `${x.name}s`)}`)));
            return `+${s.toFixed(1)} s   card a: ${status(a)}   card b: ${status(b)}   dung marks: ${api.dung().length}\n${acts.concat(said).join("\n")}${scene.kind === "lure" ? `\n${JSON.stringify(debug.lures?.())}` : ""}${scene.kind === "hatch" ? `\n${JSON.stringify(debug.drops?.())}` : ""}${scene.kind === "mob" ? `\n${JSON.stringify(debug.mobbing?.())} rigs ${JSON.stringify(scene.cast[0] ? Array.from({length: scene.cast[0].n}, (_, i) => (debug as unknown as {rigState: (id: string) => unknown}).rigState(castId(0, i))).concat((debug as unknown as {rigState: (id: string) => unknown}).rigState(foe)) : [])}` : ""}`;
        },
        /** p3 (shake): the cast's next climbs out of the water (the scene's own schedule), the earliest first. */
        outs: () => {
            const ask = (debug as unknown as {waterOuts: (id: string, from: number, slots: number) => Array<{arrive: number; x: number; z: number}>}).waterOuts;
            const all = scene.cast[0] ? Array.from({length: scene.cast[0].n}, (_, i) => ask(castId(0, i), t0, 1440).map((o) => ({...o, id: castId(0, i)}))).flat() : [];
            return all.sort((p, q) => p.arrive - q.arrive);
        },
        /** p3 (shake): the world run up to an absolute time a tenth of a second a frame (the drops fly), then the animal framed from `azimuth` off its heading (its side by default). */
        shakeShot: async (id: string, epoch: number, lengths: number, azimuth: number | null = null, polar = 1.4) => {
            await setAt(epoch - 1.5);
            for (let i = 0; i < 15; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const drawn = debug.entries().find((e) => e.animal.id === id) as unknown as {length: number; middle: {x: number; y: number; z: number} | null};
            const at = handle.locate(id);
            const target = drawn.middle ? {x: drawn.middle.x, y: drawn.middle.y, z: drawn.middle.z} : at ? {x: at.x, y: at.y + drawn.length * 0.3, z: at.z} : null;
            const controls = (debug as unknown as {controls: {minDistance: number}}).controls;
            if (target) {
                for (let i = 0; i < 3; i++) {
                    controls.minDistance = 0.08;
                    handle.setView({target, distance: Math.max(lengths * drawn.length, 0.5), polar, azimuth: (at ? at.yaw : 0) + (azimuth ?? Math.PI / 2)});
                    await frames(1);
                }
            }
            const pose = (debug.entries().find((e) => e.animal.id === id) as unknown as {sched?: {pose?: {beat?: string; act?: {recipe?: string; shake?: Record<string, number>} | null}}}).sched?.pose;
            const shake = pose?.act?.shake ? JSON.stringify(Object.fromEntries(Object.entries(pose.act.shake).map(([k, v]) => [k, Number(v.toFixed(2))]))) : "";
            const said = Array.from(new Set((debug.seenNow?.() ?? []).filter((x) => x.line).map((x) => `log: ${x.line!.replace("{aAnimal}", `a ${x.name}`)}`)));
            const recipes = (debug as unknown as {scene: {getObjectByName: (n: string) => {children: Array<{type: string; geometry: {drawRange: {count: number}}}>} | undefined}}).scene.getObjectByName("ark-recipes");
            const drops = recipes?.children.find((c) => c.type === "Points")?.geometry.drawRange.count ?? -1;
            return `drops ${drops} beat ${pose?.beat ?? "-"} act ${pose?.act?.recipe ?? "-"} ${shake} rig ${JSON.stringify((debug as unknown as {rigState: (id: string) => unknown}).rigState(id))} ${said.join(" / ")}`;
        },
        /** Lane SIG-OTHER: the cast and who is in it (for the tail shots). */
        tailPlan: () => scene.cast.map((c, k) => ({slug: c.slug, name: c.name, ids: Array.from({length: c.n}, (_, i) => castId(k, i))})),
        /**
         * Lane SIG-OTHER: an animal with its social strength forced to `social` (null: its own), the world run on until it is
         * moving (`moving`, up to 300 s; its pace is the locomotion layer's `motion`), then framed from `lengths` of its body
         * away from `azimuth` off its heading (3.14: from behind).
         */
        tailShot: async (id: string, o: {social: number | null; moving: boolean; lengths: number; azimuth: number; polar?: number; run?: number}) => {
            const dbg = debug as unknown as {forceTailSocial: (id: string, k: number | null) => void; tailSocialOf: (id: string) => number | null; controls: {minDistance: number}; camera: {near: number; updateProjectionMatrix: () => void}};
            dbg.forceTailSocial(id, o.social);
            const gaitOf = () => (debug.entries().find((e) => e.animal.id === id) as unknown as {gait?: {speed: number} | null}).gait?.speed ?? 0;
            let waited = 0;
            while (o.moving && gaitOf() < 0.35 && waited < 300) {
                for (let i = 0; i < 10; i++) {
                    fake!.perf += 100;
                    fake!.date += 100;
                    await frames(1);
                }
                waited++;
            }
            for (let i = 0; i < Math.round((o.run ?? 1) * 10); i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const far = handle.locate(id);
            if (far) handle.setView({target: {x: far.x, y: far.y, z: far.z}, distance: 30, polar: 0.9, azimuth: 0.7});
            await frames(4);
            const drawn = debug.entries().find((e) => e.animal.id === id) as unknown as {length: number; middle: {x: number; y: number; z: number} | null};
            const at = handle.locate(id);
            if (!at || !drawn) return "not found";
            const distance = Math.max(o.lengths * drawn.length, 0.08);
            dbg.controls.minDistance = Math.min(dbg.controls.minDistance, distance);
            dbg.camera.near = Math.min(0.03, distance / 25);
            dbg.camera.updateProjectionMatrix();
            const target = drawn.middle ? {x: drawn.middle.x, y: drawn.middle.y, z: drawn.middle.z} : {x: at.x, y: at.y + drawn.length * 0.3, z: at.z};
            for (let i = 0; i < 3; i++) {
                handle.setView({target, distance, polar: o.polar ?? 1.3, azimuth: at.yaw + o.azimuth});
                await frames(1);
            }
            const said = Array.from(new Set((debug.seenNow?.() ?? []).filter((x) => x.line).map((x) => `log: ${x.line!.replace("{aAnimal}", `a ${x.name}`)}`)));
            return `social ${dbg.tailSocialOf(id)?.toFixed(2) ?? "-"} pace ${gaitOf().toFixed(2)} (waited ${waited} s) length ${drawn.length.toFixed(2)} m ${said.slice(0, 2).join(" / ")}`;
        },
        /**
         * Lane SIG-OTHER: the world run on (a second at a time, up to `limit` s) until one of the cast is in an act of `recipe`, then
         * that animal followed: `n` frames `step` s apart, each framed from `lengths` of its body away. Returns the frames' notes.
         */
        flightWatch: async (recipe: string, limit: number) => {
            const acting = () => debug.entries().find((e) => (((e as unknown as {sched?: {pose?: {act?: {recipe?: string} | null}}}).sched?.pose?.act?.recipe) ?? null) === recipe);
            let waited = 0;
            while (!acting() && waited < limit) {
                for (let i = 0; i < 10; i++) {
                    fake!.perf += 100;
                    fake!.date += 100;
                    await frames(1);
                }
                waited++;
            }
            const found = acting();
            return found ? {id: found.animal.id, waited} : {id: null, waited};
        },
        /** Lane SIG-OTHER: one frame of the animal in its act: the world run on `seconds`, the camera on it from `distance` m. */
        flightFrame: async (id: string, seconds: number, distance: number, azimuth: number) => {
            for (let i = 0; i < Math.round(seconds * 10); i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const e = debug.entries().find((x) => x.animal.id === id) as unknown as {sched?: {pose?: {act?: {recipe?: string; block?: string; state?: string} | null; x?: number; z?: number; base?: number; y?: number; aloft?: boolean}}};
            const pose = e?.sched?.pose;
            const at = handle.locate(id);
            const controls = (debug as unknown as {controls: {minDistance: number}; camera: {near: number; updateProjectionMatrix: () => void}});
            controls.controls.minDistance = Math.min(controls.controls.minDistance, distance);
            controls.camera.near = Math.min(0.03, distance / 25);
            controls.camera.updateProjectionMatrix();
            if (at) for (let i = 0; i < 3; i++) {
                handle.setView({target: {x: at.x, y: at.y, z: at.z}, distance, polar: 1.25, azimuth});
                await frames(1);
            }
            return `act ${pose?.act?.recipe ?? "-"} block ${pose?.act?.block ?? "-"} state ${pose?.act?.state ?? "-"} at ${at ? `${at.x.toFixed(1)}, ${at.y.toFixed(2)}, ${at.z.toFixed(1)}` : "-"} aloft ${pose?.aloft ? "yes" : "no"}`;
        },
        /**
         * Lane SIG-OTHER: the cast and who is in it (for the look-state shots).
         */
        lsPlan: () => scene.cast.map((c, k) => ({slug: c.slug, name: c.name, ids: Array.from({length: c.n}, (_, i) => castId(k, i))})),
        /**
         * Lane SIG-OTHER: an animal with its look state forced to `k` (0-1; null: its own), the Ark month (null: its own) and
         * the hour of the island's day (null: as it is), framed from `lengths` of its body away, from `azimuth` off its side.
         */
        lsShot: async (id: string, o: {k: number | null; lengths: number; azimuth: number; polar?: number; hour?: number | null; month?: number | null; run?: number; lift?: number; focus?: [number, number, number] | null; bare?: boolean; pin?: boolean}) => {
            const dbg = debug as unknown as {forceLookState: (id: string, k: number | null) => void; forceMonth: (m: number | null) => void; lookStateOf: (id: string) => {k: number} | null; controls: {minDistance: number}; camera: {near: number; updateProjectionMatrix: () => void}; bareStage: (on: boolean) => void; pinShared: (id: string, fn: ((epoch: number) => Record<string, unknown>) | null) => void};
            dbg.forceLookState(id, o.k);
            dbg.forceMonth(o.month ?? null);
            dbg.bareStage(Boolean(o.bare));
            if (o.hour !== undefined && o.hour !== null) await setAt(Date.UTC(2026, 10, 20, o.hour) / 1000 + 60);
            for (let i = 0; i < Math.round((o.run ?? 2.5) * 10); i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const far = handle.locate(id);
            if (far) handle.setView({target: {x: far.x, y: far.y, z: far.z}, distance: 30, polar: 0.9, azimuth: 0.7});
            await frames(4);
            // (Held where it stands for the whole series: the same place by day and by night, in each state.)
            if (o.pin && far && !pinned.has(id)) {
                pinned.add(id);
                const spot = {x: far.x, y: far.y, z: far.z, yaw: far.yaw};
                dbg.pinShared(id, () => ({x: spot.x, y: spot.y, z: spot.z, yaw: spot.yaw, moving: false, aloft: false, doing: "watch"}));
                await frames(4);
            }
            const drawn = debug.entries().find((e) => e.animal.id === id) as unknown as {length: number; middle: {x: number; y: number; z: number} | null};
            const at = handle.locate(id);
            if (!at || !drawn) return "not found";
            const distance = Math.max(o.lengths * drawn.length, 0.04);
            dbg.controls.minDistance = Math.min(dbg.controls.minDistance, distance);
            dbg.camera.near = Math.min(0.03, distance / 25);
            dbg.camera.updateProjectionMatrix();
            const base = drawn.middle ? {x: drawn.middle.x, y: drawn.middle.y + (o.lift ?? 0) * drawn.length, z: drawn.middle.z} : {x: at.x, y: at.y + drawn.length * (0.3 + (o.lift ?? 0)), z: at.z};
            // (A focus: a point of the model's own frame, in lengths: x to its right, y up, z ahead: the head, the throat, the cheeks.)
            let target = base;
            if (o.focus) {
                const [fx, fy, fz] = o.focus;
                const sin = Math.sin(at.yaw);
                const cos = Math.cos(at.yaw);
                target = {x: base.x + (fx * cos + fz * sin) * drawn.length, y: base.y + fy * drawn.length, z: base.z + (-fx * sin + fz * cos) * drawn.length};
            }
            for (let i = 0; i < 3; i++) {
                handle.setView({target, distance, polar: o.polar ?? 1.3, azimuth: at.yaw + o.azimuth});
                await frames(1);
            }
            const state = dbg.lookStateOf(id);
            const said = Array.from(new Set((debug.seenNow?.() ?? []).filter((x) => x.line).map((x) => `log: ${x.line!.replace("{aAnimal}", `a ${x.name}`).replace("{animals}", `${x.name}s`)}`)));
            return `strength ${state ? state.k.toFixed(2) : "-"} length ${drawn.length.toFixed(3)} m  at ${at.x.toFixed(1)}, ${at.y.toFixed(2)}, ${at.z.toFixed(1)} yaw ${at.yaw.toFixed(2)}  ${said.slice(0, 1).join(" / ")}`;
        },
        /**
         * 3.3 batch (A): the predator (the second cast) stood `gap` body lengths of the first cast's animal from it, or
         * taken away again (null): its shared pose pinned there (`pinShared`), so the reactive layer sees a real predator.
         */
        threat: (gap: number | null) => {
            const pin = (debug as unknown as {pinShared: (id: string, fn: ((epoch: number) => Record<string, unknown>) | null) => void}).pinShared;
            const predator = castId(1, 0);
            const at = handle.locate(a);
            if (gap === null || !at) return void pin(predator, null);
            const length = debug.entries().find((e) => e.animal.id === a) as unknown as {length: number};
            const x = at.x + Math.max(gap * length.length, 0.25);
            pin(predator, () => ({x, y: Math.max(handle.heightAt(x, at.z), 0), z: at.z, yaw: -Math.PI / 2, moving: false, aloft: false, doing: "watch"}));
        },
        /** SIG-DEFENCE: the world's clock moved on to the next disturbance the day's schedule gives the first cast's animal (`disturbedNow`), less `before` s. */
        disturb: async (before = 0.5) => {
            let t = fake!.date / 1000;
            while (!disturbedNow(a, t)) t += 1;
            const ms = (t - before) * 1000 - fake!.date;
            fake!.perf += ms;
            fake!.date += ms;
            await frames(3);
        },
        /** 3.3 batch (A): the world run on for `seconds` (a tenth of a second a frame), then the first cast's animal framed from `lengths` of its body away. */
        run: async (seconds: number, lengths: number, azimuth = 0.7, polar = 1.1) => {
            for (let i = 0; i < Math.round(seconds * 10); i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const who = handle.locate(a) ?? at0;
            const drawn = debug.entries().find((e) => e.animal.id === a) as unknown as {length: number; middle: {x: number; y: number; z: number} | null};
            const length = drawn.length;
            // (Its drawn middle: a moth is on a wall, a pufferfish under the water, not on the ground at its place.)
            const target = drawn.middle ? {x: drawn.middle.x, y: drawn.middle.y, z: drawn.middle.z} : {x: who.x, y: Math.max(handle.heightAt(who.x, who.z), 0) + length * 0.3, z: who.z};
            // (Closer than the page lets a visitor come: these are small animals, and the move is in the body's shape.)
            const controls = (debug as unknown as {controls: {minDistance: number}}).controls;
            for (let i = 0; i < 3; i++) {
                controls.minDistance = 0.08;
                handle.setView({target, distance: Math.max(lengths * length, 0.12), polar, azimuth});
                await frames(1);
            }
            return `${api.defence()}   length ${length.toFixed(3)} m`;
        },
        /** What the first cast's animal does now: the reactive layer's action, its move, and what the scene reports as seen. */
        defence: () => {
            const d = (debug as unknown as {defence: (id: string) => {amount: number; tail: number; shed: number; episode: number} | null}).defence(a);
            const micro = (debug.entries().find((e) => e.animal.id === a) as unknown as {place: {micro?: unknown}; defenceNear?: number; level?: string});
            const seen = handle.seen?.().acts.filter((act) => act.recipe.startsWith("defence_")).map((act) => act.line) ?? [];
            return `action: ${micro.place.micro ? `(at its microhabitat) predator beside it ${micro.defenceNear ?? 0}` : handle.reactive?.(a)?.action ?? "-"}   move: ${d ? `amount ${d.amount.toFixed(2)} tail ${d.tail.toFixed(2)} shed ${d.shed.toFixed(1)} episode ${d.episode}` : "-"}   seen: ${seen.join(" / ") || "-"}   drawn as: ${micro.level ?? "-"}`;
        },
        /**
         * 3.3 fix (mating tap): the world run to `s` s after the mating's time, the line tapped there (`pair`: the new
         * tap, `selectPair`; else the old one, `select` of the first animal), then 3 s for the flight and the follow.
         */
        tap: async (s: number, pair: boolean) => {
            while (fake!.date / 1000 < t0 + s - 0.05) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            if (pair && handle.selectPair) handle.selectPair(a, b);
            else handle.select(a);
            for (let i = 0; i < 30; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const pa = handle.locate(a);
            const pb = handle.locate(b);
            const v = handle.view();
            const acts = debug.entries().filter((e) => e.animal.id === a || e.animal.id === b).map((e) => `${e.animal.id.slice(-3)} ${String(e.act?.state ?? "its day")}`);
            return `+${s} s, ${pair ? "new tap (the pair)" : "old tap (the first)"}: apart ${pa && pb ? Math.hypot(pa.x - pb.x, pa.z - pb.z).toFixed(1) : "?"} m, view ${v.distance.toFixed(1)} m from ${v.target.x.toFixed(1)},${v.target.z.toFixed(1)}; a ${pa ? `${pa.x.toFixed(1)},${pa.z.toFixed(1)}` : "-"} b ${pb ? `${pb.x.toFixed(1)},${pb.z.toFixed(1)}` : "-"}; ${acts.join(", ")}; ${JSON.stringify(debug.matings())}`;
        },
        /**
         * 3.3 fix (breeding taps): the line's tap as the controller now makes it (`breed-focus.ts`), at `s` s after the
         * event: "pair" a mating's two, "clutch" the pair and the clutch beside the mother, "young" the newborn with
         * its mother (`kin`); then 3 s for the flight.
         */
        breedTap: async (s: number, mode: "pair" | "clutch" | "young") => {
            while (fake!.date / 1000 < t0 + s - 0.05) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const young = youngIds[0];
            if (mode === "young") handle.selectPair?.(young, a, true);
            else handle.selectPair?.(a, b);
            if (mode === "clutch") handle.showClutch?.(`laid:harness:${s}`, [a, b], 2);
            for (let i = 0; i < 30; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const v = handle.view();
            const ids = mode === "young" ? [young, a] : [a, b];
            const at = ids.map((id) => handle.locate(id));
            const apart = at[0] && at[1] ? Math.hypot(at[0].x - at[1].x, at[0].z - at[1].z).toFixed(2) : "?";
            const laid = mode === "clutch" ? (debug as unknown as {liveClutch: () => {eggs: number | null; at: {x: number; y: number; z: number; size: number} | null} | null}).liveClutch() : null;
            const clutch = laid ? ` clutch of ${laid.eggs} at ${laid.at ? `${laid.at.x.toFixed(2)},${laid.at.z.toFixed(2)} ${laid.at.size.toFixed(3)} m` : "-"}; she at ${at[1] ? `${at[1].x.toFixed(2)},${at[1].z.toFixed(2)}` : "-"}` : "";
            return `+${s} s ${mode}:${clutch} view ${v.distance.toFixed(2)} m; apart ${apart} m; lengths ${at.map((p) => p?.length.toFixed(3) ?? "-").join("/")}`;
        },
        /** Group life (lane SIG-GROUP): an act's next windows for the cast's group (seconds after the scene's start, and how long each lasts). */
        groupWindows: (act: Parameters<typeof actWindow>[0], count: number) => {
            const out: Array<{n: number; s: number; len: number}> = [];
            for (let s = 0; s < 14400 && out.length < count; s += 10) {
                const w = actWindow(act, castId(0, 0), t0 + s);
                if (w && !out.some((o) => o.n === w.n)) out.push({n: w.n, s: w.t0 - t0, len: w.t1 - w.t0});
            }
            return out;
        },
        /** Group life: the world at `s` seconds after the scene's start, the cast's group framed from `lengths` of its spread (or `distance` m), and what each member is doing. */
        groupShot: async (s: number, distance: number, azimuth = 0.7, polar = 1.1, k = 0) => {
            await setAt(t0 + s - 2.5);
            for (let i = 1; i <= 25; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const ids = Array.from({length: scene.cast[k].n}, (_, i) => castId(k, i));
            const at = ids.map((id) => handle.locate(id));
            // (The members acting out a group act, if any: the frame is on them.)
            const GROUP_RECIPES = new Set(["huddle", "sentinel_post", "dusk_gather", "lick_gather", "chorus", "tree_feast", "bask_pile"]);
            const actingNow = ids.map((id) => GROUP_RECIPES.has((debug.entries().find((x) => x.animal.id === id) as unknown as {sched?: {pose?: {act?: {recipe?: string} | null}}} | undefined)?.sched?.pose?.act?.recipe ?? ""));
            const some = actingNow.some(Boolean);
            const found = at.filter((p, i): p is NonNullable<typeof p> => Boolean(p) && (!some || actingNow[i]));
            const cx = found.reduce((m, p) => m + p.x, 0) / Math.max(found.length, 1);
            const cz = found.reduce((m, p) => m + p.z, 0) / Math.max(found.length, 1);
            const cy = found.reduce((m, p) => m + p.y, 0) / Math.max(found.length, 1);
            const spread = found.reduce((m, p) => Math.max(m, Math.hypot(p.x - cx, p.z - cz)), 0);
            const controls = (debug as unknown as {controls: {minDistance: number}}).controls;
            for (let i = 0; i < 3; i++) {
                controls.minDistance = 0.08;
                handle.setView({target: {x: cx, y: Math.max(cy, handle.heightAt(cx, cz)) + 0.2, z: cz}, distance: Math.max(distance, spread * 2.4 + 1.2), polar, azimuth});
                await frames(1);
            }
            const lines = ids.map((id, i) => {
                const e = debug.entries().find((x) => x.animal.id === id) as unknown as {sched?: {pose?: {beat?: string; doing?: string; act?: {recipe?: string; block?: string} | null}}} | undefined;
                const p = at[i];
                return `${i}${i === 0 ? "L" : " "} ${(e?.sched?.pose?.act?.recipe ?? "-").padEnd(14)} ${(e?.sched?.pose?.act?.block ?? "-").padEnd(6)} ${(e?.sched?.pose?.beat ?? "-").padEnd(6)} card:${(handle.animalStatus?.(id)?.line ?? handle.animalStatus?.(id)?.activity ?? "-")} ${p ? `d=${Math.hypot(p.x - cx, p.z - cz).toFixed(1)} y=${(p.y - handle.heightAt(p.x, p.z)).toFixed(1)} at ${p.x.toFixed(1)},${p.z.toFixed(1)}` : "-"}`;
            });
            const said = Array.from(new Set((debug.seenNow?.() ?? []).filter((x) => x.line).map((x) => `log: ${x.line!.replace("{aAnimal}", `a ${x.name}`).replace("{animals}", `${x.name}s`)}`)));
            return `+${s.toFixed(0)} s spread ${spread.toFixed(1)} m centre ${cx.toFixed(1)},${cz.toFixed(1)}\n${lines.concat(said).join("\n")}`;
        },
        /**
         * Reptile signatures: a recipe's episode of the cast, found from the schedule's own pure functions (the way
         * `recipes-entry.ts` finds its moments): which animal, when, and its keys (block, seconds, where).
         */
        episode: () => {
            if (scene.kind !== "recipe" || !scene.recipe) return null;
            const world = scheduleWorld(worldSampler());
            const entries = debug.entries() as unknown as Array<{animal: {id: string; model_slug: string; activity: ArkBehaviourProfile["activity"] | null}; sched?: {animal: ScheduleAnimal; profile: ArkBehaviourProfile} | null}>;
            const wanted = scene.recipe;
            const found: Array<Record<string, unknown>> = [];
            // (Lane SIG5: a pair recipe's meeting (two real animals of the cast), from the schedule's own pair meetings.)
            if (TEMPLATES[wanted]?.kind === "pair") {
                for (const e of entries) {
                    if (!e.sched || found.length) continue;
                    const sched = e.sched;
                    const meet = pairMeetingsAt(world, sched.profile, sched.animal, t0, t0 + 90 * SLOT_SECONDS, () => scene.hours, e.animal.activity).find((m) => m.recipe === wanted && m.role === "a");
                    const ep = meet ? pairEpisodeAt(world, sched.profile, sched.animal, meet.t0 + 0.01, () => scene.hours, e.animal.activity) : null;
                    if (ep) found.push({id: e.animal.id, other: meet!.other, t0: ep.t0, t1: ep.t1, anchor: ep.anchor, keys: ep.keys.map((key) => ({b: key.block.id, t0: key.t0, t1: key.t1, from: key.from, to: key.to, caught: null}))});
                }
                return found;
            }
            for (const e of entries) {
                if (!e.sched) continue;
                for (let k = 0; k < 90 && found.length < 6; k++) {
                    const trip: Trip = tripAt(world, e.sched.profile, e.sched.animal, t0 + k * SLOT_SECONDS, () => scene.hours, e.animal.activity);
                    // (Lane SIG5: a stay where it already is, a `goal: "here"` template, is the trip's episode though the trip names no recipe.)
                    const ep = trip.recipe === wanted || !trip.recipe ? tripEpisode(world, trip) : null;
                    if (!ep || ep.recipe !== wanted) continue;
                    found.push({id: e.animal.id, slot: trip.slot, t0: ep.t0, t1: ep.t1, anchor: ep.anchor, keys: ep.keys.map((key) => ({b: key.block.id, t0: key.t0, t1: key.t1, from: key.from, to: key.to, caught: key.catch ? key.catch.ok : null}))});
                    break;
                }
            }
            return found;
        },
        /**
         * The world at an absolute time (s) run up a tenth of a second a frame from 2 s before (the clips settle), then
         * the animal framed from `lengths` of its body from its side (`azimuth` off its heading), with what it is doing.
         */
        recipeShot: async (id: string, epoch: number, lengthsIn: number | null, azimuthIn?: number | null, polarIn?: number | null) => {
            const lengths = lengthsIn || scene.lengths || 4;
            const azimuth = azimuthIn ?? scene.azimuth ?? Math.PI / 2;
            const polar = polarIn ?? scene.polar ?? 1.3;
            await setAt(epoch - 2);
            for (let i = 0; i < 20; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const drawn = debug.entries().find((e) => e.animal.id === id) as unknown as {length: number; middle: {x: number; y: number; z: number} | null; sched?: {pose?: {beat?: string; act?: {recipe?: string; block?: string; state?: string; u?: number} | null}}; act?: {meal?: unknown} | null};
            const at = handle.locate(id);
            if (!at) return "not drawn";
            const target = drawn.middle ? {x: drawn.middle.x, y: drawn.middle.y, z: drawn.middle.z} : {x: at.x, y: at.y + drawn.length * 0.3, z: at.z};
            const controls = (debug as unknown as {controls: {minDistance: number}; camera: {near: number; updateProjectionMatrix: () => void}});
            for (let i = 0; i < 3; i++) {
                controls.controls.minDistance = 0.05;
                controls.camera.near = 0.02;
                controls.camera.updateProjectionMatrix();
                handle.setView({target, distance: Math.max(lengths * drawn.length, 0.3), polar, azimuth: at.yaw + azimuth});
                await frames(1);
            }
            const pose = drawn.sched?.pose;
            const said = Array.from(new Set((debug.seenNow?.() ?? []).filter((x) => x.line).map((x) => `log: ${x.line!.replace("{aAnimal}", `a ${x.name}`)}`)));
            const terrain = worldSampler().heightAt(at.x, at.z);
            const actPitch = (drawn.sched?.pose?.act as {pitch?: number} | null | undefined)?.pitch;
            const sp = drawn.sched?.pose as {x?: number; y?: number; z?: number} | undefined;
            const water = (worldSampler() as unknown as {waterSurface?: (x: number, z: number) => number}).waterSurface?.(at.x, at.z);
            const lift = `y-terrain ${(at.y - terrain).toFixed(3)} pitch ${actPitch === undefined ? "-" : actPitch.toFixed(2)} at ${at.x.toFixed(2)},${at.y.toFixed(2)},${at.z.toFixed(2)} pose ${sp?.x?.toFixed(2)},${sp?.y?.toFixed(2)},${sp?.z?.toFixed(2)} terrain ${terrain.toFixed(2)} water ${typeof water === "number" ? water.toFixed(2) : "-"} path ${(drawn as unknown as {posePath?: string}).posePath ?? "-"} seat ${JSON.stringify((drawn as unknown as {seat?: {x: number; y: number; z: number; pushes: number; fell: boolean; on: string}}).seat ? (({x, y, z, pushes, fell, on}) => ({x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), pushes, fell, on}))((drawn as unknown as {seat: {x: number; y: number; z: number; pushes: number; fell: boolean; on: string}}).seat) : null)} coll ${JSON.stringify((drawn as unknown as {push?: unknown; collide?: unknown}).push ?? null)}`;
            return `${id.slice(-3)} length ${drawn.length.toFixed(2)} ${lift} beat ${pose?.beat ?? "-"} act ${pose?.act?.recipe ?? "-"}/${pose?.act?.block ?? "-"}/${pose?.act?.state ?? "-"} rig ${JSON.stringify((debug as unknown as {rigState: (id: string) => unknown}).rigState(id))} ${said.join(" / ")}`;
        },
        /** Reptile signatures: the first of the cast with a sit-and-wait bout in the next four minutes (`micro-ambush.ts`), and its bouts. */
        microBouts: () => {
            const entries = debug.entries() as unknown as Array<{animal: {id: string}; trueLength: number}>;
            for (let i = 0; i < scene.cast[0].n; i++) {
                const id = castId(0, i);
                const e = entries.find((x) => x.animal.id === id);
                if (!e) continue;
                const bouts = ambushBouts(id, e.trueLength, t0, t0 + 240);
                if (bouts.length) return {id, length: e.trueLength, bouts};
            }
            return null;
        },
        /** The world at an absolute time (s) run up a tenth of a second a frame from 2 s before, then the animal framed close from in front of its surface. */
        microShot: async (id: string, epoch: number, lengthsIn: number | null) => {
            const lengths = lengthsIn || scene.lengths || 6;
            await setAt(epoch - 2);
            for (let i = 0; i < 20; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            const e = debug.entries().find((x) => x.animal.id === id) as unknown as {trueLength: number; length: number; place: {micro?: unknown; x: number; z: number}; recipeAct?: {block?: string; state?: string; quarry?: {phase: string} | null} | null; animal: {zone: string}};
            const at = handle.locate(id);
            if (!at) return "not drawn";
            const micro = e.place.micro as Parameters<typeof surfacePoint>[0];
            const point = surfacePoint(micro, e.animal.zone as never, 0);
            const wall = Math.abs(point.ny) < 0.6;
            const controls = debug as unknown as {controls: {minDistance: number}; camera: {near: number; updateProjectionMatrix: () => void}};
            for (let i = 0; i < 3; i++) {
                controls.controls.minDistance = 0.03;
                controls.camera.near = 0.01;
                controls.camera.updateProjectionMatrix();
                handle.setView({target: {x: at.x, y: at.y, z: at.z}, distance: Math.max(lengths * e.trueLength, 0.25), polar: wall ? 1.45 : 1.05, azimuth: wall ? Math.atan2(point.nx, point.nz) + 0.25 : at.yaw + Math.PI / 2});
                await frames(1);
            }
            const said = Array.from(new Set((debug.seenNow?.() ?? []).filter((x) => x.line).map((x) => `log: ${x.line!.replace("{aAnimal}", `a ${x.name}`)}`)));
            return `${id.slice(-3)} length ${e.trueLength.toFixed(3)} on ${wall ? "a wall" : "a surface"} act ${e.recipeAct?.block ?? "-"}/${e.recipeAct?.state ?? "-"} insect ${e.recipeAct?.quarry?.phase ?? "-"} rig ${JSON.stringify((debug as unknown as {rigState: (id: string) => unknown}).rigState(id))} ${said.join(" / ")}`;
        },
        /** sig2-small: which recipe the scene is for and how it is framed. */
        smInfo: () => ({recipe: (scene as {recipe?: string}).recipe ?? "", lengths: (scene as {lengths?: number}).lengths ?? 5, polar: (scene as {polar?: number}).polar ?? 1.0, ids: scene.cast.map((_, k) => castId(k, 0))}),
        /** sig2-small: the first cast species' moments of a recipe in the day from the event (`behaviours-small.ts`), and the scene's own pace on them. */
        recipeMoments: (recipe: string) => smallMoments(debug.entries().filter((e) => e.animal.model_slug === scene.cast[0].slug) as never, recipe, TEMPLATES[recipe], t0, scene.hours),
        /** sig2-small: the world run up to an absolute time (a tenth of a second a frame), then the animals (`ids`) framed together from `lengths` of the first one's body, side on. */
        smShot: async (ids: string[], epoch: number, lengths: number, azimuth: number | null = null, polar = 1.4) => {
            await setAt(epoch - 1.5);
            for (let i = 0; i < 15; i++) {
                fake!.perf += 100;
                fake!.date += 100;
                await frames(1);
            }
            type ActNow = {recipe?: string; block?: string; state?: string; pitch?: number; roll?: number; carry?: unknown; mark?: unknown};
            type Drawn = {length: number; middle: {x: number; y: number; z: number} | null; recipeAct?: ActNow | null; toLight?: number; place?: {micro?: unknown}; sched?: {pose?: {beat?: string; act?: ActNow | null}}};
            const drawn = ids.map((id) => debug.entries().find((e) => e.animal.id === id) as unknown as Drawn);
            const at = ids.map((id) => handle.locate(id));
            const mids = drawn.map((d, i) => (d?.middle ? d.middle : at[i] ? {x: at[i]!.x, y: at[i]!.y + (d?.length ?? 0.1) * 0.3, z: at[i]!.z} : null)).filter(Boolean) as Array<{x: number; y: number; z: number}>;
            if (mids.length) {
                const target = {x: mids.reduce((n, m) => n + m.x, 0) / mids.length, y: mids.reduce((n, m) => n + m.y, 0) / mids.length, z: mids.reduce((n, m) => n + m.z, 0) / mids.length};
                const apart = mids.length > 1 ? Math.hypot(mids[0].x - mids[1].x, mids[0].z - mids[1].z) : 0;
                const controls = (debug as unknown as {controls: {minDistance: number}}).controls;
                for (let i = 0; i < 3; i++) {
                    controls.minDistance = 0.05;
                    handle.setView({target, distance: Math.max(lengths * (drawn[0]?.length ?? 0.1), apart * 1.7, 0.1), polar, azimuth: (at[0] ? at[0].yaw : 0) + (azimuth ?? Math.PI / 2)});
                    await frames(1);
                }
            }
            const say = (d: Drawn | undefined, id: string) => {
                const act = d?.recipeAct ?? d?.sched?.pose?.act ?? null;
                return `${id.slice(-3)}${d?.place?.micro ? " (micro)" : ""} ${act ? `${act.recipe}/${act.block}/${act.state} pitch ${(act.pitch ?? 0).toFixed(2)} roll ${(act.roll ?? 0).toFixed(2)}${act.carry ? " carrying" : ""}${act.mark ? " marking" : ""}` : `its day (${d?.sched?.pose?.beat ?? (d?.toLight ? `to the light ${d.toLight.toFixed(2)}` : "-")})`} len ${(d?.length ?? 0).toFixed(3)}`;
            };
            const said = Array.from(new Set((debug.seenNow?.() ?? []).filter((x) => x.line).map((x) => `log: ${x.line!.replace("{aAnimal}", `a ${x.name}`).replace("{animals}", `${x.name}s`)}`)));
            const toOther = mids.length > 1 ? Math.atan2(mids[1].x - mids[0].x, mids[1].z - mids[0].z) : 0;
            const gap = mids.length > 1 ? ` apart ${Math.hypot(mids[0].x - mids[1].x, mids[0].z - mids[1].z).toFixed(2)} m yaw ${at.map((p) => (p ? p.yaw.toFixed(2) : "-")).join("/")} a->b ${toOther.toFixed(2)}` : "";
            return `${ids.map((id, i) => say(drawn[i], id)).join(" | ")}${gap} ${said.join(" / ")}`;
        },
        handle
    };
    (window as unknown as {__behaviours: typeof api}).__behaviours = api;
}

main().catch((error) => {
    console.error("[behaviours]", error?.stack ?? error);
    (window as unknown as {__behavioursError?: string}).__behavioursError = String(error?.stack ?? error);
});
