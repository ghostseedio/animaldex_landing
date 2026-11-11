/**
 * Which surface an Ark animal is drawn with (the animal-look pass): fur,
 * feathers, scales, skin, shell or slimy, from stored data only, with the
 * deciding reason kept. Pure; `scripts/ark-animal-look.mts` runs it over the
 * whole model set into `animal-look.json`, and the tests hold its rules.
 *
 * Evidence, strongest first:
 *
 * 1. taxonomy (class, order, family; `rig/plans.json` / `rig/taxonomy.json`)
 *    where the class settles it: birds have feathers; turtles a shell;
 *    crocodiles, lizards and snakes scales; sharks and rays a skin of
 *    denticles; frogs, salamanders and caecilians moist skin (true toads dry
 *    and warty); octopus, squid, jellyfish, sea cucumbers and worms are wet
 *    and soft; insects, spiders, crustaceans and other arthropods an
 *    exoskeleton (unless the picture shows them hairy); moths and
 *    butterflies powdery and soft;
 * 2. the covering the model build read off the species' own photo
 *    (`out/<slug>/landmarks.json`, `head_box.covering`: fur, feathers,
 *    scales, shell or skin), which settles mammals (an elephant's skin, a
 *    pangolin's scales, an armadillo's shell) and fish;
 * 3. only when neither is there, the body plan, and the row is flagged as a
 *    default.
 *
 * Visual only: nothing here decides anything that happens on the Ark.
 */

export const LOOK_CLASSES = ["fur", "feathers", "scales", "skin", "shell", "slimy"] as const;
export type LookClass = (typeof LOOK_CLASSES)[number];

export type LookEvidence = {
    className?: string | null;
    order?: string | null;
    family?: string | null;
    /** What the model build saw on the photo. */
    covering?: string | null;
    /** The rig's body plan (`plans.json`), e.g. quadruped, flying_bird, fish. */
    plan?: string | null;
};

export type LookChoice = {look: LookClass; reason: string; source: "taxonomy" | "photo" | "plan"; defaulted: boolean};

const COVERINGS = new Set<string>(["fur", "feathers", "scales", "skin", "shell"]);
const ARTHROPODS = new Set(["Insecta", "Arachnida", "Malacostraca", "Diplopoda", "Chilopoda", "Merostomata", "Maxillopoda", "Branchiopoda", "Ostracoda", "Collembola", "Entognatha"]);
const SOFT_AND_WET = new Set(["Cephalopoda", "Scyphozoa", "Hydrozoa", "Cubozoa", "Holothuroidea", "Clitellata", "Polychaeta", "Turbellaria", "Hirudinea", "Ctenophora", "Tentaculata"]);
const HAIRLESS_MAMMAL_ORDERS = new Set(["Cetacea", "Sirenia"]);
const HAIRLESS_MAMMAL_FAMILIES = new Set(["Delphinidae", "Balaenopteridae", "Balaenidae", "Physeteridae", "Monodontidae", "Phocoenidae", "Ziphiidae", "Eschrichtiidae", "Hippopotamidae", "Elephantidae", "Rhinocerotidae", "Heterocephalidae", "Trichechidae", "Dugongidae"]);
const PLAN_DEFAULTS: Record<string, LookClass> = {
    quadruped: "fur",
    primate: "fur",
    bat: "fur",
    flying_bird: "feathers",
    walking_bird: "feathers",
    flightless_bird: "feathers",
    fish: "scales",
    lizard: "scales",
    legless: "scales",
    turtle: "shell",
    insect: "shell",
    flying_insect: "shell",
    arachnid: "shell",
    crustacean: "shell",
    amphibian: "slimy",
    cephalopod_jelly: "slimy"
};

export function chooseLook(evidence: LookEvidence): LookChoice {
    const cls = evidence.className ?? "";
    const order = evidence.order ?? "";
    const family = evidence.family ?? "";
    const covering = evidence.covering && COVERINGS.has(evidence.covering) ? evidence.covering as LookClass : null;
    const tax = (look: LookClass, reason: string): LookChoice => ({look, reason, source: "taxonomy", defaulted: false});
    const photo = (look: LookClass, reason: string): LookChoice => ({look, reason, source: "photo", defaulted: false});

    if (cls === "Aves") return tax("feathers", "class Aves");
    if (cls === "Testudines") return tax("shell", "class Testudines");
    if (cls === "Crocodylia" || cls === "Squamata" || (cls === "Reptilia" && order !== "Testudines")) return tax("scales", `class ${cls}`);
    if (cls === "Elasmobranchii" || cls === "Holocephali") return tax("skin", `class ${cls}: skin of dermal denticles`);
    if (cls === "Amphibia") {
        if (family === "Bufonidae") return tax("skin", "family Bufonidae: a true toad's dry, warty skin");
        return tax("slimy", "class Amphibia: moist skin");
    }
    if (SOFT_AND_WET.has(cls)) return tax("slimy", `class ${cls}: soft and wet`);
    if (cls === "Gastropoda") {
        return covering === "shell" ? photo("shell", "class Gastropoda, a shell on the photo") : tax("slimy", "class Gastropoda without a shell: a slug's wet skin");
    }
    if (cls === "Anthozoa") return covering === "shell" ? photo("shell", "class Anthozoa, a hard coral on the photo") : tax("slimy", "class Anthozoa: a soft anemone or coral");
    if (cls === "Bivalvia" || cls === "Polyplacophora") return tax("shell", `class ${cls}`);
    if (cls === "Echinoidea") return tax("shell", "class Echinoidea: an urchin's test");
    if (cls === "Insecta" && order === "Lepidoptera") return tax("fur", "order Lepidoptera: powdery wing scales and a hairy body, drawn soft and matte");
    if (ARTHROPODS.has(cls)) {
        if (covering === "fur") return photo("fur", `class ${cls}, hairy on the photo`);
        return tax("shell", `class ${cls}: an exoskeleton`);
    }
    if (cls === "Mammalia") {
        if (HAIRLESS_MAMMAL_ORDERS.has(order)) return tax("skin", `order ${order}: hairless skin`);
        if (HAIRLESS_MAMMAL_FAMILIES.has(family)) return tax("skin", `family ${family}: near-hairless skin`);
        if (covering && covering !== "feathers") return photo(covering, `class Mammalia, ${covering} on the photo`);
        return tax("fur", "class Mammalia");
    }
    if (covering) return photo(covering, `${cls ? `class ${cls}, ` : ""}${covering} on the photo`);
    const fallback = evidence.plan ? PLAN_DEFAULTS[evidence.plan] : undefined;
    if (fallback) return {look: fallback, reason: `default for the body plan ${evidence.plan}`, source: "plan", defaulted: true};
    return {look: "skin", reason: "default: no taxonomy, photo covering or body plan", source: "plan", defaulted: true};
}

/** Realms from the traits lane (`land`, `air`, `sea`, `fresh`): it swims and comes out (wet after a swim). */
export function semiAquatic(realm: readonly string[] | null | undefined): boolean {
    const set = new Set(realm ?? []);
    return (set.has("sea") || set.has("fresh")) && (set.has("land") || set.has("air"));
}

/** It lives in the water (always wet there). */
export function aquatic(realm: readonly string[] | null | undefined, plan?: string | null): boolean {
    const set = new Set(realm ?? []);
    if (plan === "fish" || plan === "cephalopod_jelly") return true;
    return set.size > 0 && !set.has("land") && !set.has("air");
}

const GROUND_PLANS = new Set(["quadruped", "primate", "walking_bird", "flightless_bird", "lizard", "legless", "turtle", "insect", "arachnid", "crustacean"]);

/** A ground animal of dry land: dust on its legs and belly on dry, open ground. Never a wet one. */
export function dusty(plan: string | null | undefined, look: LookClass, realm: readonly string[] | null | undefined): boolean {
    if (look === "slimy" || !plan || !GROUND_PLANS.has(plan)) return false;
    const set = new Set(realm ?? []);
    return set.size === 0 || set.has("land");
}

/** Row flags in `animal-look.json`. */
export const LOOK_FLAG = {defaulted: 1, semiAquatic: 2, aquatic: 4, dusty: 8} as const;
