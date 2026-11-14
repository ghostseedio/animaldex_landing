#!/usr/bin/env -S npx tsx
/**
 * Each flyer's way of life in the air (behaviours pass, lane B5 air, 2026-11-14): how often it takes off and why, from
 * the stored taxonomy and the profiles already generated from it. The schedule (`behaviour-schedule.ts` stations) and
 * `locomotion/flight.ts` (`flightWay`, `FLIGHT_WAYS`) read it. Deterministic, no AI calls, committed inputs only:
 *
 *   - `data/ark/locomotion-styles.json`: the family each flyer's flight style was decided by (lane L2's reasons);
 *   - `data/ark/behaviour-profiles.json`: how it moves first, its body plan, its diet;
 *   - `data/ark/intelligence-profiles.json`: how it hunts (`aerial_hawk`, `perch_wait`, `scavenge`).
 *
 *   npx tsx scripts/ark-flight-ways.mts
 *
 * Output: `src/ark-scene/locomotion/flight-ways.json` ({slug: way}) and, with the rule that decided each,
 * `data/ark/flight-ways.json`. Only animals that fly first get a row (a bird that walks or swims first flies as lane
 * MA3 set it, `airShare`). The ways:
 *   soar     sits on a perch with a view, soars in the warm hours (buzzards, eagles, kites, the osprey)
 *   vulture  the same, on the wing most of the warm hours (vultures, condors, frigatebirds)
 *   stork    walks or floats to feed, soars in the warm hours (storks, pelicans)
 *   perch    sits and waits, flies with purpose (kingfishers, bee-eaters, rollers, flycatchers, shrikes, falcons,
 *            sparrowhawks, owls, frogmouths, potoos, cuckoos, cormorants drying their wings)
 *   aerial   feeds on the wing and rests on a perch between (swallows, martins, nightjars, pratincoles, the bats that
 *            hawk insects)
 *   swift    on the wing all its waking day (swifts, treeswifts)
 *   flit     flits in cover from twig to twig (tits, warblers, wrens, white-eyes, sunbirds, fantails, manakins)
 *   tree     works a trunk, then flies to the next (woodpeckers, nuthatches, treecreepers)
 *   ground   feeds on the ground and flies up to a perch (thrushes, sparrows, finches, wagtails, pipits, starlings,
 *            crows)
 *   commute  flies between its roost and its feeding trees at the day's two ends, clambers in between (parrots,
 *            hornbills, toucans, turacos, fruit pigeons, birds of paradise, the fruit bats)
 *   wader    stands or walks in the shallows, flies a few times a day (herons, egrets, ibises, cranes, flamingos)
 *   shore    runs on the shore and flies low along it (sandpipers, plovers, stilts, oystercatchers, jacanas)
 *   patrol   loafs on a rock or the water and patrols on the wing (gulls, terns, skuas, gannets, petrels, albatrosses,
 *            the auks)
 *   hover    hovers at flowers and perches between (hummingbirds)
 *   flower   an insect that works flowers (butterflies, bees, hoverflies, hawk moths, bee flies)
 *   dragon   an insect that holds a beat from a perch (dragonflies, damselflies, robber flies)
 *   bug      an insect that flies now and then (flies, wasps, beetles, moths, lacewings, mayflies)
 */

import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
function read<T>(file: string): T {
    return JSON.parse(fs.readFileSync(path.join(root, file), "utf8")) as T;
}
const styles = read<{species: Record<string, {flight?: {code: string; why: string}}>}>("data/ark/locomotion-styles.json").species;
const profiles = read<{profiles: Array<{slug: string; excluded: string | null; plan: string; move: string; moves: string[]; diet: string; activity: string; size: number | null; behaviours: Record<string, number>}>}>("data/ark/behaviour-profiles.json").profiles;
const intel = new Map(read<{profiles: Array<{slug: string; hunt: Array<{style: string}>}>}>("data/ark/intelligence-profiles.json").profiles.map((p) => [p.slug, p.hunt.map((h) => h.style)]));

type Way = "soar" | "vulture" | "stork" | "perch" | "aerial" | "swift" | "flit" | "tree" | "ground" | "commute" | "wader" | "shore" | "patrol" | "hover" | "flower" | "dragon" | "bug";

/** Families by way of life (handbooks' accounts of foraging and flight: HBW family texts, BWP, Cornell's Birds of the World). */
const FAMILY: Record<string, Way> = {
    // Thermal soarers.
    Accipitridae: "soar", Pandionidae: "soar", Cathartidae: "vulture", Fregatidae: "vulture", Ciconiidae: "stork", Pelecanidae: "stork",
    // Sit and wait.
    Alcedinidae: "perch", Meropidae: "perch", Coraciidae: "perch", Momotidae: "perch", Todidae: "perch", Galbulidae: "perch", Bucconidae: "perch", Trogonidae: "perch",
    Laniidae: "perch", Muscicapidae: "perch", Tyrannidae: "perch", Dicruridae: "perch", Monarchidae: "perch", Falconidae: "perch", Strigidae: "perch", Tytonidae: "perch",
    Podargidae: "perch", Nyctibiidae: "perch", Cuculidae: "perch", Cracticidae: "perch", Phalacrocoracidae: "perch", Anhingidae: "perch", Indicatoridae: "perch",
    // On the wing.
    Hirundinidae: "aerial", Apodidae: "swift", Hemiprocnidae: "swift", Glareolidae: "aerial", Caprimulgidae: "aerial", Artamidae: "aerial",
    // In cover.
    Paridae: "flit", Phylloscopidae: "flit", Sylviidae: "flit", Acrocephalidae: "flit", Cettiidae: "flit", Cisticolidae: "flit", Troglodytidae: "flit", Zosteropidae: "flit",
    Nectariniidae: "flit", Dicaeidae: "flit", Rhipiduridae: "flit", Pipridae: "flit", Maluridae: "flit", Parulidae: "flit", Thraupidae: "flit", Remizidae: "flit",
    Regulidae: "flit", Aegithalidae: "flit", Meliphagidae: "flit", Leiothrichidae: "flit", Pycnonotidae: "flit", Thamnophilidae: "flit", Acanthisittidae: "flit",
    Paramythiidae: "flit", Panuridae: "flit", Irenidae: "flit", Bombycillidae: "flit", Cardinalidae: "flit", Vireonidae: "flit", Eupetidae: "flit",
    // On a trunk.
    Picidae: "tree", Sittidae: "tree", Certhiidae: "tree", Tichodromidae: "tree", Furnariidae: "tree",
    // On the ground, up to a perch.
    Turdidae: "ground", Passeridae: "ground", Passerellidae: "ground", Emberizidae: "ground", Fringillidae: "ground", Estrildidae: "ground", Ploceidae: "ground",
    Viduidae: "ground", Motacillidae: "ground", Alaudidae: "ground", Calcariidae: "ground", Mimidae: "ground", Pomatostomidae: "ground", Sturnidae: "ground",
    Buphagidae: "ground", Icteridae: "ground", Corvidae: "ground", Corcoracidae: "ground", Menuridae: "ground", Upupidae: "ground", Cinclidae: "ground",
    Pityriaseidae: "ground", Columbidae: "ground", Pteroclididae: "ground",
    // Roost to feeding trees and back.
    Psittacidae: "commute", Cacatuidae: "commute", Psittaculidae: "commute", Bucerotidae: "commute", Ramphastidae: "commute", Musophagidae: "commute",
    Paradisaeidae: "commute", Cotingidae: "commute", Ptilonorhynchidae: "commute", Oriolidae: "commute", Megalaimidae: "commute", Capitonidae: "commute",
    Opisthocomidae: "commute", Steatornithidae: "commute",
    // In the shallows.
    Ardeidae: "wader", Threskiornithidae: "wader", Phoenicopteridae: "wader", Gruidae: "wader", Aramidae: "wader", Scopidae: "wader", Balaenicipitidae: "wader", Eurypygidae: "wader",
    // On the shore.
    Scolopacidae: "shore", Charadriidae: "shore", Recurvirostridae: "shore", Haematopodidae: "shore", Jacanidae: "shore", Rostratulidae: "shore", Ibidorhynchidae: "shore",
    Pluvianidae: "shore", Chionidae: "shore", Burhinidae: "shore",
    // Over the sea.
    Laridae: "patrol", Stercorariidae: "patrol", Sulidae: "patrol", Phaethontidae: "patrol", Diomedeidae: "patrol", Procellariidae: "patrol", Hydrobatidae: "patrol", Alcidae: "patrol"
};
/** Insect orders and families (the styles' reasons name them "Order/Family" or "Order (Family)"). */
const INSECT: Array<[RegExp, Way]> = [
    [/^Odonata|Asilidae/, "dragon"],
    [/Sphingidae|Syrphidae|Bombyliidae|Apidae|Halictidae|Megachilidae|Andrenidae|Colletidae/, "flower"],
    [/^Lepidoptera.*(Nymphalidae|Papilionidae|Pieridae|Lycaenidae|Hesperiidae|Riodinidae|Uraniidae)/, "flower"]
];
/** The hawks that hunt from cover with a dash, not from a soar (Accipiter and its kin, by name). */
const DASHING_HAWK = /(?:^|-)(sparrowhawk|goshawk|shikra|besra|coopers-hawk|sharp-shinned-hawk)$/;
/** The Old World vultures and the condor-like among the hawks' family, by name. */
const VULTURE = /(?:^|-)(vulture|griffon|condor|lammergeier)$/;

const out: Record<string, Way> = {};
const why: Record<string, {way: Way; rule: string}> = {};
const tally: Record<string, number> = {};
for (const p of [...profiles].sort((a, b) => a.slug.localeCompare(b.slug))) {
    if (p.excluded || p.move !== "fly") continue;
    const reason = styles[p.slug]?.flight?.why ?? "";
    const head = reason.split(":")[0].trim();
    const family = head.replace(/^(bat|hummingbird) \((\w+)\)$/, "$2");
    const hunts = intel.get(p.slug) ?? [];
    let way: Way | null = null;
    let rule = "";
    const set = (w: Way, r: string) => {
        if (way) return;
        way = w;
        rule = r;
    };
    if (p.plan === "bat") {
        if (hunts.includes("aerial_hawk") || p.diet === "insects") set("aerial", `a bat that hawks insects (${hunts.includes("aerial_hawk") ? "hunt aerial_hawk" : "diet insects"})`);
        else set("commute", `a bat that eats ${p.diet}: flies out to its feeding trees and back`);
    } else if (p.plan === "flying_insect" || p.plan === "insect") {
        for (const [pattern, w] of INSECT) if (pattern.test(head)) set(w, `${head}`);
        if ((p.behaviours.visit_flowers ?? 0) >= 0.5) set("flower", "visits flowers (its stored diet)");
        set("bug", head ? `${head}: flies now and then` : "an insect: flies now and then");
    } else {
        if (family === "Trochilidae") set("hover", "family Trochilidae: hovers at flowers");
        if (family === "Accipitridae" && VULTURE.test(p.slug)) set("vulture", "family Accipitridae, a vulture by name");
        if (family === "Accipitridae" && DASHING_HAWK.test(p.slug)) set("perch", "family Accipitridae, a hawk that dashes from cover (by name)");
        if (FAMILY[family]) set(FAMILY[family], `family ${family}`);
        if (hunts.includes("aerial_hawk")) set("aerial", "hunt aerial_hawk: feeds on the wing");
        if (hunts.includes("perch_wait")) set("perch", "hunt perch_wait");
        const code = styles[p.slug]?.flight?.code ?? "";
        if (code.startsWith("s")) set("soar", `flight style soar (${head || "no family"})`);
        if (code.startsWith("b")) set("flit", `flight style flap-bounding (${head || "no family"}): a small bird in cover`);
        set("ground", `no rule for ${head || "its family"}: feeds low, flies up to a perch`);
    }
    out[p.slug] = way!;
    why[p.slug] = {way: way!, rule};
    tally[way!] = (tally[way!] ?? 0) + 1;
}
const about =
    "Generated by scripts/ark-flight-ways.mts from data/ark/locomotion-styles.json (families), behaviour-profiles.json and intelligence-profiles.json: each fly-first animal's way of life in the air. Decoded by locomotion/flight.ts flightWay; the reason for each is in data/ark/flight-ways.json.";
fs.writeFileSync(path.join(root, "src/ark-scene/locomotion/flight-ways.json"), `{"about":${JSON.stringify(about)},\n"species":{\n${Object.entries(out).map(([slug, way]) => `${JSON.stringify(slug)}:${JSON.stringify(way)}`).join(",\n")}\n}}\n`);
fs.writeFileSync(path.join(root, "data/ark/flight-ways.json"), `${JSON.stringify({about: "Why each fly-first animal has its way of life in the air (scripts/ark-flight-ways.mts).", tally, species: why}, null, 1)}\n`);
console.log(JSON.stringify(tally), `${Object.keys(out).length} species`);
