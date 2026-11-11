#!/usr/bin/env -S npx tsx
/**
 * Locomotion styles for every Ark species (motion pass lane L2: flight, swimming, legless), from stored data only:
 * the catalogue's taxonomy (class, order, family), its stored text (only where a style is named there: sidewinding),
 * the rig set's body plan, and the talking model's own plan. Deterministic rules, no AI calls. Every field keeps the
 * rule or phrase that decided it in `data/ark/locomotion-styles.json`.
 *
 * Inputs (read-only, local):
 *   1. the behaviour lane's live export (`scripts/ark-behaviour-profiles.mts` input 1: taxonomy and field-guide text);
 *   2. the rig v2 set's `detail.json` (`~/animaldex-talking-models/rig/publish-v2/detail.json`): plan per species;
 *   3. the Ark models' `ark.json` (`~/animaldex-talking-models/ark/<slug>/ark.json`): the talking model's plan;
 *   4. `src/ark-scene/behaviours.json` (does it fly?).
 *
 *   npx tsx scripts/ark-locomotion-styles.mts export.json detail.json ~/animaldex-talking-models/ark
 *
 * Outputs: `src/ark-scene/locomotion/styles.json` (compact rows, decoded by `locomotion/styles.ts`) and
 * `data/ark/locomotion-styles.json` (every species, every field with its reason).
 */

import fs from "node:fs";
import path from "node:path";

type Row = {slug: string | null; name: string; excluded_reason: string | null; class_name: string | null; order_name: string | null; family_name: string | null; signature_traits?: string[] | null; interesting_facts?: string[] | null; typical_habitat?: string | null; species_spotlight?: string | null};

const [exportPath, detailPath, arkDir] = process.argv.slice(2);
if (!exportPath || !detailPath || !arkDir) {
    console.error("usage: ark-locomotion-styles.mts export.json detail.json <ark models dir>");
    process.exit(1);
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const raw = JSON.parse(fs.readFileSync(exportPath, "utf8"));
const rows: Row[] = Array.isArray(raw) ? raw : raw.rows;
const detail: Record<string, {plan?: string}> = JSON.parse(fs.readFileSync(detailPath, "utf8")).species;
const behaviours: Record<string, string> = JSON.parse(fs.readFileSync(path.join(root, "src/ark-scene/behaviours.json"), "utf8")).species;

const talkingPlan = (slug: string): string | null => {
    const file = path.join(arkDir, slug, "ark.json");
    if (!fs.existsSync(file)) return null;
    return (JSON.parse(fs.readFileSync(file, "utf8")).behaviour?.plan as string | undefined) ?? null;
};
const flies = (slug: string): boolean => {
    const row = behaviours[slug];
    if (!row) return false;
    const [move, moves] = row.split("|");
    return move === "fly" || moves.split(",").includes("fly");
};

// MARK: Flight

/** Bird families by flight style (Pennycuick, Rayner; field guides' "flight" accounts). */
const SOAR = new Set(["Accipitridae", "Cathartidae", "Pandionidae", "Sagittariidae", "Ciconiidae", "Pelecanidae", "Diomedeidae", "Procellariidae", "Fregatidae", "Gruidae", "Bucorvidae", "Balaenicipitidae", "Phaethontidae", "Stercorariidae", "Laridae"]);
const BOUND = new Set(["Picidae", "Fringillidae", "Paridae", "Passeridae", "Estrildidae", "Passerellidae", "Ploceidae", "Motacillidae", "Cardinalidae", "Thraupidae", "Parulidae", "Phylloscopidae", "Sylviidae", "Cettiidae", "Acrocephalidae", "Troglodytidae", "Maluridae", "Cisticolidae", "Remizidae", "Panuridae", "Viduidae", "Calcariidae", "Zosteropidae", "Dicaeidae", "Megalaimidae", "Indicatoridae", "Ramphastidae", "Pipridae", "Tyrannidae", "Rhipiduridae", "Monarchidae", "Acanthisittidae", "Bombycillidae", "Nectariniidae", "Pycnonotidae", "Leiothrichidae", "Muscicapidae", "Turdidae", "Icteridae", "Furnariidae", "Thamnophilidae", "Sittidae", "Tichodromidae", "Irenidae", "Paramythiidae", "Pomatostomidae", "Mimidae", "Cotingidae", "Galbulidae", "Laniidae"]);
const GLIDE = new Set(["Ardeidae", "Threskiornithidae", "Sulidae", "Phalacrocoracidae", "Anhingidae", "Corvidae", "Sturnidae", "Hirundinidae", "Apodidae", "Meropidae", "Coraciidae", "Strigidae", "Tytonidae", "Falconidae", "Bucerotidae", "Hydrobatidae", "Caprimulgidae", "Nyctibiidae", "Podargidae", "Steatornithidae", "Paradisaeidae", "Ptilonorhynchidae", "Cracticidae", "Corcoracidae", "Dicruridae", "Oriolidae", "Buphagidae", "Scopidae", "Phoenicopteridae", "Musophagidae", "Cuculidae", "Upupidae", "Momotidae", "Trogonidae", "Otididae", "Menuridae", "Eupetidae", "Pityriaseidae", "Meliphagidae"]);
/** Heavy wings for their size (high wing loading): faster beats than the size allometry gives. */
const HEAVY = new Map<string, number>([
    ["Alcidae", 1.3],
    ["Anatidae", 1.35],
    ["Anhimidae", 1.1],
    ["Anseranatidae", 1.2],
    ["Gaviidae", 1.6],
    ["Podicipedidae", 1.5],
    ["Phalacrocoracidae", 1.3],
    ["Rallidae", 1.3],
    ["Phasianidae", 1.5],
    ["Odontophoridae", 1.5],
    ["Numididae", 1.4],
    ["Megapodiidae", 1.2],
    ["Cracidae", 1.2],
    ["Tinamidae", 1.6],
    ["Pteroclididae", 1.3],
    ["Turnicidae", 1.5],
    ["Columbidae", 1.15],
    ["Psittacidae", 1.1],
    ["Alcedinidae", 1.3],
    ["Todidae", 1.1]
]);
/** Broad, slow wings: slower beats than the allometry gives. */
const SLOW = new Map<string, number>([
    ["Strigidae", 0.75],
    ["Tytonidae", 0.75],
    ["Ardeidae", 0.8],
    ["Ciconiidae", 0.8],
    ["Threskiornithidae", 0.85],
    ["Pelecanidae", 0.8],
    ["Gruidae", 0.8],
    ["Accipitridae", 0.8],
    ["Cathartidae", 0.75],
    ["Pandionidae", 0.8],
    ["Sagittariidae", 0.8],
    ["Diomedeidae", 0.85],
    ["Fregatidae", 0.75],
    ["Bucorvidae", 0.8],
    ["Bucerotidae", 0.85],
    ["Balaenicipitidae", 0.8],
    ["Laridae", 0.9],
    ["Caprimulgidae", 0.8],
    ["Nyctibiidae", 0.8],
    ["Podargidae", 0.8],
    ["Paradisaeidae", 0.9]
]);

/** Flying insects' wing beats (Hz, true; Dudley 2000, "The biomechanics of insect flight", table 4.1 ranges). */
const INSECT_HZ: Array<[RegExp, number, string]> = [
    [/^Sphingidae$/, 35, "hawk-moths 25-45 Hz"],
    [/^(Apidae|Halictidae)$/, 190, "bees 130-250 Hz"],
    [/^(Vespidae|Eumenidae|Sphecidae|Crabronidae|Ampulicidae|Scoliidae|Pompilidae)$/, 110, "wasps 80-150 Hz"],
    [/^Mymaridae$/, 300, "fairyflies (tiny wasps) hundreds of Hz"],
    [/^(Syrphidae|Bombyliidae)$/, 160, "hoverflies and bee-flies 120-200 Hz"],
    [/^(Calliphoridae|Sarcophagidae|Muscidae|Tabanidae|Asilidae|Scathophagidae|Ulidiidae|Drosophilidae|Diopsidae|Neriidae|Psychodidae|Bibionidae)$/, 170, "flies 100-250 Hz"],
    [/^Tipulidae$/, 45, "crane flies 40-60 Hz"],
    [/^(Libellulidae|Aeshnidae|Gomphidae)$/, 30, "dragonflies 25-40 Hz"],
    [/^Coenagrionidae$/, 20, "damselflies 15-30 Hz"],
    [/^(Ephemeridae)$/, 20, "mayflies about 20 Hz"],
    [/^(Chrysopidae|Myrmeleontidae|Mantispidae|Corydalidae|Raphidiidae|Panorpidae|Pteronarcyidae|Limnephilidae)$/, 30, "lacewings, antlions, stoneflies, caddisflies 20-40 Hz"]
];
const HOVER_INSECTS = /^(Syrphidae|Bombyliidae|Sphingidae|Libellulidae|Aeshnidae|Gomphidae|Coenagrionidae)$/;

/** Families that dive or stoop from the air onto prey (raptors' stoops, plunge-divers): a `d` on their flight code. */
const STOOP = new Set(["Accipitridae", "Falconidae", "Pandionidae", "Sagittariidae", "Sulidae", "Alcedinidae", "Laridae", "Pelecanidae", "Phaethontidae", "Stercorariidae", "Strigidae", "Tytonidae"]);

type Flight = {code: string; why: string};
function flightOf(row: Row, plan: string | null): Flight | null {
    const own = flightStyleOf(row, plan);
    if (!own || !STOOP.has(row.family_name ?? "")) return own;
    return {code: `${own.code}d`, why: `${own.why}; dives or stoops onto prey (${row.family_name})`};
}
function flightStyleOf(row: Row, plan: string | null): Flight | null {
    const slug = row.slug!;
    const cls = row.class_name ?? "";
    const order = row.order_name ?? "";
    const family = row.family_name ?? "";
    const flyer = flies(slug) || plan === "flying_bird" || plan === "bat" || plan === "flying_insect";
    if (!flyer) return null;
    if (order === "Chiroptera" || plan === "bat") return {code: "t", why: `bat (${family || "Chiroptera"}): continuous flapping, f = 1.08 L^-0.93 Hz`};
    if (cls === "Insecta" || plan === "flying_insect") {
        if (order === "Lepidoptera" && family !== "Sphingidae") return {code: "f", why: `Lepidoptera (${family}): fluttering flight, f = 1.5 L^-0.5 Hz`};
        const hit = INSECT_HZ.find(([re]) => re.test(family));
        const hz = hit ? hit[1] : order === "Coleoptera" ? 80 : order === "Hymenoptera" ? 150 : order === "Diptera" ? 170 : order === "Odonata" ? 30 : 60;
        const hover = HOVER_INSECTS.test(family);
        return {code: `${hover ? "h" : "w"}${hz}`, why: `${order}/${family}: ${hit ? hit[2] : "order default"}${hover ? "; hovers" : ""}`};
    }
    if (cls !== "Aves" && plan !== "flying_bird" && plan !== "walking_bird") return null;
    if (family === "Trochilidae") return {code: "h", why: "hummingbird (Trochilidae): hovering, f = 0.58 L^-1.74 Hz"};
    const k = HEAVY.get(family) ?? SLOW.get(family) ?? 1;
    const kk = k === 1 ? "" : String(k);
    if (SOAR.has(family)) return {code: `s${kk}`, why: `${family}: soars and glides, flaps to climb; beat factor ${k}`};
    if (BOUND.has(family)) return {code: `b${kk}`, why: `${family}: small passerine-type flap-bounding (bursts, then wings closed); beat factor ${k}`};
    if (GLIDE.has(family)) return {code: `g${kk}`, why: `${family}: flap-gliding; beat factor ${k}`};
    if (HEAVY.has(family)) return {code: `c${kk}`, why: `${family}: continuous flapping (high wing loading); beat factor ${k}`};
    return {code: `c${kk}`, why: `${family || order || "bird"}: continuous flapping (default for birds); beat factor ${k}`};
}

// MARK: Birds on the ground

const HOP = new Set([...BOUND].filter((f) => !["Picidae", "Motacillidae", "Ramphastidae", "Megalaimidae", "Indicatoridae", "Galbulidae", "Sittidae", "Tichodromidae", "Icteridae", "Furnariidae"].includes(f)));
const BOB = new Set(["Columbidae", "Phasianidae", "Numididae", "Odontophoridae", "Cracidae", "Megapodiidae", "Ardeidae", "Rallidae", "Gruidae", "Aramidae", "Ciconiidae", "Threskiornithidae", "Otididae", "Cariamidae", "Sagittariidae", "Psophiidae", "Rhynochetidae", "Eurypygidae", "Tinamidae", "Pteroclididae", "Turnicidae", "Corvidae", "Sturnidae", "Icteridae", "Cuculidae", "Balaenicipitidae", "Scopidae", "Opisthocomidae", "Jacanidae"]);
const WADDLE = new Set(["Anatidae", "Anhimidae", "Anseranatidae", "Spheniscidae", "Alcidae", "Gaviidae", "Podicipedidae", "Phalacrocoracidae", "Anhingidae", "Sulidae", "Pelecanidae", "Diomedeidae", "Procellariidae", "Hydrobatidae", "Fregatidae", "Phaethontidae"]);
const RUN = new Set(["Charadriidae", "Scolopacidae", "Recurvirostridae", "Haematopodidae", "Glareolidae", "Pluvianidae", "Ibidorhynchidae", "Rostratulidae", "Chionidae", "Struthionidae", "Rheidae", "Casuariidae", "Dromaiidae", "Apterygidae", "Motacillidae", "Alaudidae", "Laridae", "Stercorariidae", "Phoenicopteridae"]);

function groundOf(row: Row): {code: string; why: string} | null {
    if (row.class_name !== "Aves") return null;
    const family = row.family_name ?? "";
    const bob = BOB.has(family);
    const gait = HOP.has(family) ? "h" : WADDLE.has(family) ? "a" : RUN.has(family) ? "r" : "w";
    const name = {h: "hops", a: "waddles", r: "runs and stops", w: "walks"}[gait];
    return {code: `${gait}${bob ? "b" : ""}`, why: `${family}: ${name}${bob ? ", head-bobbing as it walks" : ""}`};
}

// MARK: Swimming

const SWIM_FAMILY: Array<[RegExp, string, string]> = [
    [/^(Lamnidae|Alopiidae|Scombridae|Xiphiidae|Istiophoridae|Coryphaenidae)$/, "th", "thunniform: a stiff body, the tail's crescent beats"],
    [/^(Carangidae|Clupeidae|Engraulidae|Atherinidae|Mugilidae|Ammodytidae|Echeneidae|Nematistiidae|Trichiuridae|Exocoetidae|Melanotaeniidae|Characidae|Alestidae|Myctophidae|Sternoptychidae|Lampridae)$/, "ca", "carangiform: the rear third of the body and the tail beat"],
    [/^(Anguillidae|Muraenidae|Congridae|Myxinidae|Petromyzontidae|Synbranchidae|Gymnotidae|Anarhichadidae|Eurypharyngidae|Regalecidae|Chlamydoselachidae|Polypteridae|Protopteridae|Cobitidae|Clariidae|Channidae|Stomiidae|Chiasmodontidae|Notopteridae|Trichiuridae|Callionymidae)$/, "an", "anguilliform: the whole body waves, head to tail"],
    [/^(Ostraciidae|Tetraodontidae|Diodontidae|Molidae|Monacanthidae|Balistidae|Syngnathidae|Solenostomidae|Centriscidae|Antennariidae|Brachionichthyidae|Ogcocephalidae|Melanocetidae|Psychrolutidae|Cyclopteridae|Synanceiidae|Monocentridae|Pegasidae|Zeidae|Opisthoproctidae|Ipnopidae|Anoplogastridae|Batrachoididae|Uranoscopidae|Scorpaenidae|Lophiidae|Dactylopteridae|Triglidae|Chimaeridae|Aulostomidae)$/, "os", "fin-driven (ostraciiform/tetraodontiform): the body nearly still, fins and tail scull"],
    [/^(Labridae|Scaridae|Pomacentridae|Pomacanthidae|Chaetodontidae|Acanthuridae|Zanclidae|Siganidae|Apogonidae|Embiotocidae|Holocentridae|Anomalopidae|Gobiidae|Eleotridae|Chaenopsidae|Pantodontidae|Mormyridae|Callichthyidae|Loricariidae|Osphronemidae|Toxotidae)$/, "lb", "labriform: rows with its pectoral fins, the body steady, a light tail"],
    [/^(Pleuronectidae|Scophthalmidae|Soleidae|Bothidae)$/, "ff", "flatfish: lying on its side, the whole flat body ripples up and down"],
    [/^(Myliobatidae|Mobulidae)$/, "mb", "mobuliform: flies with its wing-like fins, big slow flaps"],
    [/^(Dasyatidae|Potamotrygonidae|Rajidae|Urolophidae|Torpedinidae|Gymnuridae)$/, "rj", "rajiform: a wave runs front to back along the fin's edge"],
    [/^(Trichechidae|Dugongidae)$/, "si", "sirenian: slow up-and-down beats of the paddle tail"]
];
function swimOf(row: Row, tplan: string | null): {code: string; why: string} | null {
    const family = row.family_name ?? "";
    const order = row.order_name ?? "";
    const slug = row.slug!;
    if (order === "Cetacea" || (tplan === "cetacean" && order !== "Sirenia" && order !== "Acipenseriformes")) return {code: "ce", why: `cetacean (${family}): up-and-down fluke beats`};
    for (const [re, code, why] of SWIM_FAMILY) if (re.test(family)) return {code, why: `${family}: ${why}`};
    if (/sea-krait|sea-snake/.test(slug)) return {code: "an", why: "sea snake: anguilliform with a paddle tail"};
    if (tplan === "eel") return {code: "an", why: `eel-like body (model plan eel, ${family || order})`};
    if (tplan === "flatfish") return {code: family === "Orectolobidae" ? "sc" : "ff", why: family === "Orectolobidae" ? "wobbegong (Orectolobidae): a flat shark, but it swims side to side" : "flatfish model"};
    if (tplan === "ray") return {code: /Pristidae|Rhinidae|Rhinobatidae/.test(family) ? "sc" : /eagle|manta|cownose/.test(slug) ? "mb" : "rj", why: `ray model (${family}): ${/Pristidae|Rhinidae/.test(family) ? "a shark-like body, side to side" : "fin waves"}`};
    if (tplan === "fish") return {code: "sc", why: `fish (${family || order || "unknown family"}): subcarangiform default (the rear half of the body and the tail)`};
    return null;
}

// MARK: Legless

function leglessOf(row: Row, tplan: string | null, plan: string | null): {code: string; why: string} | null {
    if (tplan !== "snake" && tplan !== "worm" && plan !== "legless") return null;
    const slug = row.slug!;
    const cls = row.class_name ?? "";
    const family = row.family_name ?? "";
    // Each stored sentence on its own (the traits and facts are lists), so the reason quotes just the one that names it.
    const sentences = [...(row.signature_traits ?? []), ...(row.interesting_facts ?? []), row.species_spotlight ?? "", row.typical_habitat ?? ""].flatMap((t) => t.split(/(?<=\.)\s+/));
    const side = sentences.find((t) => /\bsidewind/i.test(t));
    if (side) return {code: "sw", why: `stored text: "${side.trim()}"`};
    const rect = sentences.find((t) => /\b(rectilinear|caterpillar-like|in a straight line)/i.test(t));
    if (rect) return {code: "re", why: `stored text: "${rect.trim()}"`};
    if (/earthworm/.test(slug) || /Megascolecidae|Lumbricidae|Glossoscolecidae/.test(family)) return {code: "pe", why: "earthworm: peristalsis (waves of contraction), no side-to-side bends"};
    if (/Hirudinidae|Erpobdellidae/.test(family)) return {code: "pe", why: "leech: crawls by looping and stretching (peristalsis), swims with up-and-down waves"};
    if (cls === "Diplopoda" || /Dugesiidae|Planariidae/.test(family) || /velvet-worm|rotifer/.test(slug)) return {code: "gl", why: `${cls || family || slug}: glides on many legs or cilia, the body straight`};
    if (/Pythonidae|Boidae|Viperidae/.test(family)) return {code: "re", why: `${family}: heavy-bodied; rectilinear (straight, belly ripples) when slow, lateral undulation when faster (rule, not stored text)`};
    if (cls === "Chilopoda") return {code: "la", why: "centipede: legs plus a side-to-side body wave when fast"};
    return {code: "la", why: `${family || cls || "legless"}: lateral undulation`};
}

// MARK: Run

const compact: Record<string, string> = {};
const full: Record<string, Record<string, {code: string; why: string}>> = {};
const tally: Record<string, Record<string, number>> = {flight: {}, ground: {}, swim: {}, legless: {}};
for (const row of rows) {
    const slug = row.slug;
    if (!slug || row.excluded_reason) continue;
    const plan = detail[slug]?.plan ?? null;
    const tplan = talkingPlan(slug);
    const f = flightOf(row, plan);
    const g = f && row.class_name === "Aves" ? groundOf(row) : row.class_name === "Aves" ? groundOf(row) : null;
    const s = swimOf(row, tplan);
    const l = leglessOf(row, tplan, plan);
    if (!f && !g && !s && !l) continue;
    compact[slug] = [f?.code ?? "", g?.code ?? "", s?.code ?? "", l?.code ?? ""].join("|");
    full[slug] = Object.fromEntries(Object.entries({flight: f, ground: g, swim: s, legless: l}).filter(([, v]) => v)) as Record<string, {code: string; why: string}>;
    for (const [k, v] of Object.entries({flight: f, ground: g, swim: s, legless: l})) if (v) { const key = v.code.replace(/[0-9.]+/g, ""); tally[k][key] = (tally[k][key] ?? 0) + 1; }
}
const sorted = Object.keys(compact).sort();
fs.mkdirSync(path.join(root, "src/ark-scene/locomotion"), {recursive: true});
fs.writeFileSync(
    path.join(root, "src/ark-scene/locomotion/styles.json"),
    `{"about":"Generated by scripts/ark-locomotion-styles.mts (reasons per species: data/ark/locomotion-styles.json). Rows: flight|ground|swim|legless. flight: c continuous, g flap-glide, b flap-bound, s soar (then the beat factor on the bird size allometry, 1 when absent); h hover (birds: hummingbirds; insects then their Hz); t bat; f flutter (butterflies, moths); w whir (other insects, then their Hz); a trailing d: it stoops or plunge-dives. ground (birds): h hop, w walk, a waddle, r run, b head-bob. swim: an anguilliform, sc subcarangiform, ca carangiform, th thunniform, os fin-driven, lb labriform, ff flatfish, rj rajiform, mb mobuliform, ce cetacean, si sirenian. legless: la lateral undulation, sw sidewinding, re rectilinear when slow, pe peristalsis, gl glide. Decoded by locomotion/styles.ts.",\n"species":{\n${sorted.map((slug) => `${JSON.stringify(slug)}:${JSON.stringify(compact[slug])}`).join(",\n")}\n}}\n`
);
fs.mkdirSync(path.join(root, "data/ark"), {recursive: true});
fs.writeFileSync(path.join(root, "data/ark/locomotion-styles.json"), JSON.stringify({generated_from: "the behaviour lane's live export (taxonomy, field-guide text), the rig v2 detail (plans), the Ark models' talking plans", tally, species: Object.fromEntries(sorted.map((slug) => [slug, full[slug]]))}, null, 1) + "\n");
console.log(JSON.stringify(tally, null, 1));
console.log(`${sorted.length} species with a style`);
