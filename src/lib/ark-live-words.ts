/**
 * The live HUD's words (`ark.live` in the locale files): the on-screen log and the population bars. The type
 * lives here, beside its English, so the embed can say its lines before (or without) the words read.
 */
export type ArkLiveWords = {
    /** The log's chip: "Live". */
    title: string;
    show: string;
    hide: string;
    /** The log's accessible name. */
    logLabel: string;
    /** The tag on a line seen near the camera (not the Ark's record). */
    seen: string;
    seenNote: string;
    /** What a bar's length means (its tooltip). */
    barsNote: string;
    /** The arrow beside a count that changed. */
    up: string;
    down: string;
    /** A burst bigger than the log: "+{count} more". */
    more: string;
    arrivalOne: string;
    arrivalOther: string;
    birthOne: string;
    birthOther: string;
    hatchedOne: string;
    hatchedOther: string;
    deathOther: string;
    /** Humans (decision 442): "{count} {animals} died peacefully of old age". */
    deathPeacefulOther?: string;
    courting: string;
    contest: string;
    fishing: string;
    nest: string;
    alarm: string;
    /** A pair bred (the server's `mated`): "Two Plains Zebras mated". */
    matedOne: string;
    matedOther: string;
    /** Hearts are lives (behind `ark_hearts`): a death's hearts left ("{line} · 2 ♥ left"), a return, a final end. */
    heartsLeftOne: string;
    heartsLeftOther: string;
    heartsLeftNone: string;
    withHearts: string;
    eatenBy: string;
    /** A kind's dormant season (decision 370): "{animals} have gone into their winter sleep" / "{animals} are awake again". */
    dormant?: string;
    woke?: string;
    /** A prey animal that got away from a predator's attempt (decision 373): "{aPrey} got away from {aPredator}". */
    escaped?: string;
    /** A meal that ends a hunt seen setting out: "A Lion caught a Plains Zebra". */
    caught?: string;
    /** Release to the Wild (AnimalDex P1-8): "{aAnimal} was released into the wild" (`release-lines.ts`). */
    released?: string;
    revived: string;
    revivedYoung: string;
    gone: string;
    /**
     * The crisis layer's lines (AnimalDex E4): the kind, a colon, then what happened, each with no verb that agrees with
     * the animal's sex or number (so they hold in every language, whether or not the language has a plural for a name).
     * `crisis`: only a few left in the wild; `saved`: out of danger; `wildGone`: none left in the wild; `toCare`: a
     * recovering animal now in the zoo's care.
     */
    crisis?: string;
    saved?: string;
    wildGone?: string;
    toCare?: string;
};

/** English, as `en.json` has it: the fallback when a reader's words lack `live`. */
export const ARK_LIVE_ENGLISH: ArkLiveWords = {
    title: "Live",
    show: "Show what is happening",
    hide: "Hide what is happening",
    logLabel: "What is happening on the Ark",
    seen: "Seen",
    seenNote: "Seen near you, happening now. Everything else is the Ark’s record.",
    barsNote: "Each bar compares a kind with the most numerous in its region",
    up: "{count} more",
    down: "{count} fewer",
    more: "+{count} more",
    arrivalOne: "{aAnimal} came aboard",
    arrivalOther: "{count} {animals} came aboard",
    birthOne: "{aAnimal} was born",
    birthOther: "{count} {animal} young were born",
    hatchedOne: "{aAnimal} hatched",
    hatchedOther: "{count} {animal} young hatched",
    deathOther: "{count} {animals} died of old age",
    deathPeacefulOther: "{count} {animals} died peacefully of old age",
    courting: "{aAnimal} is courting",
    contest: "{animal} rivals are clashing",
    fishing: "{aAnimal} caught a fish",
    nest: "{aAnimal} is building a nest",
    alarm: "{aAnimal} gave an alarm call",
    matedOne: "Two {animals} mated",
    matedOther: "{count} pairs of {animals} mated",
    heartsLeftOne: "1 ♥ left",
    heartsLeftOther: "{n} ♥ left",
    heartsLeftNone: "no ♥ left",
    withHearts: "{line} · {hearts}",
    eatenBy: "{animal} was eaten by {aPredator}",
    caught: "{aPredator} caught {aPrey}",
    dormant: "{animals} have gone into their winter sleep",
    woke: "{animals} are awake again",
    escaped: "{aPrey} got away from {aPredator}",
    revived: "{animal} is back",
    revivedYoung: "{animal} is back, a young adult again",
    released: "{aAnimal} was released into the wild",
    gone: "{animal} is gone from the Ark",
    crisis: "{animal}: only a few left in the wild",
    saved: "{animal}: out of danger in the wild",
    wildGone: "{animal}: none left in the wild",
    toCare: "{animal}: now cared for in the zoo"
};
