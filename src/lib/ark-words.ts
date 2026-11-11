/**
 * The Ark's words (`ark` in the locale file): the /ark page, its population
 * HUD and tap card, and the capture page's Ark band. Read on the server
 * (`loaders/ark-words`), English key by key where a locale lacks one, and
 * handed to the client components as a prop.
 */

import type {ArkRegion, ArkZone} from "@/ark-scene/types";

export type ArkHudWords = {
    label: string;
    title: string;
    show: string;
    hide: string;
    statAnimals: string;
    statSpecies: string;
    statFounders: string;
    pairsLine: string;
    single: string;
    pair: string;
    more: string;
    crowded: string;
    yours: string;
    flyTo: string;
    rowLabel: string;
    showAll: string;
    showFewer: string;
    earlyTitle: string;
    earlyBody: string;
    bring: string;
    /** A species drawn as a herd (A14), beside its count. */
    herdTag: string;
    /** A kind's breeds aboard (A1), e.g. "breeds: Labrador 3, Poodle 2". */
    breeds: string;
    /** "12 · crowded": a count and its pair status. */
    countStatus: string;
};

/** `generic`: an animal a step brought (before captures did); `capture`: one a capture brought (captures + thrive). */
export type ArkStoryWords = {generic: string; capture: string; debate: string; openDebate: string};

/** The tap card's life story (life v2). */
export type ArkLifeWords = {
    bornAboard: string;
    bornTo: string;
    bornToValue: string;
    born: string;
    generation: string;
    generationArrived: string;
    generationBorn: string;
    generationShort: string;
    age: string;
    ageYears: string;
    ageYear: string;
    ageDays: string;
    ageDay: string;
    meals: string;
    lastMeal: string;
    dietSays: string;
    young: string;
    noYoung: string;
    milestones: string;
    milestonesValue: string;
    condition: string;
    well_fed: string;
    hungry: string;
    old: string;
    asleep: string;
    ended: string;
    endedEaten: string;
    endedOld: string;
    /** Life v2: a predator dead of long hunger. */
    starved: string;
    breeding: string;
    breedingEstimated: string;
    breedingPartial: string;
    line: string;
    lineValue: string;
    showStory: string;
    hideStory: string;
    follow: string;
    followHint: string;
    /** Hatched from an egg (A9). */
    hatchedAboard: string;
    hatched: string;
    /** A species with no Ark model yet (A13): the stand-in figure, said so. */
    placeholder: string;
    /** A3: the step that brought it was revised after it arrived (it stays aboard). */
    revised: string;
    revisedWorked: string;
    revisedNot: string;
    /** The label of its hunger and age now (`condition`: Well-fed, Hungry, Old); "Condition" is its thrive band's. */
    now: string;
    /** Captures + thrive: how well kept it is (`thrive`), in plain words. */
    thrivePrime: string;
    thriveGood: string;
    thriveOrdinary: string;
    /** Its family line (`lineage`): "2 young, 1 grandchild · 2 alive now". */
    lineage: string;
    lineageYoungOne: string;
    lineageYoungOther: string;
    lineageGrandOne: string;
    lineageGrandOther: string;
    lineageLaterOne: string;
    lineageLaterOther: string;
    lineageLiving: string;
};

/** "While you were away": the replay's captions and its summary line. */
export type ArkReplayWords = {
    title: string;
    skip: string;
    progress: string;
    arrival: string;
    birthOne: string;
    birthOther: string;
    meal: string;
    mealPhrase: string;
    death: string;
    starved: string;
    lastGone: string;
    extinction: string;
    summary: string;
    arrivalsOne: string;
    arrivalsOther: string;
    birthsOne: string;
    birthsOther: string;
    mealsOne: string;
    mealsOther: string;
    deathsOne: string;
    deathsOther: string;
    starvedOne: string;
    starvedOther: string;
    extinctionsOne: string;
    extinctionsOther: string;
    today: string;
    yesterday: string;
    weekday: string;
    date: string;
    a: string;
    an: string;
    dismiss: string;
    /** Eggs (A9): a clutch laid, and the young that hatch from it. */
    laidOne: string;
    laidOther: string;
    laidSome: string;
    hatchedOne: string;
    hatchedOther: string;
    laidCountOne: string;
    laidCountOther: string;
    hatchedCountOne: string;
    hatchedCountOther: string;
};

/** A very popular species, drawn as a herd (A14): its badge and its species card. */
export type ArkHerdWords = {
    badge: string;
    title: string;
    count: string;
    mineOne: string;
    mineOther: string;
    meet: string;
    meetAnother: string;
    note: string;
};

/** The lighter view (A18): fewer details, for a slower device. */
export type ArkLiteWords = {
    label: string;
    auto: string;
    hint: string;
};

/** Sound (liveliness): the toggle, and the Sounds panel's credits for every recording heard. */
export type ArkSoundWords = {
    label: string;
    hint: string;
    credits: string;
    empty: string;
};

/** What a screen reader hears (A18). */
export type ArkA11yWords = {
    scene: string;
    list: string;
    regionCount: string;
    selected: string;
    herdSelected: string;
    closed: string;
    motionReduced: string;
    skipToList: string;
    /** The world's reset button (runtime lane): fly back to the whole island. */
    resetView: string;
};

/** Share buttons and the share cards (Part 4c). */
export type ArkShareWords = {
    share: string;
    shareArk: string;
    shareAnimal: string;
    copied: string;
    textArk: string;
    textAnimal: string;
    cardStatArk: string;
    cardStatSpecies: string;
    cardNotAboard: string;
    cardSoon: string;
    cardSubtitle: string;
    cardSpeciesSubtitle: string;
    cardNotAboardSubtitle: string;
    countAboard: string;
};

/** /ark's metadata and its server-rendered words for search (Part 4d). */
export type ArkSeoWords = {
    metaTitle: string;
    metaDescription: string;
    metaFocusTitle: string;
    metaFocusDescription: string;
    aboutEyebrow: string;
    aboutTitle: string;
    aboutBody: string;
    liveCounts: string;
    arriveTitle: string;
    arriveBody: string;
    lifeTitle: string;
    lifeBody: string;
    lifeRules: string;
    lifeNote: string;
    listTitle: string;
    listIntro: string;
    listAboard: string;
    breadcrumbHome: string;
};

/** A species page's "In the Ark" (Part 4d). */
export type ArkSpeciesWords = {
    title: string;
    body: string;
    aboardOne: string;
    aboardOther: string;
    notAboard: string;
    notAboardPlain: string;
    eats: string;
    eatenBy: string;
    see: string;
    seeArk: string;
};

/**
 * The capture page's band. The species' band (from the public snapshot): `aboardOne` … `seeArk`.
 * Captures + thrive (`voyage_capture_state_v1`): what this capture did, `aboardTitle` … `thrive`.
 */
export type ArkCaptureWords = {
    aboardOne: string;
    aboardOther: string;
    mineOnly: string;
    mineOne: string;
    mineOther: string;
    needsMate: string;
    see: string;
    bringMate: string;
    notAboardTitle: string;
    notAboardBody: string;
    start: string;
    seeArk: string;
    aboardTitle: string;
    aboardBody: string;
    aboardPair: string;
    alreadyBody: string;
    comingTitle: string;
    comingBody: string;
    waitingBody: string;
    pairFullTitle: string;
    pairFullBody: string;
    wasAboardTitle: string;
    wasAboardBody: string;
    notOnArkTitle: string;
    notOnArkBody: string;
    /** "Steps with it keep your {animal} thriving." */
    thrive: string;
};

/**
 * Founders (founders contract, section 6): the tap card's "Brought by {name}"
 * and "How it got aboard", a founder's page, the name question and share line
 * under an arrival in the chat, and the "Show my name on my Ark animals" setting.
 */
export type ArkFoundersWords = {
    /** "Show my name on my Ark animals": an opt-out, on by default, no 18+ step (owner, 2026-11-11). */
    settings: {title: string; note: string; under18: string; noHandle: string};
    share: {
        ask: string;
        stepLabel: string;
        problemPlaceholder: string;
        share: string;
        edit: string;
        notNow: string;
        shared: string;
        publicNote: string;
        notPublic: string;
        couldNotCheck: string;
        remove: string;
        removed: string;
        /** The Share button when the one-tap 18+ confirmation is still needed. */
        confirmShare: string;
    };
    /** `howThriving` (D6): the story on an animal a capture brought, of a step that keeps it thriving. */
    card: {howAboard: string; howThriving: string; broughtBy: string};
    founder: {storiesTitle: string; noStories: string};
    error: {needsAdult: string};
};

export type ArkWords = {
    metaTitle: string;
    metaDescription: string;
    eyebrow: string;
    title: string;
    beginning: string;
    aboard: string;
    empty: string;
    unavailable: string;
    animalsOne: string;
    animalsOther: string;
    speciesOne: string;
    speciesOther: string;
    foundersOne: string;
    foundersOther: string;
    myAnimals: string;
    hint: string;
    loading: string;
    noWebgl: string;
    newArrival: string;
    showMe: string;
    lives: string;
    broughtBy: string;
    arrived: string;
    close: string;
    wholeWorld: string;
    regionsLabel: string;
    howTitle: string;
    howBody: string;
    howCta: string;
    /** A deleted account's animals (A5): the server's "Former voyager", in the reader's language. */
    formerVoyager: string;
    zones: Record<ArkZone, string>;
    regions: Record<ArkRegion, string>;
    hud: ArkHudWords;
    story: ArkStoryWords;
    life: ArkLifeWords;
    replay: ArkReplayWords;
    capture: ArkCaptureWords;
    herd: ArkHerdWords;
    lite: ArkLiteWords;
    sound: ArkSoundWords;
    a11y: ArkA11yWords;
    person: ArkPersonWords;
    share: ArkShareWords;
    seo: ArkSeoWords;
    species: ArkSpeciesWords;
    founders: ArkFoundersWords;
};

/** `/u/{handle}/ark` (Ark 3.3, Part 3): one person's animals aboard, as privacy allows. */
export type ArkPersonWords = {
    metaTitle: string;
    title: string;
    titleSelf: string;
    scoreAbout: string;
    scoreAboutSelf: string;
    outOf: string;
    summary: string;
    anonymousTitle: string;
    anonymousBody: string;
    selfPrivate: string;
    selfNamed: string;
    noneSelf: string;
    since: string;
    see: string;
    arkLine: string;
    openArk: string;
    back: string;
};

/** "{count} animals" and the like: every `{key}` filled from `values`, unknown keys left as they are. */
export function fillArkWords(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
