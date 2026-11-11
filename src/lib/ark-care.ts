/**
 * How a species' young are cared for, read from its stored text
 * (`species_field_guide.female_offspring_notes`), for the Ark's young:
 * who follows a parent, who is carried, who stays at a nest or den, who is
 * guarded, and who is on its own from the start.
 *
 * Visual only: it decides where a young animal is drawn and how it moves,
 * never a birth, a meal or a death. The deciding sentence is kept, so every
 * classification can be checked against what the text says. A species whose
 * text says nothing either way falls back to its body plan's default, and is
 * flagged as such (`basis: "plan_default"`).
 */

export type ArkCareKind = "follow" | "carry" | "nest" | "guard" | "none";

export type ArkCareBasis = "stated" | "inferred" | "plan_default";

export type ArkCare = {
    kind: ArkCareKind;
    /** stated: the text says it outright; inferred: from a telling word (a calf, a den); plan_default: the body plan's default. */
    basis: ArkCareBasis;
    /** Days until the young are independent (weaned, fledged…), when the text gives a number. */
    independentDays: number | null;
    /** The sentence it was read from. */
    phrase: string | null;
};

type Rule = {kind: ArkCareKind; basis: Exclude<ArkCareBasis, "plan_default">; pattern: RegExp};

/** First match wins: explicit "no care" beats a nest word ("bird-nest material"), carrying beats following. */
const RULES: Rule[] = [
    {kind: "none", basis: "stated", pattern: /\bno (?:parental |further )?care\b|\breceive no\b|\bfend for themselves\b|\bindependent (?:at once|immediately|from (?:birth|hatching)|at (?:birth|hatching))|\bleft to (?:develop|fend)\b|\bon their own from (?:birth|hatching)\b|\babandon(?:s|ed)? (?:the )?(?:eggs|clutch|young)\b/},
    {kind: "carry", basis: "stated", pattern: /\bpouch\b|\bon (?:her|his|its|their|the (?:mother|female|male|parent)'?s?) back\b|\bcarr(?:y|ies|ied) (?:the |her |his |its |their |one |a |single |each )*(?:young|babies|baby|joeys?|pups?|infants?|chicks|offspring|tadpoles|eggs on (?:his|her|its) back)\b|\bmouth ?brood|\bin (?:her|his|the parent's) mouth\b|\bclings? to (?:her|its|the mother)\b/},
    {kind: "follow", basis: "stated", pattern: /\bfollows? (?:the |its |their |her )?(?:mother|parents?|female|herd|adults)\b|\bprecocial\b|\bleave the nest (?:soon|within|shortly|a day|the day|almost)\b|\bcan (?:stand|walk|run|swim|feed themselves)\b[^.]{0,30}\b(?:soon|within|hours|shortly|after hatching|after birth)\b|\bjoin(?:s|ing)? the (?:herd|group|troop|pod|flock)\b|\bfollow her\b|\bstay(?:s|ing)? close to the (?:hen|mother|female|adults?|parents?)\b|\bfeed themselves (?:within|from|soon|shortly|almost)\b|\bbecome active quickly\b|\bstays? (?:close|near) to (?:the |its |their |her )?mother\b|\baccompan(?:y|ies) (?:the |its |their |her )?mother\b|\btravels? with (?:the |its |their |her )?mother\b/},
    {kind: "nest", basis: "stated", pattern: /\b(?:both parents|the parents?|the female|the male|she|he) (?:\w+ )?(?:feeds?|feed|brood|tend|care for|raise)s? (?:the )?(?:chicks|nestlings|young|kits|cubs|pups)\b|\bfed by (?:both )?(?:parents|the female|the male)\b|\bfledg|\bnestlings?\b|\blies? hidden\b|\bhidden (?:in|for)\b|\bin (?:a |an |the |hidden |underground |their )*dens?\b|\braise(?:s|d)? (?:the )?(?:cubs|kits|pups|young|chicks)\b/},
    {kind: "guard", basis: "stated", pattern: /\bguard(?:s|ed|ing)? (?:the |its |their |her |his )?(?:eggs|egg sac|egg mass|it|them|nest|clutch|young|hatchlings|fry|brood|spiderlings)\b|\bbroods? (?:the |her )?eggs\b|\bcoils? around (?:the |her )?eggs\b|\bstays? to guard\b/},
    {kind: "none", basis: "inferred", pattern: /\bdrift (?:in|with|as) (?:the )?(?:plankton|currents?)\b|\b(?:release|spawn)s? (?:their )?eggs and sperm\b|\binto the water\b|\beggs are dropped\b|\binto (?:the )?open water\b|\bplanktonic (?:larvae|eggs)\b|\bbroadcast spawn|\bscatter(?:s|ed)? (?:the )?eggs\b|\blarvae (?:hatch|develop|feed|drift)|\bcaterpillars?\b|\bspawn(?:s|ing)? (?:in|into|over|among|on)\b/},
    {kind: "follow", basis: "inferred", pattern: /\b(?:calf|calves|foals?|lambs?|kids|fawns?|piglets?|cria|ducklings|goslings|goslings)\b/},
    {kind: "nest", basis: "inferred", pattern: /\bnurse(?:s|d)?\b/},
    {kind: "nest", basis: "inferred", pattern: /\b(?:cubs?|pups?|kits?|kittens?|joeys?|chicks|infants?|baby|babies)\b|\bnests?\b|\bburrows?\b/}
];

const NUMBER_WORDS: Record<string, number> = {
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    eleven: 11, twelve: 12, fifteen: 15, eighteen: 18, twenty: 20, "a few": 3, several: 4, "a couple of": 2
};
const UNIT_DAYS: Record<string, number> = {day: 1, week: 7, month: 30.4, year: 365};

/** "weaned at about six months", "fledge after 3 to 4 weeks", "independent at 18 months": the first such span, in days. */
export function independenceDays(text: string): number | null {
    const t = text.toLowerCase();
    const re = /\b(weaned|independen\w*|fledg\w*|leave (?:the|their) (?:mother|parents)|stay(?:s)? with (?:the|their|its) mother|cared for)\b[^.]{0,40}?\b(\d+(?:\.\d+)?|a few|a couple of|several|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|eighteen|twenty)(?:\s*(?:to|-|–|or)\s*(\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|eighteen|twenty))?\s*(day|week|month|year)s?\b/;
    const m = re.exec(t);
    if (!m) return null;
    const read = (word: string | undefined): number | null => (word == null ? null : /^\d/.test(word) ? Number(word) : NUMBER_WORDS[word] ?? null);
    const from = read(m[2]);
    const to = read(m[3]);
    if (from == null) return null;
    const value = to != null ? (from + to) / 2 : from;
    return Math.round(value * UNIT_DAYS[m[4]]);
}

function sentences(text: string): string[] {
    return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

/** The care its text states or implies, with the deciding sentence; null when the text says nothing of the young. */
export function careFromText(text: string | null | undefined): ArkCare | null {
    if (!text || !text.trim()) return null;
    const parts = sentences(text);
    for (const rule of RULES) {
        for (const sentence of parts) {
            if (rule.pattern.test(sentence.toLowerCase())) {
                return {kind: rule.kind, basis: rule.basis, independentDays: independenceDays(text), phrase: sentence};
            }
        }
    }
    return null;
}

/** Body-plan defaults where the text is silent (flagged `plan_default`). */
export const PLAN_CARE: Record<string, ArkCareKind> = {
    mammal: "follow",
    cetacean: "follow",
    bird: "nest",
    reptile: "none",
    turtle: "none",
    frog: "none",
    fish: "none",
    ray: "none",
    arthropod: "none",
    insect: "none",
    sessile: "none",
    jellyfish: "none",
    cephalopod: "none",
    worm: "none"
};

/** Plans whose "nest" or "burrow" is mostly only where the eggs go: an inferred nest there is no care (a stated guard, as for crocodiles, still counts). */
const EGG_SITE_PLANS = new Set(["insect", "arthropod", "fish", "ray", "worm", "sessile", "jellyfish", "cephalopod", "reptile", "turtle", "frog"]);

function planDefault(plan: string | null | undefined): ArkCare {
    return {kind: PLAN_CARE[plan ?? ""] ?? "none", basis: "plan_default", independentDays: null, phrase: null};
}

/** The care for a species: its text's, else (or when the text only names an egg site of an invertebrate or fish) its plan's. */
export function careOf(text: string | null | undefined, plan: string | null | undefined): ArkCare {
    const care = careFromText(text);
    if (!care) return planDefault(plan);
    if (care.basis === "inferred" && care.kind === "nest" && EGG_SITE_PLANS.has(plan ?? "")) return planDefault(plan);
    return care;
}

/** The compact table the scene ships (`src/ark-scene/care.json`): slug → [kind letter, independent days or 0, basis letter]. */
export const CARE_CODES: Record<ArkCareKind, string> = {follow: "f", carry: "c", nest: "n", guard: "g", none: "x"};
const CODE_KINDS: Record<string, ArkCareKind> = {f: "follow", c: "carry", n: "nest", g: "guard", x: "none"};

export function encodeCare(care: ArkCare): [string, number, string] {
    return [CARE_CODES[care.kind], care.independentDays ?? 0, care.basis === "stated" ? "s" : care.basis === "inferred" ? "i" : "p"];
}

export function decodeCare(row: [string, number, string] | null | undefined, plan: string | null | undefined): ArkCare {
    if (!row || !CODE_KINDS[row[0]]) return planDefault(plan);
    const care: ArkCare = {kind: CODE_KINDS[row[0]], basis: row[2] === "s" ? "stated" : row[2] === "i" ? "inferred" : "plan_default", independentDays: row[1] > 0 ? row[1] : null, phrase: null};
    if (care.basis === "inferred" && care.kind === "nest" && EGG_SITE_PLANS.has(plan ?? "")) return planDefault(plan);
    return care;
}
