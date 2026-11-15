/**
 * System Dynamics ↔ Ark (lane `ark-sd-align`, owner 2026-11-15: "are animals' activity in line with their System
 * Dynamics line"; AnimalDex `docs/ark/sd-alignment-audit-2026-11.md`). System Dynamics is the researched layer: when
 * the Ark disagrees with it, the Ark is the defect. This module is the one place the two meet, pure and shared by the
 * scene (`ark-scene/sd-rhythm.ts`), the audit (`scripts/ark-sd-alignment.mts`), the generator
 * (`scripts/ark-sd-rhythm.mts`) and the cards (web now; iOS and Android by `docs/ark/sd-rhythm-contract.md`).
 *
 *   1. MODES → ARK CATEGORIES, by rule (data, never per species): each SD mode's label words, left to right, are
 *      matched against `SD_WORD_RULES`; the first word that matches decides (tempo words such as "Rhythmic",
 *      "Explosive", "Slow" match nothing and are passed over). A mode whose label says nothing is read from its role
 *      sentence the same way. A moving or still word whose mode text speaks of prey or food (`FOOD_CONTEXT`) is a
 *      foraging walk or an ambush: half feeding.
 *   2. FREQUENCY → TEMPO: LOW long slow bouts, MID middling, HIGH rapid switching (`SD_TEMPO`), the species' tempo the
 *      weight-weighted mean of its modes'.
 *   3. WEIGHTS → TIME SHARES: a mode's conceptual weight is its share of the waking time the modes take between them.
 *   4. THE SCORE (`sdAgreement`): how far an Ark day (`ArkDay`, measured from the schedule) does what its SD says: the
 *      waking time on its modes (cover, 0.35), the modes' mix (0.35) and its tempo (0.3). One number 0–1 and a state.
 */

// MARK: Categories

/** What an Ark animal is seen doing, in the six kinds an SD mode is about (anything else, a drink, is `other`). */
export const SD_CATEGORIES = ["feed", "still", "move", "social", "dig", "care"] as const;
export type SdCategory = (typeof SD_CATEGORIES)[number];
export type SdMix = Partial<Record<SdCategory, number>>;
export type SdFrequency = "LOW" | "MID" | "HIGH";

/** The card's activity keys (`ark-animal-status.ts` ARK_ACTIVITIES) in those kinds; sleeping is not waking time. */
export const ARK_KEY_CATEGORY: Record<string, SdCategory | "sleep" | "other"> = {
    sleeping: "sleep",
    food: "feed", grazing: "feed", browsing: "feed", hunting: "feed", prowling: "feed", waiting: "feed", fishing: "feed", flowers: "feed", feeding: "feed",
    resting: "still", basking: "still", hiding: "still", watching: "still", wary: "still", about: "still",
    wandering: "move", flying: "move", swimming: "move", climbing: "move", home: "move", toWater: "move", breathing: "move", light: "move",
    courting: "social", sparring: "social", playing: "social", calling: "social", nest: "social", eggs: "social",
    digging: "dig",
    grooming: "care", bathing: "care",
    drinking: "other"
};

/**
 * How busy each card activity looks (0 asleep … 1 at full stretch), for the day's line: a still animal low, a feeding
 * or digging one in the middle, one travelling, chasing or courting high. The same weights on every surface.
 */
export const ARK_KEY_INTENSITY: Record<string, number> = {
    sleeping: 0,
    resting: 0.15, basking: 0.15, hiding: 0.15, about: 0.2, waiting: 0.25,
    watching: 0.35, wary: 0.45, grooming: 0.35, bathing: 0.45, eggs: 0.3, nest: 0.5,
    food: 0.55, grazing: 0.5, browsing: 0.5, flowers: 0.6, drinking: 0.45, feeding: 0.55, digging: 0.65, calling: 0.55,
    wandering: 0.7, climbing: 0.75, swimming: 0.75, home: 0.65, toWater: 0.65, breathing: 0.6, light: 0.7, prowling: 0.7,
    fishing: 0.8, courting: 0.8, sparring: 0.9, playing: 0.85, flying: 0.9, hunting: 1
};

// MARK: Mode words

/** One rule: a word (the start of one of a mode's label words, case-insensitive) and the kinds it means. */
export type SdWordRule = {words: RegExp; mix: SdMix; /** Moving or still: half feeding where the mode speaks of food. */ food?: boolean};

/**
 * Group-living words ("Herded", "Colonial", "Troop", "Massed") say who it is with, not what it does: passed over like the
 * tempo words, so "Herded • Grazing" is grazing.
 *
 * The words, first match wins (so "Burrowed", a state, is still before "Burrow…", digging). Each is the start of a
 * word: `graz` takes Grazing and Grazer. Kept as data so the audit can say which rule decided each mode.
 */
export const SD_WORD_RULES: readonly SdWordRule[] = [
    {words: /^(burrowed|buried|sealed|denned|sunken|underground|wedged|lying up)/i, mix: {still: 1}},
    {words: /^(dig|burrow|tunnel|excavat|sand-swim|levering|raking|drilling)/i, mix: {dig: 1}},
    {words: /^(groom|preen|bath|wallow|dust|moult)/i, mix: {care: 1}},
    {words: /^(graz|brows|forag|feed|fed\b|leaf-fed|fruit|prob|filter|hunt|channel-hunt|strik|strike|lung|stalk|ambush|pounc|seiz|scaveng|root|harvest|sally|hawk|fish|sweep|catch|captur|prey|eat|nibbl|crop|sip|nectar|engulf|gap(e|ing)|snap|pluck|chas|pursu|plung|intercept|lur|cach|glean|dabbl|tear|crush|ruminat|haying|tool|gather|tapping|sniff|nosing|search|stoop|swoop|quarter|dropping|drop\b|aiming|cutting|handling|pulling|crushing|ground-forag|selective|targeted|tongue|probing|dash|rush|short rush|ramming|charging)/i, mix: {feed: 1}},
    {words: /^(call|display|court|sing|whistl|click|drum|signal|flash|alarm|mat(e|ing)\b|breed|spawn|pair|nest|incubat|build|contest|clash|spar|mob|provision|rais|rear|territor|mark|chorus|vocal|humming|ornament|conspicuous|helped|synchron)/i, mix: {social: 1}},
    {words: /^(still|rest|perch|hidden|hid|shelter|bask|anchor|attach|torpid|dormant|hibernat|motionless|coil|cling|roost|sleep|settled|frozen|flatten|camoufl|cryptic|conceal|cover|lying|sitting|standing|hanging|waiting|fasting|conserv|patient|submerged|watch|scan|listen|vigilant|alert|guard|poised|holding|station|fixed|clamped|pressed|folded|closed|calm|quiet|silent|insulated|recovering|latent|grip|armou?red|blended|unseen|shaded|shading|cool|dark|tripod|head cocked|suspended|confined|weightless)/i, mix: {still: 1}, food: true},
    {words: /^(walk|rang|roam|travel|patrol|fly|flying|airborne|soar|glid|hover|climb|clamber|swim|cruis|div(e|ing)|wad(e|ing)|migrat|commut|drift|run|sprint|bound|hop|leap|strid|ambl|creep|crawl|slither|slip|swing|brachiat|school|shoal|flock|nomad|follow|descend|ris(e|ing)|surfac|paddl|scull|sink|moving|travers|cross|threading|weav|spinning|whirring|darting|launch|ballistic|vertical|skulk|floating|emerg|chaining|leaving|walking)/i, mix: {move: 1}, food: true}
];

/** Mode text that speaks of food or prey: a moving or still word there is a foraging walk or an ambush. */
export const FOOD_CONTEXT = /\b(prey|food|feed|feeds|feeding|forag\w*|hunt\w*|catch\w*|caught|fish|insects?|kill\w*|strike|strikes|ambush\w*|seiz\w*|eat\w*|graz\w*|nectar|seeds?|fruit)\b/i;

export type SdModeInput = {label?: string | null; role?: string | null; frequency?: string | null; conceptual_weight?: number | null};
export type SdModeRead = {mix: SdMix; weight: number; frequency: SdFrequency; /** The word that decided, or null (unread). */ word: string | null; from: "label" | "role" | null};

function frequencyOf(value: string | null | undefined): SdFrequency {
    return value === "LOW" || value === "HIGH" ? value : "MID";
}

function wordsOf(text: string): string[] {
    return text.split(/[•,;/]|\s+-\s+/).map((w) => w.trim()).filter(Boolean);
}

function matchWord(word: string): SdWordRule | null {
    // (A label word may be a phrase, "Walking the grassland": its own first word decides; so may a sentence-long role.)
    const first = word.split(/\s+/)[0];
    for (const rule of SD_WORD_RULES) if (rule.words.test(word) || rule.words.test(first)) return rule;
    return null;
}

/** One SD mode, read by the rules. */
export function readSdMode(mode: SdModeInput): SdModeRead {
    const label = mode.label ?? "";
    const role = mode.role ?? "";
    const text = `${label} ${role}`;
    const weight = Math.max(Number(mode.conceptual_weight ?? 0) || 0, 0);
    const frequency = frequencyOf(mode.frequency);
    const finish = (rule: SdWordRule, word: string, from: "label" | "role"): SdModeRead => {
        const mix: SdMix = rule.food && FOOD_CONTEXT.test(text) ? {...halve(rule.mix), feed: 0.5} : {...rule.mix};
        return {mix, weight, frequency, word, from};
    };
    for (const word of wordsOf(label)) {
        const rule = matchWord(word);
        if (rule) return finish(rule, word, "label");
    }
    for (const word of role.split(/[\s,;.]+/).filter(Boolean)) {
        const rule = matchWord(word);
        if (rule) return finish(rule, word, "role");
    }
    return {mix: {}, weight, frequency, word: null, from: null};
}

function halve(mix: SdMix): SdMix {
    const out: SdMix = {};
    for (const [k, v] of Object.entries(mix) as Array<[SdCategory, number]>) out[k] = v / 2;
    return out;
}

// MARK: A species' rhythm

/** A species' SD as the Ark acts on it: the share of the modes' waking time each kind should take, and its tempo. */
export type SdRhythm = {target: SdMix; tempo: SdFrequency; /** Its tempo on a 0 (LOW) … 2 (HIGH) line. */ level: number; modes: SdModeRead[]};

const LEVEL: Record<SdFrequency, number> = {LOW: 0, MID: 1, HIGH: 2};

/** A species' rhythm from its SD frequency profile's modes; null when no mode says anything the Ark can show. */
export function sdRhythmOf(modes: readonly SdModeInput[] | null | undefined): SdRhythm | null {
    const read = (modes ?? []).map(readSdMode);
    const counted = read.filter((m) => Object.keys(m.mix).length);
    if (!counted.length) return null;
    const total = counted.reduce((s, m) => s + (m.weight || 1), 0);
    const target: SdMix = {};
    for (const m of counted) for (const [k, v] of Object.entries(m.mix) as Array<[SdCategory, number]>) target[k] = (target[k] ?? 0) + (v * (m.weight || 1)) / total;
    const allTotal = read.reduce((s, m) => s + (m.weight || 1), 0);
    const level = read.reduce((s, m) => s + LEVEL[m.frequency] * (m.weight || 1), 0) / allTotal;
    const tempo: SdFrequency = level < 0.67 ? "LOW" : level > 1.33 ? "HIGH" : "MID";
    return {target, tempo, level, modes: read};
}

/**
 * The tempo each frequency means in the Ark (80 s slots): the bout it is held to (slots), and the band its measured
 * mean waking bout should fall in (minutes). LOW: long slow bouts; HIGH: what it does changes slot by slot.
 */
export const SD_TEMPO: Record<SdFrequency, {bout: number; minutes: [number, number]}> = {
    LOW: {bout: 6, minutes: [5, Infinity]},
    MID: {bout: 2, minutes: [2.6, 7]},
    HIGH: {bout: 1, minutes: [0, 3.2]}
};

// MARK: An Ark day

/** One animal's day in the Ark, measured from its schedule (`arkDayOf`). */
export type ArkDay = {
    /** Share of its waking time in each kind (and `other`). */
    awake: Partial<Record<SdCategory | "other", number>>;
    /** Share of the whole span asleep. */
    asleep: number;
    /** Its mean waking bout (minutes): a run of slots in one kind. */
    boutMinutes: number;
    /** Changes of kind per waking hour. */
    switchesPerHour: number;
    /** How busy it looked, slot by slot (0–1), oldest first. */
    intensity: number[];
};

/** A day from its slots' card activity keys, oldest first, each `slotSeconds` long. */
export function arkDayOf(keys: readonly string[], slotSeconds: number): ArkDay {
    const cats = keys.map((k) => ARK_KEY_CATEGORY[k] ?? "still");
    const awakeCats = cats.filter((c) => c !== "sleep");
    const awake: ArkDay["awake"] = {};
    for (const c of awakeCats) awake[c as SdCategory | "other"] = (awake[c as SdCategory | "other"] ?? 0) + 1 / awakeCats.length;
    let runs = 0;
    let switches = 0;
    for (let i = 0; i < cats.length; i++) {
        if (cats[i] === "sleep") continue;
        if (i === 0 || cats[i - 1] === "sleep") runs++;
        else if (cats[i] !== cats[i - 1]) {
            runs++;
            switches++;
        }
    }
    const awakeHours = (awakeCats.length * slotSeconds) / 3600;
    return {
        awake,
        asleep: cats.length ? 1 - awakeCats.length / cats.length : 0,
        boutMinutes: runs ? (awakeCats.length * slotSeconds) / 60 / runs : 0,
        switchesPerHour: awakeHours ? switches / awakeHours : 0,
        intensity: keys.map((k) => ARK_KEY_INTENSITY[k] ?? 0.2)
    };
}

// MARK: Agreement

/** Most of its waking time on what its SD modes are about: at least this much scores in full. */
export const SD_COVER = 0.6;
export type SdRhythmState = "in" | "slightly" | "out";
export type SdAgreement = {
    score: number;
    state: SdRhythmState;
    /** Waking time on its modes' kinds (0–1), its score; the modes' mix (1 − total variation); its tempo (1 when unknown). */
    cover: number;
    coverScore: number;
    mix: number;
    tempo: number;
    /** Per kind its SD share of the modes and the Ark's share of the waking time those kinds take. */
    shares: Array<{category: SdCategory; sd: number; ark: number}>;
    /** What disagrees most, by type (the audit's tally): null when nothing is far off. */
    worst: "cover" | "mix" | "tempo-slow" | "tempo-fast" | null;
};

/** In rhythm from this score; slightly off from `SLIGHTLY`; out of rhythm below. */
export const SD_IN_RHYTHM = 0.8;
export const SD_SLIGHTLY = 0.62;

export function sdAgreement(rhythm: SdRhythm, day: ArkDay): SdAgreement {
    const cats = (Object.keys(rhythm.target) as SdCategory[]).filter((c) => (rhythm.target[c] ?? 0) > 0);
    const cover = cats.reduce((s, c) => s + (day.awake[c] ?? 0), 0);
    const coverScore = Math.min(cover / SD_COVER, 1);
    let tv = 0;
    for (const c of cats) tv += Math.abs((cover ? (day.awake[c] ?? 0) / cover : 0) - (rhythm.target[c] ?? 0));
    const mix = cats.length > 1 ? 1 - tv / 2 : cover > 0 ? 1 : 0;
    const [lo, hi] = SD_TEMPO[rhythm.tempo].minutes;
    // (Its tempo unknown, NaN: asleep through the bouts read. The score is then its cover and mix alone.)
    const known = Number.isFinite(day.boutMinutes);
    const b = Math.max(known ? day.boutMinutes : 0, 0.01);
    // (Outside its band by a factor f, the tempo scores 1/f: half the band's floor scores 0.5.)
    const tempo = !known ? 1 : b < lo ? b / lo : b > hi ? hi / b : 1;
    const score = known ? 0.35 * coverScore + 0.35 * mix + 0.3 * tempo : (coverScore + mix) / 2;
    const shares = cats.map((c) => ({category: c, sd: rhythm.target[c] ?? 0, ark: day.awake[c] ?? 0}));
    const gaps: Array<[SdAgreement["worst"], number]> = [["cover", 1 - coverScore], ["mix", 1 - mix], [b < lo ? "tempo-fast" : "tempo-slow", known ? 1 - tempo : 0]];
    gaps.sort((x, y) => y[1] - x[1]);
    return {score, state: score >= SD_IN_RHYTHM ? "in" : score >= SD_SLIGHTLY ? "slightly" : "out", cover, coverScore, mix, tempo, shares, worst: gaps[0][1] > 0.2 ? gaps[0][0] : null};
}

// MARK: The individual (owner 2026-11-15: "completing its step would fix it, or thriving would help it align")

export type ArkRhythmCondition = "well_fed" | "hungry" | "old" | null | undefined;
export type ArkRhythmThrive = "ordinary" | "good" | "prime";

/**
 * How its own state moves one animal off its kind's rhythm (welfare science: poor condition disrupts the natural
 * activity budget), by rule from the server's state only. `cover`: the share of its choosing that goes to its modes
 * (its kind's rhythm in full at prime); `feed`/`still`/`move`: what its state does to those kinds' pull; `bout`: its
 * bouts' length against its kind's. Visual only: the server decides life and death.
 */
export type ArkRhythmShift = {cover: number; feed: number; still: number; move: number; bout: number};

export const ARK_RHYTHM_COVER: Record<ArkRhythmThrive, number> = {prime: 0.78, good: 0.66, ordinary: 0.38};

export function arkRhythmShift(thrive: ArkRhythmThrive | null | undefined, condition: ArkRhythmCondition): ArkRhythmShift {
    const shift: ArkRhythmShift = {cover: ARK_RHYTHM_COVER[thrive ?? "ordinary"], feed: 1, still: thrive === "ordinary" || !thrive ? 1.35 : 1, move: 1, bout: 1};
    // Hungry: searching for food, rests cut short, bouts broken.
    if (condition === "hungry") Object.assign(shift, {feed: 1.7, still: 0.45, move: 1.3, bout: 0.34});
    // Old: slower, longer rests, less travel.
    if (condition === "old") Object.assign(shift, {still: shift.still * 1.9, move: 0.55, bout: 2});
    return shift;
}

/** Why one is off its rhythm, in the card's words' keys; and whether a person's step can bring it back. */
export type ArkRhythmCause = "hungry" | "old" | "unkept";
export function arkRhythmCauses(thrive: ArkRhythmThrive | null | undefined, condition: ArkRhythmCondition, stepFeeds: boolean): Array<{cause: ArkRhythmCause; fixable: boolean}> {
    const causes: Array<{cause: ArkRhythmCause; fixable: boolean}> = [];
    if (condition === "hungry") causes.push({cause: "hungry", fixable: stepFeeds});
    if (condition === "old") causes.push({cause: "old", fixable: false});
    if (thrive !== "prime") causes.push({cause: "unkept", fixable: true});
    return causes;
}

// MARK: The line

/** A day's intensity smoothed into `bins` points (mean per bin), for the line beside the SD waveform. */
export function intensityLine(intensity: readonly number[], bins: number): number[] {
    if (!intensity.length) return [];
    const out: number[] = [];
    for (let b = 0; b < bins; b++) {
        const from = Math.floor((b * intensity.length) / bins);
        const to = Math.max(Math.floor(((b + 1) * intensity.length) / bins), from + 1);
        let sum = 0;
        for (let i = from; i < to; i++) sum += intensity[i];
        out.push(sum / (to - from));
    }
    return out;
}

/** An SVG path over `0 0 100 50` (the SD waveform's own box), high = busy, as the waveform draws it. */
export function intensityPath(line: readonly number[]): string {
    if (!line.length) return "";
    return line.map((v, i) => `${i ? "L" : "M"} ${((i / Math.max(line.length - 1, 1)) * 100).toFixed(1)} ${(46 - Math.min(Math.max(v, 0), 1) * 40).toFixed(1)}`).join(" ");
}
