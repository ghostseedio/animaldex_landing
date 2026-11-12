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
 */
import {ARK_DAY_MS, STEPS_PER_ARK_DAY, awakeAt, decodeAtlas, forayAt, homeOf, stepIndex, type Atlas, type Home} from "@/ark-scene/positions/positions";
import type {ArkDoing, TripPose} from "@/ark-scene/behaviour-schedule";
import type {ArkAnimal} from "@/ark-scene/types";
import type {ArkHunting} from "@/lib/ark-hunting";
import pin from "@/ark-scene/positions/PIN.json";

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

type State = {startedAtMs: number; from: Map<string, number>; atlas: Atlas};
type Leg = {k: number; a: {x: number; z: number}; b: {x: number; z: number}; on0: boolean; on1: boolean};

const ease = (u: number) => u * u * (3 - 2 * u);

export class HuntingLayer {
    private state: State | null = null;
    private homes = new Map<string, Home | null>();
    private legs = new Map<string, Leg>();

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
            return;
        }
        if (this.state && this.state.atlas !== atlas) this.homes.clear();
        this.state = {startedAtMs: start, from: hunting.predators, atlas};
        this.legs.clear();
    }

    /** Animals whose home is worked out again (a new snapshot moved its slot). */
    forget(id: string): void {
        this.homes.delete(id);
        this.legs.delete(id);
    }

    private home(animal: ArkAnimal): Home | null {
        const st = this.state!;
        let h = this.homes.get(animal.id);
        if (h !== undefined) return h;
        h = typeof animal.slot === "number" && animal.species_profile_id
            ? homeOf(st.atlas, {zone: animal.zone, slug: animal.model_slug, speciesId: animal.species_profile_id, slot: animal.slot, rank: animal.slot_rank ?? 0})
            : null;
        this.homes.set(animal.id, h);
        return h;
    }

    /** Is it hunting at step k: its next hunt has come and it is awake (the module's sleep, its stored activity first). */
    private on(animal: ArkAnimal, home: Home, from: number, k: number): boolean {
        const day = k / STEPS_PER_ARK_DAY;
        return day >= from && awakeAt(animal.activity ?? home.sheet.activity ?? null, this.state!.startedAtMs, day, 0);
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
            leg = {k, a: forayAt(st.atlas, home, animal.id, k), b: forayAt(st.atlas, home, animal.id, k + 1), on0: this.on(animal, home, from, k), on1: this.on(animal, home, from, k + 1)};
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
        const walk = at({x: leg.a.x + (leg.b.x - leg.a.x) * u, z: leg.a.z + (leg.b.z - leg.a.z) * u}, leg.b);
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
