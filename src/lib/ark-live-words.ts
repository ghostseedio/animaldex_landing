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
    courting: string;
    contest: string;
    fishing: string;
    nest: string;
    alarm: string;
    /** A pair bred (the server's `mated`): "Two Plains Zebras mated". */
    matedOne: string;
    matedOther: string;
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
    courting: "{aAnimal} is courting",
    contest: "{animal} rivals are clashing",
    fishing: "{aAnimal} caught a fish",
    nest: "{aAnimal} is building a nest",
    alarm: "{aAnimal} gave an alarm call",
    matedOne: "Two {animals} mated",
    matedOther: "{count} pairs of {animals} mated"
};
