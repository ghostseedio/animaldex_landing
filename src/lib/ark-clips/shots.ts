import {ARK_FLYERS} from "@/ark-scene/flyers";
import {displayLength} from "@/ark-scene/sizes";
import type {ArkAnimal, ArkSnapshot, ArkZone} from "@/ark-scene/types";
import type {ArkAct, ArkEvent} from "@/lib/ark-life";
import {planArkReplay} from "@/lib/ark-life";
import {pickArkFacts, type ArkFact, type ArkFieldGuide} from "@/lib/ark-clips/facts";
import {ARK_MOMENTS, canMoment, MOMENT_SECONDS, type ArkMomentKind} from "@/ark-scene/moments";

/**
 * Ark marketing clips (docs/ark-next.md, Part 4b): what each scripted shot
 * shows and says. Pure, so the choices are testable and the recorder, the
 * admin page and the tests agree.
 *
 * Every word on screen comes from stored data or live counts: the snapshot
 * (`voyage_public_v2` / `v1`), the event log (`voyage_events_since_v1`) and
 * the species' field guide. No user is ever named (bringers are not shown
 * at all), and nothing from a problem, debate, chat or memory is read.
 */

export const ARK_SHOTS = ["day_to_night", "arrival", "meal_chase", "follow", "flyover", "meet", ...ARK_MOMENTS] as const;
/** The cross-layer moments (`ark-scene/moments.ts`): cosmetic, never a meal; available when the Ark has an animal that can act one out. */
export const ARK_MOMENT_SHOTS: readonly ArkShotKind[] = ARK_MOMENTS;
export type ArkShotKind = (typeof ARK_SHOTS)[number];

export function isArkShot(value: unknown): value is ArkShotKind {
    return typeof value === "string" && (ARK_SHOTS as readonly string[]).includes(value);
}

export const ARK_SHOT_LABELS: Record<ArkShotKind, string> = {
    day_to_night: "Day turning to night",
    arrival: "A new arrival",
    meal_chase: "A meal-chase replay",
    follow: "Following one animal",
    flyover: "Flyover of the whole Ark",
    meet: "Meet the species (field-guide facts)",
    seabird_dive: "A seabird dives into the sea",
    whale_surface: "A whale surfaces to blow",
    owl_swoop: "An owl swoops from its branch",
    primate_drop: "A primate drops to the ground"
};

export const CLIP_WIDTH = 1080;
export const CLIP_HEIGHT = 1920;
export const CLIP_FPS = 30;
export const MIN_CLIP_SECONDS = 15;
export const MAX_CLIP_SECONDS = 45;
/** The end card: the last seconds, over the still-moving Ark. */
export const END_SECONDS = 2.6;

/** Moments the director reports, in seconds from the first frame. Without an act, `act` and `actEnd` are where the lead ends. */
export type ArkMark = "start" | "act" | "actEnd" | "end";
export type ArkMarks = Record<ArkMark, number> & {total: number};

export type ArkCue = {
    kind: "hook" | "caption" | "end";
    /** A small lime label over the caption ("Diet"), or none. */
    label?: string;
    text: string;
    from: {mark: ArkMark; offset: number};
    to: {mark: ArkMark; offset: number};
};

/** What the browser director runs (JSON across Playwright). */
export type ArkDirection = {
    kind: ArkShotKind;
    /** The light's hour at the first and the last frame (eased between). */
    hours: {from: number; to: number};
    /** Camera seconds before the act; the whole camera move when there is no act. */
    lead: number;
    /** Camera seconds after the act. */
    linger: number;
    /** The end card's seconds (the camera keeps moving under it). */
    end: number;
    /** The shortest the whole clip may be: a short act gets a longer linger. */
    minSeconds: number;
    /** The animal the camera is about (its id in the snapshot), if any. */
    subject: string | null;
    /** The replay act this shot plays (an arrival or a meal). */
    act: ArkAct | null;
    /** Model slugs to load before the first frame. */
    preload: string[];
};

export type ArkShotPlan = {
    kind: ArkShotKind;
    /** `admin_content_videos.source_slug`: one live clip per slug. Samples from fixtures start `sample-`. */
    slug: string;
    title: string;
    hookText: string;
    direction: ArkDirection;
    cues: ArkCue[];
    /** The field-guide sentences used ("meet" only), verbatim. */
    facts: ArkFact[];
    subject: {id: string; name: string; speciesProfileId: string; modelSlug: string} | null;
    dataSource: "live" | "fixture";
    counts: ArkSnapshot["counts"];
    asOf: string | null;
};

export type ArkClipInput = {
    snapshot: ArkSnapshot;
    /** Decoded events, oldest first (`decodeArkEvents`). */
    events: ArkEvent[];
    /** The subject species' stored field guide ("meet"). */
    fieldGuide?: ArkFieldGuide | null;
    /** True when the Ark is the development fixture: the clip is a sample and is never uploaded. */
    fixture: boolean;
    now: Date;
    /** "meet" / "follow": a species slug, model slug or species_profile_id to use instead of the default choice. */
    species?: string | null;
};

export class ArkShotUnavailable extends Error {}

const ZONE_NAMES: Record<ArkZone, string> = {
    coral_reef: "coral reef",
    open_ocean: "open ocean",
    seashore: "seashore",
    river_lake: "rivers and lakes",
    wetland: "wetlands",
    rainforest: "rainforest",
    woodland: "woodland",
    grassland: "grassland",
    desert: "desert",
    mountains: "mountains",
    polar: "polar ice",
    farm_garden: "farm and garden"
};

const SEA_ZONES = new Set<ArkZone>(["open_ocean", "coral_reef"]);

/** How the general rule is said: no step, problem or person, only how animals come aboard. */
export const ARK_HOW_LINE = "Animals come aboard when someone captures them, and steps that work keep them thriving.";
export const ARK_END_TITLE = "THE ARK";
export const ARK_END_URL = "animaldex.app/ark";

export function slugify(value: string): string {
    return value.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

function day(at: string | Date): string {
    return (typeof at === "string" ? new Date(at) : at).toISOString().slice(0, 10);
}

/** "a Plains Zebra", "an Arctic Fox" (the scene's own rule). */
export function withArticle(name: string): string {
    const an = /^[aeiou]/i.test(name) && !/^(uni|eu|one|use|usu|ura)/i.test(name);
    return `${an ? "an" : "a"} ${name}`;
}

function capitalised(text: string): string {
    return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function longDate(at: string): string {
    return new Intl.DateTimeFormat("en-GB", {day: "numeric", month: "long", timeZone: "UTC"}).format(new Date(at));
}

/** "There are 8 aboard the Ark.", "It's the only one aboard." */
function aboardLine(count: number): string {
    return count <= 1 ? "It's the only one aboard the Ark." : `There are ${count} aboard the Ark.`;
}

function sameSpecies(animals: ArkAnimal[], animal: ArkAnimal): ArkAnimal[] {
    return animals.filter((other) => other.species_profile_id === animal.species_profile_id);
}

function matchesSpecies(animal: ArkAnimal, wanted: string): boolean {
    const key = wanted.trim().toLowerCase();
    return animal.species_profile_id.toLowerCase() === key || animal.model_slug === key || slugify(animal.name) === key;
}

/** Out of sight at night (the light the clip is filmed in): prefer animals awake by day. */
function awakeByDay(animal: ArkAnimal): boolean {
    return animal.activity !== "nocturnal";
}

/** "follow" / "meet": the wanted species, else the best-known one aboard (most of them, awake by day, a land animal first for "meet"). */
export function pickArkSubject(snapshot: ArkSnapshot, purpose: "follow" | "meet", wanted?: string | null): ArkAnimal | null {
    const animals = snapshot.animals;
    if (!animals.length) return null;
    const pool = wanted ? animals.filter((animal) => matchesSpecies(animal, wanted)) : animals;
    if (!pool.length) return null;
    const counts = new Map<string, number>();
    for (const animal of animals) counts.set(animal.species_profile_id, (counts.get(animal.species_profile_id) ?? 0) + 1);
    const score = (animal: ArkAnimal) => {
        let value = (counts.get(animal.species_profile_id) ?? 0) * 10;
        if (awakeByDay(animal)) value += 25;
        if (purpose === "follow" && ARK_FLYERS.has(animal.model_slug)) value += 60;
        if (purpose === "follow" && SEA_ZONES.has(animal.zone)) value += 30;
        if (purpose === "meet" && !SEA_ZONES.has(animal.zone)) value += 15;
        if (animal.origin !== "born") value += 2;
        return value;
    };
    // Ties go to the earliest arrival, then the id, so the same Ark picks the same animal.
    return [...pool].sort((a, b) => score(b) - score(a) || a.arrived_at.localeCompare(b.arrived_at) || a.id.localeCompare(b.id))[0];
}

/** Who acts out a cross-layer moment: the first aboard (earliest arrival, then id) whose species can, awake by day first. */
export function momentSubject(snapshot: ArkSnapshot, kind: ArkMomentKind): ArkAnimal | null {
    const able = snapshot.animals.filter((animal) => canMoment(kind, animal.model_slug, animal.zone));
    return [...able].sort((a, b) => Number(awakeByDay(b)) - Number(awakeByDay(a)) || a.arrived_at.localeCompare(b.arrived_at) || a.id.localeCompare(b.id))[0] ?? null;
}

const MOMENT_HOOKS: Record<ArkMomentKind, (name: string) => string> = {
    seabird_dive: (name) => `WATCH ${withArticle(name).toUpperCase()} DIVE`,
    whale_surface: (name) => `${withArticle(name).toUpperCase()} COMES UP TO BREATHE`,
    owl_swoop: (name) => `${withArticle(name).toUpperCase()} TAKES OFF`,
    primate_drop: (name) => `${withArticle(name).toUpperCase()} COMES DOWN FROM THE TREES`
};

/** The newest animal that came aboard (not one born there). */
export function newestArrival(snapshot: ArkSnapshot): ArkAnimal | null {
    const arrived = snapshot.animals.filter((animal) => animal.origin !== "born");
    return [...arrived].sort((a, b) => b.arrived_at.localeCompare(a.arrived_at) || a.id.localeCompare(b.id))[0] ?? null;
}

/** Where the scene cuts away from a chase (water, or the shore beside it) instead of acting it out. */
const CUTAWAY_ZONES = new Set<ArkZone>(["open_ocean", "coral_reef", "seashore", "river_lake", "wetland"]);

/**
 * A chase worth filming: on land, a hunter about a metre or more long after
 * prey big enough to see. A frog after a cricket, or a shark after a seal on
 * the shore, is a cut-away to the horizon in the scene.
 */
export function isVisibleChase(meal: Extract<ArkAct, {kind: "meal"}>): boolean {
    if (CUTAWAY_ZONES.has(meal.predator.zone) || CUTAWAY_ZONES.has(meal.prey.zone)) return false;
    // Drawn lengths (sizes.ts): about 1.25 m real for the hunter, 0.5 m for the prey.
    return displayLength(meal.predator.model_slug, null) >= 1.4 && displayLength(meal.prey.model_slug, null) >= 0.9;
}

/** The newest meal in the log, a visible chase first. */
export function newestMeal(events: ArkEvent[]): Extract<ArkAct, {kind: "meal"}> | null {
    const acts = planArkReplay(events, Number.MAX_SAFE_INTEGER).acts;
    const meals = acts.filter((act): act is Extract<ArkAct, {kind: "meal"}> => act.kind === "meal");
    return meals.filter(isVisibleChase).at(-1) ?? meals.at(-1) ?? null;
}

function subjectOf(animal: ArkAnimal | null): ArkShotPlan["subject"] {
    return animal ? {id: animal.id, name: animal.name, speciesProfileId: animal.species_profile_id, modelSlug: animal.model_slug} : null;
}

function hoursFor(animal: ArkAnimal | null): number {
    if (animal?.activity === "nocturnal") return 19.2;
    if (animal?.activity === "crepuscular") return 18.2;
    return 10.5;
}

const at = (mark: ArkMark, offset: number) => ({mark, offset});

function endCue(): ArkCue {
    return {kind: "end", text: ARK_END_TITLE, from: at("end", 0), to: at("end", END_SECONDS)};
}

function activityLine(animal: ArkAnimal): string | null {
    switch (animal.activity) {
        case "diurnal": return "Awake by day, asleep at night.";
        case "nocturnal": return "Asleep by day, awake at night.";
        case "crepuscular": return "Most awake at dawn and dusk.";
        case "any": return "Awake day and night.";
        default: break;
    }
    if (animal.sociality === "group") return "It keeps close to its group.";
    if (animal.sociality === "pair") return "It stays close to its partner.";
    return null;
}

/**
 * The plan of one shot from the Ark as it is (or the fixture, for a sample).
 * Throws `ArkShotUnavailable` when the Ark has nothing to show for it (no
 * meal yet, no stored facts for the species).
 */
export function planArkShot(kind: ArkShotKind, input: ArkClipInput): ArkShotPlan {
    const {snapshot, fixture} = input;
    const animals = snapshot.animals;
    if (!animals.length) throw new ArkShotUnavailable("The Ark has no animals yet");
    const counts = snapshot.counts;
    const base = {
        kind,
        dataSource: fixture ? "fixture" as const : "live" as const,
        counts,
        asOf: snapshot.as_of,
        facts: [] as ArkFact[]
    };
    const sample = (slug: string) => (fixture ? `sample-${slug}` : slug).slice(0, 120);
    const today = day(input.now);
    const direction = (partial: Partial<ArkDirection> & Pick<ArkDirection, "lead">): ArkDirection => ({
        kind,
        hours: {from: 10.5, to: 10.5},
        linger: 0,
        end: END_SECONDS,
        minSeconds: MIN_CLIP_SECONDS,
        subject: null,
        act: null,
        preload: [],
        ...partial
    });

    switch (kind) {
        case "day_to_night": {
            const diurnal = animals.filter((animal) => animal.activity === "diurnal").length;
            const nocturnal = animals.filter((animal) => animal.activity === "nocturnal").length;
            const cues: ArkCue[] = [
                {kind: "hook", text: "WATCH THE ARK FALL ASLEEP", from: at("start", 0), to: at("start", 3.2)},
                {kind: "caption", label: "Aboard now", text: `${counts.animals} animals, ${counts.species} species.`, from: at("start", 3.6), to: at("start", 8.2)}
            ];
            if (diurnal) cues.push({kind: "caption", text: `${diurnal} of them are day animals. At night they sleep.`, from: at("start", 8.6), to: at("start", 12.8)});
            cues.push(nocturnal
                ? {kind: "caption", text: nocturnal === 1 ? "One night animal wakes up." : `${nocturnal} night animals wake up.`, from: at("start", 13.2), to: at("end", 0)}
                : {kind: "caption", text: ARK_HOW_LINE, from: at("start", 13.2), to: at("end", 0)});
            cues.push(endCue());
            return {
                ...base,
                slug: sample(`day-to-night-${today}`),
                title: "Day turns to night on the AnimalDex Ark",
                hookText: "WATCH THE ARK FALL ASLEEP",
                direction: direction({hours: {from: 16.2, to: 22.6}, lead: 17.4}),
                cues,
                subject: null
            };
        }
        case "flyover": {
            const habitats = snapshot.zones.filter((zone) => zone.animals > 0).length || new Set(animals.map((animal) => animal.zone)).size;
            const newest = newestArrival(snapshot);
            const hook = `${counts.animals} ANIMALS. ONE ARK.`;
            const cues: ArkCue[] = [
                {kind: "hook", text: hook, from: at("start", 0), to: at("start", 3.4)},
                {kind: "caption", text: `${counts.species} species so far, across ${habitats} habitats.`, from: at("start", 3.8), to: at("start", 9.2)},
                {kind: "caption", text: ARK_HOW_LINE, from: at("start", 9.6), to: at("start", 15.2)}
            ];
            if (newest) cues.push({kind: "caption", label: "Newest aboard", text: `${capitalised(withArticle(newest.name))}.`, from: at("start", 15.6), to: at("end", 0)});
            cues.push(endCue());
            return {
                ...base,
                slug: sample(`flyover-${today}`),
                title: `Fly over the AnimalDex Ark: ${counts.animals} animals, ${counts.species} species`,
                hookText: hook,
                direction: direction({hours: {from: 17.0, to: 17.4}, lead: 21.4}),
                cues,
                subject: null
            };
        }
        case "arrival": {
            const animal = newestArrival(snapshot);
            if (!animal) throw new ArkShotUnavailable("No animal has come aboard yet");
            const fresh = input.now.getTime() - Date.parse(animal.arrived_at) < 2 * 86_400_000;
            const hook = fresh ? "A NEW ANIMAL JUST CAME ABOARD" : "THE NEWEST ARRIVAL ON THE ARK";
            const act: ArkAct = {kind: "arrival", at: animal.arrived_at, animal: {
                id: animal.id,
                species_profile_id: animal.species_profile_id,
                name: animal.name,
                model_slug: animal.model_slug,
                zone: animal.zone,
                arrived_at: animal.arrived_at,
                origin: animal.origin ?? null,
                generation: animal.generation ?? null,
                slot: animal.slot ?? null,
                slot_rank: animal.slot_rank ?? null,
                activity: animal.activity ?? null,
                sociality: animal.sociality ?? null,
                status: "present"
            }};
            return {
                ...base,
                slug: sample(`arrival-${slugify(animal.name)}-${day(animal.arrived_at)}`),
                title: `${capitalised(withArticle(animal.name))} comes aboard the AnimalDex Ark`,
                hookText: hook,
                direction: direction({hours: {from: hoursFor(animal), to: hoursFor(animal)}, lead: 3.0, linger: 6.0, subject: animal.id, act, preload: [animal.model_slug]}),
                cues: [
                    {kind: "hook", text: hook, from: at("start", 0), to: at("act", 0.2)},
                    {kind: "caption", text: `${capitalised(withArticle(animal.name))} came aboard on ${longDate(animal.arrived_at)}.`, from: at("act", 0.4), to: at("actEnd", 2.4)},
                    {kind: "caption", text: ARK_HOW_LINE, from: at("actEnd", 2.7), to: at("end", 0)},
                    endCue()
                ],
                subject: subjectOf(animal)
            };
        }
        case "meal_chase": {
            const meal = newestMeal(input.events);
            if (!meal) throw new ArkShotUnavailable("The event log has no meal to replay");
            const hook = `${meal.predator.name} vs ${meal.prey.name}`.toUpperCase();
            const cues: ArkCue[] = [
                {kind: "hook", text: hook, from: at("start", 0), to: at("act", 0.6)},
                {kind: "caption", text: "Every meal on the Ark follows the hunter's stored diet.", from: at("act", 0.8), to: at("actEnd", 0)}
            ];
            if (meal.phrase) cues.push({kind: "caption", label: `The ${meal.predator.name}'s diet`, text: `“${meal.phrase}”`, from: at("actEnd", 0.3), to: at("end", 0)});
            else cues.push({kind: "caption", text: ARK_HOW_LINE, from: at("actEnd", 0.3), to: at("end", 0)});
            cues.push(endCue());
            const predator = animals.find((animal) => animal.id === meal.predator.id) ?? null;
            return {
                ...base,
                slug: sample(`meal-chase-${slugify(meal.predator.name)}-${slugify(meal.prey.name)}-${day(meal.at)}`),
                title: `${meal.predator.name} vs ${meal.prey.name}: a meal on the AnimalDex Ark`,
                hookText: hook,
                direction: direction({hours: {from: 11, to: 11}, lead: 2.6, linger: 4.5, subject: meal.predator.id, act: meal, preload: [meal.predator.model_slug, meal.prey.model_slug]}),
                cues,
                subject: predator ? subjectOf(predator) : {id: meal.predator.id, name: meal.predator.name, speciesProfileId: meal.predator.species_profile_id, modelSlug: meal.predator.model_slug}
            };
        }
        case "follow": {
            const animal = pickArkSubject(snapshot, "follow", input.species);
            if (!animal) throw new ArkShotUnavailable(input.species ? `No ${input.species} is aboard` : "Nobody to follow");
            const kin = sameSpecies(animals, animal).length;
            const hook = `FOLLOW ONE ${animal.name.toUpperCase()}`;
            const cues: ArkCue[] = [
                {kind: "hook", text: hook, from: at("start", 0), to: at("start", 3.2)},
                {kind: "caption", text: aboardLine(kin), from: at("start", 3.6), to: at("start", 8.0)},
                {kind: "caption", text: `It lives in the Ark's ${ZONE_NAMES[animal.zone]}.`, from: at("start", 8.4), to: at("start", 12.6)}
            ];
            const habit = activityLine(animal);
            if (habit) cues.push({kind: "caption", text: habit, from: at("start", 13.0), to: at("end", 0)});
            cues.push(endCue());
            return {
                ...base,
                slug: sample(`follow-${slugify(animal.name)}-${today}`),
                title: `Follow ${withArticle(animal.name)} around the AnimalDex Ark`,
                hookText: hook,
                direction: direction({hours: {from: hoursFor(animal), to: hoursFor(animal) + 0.4}, lead: 15.4, subject: animal.id, preload: [animal.model_slug]}),
                cues,
                subject: subjectOf(animal)
            };
        }
        case "seabird_dive":
        case "whale_surface":
        case "owl_swoop":
        case "primate_drop": {
            // A cross-layer moment: cosmetic, acted out by the scene; the captions are the live counts and the zone only.
            const wanted = input.species ? animals.filter((animal) => matchesSpecies(animal, input.species!) && canMoment(kind, animal.model_slug, animal.zone)) : null;
            const animal = wanted ? wanted[0] ?? null : momentSubject(snapshot, kind);
            if (!animal) throw new ArkShotUnavailable(`Nobody aboard can act out "${ARK_SHOT_LABELS[kind]}"`);
            const hook = MOMENT_HOOKS[kind](animal.name);
            const lead = 3.2;
            const linger = Math.max(MOMENT_SECONDS[kind] + 1.5, MIN_CLIP_SECONDS - lead - END_SECONDS);
            return {
                ...base,
                slug: sample(`${kind.replace(/_/g, "-")}-${slugify(animal.name)}-${today}`),
                title: `${capitalised(withArticle(animal.name))} on the AnimalDex Ark: ${ARK_SHOT_LABELS[kind].toLowerCase()}`,
                hookText: hook,
                direction: direction({hours: {from: hoursFor(animal), to: hoursFor(animal) + 0.2}, lead, linger, subject: animal.id, preload: [animal.model_slug]}),
                cues: [
                    {kind: "hook", text: hook, from: at("start", 0), to: at("start", 3.2)},
                    {kind: "caption", text: aboardLine(sameSpecies(animals, animal).length), from: at("start", 3.6), to: at("start", 7.8)},
                    {kind: "caption", text: `It lives in the Ark's ${ZONE_NAMES[animal.zone]}.`, from: at("start", 8.2), to: at("start", 12.0)},
                    {kind: "caption", text: ARK_HOW_LINE, from: at("start", 12.4), to: at("end", 0)},
                    endCue()
                ],
                subject: subjectOf(animal)
            };
        }
        case "meet": {
            const animal = pickArkSubject(snapshot, "meet", input.species);
            if (!animal) throw new ArkShotUnavailable(input.species ? `No ${input.species} is aboard` : "Nobody to meet");
            const facts = pickArkFacts(input.fieldGuide ?? null, 3);
            if (facts.length < 2) throw new ArkShotUnavailable(`The ${animal.name} has fewer than two stored field-guide facts that fit`);
            const hook = `MEET THE ${animal.name.toUpperCase()}`;
            const per = 4.4;
            const cues: ArkCue[] = [{kind: "hook", text: hook, from: at("start", 0), to: at("start", 3.2)}];
            facts.forEach((fact, index) => {
                cues.push({kind: "caption", label: fact.label, text: fact.text, from: at("start", 3.4 + index * per), to: at("start", 3.4 + (index + 1) * per - 0.3)});
            });
            const countFrom = 3.4 + facts.length * per;
            cues.push({kind: "caption", text: aboardLine(sameSpecies(animals, animal).length), from: at("start", countFrom), to: at("end", 0)});
            cues.push(endCue());
            return {
                ...base,
                facts,
                slug: sample(`meet-${slugify(animal.name)}`),
                title: `Meet the ${animal.name} on the AnimalDex Ark`,
                hookText: hook,
                direction: direction({hours: {from: hoursFor(animal), to: hoursFor(animal) + 0.3}, lead: countFrom + 3.0, subject: animal.id, preload: [animal.model_slug]}),
                cues,
                subject: subjectOf(animal)
            };
        }
    }
}

/** Seconds of a cue's edge, from the director's marks. */
export function cueTime(edge: ArkCue["from"], marks: ArkMarks): number {
    return Math.min(Math.max(marks[edge.mark] + edge.offset, 0), marks.total);
}

/** The cues placed in time (overlapping or empty ones dropped). */
export function placeCues(cues: ArkCue[], marks: ArkMarks): Array<ArkCue & {start: number; stop: number}> {
    return cues
        .map((cue) => ({...cue, start: cueTime(cue.from, marks), stop: cueTime(cue.to, marks)}))
        .filter((cue) => cue.stop - cue.start >= 0.4);
}
