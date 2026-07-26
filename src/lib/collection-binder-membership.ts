/**
 * Assigns indexed catalog species into curated binders.
 * Port of AnimalCollectionSetMembership.swift (iOS).
 */

export type BinderSetId =
  | "birds"
  | "insects"
  | "arachnids"
  | "venomous"
  | "birds_of_prey"
  | "fish"
  | "farm"
  | "lizards"
  | "frogs"
  | "snakes"
  | "predators"
  | "zoo"
  | "giant_bugs";

export type BinderMembershipCatalogEntry = {
  speciesProfileId: string;
  normalizedIdentityKey: string;
  displayName: string;
  animalName?: string | null;
  refinedIdentity?: string | null;
  scientificName?: string | null;
  animalDexNumber: number | null;
  identityKind?: string | null;
  catalogStatus?: string | null;
  /** e.g. Bird, Mammal — mapped to type tags when possible */
  category?: string | null;
};

export type BinderMembershipContext = {
  zooSpeciesProfileIds?: Set<string>;
};

/** Launch shelf order (AnimalCollectionSetCatalog.all, excluding withheld dogs/cats). */
export const LAUNCH_BINDER_SET_IDS: readonly BinderSetId[] = [
  "birds",
  "insects",
  "arachnids",
  "fish",
  "birds_of_prey",
  "venomous",
  "predators",
  "zoo",
  "farm",
  "lizards",
  "frogs",
  "snakes",
  "giant_bugs",
] as const;

type AnimalTypeTag =
  | "bird"
  | "mammal"
  | "reptile"
  | "amphibian"
  | "invertebrate"
  | "arachnid"
  | "fish"
  | "farmAnimal"
  | "livestock"
  | "domestic"
  | "pet"
  | "canine"
  | "feline"
  | "bigCat";

function typeTagsFromCategory(category: string | null | undefined): Set<AnimalTypeTag> {
  const tags = new Set<AnimalTypeTag>();
  if (!category) return tags;
  const normalized = category.trim().toLowerCase();
  switch (normalized) {
    case "bird":
      tags.add("bird");
      break;
    case "mammal":
      tags.add("mammal");
      break;
    case "reptile":
      tags.add("reptile");
      break;
    case "amphibian":
      tags.add("amphibian");
      break;
    case "invertebrate":
      tags.add("invertebrate");
      break;
    case "arachnid":
      tags.add("arachnid");
      break;
    case "fish":
      tags.add("fish");
      break;
    default:
      break;
  }
  return tags;
}

export function binderSetIdsForEntry(
  entry: BinderMembershipCatalogEntry,
  context?: BinderMembershipContext,
  requireIndexedNumber = true
): BinderSetId[] {
  if (requireIndexedNumber ? !isIndexedCatalogCandidate(entry) : !isProvisionalCatalogCandidate(entry)) {
    return [];
  }

  const haystack = normalizedHaystack(entry);
  const key = entry.normalizedIdentityKey.toLowerCase();
  const kind = (entry.identityKind ?? "").toLowerCase();
  const typeTags = typeTagsFromCategory(entry.category);
  const sets = new Set<BinderSetId>();

  if (matchesBird(haystack, key, typeTags)) {
    sets.add("birds");
  }
  if (matchesBirdOfPrey(haystack, key)) {
    sets.add("birds_of_prey");
    sets.add("birds");
  }
  if (matchesInsect(haystack, key, typeTags)) {
    sets.add("insects");
  }
  if (matchesArachnid(haystack, key, typeTags)) {
    sets.add("arachnids");
  }
  if (matchesFish(haystack, key, typeTags)) {
    sets.add("fish");
  }
  if (matchesLizard(haystack, key, typeTags)) {
    sets.add("lizards");
  }
  if (matchesFrog(haystack, key, typeTags)) {
    sets.add("frogs");
  }
  if (matchesSnake(haystack, key, typeTags)) {
    sets.add("snakes");
  }
  if (matchesVenomous(haystack, key)) {
    sets.add("venomous");
  }
  if (matchesFarm(haystack, key, kind, typeTags)) {
    sets.add("farm");
  }
  // Dogs / Cats binders are temporarily withheld from the Collection shelf.
  if (matchesApexPredator(haystack, key)) {
    sets.add("predators");
  }
  if (matchesGiantBug(haystack, key)) {
    sets.add("giant_bugs");
    sets.add("insects");
  }

  const zooIds = context?.zooSpeciesProfileIds;
  if (zooIds?.has(entry.speciesProfileId.toLowerCase())) {
    sets.add("zoo");
  }

  if (sets.has("giant_bugs") && matchesArachnid(haystack, key, typeTags)) {
    sets.add("arachnids");
  }

  return LAUNCH_BINDER_SET_IDS.filter((id) => sets.has(id));
}

export function buildBinderMembershipMap(
  catalog: BinderMembershipCatalogEntry[],
  context?: BinderMembershipContext,
  requireIndexedNumber = true
): Map<BinderSetId, BinderMembershipCatalogEntry[]> {
  const map = new Map<BinderSetId, BinderMembershipCatalogEntry[]>();
  for (const setId of LAUNCH_BINDER_SET_IDS) {
    map.set(setId, []);
  }
  for (const entry of catalog) {
    for (const setId of binderSetIdsForEntry(entry, context, requireIndexedNumber)) {
      map.get(setId)!.push(entry);
    }
  }
  for (const setId of LAUNCH_BINDER_SET_IDS) {
    map.set(setId, (map.get(setId) ?? []).slice().sort(catalogSort));
  }
  return map;
}

// MARK: - Rules

function isIndexedCatalogCandidate(entry: BinderMembershipCatalogEntry): boolean {
  const number = entry.animalDexNumber;
  if (number == null || number < 1) return false;
  const status = (entry.catalogStatus ?? "active").toLowerCase();
  if (status === "hidden") return false;
  return true;
}

function isProvisionalCatalogCandidate(entry: BinderMembershipCatalogEntry): boolean {
  return entry.displayName.trim().length > 0;
}

function normalizedHaystack(entry: BinderMembershipCatalogEntry): string {
  return [
    entry.displayName,
    entry.animalName,
    entry.refinedIdentity,
    entry.scientificName,
    entry.normalizedIdentityKey.replace(/_/g, " "),
  ]
    .filter((value): value is string => value != null && value !== "")
    .map((value) => value.toLowerCase())
    .join(" ")
    .replace(/-/g, " ");
}

/** Word-boundary token match on display/scientific haystacks. */
function matchesAny(haystack: string, tokens: string[]): boolean {
  return tokens.some((token) => {
    if (token.includes(" ")) {
      return containsPhrase(haystack, token);
    }
    const words = haystack.split(/[^\p{L}]+/u).filter(Boolean);
    return (
      words.includes(token) ||
      haystack.includes(` ${token} `) ||
      haystack.startsWith(`${token} `) ||
      haystack.endsWith(` ${token}`) ||
      haystack === token
    );
  });
}

/** Phrase match that requires full word boundaries (so "domestic cat" ≠ "domestic cattle"). */
function containsPhrase(haystack: string, phrase: string): boolean {
  if (!phrase) return false;
  if (haystack === phrase) return true;
  return ` ${haystack} `.includes(` ${phrase} `);
}

/**
 * Underscore-segment / contiguous-fragment match for identity keys.
 * Avoids substring false positives (`elephant` ⊄ `ant`, `boar` ⊄ `boa`, `dragonfly` ⊄ `dragon`).
 */
function keyMatches(key: string, fragment: string): boolean {
  const normalizedKey = key.toLowerCase().replace(/-/g, "_");
  const normalizedFragment = fragment.toLowerCase().replace(/-/g, "_");
  if (!normalizedFragment) return false;

  if (normalizedKey === normalizedFragment) return true;
  if (normalizedKey.startsWith(`${normalizedFragment}_`)) return true;
  if (normalizedKey.endsWith(`_${normalizedFragment}`)) return true;
  if (normalizedKey.includes(`_${normalizedFragment}_`)) return true;

  const keySegments = normalizedKey.split("_").filter(Boolean);
  const fragmentSegments = normalizedFragment.split("_").filter(Boolean);
  if (fragmentSegments.length === 0) return false;

  if (fragmentSegments.length === 1) {
    return keySegments.includes(fragmentSegments[0]!);
  }

  if (keySegments.length < fragmentSegments.length) return false;
  for (let start = 0; start <= keySegments.length - fragmentSegments.length; start++) {
    let match = true;
    for (let i = 0; i < fragmentSegments.length; i++) {
      if (keySegments[start + i] !== fragmentSegments[i]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

function keyMatchesAny(key: string, fragments: string[]): boolean {
  return fragments.some((fragment) => keyMatches(key, fragment));
}

function hasConflictingClassTags(
  typeTags: Set<AnimalTypeTag>,
  excluding: Set<AnimalTypeTag>
): boolean {
  const vertebrateConflicts: AnimalTypeTag[] = ["mammal", "bird", "reptile", "amphibian"];
  for (const tag of vertebrateConflicts) {
    if (excluding.has(tag)) continue;
    if (typeTags.has(tag)) return true;
  }
  return false;
}

function matchesBird(
  haystack: string,
  key: string,
  typeTags: Set<AnimalTypeTag>
): boolean {
  if (isBirdImpostor(haystack, key, typeTags)) return false;
  if (typeTags.has("bird")) return true;
  return matchesAny(haystack, birdTokens) || keyMatchesAny(key, birdKeyFragments);
}

function isBirdImpostor(
  haystack: string,
  key: string,
  typeTags: Set<AnimalTypeTag>
): boolean {
  if (hasConflictingClassTags(typeTags, new Set<AnimalTypeTag>(["bird"]))) return true;
  if (matchesAny(haystack, birdImpostorPhrases) || keyMatchesAny(key, birdImpostorKeyFragments)) {
    return true;
  }
  return false;
}

function matchesBirdOfPrey(haystack: string, key: string): boolean {
  if (matchesAny(haystack, birdImpostorPhrases) || keyMatchesAny(key, birdImpostorKeyFragments)) {
    return false;
  }
  return matchesAny(haystack, birdOfPreyTokens) || keyMatchesAny(key, birdOfPreyKeyFragments);
}

function matchesInsect(
  haystack: string,
  key: string,
  typeTags: Set<AnimalTypeTag>
): boolean {
  if (hasConflictingClassTags(typeTags, new Set<AnimalTypeTag>())) return false;
  if (matchesAny(haystack, insectImpostorPhrases) || keyMatchesAny(key, insectImpostorKeyFragments)) {
    return false;
  }
  return matchesAny(haystack, insectTokens) || keyMatchesAny(key, insectKeyFragments);
}

function matchesArachnid(
  haystack: string,
  key: string,
  typeTags: Set<AnimalTypeTag>
): boolean {
  if (hasConflictingClassTags(typeTags, new Set<AnimalTypeTag>())) return false;
  return matchesAny(haystack, arachnidTokens) || keyMatchesAny(key, arachnidKeyFragments);
}

function matchesFish(
  haystack: string,
  key: string,
  typeTags: Set<AnimalTypeTag>
): boolean {
  if (typeTags.has("bird") || typeTags.has("mammal") || typeTags.has("amphibian")) return false;
  if (matchesAny(haystack, fishImpostorPhrases) || keyMatchesAny(key, fishImpostorKeyFragments)) {
    return false;
  }
  return matchesAny(haystack, fishTokens) || keyMatchesAny(key, fishKeyFragments);
}

function matchesLizard(
  haystack: string,
  key: string,
  typeTags: Set<AnimalTypeTag>
): boolean {
  if (typeTags.has("bird") || typeTags.has("mammal") || typeTags.has("amphibian")) return false;
  if (matchesAny(haystack, lizardImpostorPhrases) || keyMatchesAny(key, lizardImpostorKeyFragments)) {
    return false;
  }
  return matchesAny(haystack, lizardTokens) || keyMatchesAny(key, lizardKeyFragments);
}

function matchesFrog(
  haystack: string,
  key: string,
  typeTags: Set<AnimalTypeTag>
): boolean {
  if (typeTags.has("bird") || typeTags.has("mammal") || typeTags.has("reptile")) return false;
  return matchesAny(haystack, frogTokens) || keyMatchesAny(key, frogKeyFragments);
}

function matchesSnake(
  haystack: string,
  key: string,
  typeTags: Set<AnimalTypeTag>
): boolean {
  if (typeTags.has("bird") || typeTags.has("mammal") || typeTags.has("amphibian")) return false;
  if (matchesAny(haystack, snakeImpostorPhrases) || keyMatchesAny(key, snakeImpostorKeyFragments)) {
    return false;
  }
  return matchesAny(haystack, snakeTokens) || keyMatchesAny(key, snakeKeyFragments);
}

function matchesVenomous(haystack: string, key: string): boolean {
  if (venomousDenyTokens.some((token) => haystack.includes(token))) return false;
  return matchesAny(haystack, venomousTokens) || keyMatchesAny(key, venomousKeyFragments);
}

function matchesFarm(
  haystack: string,
  key: string,
  kind: string,
  typeTags: Set<AnimalTypeTag>
): boolean {
  if (matchesDog(haystack, key, kind, typeTags) || matchesCat(haystack, key, kind, typeTags)) {
    return false;
  }
  if (matchesAny(haystack, farmImpostorPhrases) || keyMatchesAny(key, farmImpostorKeyFragments)) {
    return false;
  }

  if (typeTags.has("farmAnimal") || typeTags.has("livestock")) {
    return true;
  }

  if (keyMatchesAny(key, domesticFarmKeyFragments)) {
    return true;
  }

  const hasDomesticSignal =
    typeTags.has("domestic") ||
    kind === "domestic_parent" ||
    kind === "breed" ||
    matchesAny(haystack, domesticFarmPhrases);

  if (!hasDomesticSignal) return false;
  return matchesAny(haystack, farmTokens) || keyMatchesAny(key, farmKeyFragments);
}

/** Kept for farm exclusion (dogs binder withheld from shelf). */
function matchesDog(
  haystack: string,
  key: string,
  kind: string,
  typeTags: Set<AnimalTypeTag>
): boolean {
  if (matchesAny(haystack, dogImpostorPhrases) || keyMatchesAny(key, dogImpostorKeyFragments)) {
    return false;
  }

  if (
    keyMatches(key, "domestic_dog") ||
    key === "dog" ||
    keyMatches(key, "canis_familiaris") ||
    keyMatches(key, "canis_lupus_familiaris")
  ) {
    return true;
  }

  const hasDomesticSignal =
    typeTags.has("domestic") ||
    typeTags.has("pet") ||
    kind === "breed" ||
    kind === "domestic_parent";

  if (typeTags.has("canine")) {
    return hasDomesticSignal;
  }

  if (hasDomesticSignal) {
    if (matchesAny(haystack, dogBreedTokens) || keyMatchesAny(key, dogKeyFragments)) {
      return true;
    }
    if (matchesAny(haystack, ["dog"])) {
      return true;
    }
  }

  return matchesAny(haystack, ["domestic dog", "canis familiaris", "canis lupus familiaris"]);
}

/** Kept for farm exclusion (cats binder withheld from shelf). */
function matchesCat(
  haystack: string,
  key: string,
  kind: string,
  typeTags: Set<AnimalTypeTag>
): boolean {
  if (matchesAny(haystack, bigCatTokens) || keyMatchesAny(key, bigCatKeyFragments)) {
    return false;
  }
  if (typeTags.has("bigCat")) return false;

  if (keyMatches(key, "domestic_cat") || key === "cat" || keyMatches(key, "felis_catus")) {
    return true;
  }

  const hasDomesticSignal =
    typeTags.has("domestic") ||
    typeTags.has("pet") ||
    kind === "breed" ||
    kind === "domestic_parent";

  if (typeTags.has("feline")) {
    return hasDomesticSignal;
  }

  if (hasDomesticSignal) {
    if (matchesAny(haystack, catBreedTokens) || keyMatchesAny(key, catKeyFragments)) {
      return true;
    }
    if (matchesAny(haystack, ["cat"])) {
      return true;
    }
  }

  return matchesAny(haystack, ["domestic cat", "felis catus", "house cat"]);
}

function matchesApexPredator(haystack: string, key: string): boolean {
  if (apexPredatorKeys.has(key)) return true;
  if (matchesAny(haystack, apexImpostorPhrases) || keyMatchesAny(key, apexImpostorKeyFragments)) {
    return false;
  }
  return matchesAny(haystack, apexPredatorTokens);
}

function matchesGiantBug(haystack: string, key: string): boolean {
  if (giantBugKeys.has(key)) return true;
  if (Array.from(giantBugKeys).some((fragment) => key.startsWith(`${fragment}_`))) return true;
  return matchesAny(haystack, giantBugTokens);
}

function catalogSort(
  lhs: BinderMembershipCatalogEntry,
  rhs: BinderMembershipCatalogEntry
): number {
  const l = lhs.animalDexNumber;
  const r = rhs.animalDexNumber;
  if (l != null && r != null && l !== r) return l - r;
  if (l != null && r == null) return -1;
  if (l == null && r != null) return 1;

  const nameOrder = lhs.displayName.localeCompare(rhs.displayName, undefined, {
    sensitivity: "accent",
  });
  if (nameOrder !== 0) return nameOrder;
  return lhs.speciesProfileId.localeCompare(rhs.speciesProfileId);
}

// MARK: - Token banks

const birdTokens = [
  "bird", "eagle", "hawk", "owl", "falcon", "kite", "vulture", "heron", "egret", "duck", "goose",
  "swan", "parrot", "pigeon", "dove", "crow", "raven", "sparrow", "finch", "warbler", "thrush",
  "wren", "robin", "kingfisher", "woodpecker", "stork", "crane", "ibis", "pelican", "cormorant",
  "tern", "gull", "albatross", "penguin", "cockatoo", "lorikeet", "macaw", "toucan", "hornbill",
  "babbler", "apostlebird", "chough", "magpie", "jay", "starling", "myna", "bulbul", "flycatcher",
  "swallow", "swift", "hummingbird", "chickadee", "nuthatch", "lark", "pipit", "wagtail",
  "bunting", "oriole", "tanager", "cardinal", "grackle", "blackbird", "cowbird", "cuckoo",
  "nightjar", "frogmouth", "trogon", "hoopoe", "passerine", "songbird", "raptor", "condor",
  "osprey", "harrier", "buzzard", "secretarybird", "cassowary", "emu", "ostrich", "kiwi",
  "quail", "pheasant", "chicken", "turkey", "peacock", "peafowl", "guinea fowl", "hwamei",
  "mallard", "teal", "wigeon", "pintail", "canvasback", "redhead", "scoter", "eider",
];
const birdKeyFragments = [
  "bird", "eagle", "hawk", "owl", "falcon", "duck", "goose", "parrot", "pigeon", "dove",
  "crow", "raven", "finch", "sparrow", "heron", "penguin", "cockatoo", "lorikeet", "macaw",
  "thrush", "warbler", "babbler", "apostlebird", "cormorant", "pheasant",
];
const birdImpostorPhrases = [
  "crane fly", "crane-fly", "flying fox", "swift fox", "peacock bass", "sea kite",
];
const birdImpostorKeyFragments = [
  "crane_fly", "flying_fox", "swift_fox", "peacock_bass",
];

const birdOfPreyTokens = [
  "eagle", "hawk", "falcon", "kite", "vulture", "owl", "osprey", "harrier", "buzzard",
  "condor", "secretarybird", "caracara", "kestrel", "merlin", "gyrfalcon", "accipiter",
  "buteo", "aquila", "haliaeetus", "pandion", "tyto", "bubo", "strix", "asio",
];
const birdOfPreyKeyFragments = [
  "eagle", "hawk", "falcon", "kite", "vulture", "owl", "osprey", "harrier", "buzzard",
  "condor", "kestrel", "merlin", "caracara", "secretarybird",
];

const insectTokens = [
  "insect", "beetle", "ant", "bee", "wasp", "hornet", "fly", "moth", "butterfly", "dragonfly",
  "damselfly", "grasshopper", "cricket", "mantis", "cockroach", "termite", "bug", "cicada",
  "aphid", "lacewing", "mayfly", "stonefly", "caddisfly", "earwig", "silverfish", "flea",
  "thrip", "stick insect", "katydid", "locust", "weevil", "scarab", "ladybird", "ladybug",
  "firefly", "glowworm", "mosquito", "crane fly", "hoverfly", "robber fly", "sawfly",
  "ichneumon", "skipper", "nymphalid", "lycaenid", "saturniid",
];
const insectKeyFragments = [
  "insect", "beetle", "ant", "bee", "wasp", "fly", "moth", "butterfly", "dragonfly",
  "damselfly", "grasshopper", "cricket", "mantis", "cockroach", "termite", "cicada",
  "katydid", "locust", "weevil", "mosquito", "ladybird", "ladybug", "crane_fly",
];
const insectImpostorPhrases = [
  "elephant", "anteater", "antelope", "cormorant", "pheasant", "flying fox",
];
const insectImpostorKeyFragments = [
  "elephant", "anteater", "antelope", "cormorant", "pheasant", "flying_fox",
  "elephant_seal", "elephant_shrew",
];

const arachnidTokens = [
  "spider", "scorpion", "tick", "mite", "harvestman", "tarantula", "arachnid", "solifuge",
  "whip spider", "vinegaroon", "pseudoscorpion",
];
const arachnidKeyFragments = [
  "spider", "scorpion", "tick", "mite", "harvestman", "tarantula", "arachnid",
];

const fishTokens = [
  "fish", "shark", "ray", "eel", "trout", "salmon", "bass", "carp", "goldfish", "betta",
  "guppy", "tetra", "cichlid", "catfish", "grouper", "tuna", "mackerel", "pike", "perch",
  "sunfish", "angelfish", "clownfish", "barracuda", "swordfish", "marlin", "sturgeon",
  "gar", "lamprey", "lungfish", "seahorse", "pipefish", "puffer", "triggerfish", "wrasse",
  "parrotfish", "snapper", "flounder", "halibut", "cod", "haddock", "anchovy", "sardine",
  "herring", "minnow", "danio", "rasbora", "molly", "platy", "swordtail", "oscar", "discus",
  "koi", "pleco", "cory", "loach", "killifish", "goby", "blenny", "damselfish", "tang",
  "surgeonfish", "mudskipper", "archerfish", "hammerhead", "dogfish", "skate",
];
const fishKeyFragments = [
  "fish", "shark", "ray", "eel", "trout", "salmon", "bass", "carp", "goldfish", "betta",
  "tetra", "cichlid", "catfish", "tuna", "koi", "pleco", "seahorse", "puffer",
];
const fishImpostorPhrases = [
  "crayfish", "shellfish", "jellyfish", "starfish", "cuttlefish", "fish owl", "fish eagle",
];
const fishImpostorKeyFragments = [
  "crayfish", "shellfish", "jellyfish", "starfish", "cuttlefish", "fish_owl", "fish_eagle",
];

const lizardTokens = [
  "lizard", "gecko", "iguana", "monitor", "skink", "agama", "chameleon", "anole", "tegu",
  "dragon", "bearded dragon", "water dragon", "komodo", "whiptail", "racerunner",
  "uromastyx", "chuckwalla", "horned lizard", "frilled lizard", "basilisk",
];
const lizardKeyFragments = [
  "lizard", "gecko", "iguana", "monitor", "skink", "agama", "chameleon", "anole", "tegu",
  "komodo", "pogona", "varanus", "heloderma", "bearded_dragon", "water_dragon",
];
const lizardImpostorPhrases = ["dragonfly", "damselfly", "snapdragon"];
const lizardImpostorKeyFragments = ["dragonfly", "damselfly"];

const frogTokens = [
  "frog", "toad", "treefrog", "tree frog", "bullfrog", "poison dart", "dart frog",
  "glass frog", "pacman frog", "horned frog", "rain frog", "spadefoot",
];
const frogKeyFragments = [
  "frog", "toad", "treefrog", "dendrobates", "hyla", "rana", "bufo",
];

const snakeTokens = [
  "snake", "python", "boa", "viper", "cobra", "mamba", "adder", "rattlesnake", "krait",
  "taipan", "copperhead", "cottonmouth", "garter", "corn snake", "king snake", "milk snake",
  "rat snake", "pine snake", "anaconda", "sidewinder", "bushmaster", "fer-de-lance",
];
const snakeKeyFragments = [
  "snake", "python", "boa", "viper", "cobra", "mamba", "adder", "rattlesnake", "krait",
  "taipan", "anaconda", "naja", "crotalus", "bothrops",
];
const snakeImpostorPhrases = ["boar", "wild boar", "snakehead", "snake eel"];
const snakeImpostorKeyFragments = ["boar", "wild_boar", "snakehead", "snake_eel"];

const venomousTokens = [
  "cobra", "mamba", "viper", "rattlesnake", "krait", "taipan", "adder", "copperhead",
  "cottonmouth", "bushmaster", "fer-de-lance", "black widow", "brown recluse", "funnel web",
  "funnel-web", "sydney funnel", "scorpion", "box jellyfish", "irukandji", "stonefish",
  "lionfish", "blue ringed", "blue-ringed", "cone snail", "gila monster", "beaded lizard",
  "platypus", "slow loris", "komodo", "venom", "venomous", "poison dart", "dart frog",
  "pit viper", "sea snake", "coral snake",
];
const venomousKeyFragments = [
  "cobra", "mamba", "viper", "rattlesnake", "krait", "taipan", "scorpion", "stonefish",
  "lionfish", "funnel_web", "black_widow", "brown_recluse", "blue_ringed", "cone_snail",
  "gila", "heloderma", "sea_snake", "coral_snake",
];
const venomousDenyTokens = ["nonvenomous", "non-venomous", "harmless"];

const farmTokens = [
  "chicken", "rooster", "hen", "cow", "cattle", "bull", "ox", "sheep", "ram", "ewe",
  "goat", "pig", "hog", "boar", "horse", "pony", "donkey", "mule", "duck", "goose",
  "turkey", "llama", "alpaca", "farm", "livestock",
];
const farmKeyFragments = [
  "chicken", "cattle", "cow", "sheep", "goat", "pig", "horse", "donkey", "duck", "goose",
  "turkey", "llama", "alpaca", "farm", "livestock", "gallus", "bos_taurus", "ovis_aries",
  "capra", "sus_domesticus", "equus_caballus", "equus_asinus",
];
const domesticFarmPhrases = [
  "domestic chicken", "domestic duck", "domestic goose", "domestic pig", "domestic goat",
  "domestic sheep", "domestic cattle", "domestic horse", "domestic donkey", "domestic turkey",
  "farmyard", "livestock",
];
const domesticFarmKeyFragments = [
  "domestic_chicken", "domestic_duck", "domestic_goose", "domestic_pig", "domestic_goat",
  "domestic_sheep", "domestic_cattle", "domestic_horse", "domestic_donkey", "domestic_turkey",
  "gallus_gallus_domesticus", "bos_taurus", "ovis_aries", "capra_hircus", "sus_domesticus",
  "sus_scrofa_domesticus", "equus_caballus", "equus_asinus",
];
const farmImpostorPhrases = [
  "guinea pig", "cattle egret", "bull shark", "bullfrog", "turkey vulture", "sea horse",
  "wild boar", "wild horse", "mustang", "zebra", "wild duck", "mallard", "canada goose",
];
const farmImpostorKeyFragments = [
  "guinea_pig", "cattle_egret", "bull_shark", "bullfrog", "turkey_vulture", "seahorse",
  "wild_boar", "wild_horse", "mustang", "zebra", "mallard", "canada_goose",
];

const dogBreedTokens = [
  "retriever", "shepherd", "terrier", "spaniel", "bulldog", "poodle", "husky", "collie",
  "beagle", "boxer", "mastiff", "dachshund", "corgi", "labrador", "rottweiler", "doberman",
  "chihuahua", "pomeranian", "shiba", "akita", "malamute", "samoyed", "whippet", "greyhound",
  "domestic dog", "canis familiaris", "canis lupus familiaris",
];
const dogKeyFragments = [
  "retriever", "shepherd", "terrier", "spaniel", "bulldog", "poodle", "husky", "collie",
  "beagle", "labrador", "rottweiler", "doberman", "domestic_dog", "canis_familiaris",
  "canis_lupus_familiaris",
];
const dogImpostorPhrases = [
  "wolf", "coyote", "fox", "jackal", "dingo", "hyena", "wild dog", "african wild dog",
  "raccoon dog", "dogfish", "sea dog",
];
const dogImpostorKeyFragments = [
  "wolf", "coyote", "fox", "jackal", "dingo", "hyena", "wild_dog", "african_wild_dog",
  "raccoon_dog", "dogfish",
];

const catBreedTokens = [
  "persian", "siamese", "maine coon", "ragdoll", "bengal cat", "sphynx", "british shorthair",
  "scottish fold", "abyssinian", "burmese", "russian blue", "norwegian forest", "domestic cat",
  "felis catus", "house cat",
];
const catKeyFragments = [
  "persian", "siamese", "maine_coon", "ragdoll", "sphynx", "british_shorthair",
  "scottish_fold", "abyssinian", "domestic_cat", "felis_catus", "house_cat",
];
const bigCatTokens = [
  "lion", "tiger", "leopard", "jaguar", "cheetah", "cougar", "puma", "lynx", "bobcat",
  "serval", "ocelot", "caracal", "panther", "wildcat", "margay", "oncilla",
];
const bigCatKeyFragments = [
  "lion", "tiger", "leopard", "jaguar", "cheetah", "cougar", "puma", "lynx", "bobcat",
  "serval", "ocelot", "caracal", "panther", "wildcat", "margay", "oncilla", "panthera",
];

const apexPredatorTokens = [
  "lion", "tiger", "leopard", "jaguar", "cheetah", "cougar", "puma", "wolf", "orca",
  "killer whale", "great white", "saltwater crocodile", "nile crocodile", "polar bear",
  "grizzly", "brown bear", "komodo dragon", "harpy eagle", "philippine eagle", "anaconda",
  "king cobra", "siberian tiger", "bengal tiger", "african lion",
];
const apexPredatorKeys = new Set([
  "lion", "african_lion", "tiger", "bengal_tiger", "siberian_tiger", "leopard",
  "jaguar", "cheetah", "cougar", "puma", "mountain_lion", "gray_wolf", "grey_wolf",
  "wolf", "orca", "killer_whale", "great_white_shark", "great_white", "saltwater_crocodile",
  "nile_crocodile", "polar_bear", "brown_bear", "grizzly_bear", "komodo_dragon",
  "harpy_eagle", "philippine_eagle", "green_anaconda", "king_cobra",
]);
const apexImpostorPhrases = [
  "sea lion", "sealion", "wolf spider", "tiger beetle", "tiger shark", "leopard gecko",
  "leopard seal", "lionfish", "antlion", "lion's mane",
];
const apexImpostorKeyFragments = [
  "sea_lion", "sealion", "wolf_spider", "tiger_beetle", "tiger_shark", "leopard_gecko",
  "leopard_seal", "lionfish", "antlion",
];

const giantBugTokens = [
  "hercules beetle", "atlas beetle", "titan beetle", "goliath beetle", "elephant beetle",
  "giant weta", "giant stick insect", "giant burrowing cockroach", "giant katydid",
  "giant water bug", "giant praying mantis", "giant centipede", "giant millipede",
  "coconut crab", "bird eating spider", "bird-eating spider", "goliath birdeater",
  "emperor scorpion", "giant huntsman",
];
const giantBugKeys = new Set([
  "hercules_beetle", "atlas_beetle", "titan_beetle", "goliath_beetle", "elephant_beetle",
  "giant_weta", "giant_stick_insect", "giant_burrowing_cockroach", "giant_katydid",
  "giant_water_bug", "giant_praying_mantis", "giant_centipede", "giant_millipede",
  "coconut_crab", "goliath_birdeater", "emperor_scorpion", "giant_huntsman",
  "dynastes_hercules", "chalcosoma_atlas", "titanus_giganteus", "goliathus",
]);
