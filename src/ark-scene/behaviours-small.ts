/**
 * The behaviours harness's scenes for the small bodies (signature behaviours, wave 2, `recipe-small.ts`; development
 * only, read by `behaviours-entry.ts`): each is a cast of one species (two or more where a recipe is a pair's) placed in
 * its own zone at a pinned hour, and the finder of the moments its recipe is on screen, from the engine's own pure
 * functions (a world built as the scene's, the scene's wired animals), as `recipes-entry.ts` finds a kingfisher's dive.
 * `scripts/ark-behaviours-clips.mjs --scenes sm-ant,sm-dance…` takes its frames at those moments.
 */

import type {ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {pairWindows, sexLook} from "@/ark-scene/behaviour-recipes";
import {flowerSpot, microActWindows, soilSpot} from "@/ark-scene/micro-acts";
import {poseOnTrip, scheduleWorld, SLOT_SECONDS, tripAt, tripEpisode, type ScheduleAnimal, type Trip} from "@/ark-scene/behaviour-schedule";
import {worldSampler} from "@/ark-scene/world-sampler";

export type SmallScene = {zone: string; hours: number; cast: Array<{slug: string; name: string; n: number; young?: number; slot?: number; activity?: string}>; kind: "recipe"; recipe: string; /** Camera: body lengths from the animal, and the polar angle. */ lengths: number; polar?: number};

/** (The activity "any": the pictures are taken in daylight whatever the kind's own hours are; the hornet's, which is about the lamp after dark, is at night.) */
const one = (slug: string, name: string, n: number, activity: string, slot?: number) => [{slug, name, n, activity, ...(slot === undefined ? {} : {slot})}];

/** One scene per recipe the small bodies' wave adds (the first cast's species acts). */
export const SMALL_SCENES: Record<string, SmallScene> = {
    // Neighbouring majors box at a border.
    "sm-ant": {zone: "woodland", hours: 11, kind: "recipe", recipe: "border_spar", polar: 0.85, lengths: 5, cast: one("carpenter-ant", "Carpenter Ant", 6, "any")},
    // A hornet hawking after dark.
    "sm-hornet": {zone: "woodland", hours: 22, kind: "recipe", recipe: "night_hawk", polar: 0.85, lengths: 10, cast: one("european-hornet", "European Hornet", 3, "any")},
    // A mangrove crab defending its burrow's mouth with raised claws.
    "sm-claws": {zone: "wetland", hours: 11, kind: "recipe", recipe: "claw_spar", polar: 0.85, lengths: 5, cast: one("mangrove-crab", "Mangrove Crab", 4, "any")},
    // A jumping spider's courting dance.
    "sm-dance": {zone: "farm_garden", hours: 11, kind: "recipe", recipe: "spider_dance", polar: 1.45, lengths: 7, cast: one("pantropical-jumping-spider", "Pantropical Jumping Spider", 8, "any")},
    "sm-dance2": {zone: "woodland", hours: 11, kind: "recipe", recipe: "spider_dance", polar: 1.45, lengths: 7, cast: one("peterss-jumping-spider", "Peters's Jumping Spider", 8, "any")},
    // Digs (a cricket and a crab at their spots in the leaf litter; a mud crab's bank is the schedule's).
    "sm-dig-cricket": {zone: "grassland", hours: 11, kind: "recipe", recipe: "molehills", polar: 0.7, lengths: 30, cast: one("southern-mole-cricket", "Southern Mole Cricket", 3, "any")},
    "sm-dig-vampire": {zone: "seashore", hours: 11, kind: "recipe", recipe: "dig_burrow", polar: 0.85, lengths: 5, cast: one("vampire-crab", "Vampire Crab", 3, "any")},
    "sm-bank-mud": {zone: "wetland", hours: 11, kind: "recipe", recipe: "bank_burrow", polar: 0.85, lengths: 4, cast: one("giant-mud-crab", "Giant Mud Crab", 3, "any")},
    // Hawkmoths and flies hanging at a flower; a frog, a toad, a mantis sitting and waiting.
    "sm-moth": {zone: "rainforest", hours: 11, kind: "recipe", recipe: "flower_hover", polar: 1.25, lengths: 4, cast: one("coffee-hawk-moth", "Coffee hawk-moth", 2, "any", 9)},
    "sm-frog": {zone: "river_lake", hours: 11, kind: "recipe", recipe: "edge_ambush", polar: 0.85, lengths: 4, cast: one("american-bullfrog", "American Bullfrog", 4, "any")},
    // SIG3 tranche 4: a large pair's wrestle beside the frogs', for the meet's spacing (a body length between the two).
    "sm-kuduwrestle": {zone: "grassland", hours: 11, kind: "recipe", recipe: "wrestle", polar: 1.0, lengths: 4, cast: one("greater-kudu", "Greater Kudu", 8, "any")},
    "sm-frogwrestle": {zone: "river_lake", hours: 11, kind: "recipe", recipe: "wrestle", polar: 0.85, lengths: 5, cast: one("american-bullfrog", "American Bullfrog", 8, "any")},
    "sm-toad": {zone: "farm_garden", hours: 11, kind: "recipe", recipe: "sit_snap", polar: 0.85, lengths: 4, cast: one("american-toad", "American Toad", 4, "any")},
    "sm-mantis": {zone: "farm_garden", hours: 11, kind: "recipe", recipe: "sit_snap", polar: 0.85, lengths: 4, cast: one("chinese-mantis", "Chinese Mantis", 4, "any")},
    // The beetle that wrestles (the generic wrestle, with its own sentence).
    "sm-dance3": {zone: "rainforest", hours: 11, kind: "recipe", recipe: "spider_dance", polar: 0.85, lengths: 7, cast: one("two-striped-telamonia", "Two-striped Telamonia", 8, "any")},
    "sm-spider": {zone: "farm_garden", hours: 11, kind: "recipe", recipe: "sit_snap", polar: 0.85, lengths: 4, cast: one("giant-house-spider", "Giant House Spider", 4, "any")},
    "sm-stag": {zone: "woodland", hours: 11, kind: "recipe", recipe: "wrestle", polar: 0.85, lengths: 5, cast: one("golden-stag-beetle", "Golden Stag Beetle", 8, "any")}
};

type Entry = {animal: {id: string; model_slug: string; activity: ArkBehaviourProfile["activity"] | null}; sched?: {animal: ScheduleAnimal; profile: ArkBehaviourProfile} | null; trueLength?: number; place?: {leader?: string; rank?: number; micro?: {spot: string; surface: string; attach?: {tag?: string} | null} | null}};
export type SmallMoment = {id: string; other: string | null; recipe: string; start: number; end: number; /** The recipe's blocks in order, with their times (world seconds). */ blocks: Array<{block: string; t0: number; t1: number}>};

/**
 * The moments of a recipe in the day from `from` for the animals of the cast's first species: a stay's own episode keys,
 * a pair's meeting read off its pose each half second (the pair's windows are pure; the pose is the scene's own).
 */
export function smallMoments(entries: Entry[], recipe: string, template: {kind: string}, from: number, hours: number, limit = 6): SmallMoment[] {
    // A hornet round the lamp after dark: the micro moths' way (`toLight`), not a window: a stretch of the night from the start.
    // A burrower's mounds (`molehillsOf`: off the schedule, no window): its first ten minutes and what they have left.
    if (recipe === "molehills") return entries.slice(0, 1).map((e) => ({id: e.animal.id, other: null, recipe, start: from + 700, end: from + 760, blocks: [{block: "mounds", t0: from + 700, t1: from + 760}]}));
    if (recipe === "night_hawk") return entries.slice(0, 1).map((e) => ({id: e.animal.id, other: null, recipe, start: from + 20, end: from + 60, blocks: [{block: "toLight", t0: from + 20, t1: from + 60}]}));
    const world = scheduleWorld(worldSampler());
    const hoursAt = () => hours;
    const out: SmallMoment[] = [];
    // A micro animal (`micro-acts.ts`: off the schedule): its in-place windows, a pair's with the other of its cluster.
    const micro = entries.filter((e) => e.place?.micro);
    for (const e of micro) {
        const lead = e.place!.leader ?? e.animal.id;
        const want = (e.place!.rank ?? 0) ^ 1;
        const other = micro.find((o) => o !== e && o.animal.model_slug === e.animal.model_slug && (o.place!.leader ?? o.animal.id) === lead && (o.place!.rank ?? 0) === want);
        const key = other ? [e.animal.id, other.animal.id].sort() : null;
        const pair = other && key ? {key: `${key[0]}#${key[1]}`, role: (e.animal.id === key[0] ? "a" : "b") as "a" | "b", otherMale: sexLook(other.animal.id, other.animal.model_slug).sex === "male"} : null;
        for (const w of microActWindows(e.animal.id, e.animal.model_slug, from, from + 12 * 3600, hours, e.trueLength ?? 0.05, {soil: soilSpot(e.place!.micro!.spot), flower: flowerSpot(e.place!.micro!.attach?.tag)}, pair)) {
            if (w.recipe === recipe) out.push({id: e.animal.id, other: pair && (w.blocks.some((b) => b.block === "fight" || b.block === "front_box" || b.block === "claw_shove" || b.block === "display" || b.block === "rear")) ? other!.animal.id : null, recipe, start: w.start, end: w.end, blocks: w.blocks});
        }
    }
    for (const e of entries) {
        if (!e.sched) continue;
        const {animal, profile} = e.sched;
        const activity = e.animal.activity;
        if (template.kind === "pair") {
            for (const w of pairWindows(animal, e.animal.model_slug, from, from + 10 * 3600)) {
                if (w.template !== recipe) continue;
                const blocks: SmallMoment["blocks"] = [];
                for (let t = w.start; t < w.end; t += 0.5) {
                    const act = poseOnTrip(world, tripAt(world, profile, animal, t, hoursAt, activity), t).act;
                    if (act?.recipe !== recipe) continue;
                    const last = blocks[blocks.length - 1];
                    if (last && last.block === act.block && t - last.t1 < 0.75) last.t1 = t + 0.5;
                    else blocks.push({block: act.block, t0: t, t1: t + 0.5});
                }
                if (blocks.length) out.push({id: animal.id, other: w.other, recipe, start: blocks[0].t0, end: blocks[blocks.length - 1].t1, blocks});
            }
        } else {
            let previous: Trip | null = null;
            for (let t = from; t < from + 12 * 3600 && out.length < 200; t += SLOT_SECONDS) {
                const trip: Trip = tripAt(world, profile, animal, t, hoursAt, activity, previous);
                previous = trip;
                if (trip.recipe !== recipe) continue;
                const ep = tripEpisode(world, trip);
                if (!ep) continue;
                out.push({id: animal.id, other: null, recipe, start: ep.t0, end: ep.t1, blocks: ep.keys.map((k) => ({block: k.block.id, t0: k.t0, t1: k.t1}))});
            }
        }
    }
    return out.sort((a, b) => a.start - b.start).slice(0, Math.max(limit, 1) * 20);
}
