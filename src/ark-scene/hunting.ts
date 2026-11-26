/**
 * Encounter hunting in the scene (AnimalDex docs/ark/encounter-hunting.md): a due predator walks its forays.
 *
 * Under `hunting = 'encounter'` the server hunts on 15-Ark-minute steps (step k is Ark day k / 96): a predator whose
 * next hunt (`hunt_from_ark_day`, `voyage_hunting_v1`) has come and that is awake is at `forayAt(home, id, k)` at step
 * k, and eats a prey it finds within its detection range there. The scene draws exactly that, from the same shared
 * position module (`positions/positions.ts`): between steps k and k + 1 the hunter walks (flies, swims) from one
 * waypoint to the next, facing its way. At a step where it starts or stops hunting it walks from where its schedule
 * has it to its first waypoint (or back), over that one step, so it never jumps. Everything is a function of the
 * time, its id and what the server sent: the same for every viewer. With no hunting read (the pool, development's
 * fixtures, the visual CI) this layer is off and every animal is exactly as before.
 *
 * Its home here is the module's (the server's) spot for its slot; `spaceHomes` keeps a resting predator's home a safe
 * distance from its prey as before, and applies only while it is not hunting.
 *
 * Hunt geometry (AnimalDex decision 500; the read's `hunt_geometry`): the waypoints follow its way of hunting
 * (`positions.ts` huntForayAt, by its look in `hunt-geometry.json`): a searcher's loop leans towards where its prey lives,
 * an ambusher keeps to one spot. Where each works (its lean) is the engine's, sent with the read a day before it is used,
 * so this draws exactly the server's waypoints. Nothing here finds or catches anything.
 */
import {ARK_DAY_MS, STEPS_PER_ARK_DAY, awakeAt, decodeAtlas, forayAt, homeOf, huntForayAt, huntGeometryOf, leanAt, stepIndex, type Atlas, type Home, type HuntGeometryTable} from "@/ark-scene/positions/positions";
import geometryTable from "@/ark-scene/positions/hunt-geometry.json";
import type {ArkDoing, TripPose} from "@/ark-scene/behaviour-schedule";
import type {ArkAnimal} from "@/ark-scene/types";
import {arkSleepOf} from "@/ark-scene/sleep-hours";
import type {ArkHunting} from "@/lib/ark-hunting";
import pin from "@/ark-scene/positions/PIN.json";
import {searchLeg, searchStyleOf} from "@/ark-scene/hunt-search";
import {ARK_STALK_CUE, arkStalkCouldCue, arkStalkCue, type ArkHuntOdds, type ArkHuntWindow} from "@/lib/ark-eat-soon";

export type HuntPose = TripPose & {doing: ArkDoing};

/**
 * The atlas (1.6 MB) as a static file (`scripts/build-ark-bundle.mjs` copies it to public/ark/), read only when the
 * Ark hunts by encounter: never in the scene's bundle. Versioned by its pinned hash, so a new atlas is never a stale one.
 */
export const POSITIONS_ATLAS_URL = `/ark/positions-atlas.json?v=${pin.sha256["atlas.json"].slice(0, 12)}`;

let atlasLoad: Promise<Atlas> | null = null;

export function loadPositionsAtlas(url = POSITIONS_ATLAS_URL): Promise<Atlas> {
    atlasLoad ??= fetch(url)
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`atlas ${response.status}`))))
        .then((raw) => decodeAtlas(raw))
        .catch((error) => {
            // (Asked again at the next hunting read.)
            atlasLoad = null;
            throw error;
        });
    return atlasLoad;
}

type State = {startedAtMs: number; from: Map<string, number>; odds: Map<string, ArkHuntOdds>; atlas: Atlas; geometry: boolean; leans: Map<string, Array<Array<number | null>>>};

const GEOMETRY = geometryTable as unknown as HuntGeometryTable;

/**
 * How far ahead (Ark days) "hunts again in about X" looks for its first awake step on or after its next hunt: 16 Ark days
 * is about 14.7 real hours, past the longest night (the island's sun follows the real clock; an Ark day is 55 minutes).
 */
const WINDOW_AHEAD_DAYS = 16;
type Leg = {k: number; a: {x: number; z: number}; b: {x: number; z: number}; on0: boolean; on1: boolean};

const ease = (u: number) => u * u * (3 - 2 * u);

export class HuntingLayer {
    private state: State | null = null;
    private homes = new Map<string, Home | null>();
    private legs = new Map<string, Leg>();
    /** EATSOON: the last due window worked out, per animal, by the step it was worked out at (the selected few only). */
    private windows = new Map<string, {k: number; window: ArkHuntWindow}>();

    /** On while the server hunts by encounter and the atlas is in. */
    get active(): boolean {
        return this.state !== null;
    }

    /** The hunting read (or null: off). `startedAtMs` falls back to the snapshot's voyage start. */
    set(hunting: ArkHunting | null, atlas: Atlas | null, fallbackStartMs: number | null): void {
        const start = hunting?.startedAtMs ?? fallbackStartMs;
        if (!hunting || hunting.hunting !== "encounter" || !atlas || start === null || !Number.isFinite(start)) {
            this.state = null;
            this.legs.clear();
            this.windows.clear();
            return;
        }
        if (this.state && this.state.atlas !== atlas) this.homes.clear();
        this.state = {startedAtMs: start, from: hunting.predators, odds: hunting.odds ?? new Map(), atlas, geometry: hunting.geometry === true, leans: hunting.leans ?? new Map()};
        this.windows.clear();
        this.legs.clear();
    }

    /** Animals whose home is worked out again (a new snapshot moved its slot). */
    forget(id: string): void {
        this.homes.delete(id);
        this.windows.delete(id);
        this.legs.delete(id);
    }

    private home(animal: ArkAnimal): Home | null {
        const st = this.state!;
        let h = this.homes.get(animal.id);
        if (h !== undefined) return h;
        // (Islands mode: the atlas is the wild island's; a town animal has no home in it, so it never walks a foray across
        // the strait. The server sends it no next hunt either: the pool feeds it.)
        h = typeof animal.slot === "number" && animal.species_profile_id && animal.island !== "town"
            ? homeOf(st.atlas, {island: animal.island ?? "wild", zone: animal.zone, slug: animal.model_slug, speciesId: animal.species_profile_id, slot: animal.slot, rank: animal.slot_rank ?? 0})
            : null;
        this.homes.set(animal.id, h);
        return h;
    }

    /** Where the server has it at step k: today's foray, or under hunt geometry its way of hunting's, from its lean. */
    private waypoint(animal: ArkAnimal, home: Home, k: number): {x: number; z: number} {
        const st = this.state!;
        if (!st.geometry) return forayAt(st.atlas, home, animal.id, k);
        const geo = huntGeometryOf(GEOMETRY, home.slug);
        return geo ? huntForayAt(st.atlas, home, animal.id, k, null, geo, leanAt(st.leans.get(animal.id), k)) : forayAt(st.atlas, home, animal.id, k);
    }

    /** Is it hunting at step k: its next hunt has come and it is awake (the module's sleep, its stored activity first). */
    private on(animal: ArkAnimal, home: Home, from: number, k: number): boolean {
        const day = k / STEPS_PER_ARK_DAY;
        // (One active at any hour sleeps its own bouts, as the server's awake time has it: `sleep-hours.ts`.)
        return day >= from && awakeAt(animal.activity ?? home.sheet.activity ?? null, this.state!.startedAtMs, day, 0, arkSleepOf(animal));
    }

    /** True when this animal is walking its forays now (the tap card, the audit). */
    hunting(animal: ArkAnimal, epochSeconds: number): boolean {
        const st = this.state;
        const from = st?.from.get(animal.id);
        if (!st || from === undefined) return false;
        const home = this.home(animal);
        if (!home) return false;
        const k = stepIndex((epochSeconds * 1000 - st.startedAtMs) / ARK_DAY_MS);
        return this.on(animal, home, from, k) || this.on(animal, home, from, k + 1);
    }

    /** When its forays began (epoch s; the newest hunt under way is the marker's), or null when it is not hunting now. */
    since(animal: ArkAnimal, epochSeconds: number): number | null {
        const st = this.state;
        const from = st?.from.get(animal.id);
        if (!st || from === undefined) return null;
        const home = this.home(animal);
        if (!home) return null;
        let k = stepIndex((epochSeconds * 1000 - st.startedAtMs) / ARK_DAY_MS);
        if (!this.on(animal, home, from, k)) return null;
        // Back to its first step on (a day at most).
        for (let n = 0; n < STEPS_PER_ARK_DAY && this.on(animal, home, from, k - 1); n++) k--;
        return (st.startedAtMs + (k / STEPS_PER_ARK_DAY) * ARK_DAY_MS) / 1000;
    }

    /**
     * EATSOON: a hunter's due window (`ark-eat-soon.ts`): its awake steps in the next Ark day on or after its next hunt
     * (the server's), and the first such step within a few Ark days. Null when the read names no next hunt for it (not a
     * hunter, the pool, a town animal). At most 16 x 96 `awakeAt` reads (a few hundred microseconds), once per step (15 Ark minutes, about 35 real
     * seconds) per animal asked: the card's selected animal, and the stalking cue's few hunters (`stalkers`).
     */
    window(animal: ArkAnimal, epochSeconds: number): ArkHuntWindow | null {
        const st = this.state;
        const from = st?.from.get(animal.id);
        if (!st || from === undefined) return null;
        const home = this.home(animal);
        if (!home) return null;
        const k = stepIndex((epochSeconds * 1000 - st.startedAtMs) / ARK_DAY_MS);
        const known = this.windows.get(animal.id);
        if (known && known.k === k) return known.window;
        let steps = 0;
        let first: number | null = null;
        for (let j = k + 1; j <= k + WINDOW_AHEAD_DAYS * STEPS_PER_ARK_DAY; j++) {
            if (j > k + STEPS_PER_ARK_DAY && first !== null) break;
            if (j / STEPS_PER_ARK_DAY < from) {
                j = Math.max(j, Math.ceil(from * STEPS_PER_ARK_DAY) - 1);
                continue;
            }
            if (!this.on(animal, home, from, j)) continue;
            if (first === null) first = (st.startedAtMs + (j / STEPS_PER_ARK_DAY) * ARK_DAY_MS) / 1000;
            if (j <= k + STEPS_PER_ARK_DAY) steps++;
        }
        const window = {steps, firstAt: first};
        this.windows.set(animal.id, {k, window});
        if (this.windows.size > 64) this.windows.delete(this.windows.keys().next().value as string);
        return window;
    }

    /** EATSOON: the engine's find share and catch chance for a hunter, when the read sends them. */
    odds(id: string): ArkHuntOdds | null {
        return this.state?.odds.get(id) ?? null;
    }

    /**
     * The stalking cue (`ark-eat-soon.ts` arkStalkCue): the hunters out on their forays now whose chance of a catch in the
     * next Ark day is high, by id, with that chance. Only the read's hunters with the engine's two numbers are looked
     * at, and only those whose numbers could reach the cue get a window (cached per step): the scene asks every few seconds.
     */
    stalkers(animalOf: (id: string) => ArkAnimal | null, epochSeconds: number, least = ARK_STALK_CUE): Map<string, number> {
        const out = new Map<string, number>();
        const st = this.state;
        if (!st) return out;
        for (const [id, odds] of Array.from(st.odds)) {
            if (!arkStalkCouldCue(odds, least)) continue;
            const animal = animalOf(id);
            if (!animal) continue;
            const now = this.hunting(animal, epochSeconds);
            const chance = now ? arkStalkCue(odds, this.window(animal, epochSeconds), now, least) : null;
            if (chance !== null) out.set(id, chance);
        }
        return out;
    }

    /** The predators the read names (their ids). */
    predators(): string[] {
        return this.state ? Array.from(this.state.from.keys()) : [];
    }

    /**
     * Its pose now when it hunts (or is on its way into or out of a hunt), else null (its schedule's). `schedule` is its
     * schedule's pose at this moment; `heightAt` the ground's height.
     */
    pose(animal: ArkAnimal, epochSeconds: number, length: number, heightAt: (x: number, z: number) => number, schedule: () => HuntPose): HuntPose | null {
        const st = this.state;
        if (!st) return null;
        const from = st.from.get(animal.id);
        if (from === undefined) return null;
        const home = this.home(animal);
        if (!home) return null;
        const day = (epochSeconds * 1000 - st.startedAtMs) / ARK_DAY_MS;
        const k = stepIndex(day);
        let leg = this.legs.get(animal.id);
        if (!leg || leg.k !== k) {
            leg = {k, a: this.waypoint(animal, home, k), b: this.waypoint(animal, home, k + 1), on0: this.on(animal, home, from, k), on1: this.on(animal, home, from, k + 1)};
            this.legs.set(animal.id, leg);
        }
        if (!leg.on0 && !leg.on1) return null;
        const u = Math.min(Math.max(day * STEPS_PER_ARK_DAY - k, 0), 1);
        const flyer = home.sheet.flies;
        const swimmer = home.sheet.aquatic && !home.sheet.amphibious;
        const at = (p: {x: number; z: number}, toward: {x: number; z: number}): HuntPose => {
            const ground = heightAt(p.x, p.z);
            const dx = toward.x - p.x, dz = toward.z - p.z;
            return {
                x: p.x,
                z: p.z,
                y: flyer ? Math.max(ground, 0) + 2.5 + 1.5 * length : swimmer ? Math.min(-0.2, Math.max(ground + 0.6 * length, ground * 0.5)) : ground,
                yaw: Math.atan2(dx, dz),
                moving: dx * dx + dz * dz > 1e-6,
                aloft: flyer,
                nx: 0,
                ny: 1,
                nz: 0,
                beat: flyer ? "fly" : swimmer ? "swim" : "walk",
                doing: flyer ? "fly" : swimmer ? "swim" : "stalk"
            };
        };
        // Its species' way of searching (`hunt-search.ts`): the same waypoints, reached on the step, walked in its own way.
        const style = leg.on0 && leg.on1 ? searchStyleOf(animal.model_slug) : null;
        const shaped = style ? searchLeg(style, u, `${animal.id}:${k}`, length, flyer) : null;
        const along = shaped ? shaped.u : u;
        const walk = at({x: leg.a.x + (leg.b.x - leg.a.x) * along, z: leg.a.z + (leg.b.z - leg.a.z) * along}, leg.b);
        if (shaped) {
            const dx = leg.b.x - leg.a.x;
            const dz = leg.b.z - leg.a.z;
            const d = Math.hypot(dx, dz);
            if (d > 1e-3 && shaped.side !== 0) {
                // (To the left of the way it goes.)
                walk.x += (-dz / d) * shaped.side;
                walk.z += (dx / d) * shaped.side;
            }
            walk.moving = shaped.moving && d > 1e-3;
            if (!shaped.moving || shaped.beat !== "walk") walk.beat = shaped.beat;
            // (Its card keeps saying what it said: `doing` is the foray's own.)
        }
        if (leg.on0 && leg.on1) return walk;
        // Into a hunt (to its first waypoint) or out of one (back to where its schedule has it), over this one step.
        const sched = schedule();
        const into = leg.on1;
        const w = into ? ease(u) : 1 - ease(u);
        const hunt = into ? at(leg.b, leg.b) : at(leg.a, leg.b);
        const x = sched.x + (hunt.x - sched.x) * w;
        const z = sched.z + (hunt.z - sched.z) * w;
        const dest = into ? hunt : sched;
        const dx = dest.x - x, dz = dest.z - z;
        return {...(w >= 0.5 ? hunt : sched), x, z, y: sched.y + (hunt.y - sched.y) * w, yaw: dx * dx + dz * dz > 1e-4 ? Math.atan2(dx, dz) : dest.yaw, moving: true};
    }
}
