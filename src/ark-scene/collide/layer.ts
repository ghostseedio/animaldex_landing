/**
 * The collisions' layer in a scene (motion pass L5): each scheduled animal's pose, as its schedule (and recipe and
 * liveliness) give it, made to stand clear of anything solid and eased off its neighbours (`resolve.ts`).
 *
 * Its neighbours' poses are theirs at the same moment, worked out from their own schedules (pure), never what this
 * viewer happened to draw last: who is near is found from where each was last worked out, widened by how far it could
 * have gone since, so every animal that touches it now is found. Touching animals are eased apart as one cluster (all
 * that touch, transitively), so the answer is the same for every viewer, whatever each has drawn and when.
 */

import type {ColliderSet} from "@/ark-scene/collide/colliders";
import {inContact, pushOut, separateCluster, type ResolveBody, type ResolvePose} from "@/ark-scene/collide/resolve";

export type CollideHooks<E> = {
    colliders(): ColliderSet | null;
    body(e: E): ResolveBody;
    /** Its pose now before the collisions (pure in the moment), or null when it is not posed by its schedule now. */
    base(e: E, epoch: number): ResolvePose | null;
    /** Everyone on the schedule now (who may be a neighbour). */
    everyone(): readonly E[];
    /** Where it was last worked out, and at what moment (null: not yet). */
    last(e: E): {x: number; z: number; at: number} | null;
    /** The fastest it can go (m/s). */
    speed(e: E): number;
};

const CELL = 4;
/** The most the search widens for how far a neighbour could have gone since it was last placed (m). */
const MOST_TRAVEL = 30;
/** How long a laid grid serves (s): every entry is listed as far as it could go by then. */
const GRID_HOLD = 0.3;
const key = (i: number, j: number) => (i + 32768) * 65536 + (j + 32768);

export class CollideLayer<E> {
    private epoch = Number.NaN;
    private readonly grid = new Map<number, E[]>();
    private readonly placedNow = new Map<E, ResolvePose | null>();
    private readonly resolvedNow = new Map<E, {x: number; z: number}>();
    private readonly bodies = new Map<E, ResolveBody>();
    /** Work (ms), poses moved out of something solid and poses eased apart, since `resetStats`. */
    spentMs = 0;
    eased = 0;
    pushed = 0;
    clusters = 0;

    constructor(private readonly hooks: CollideHooks<E>) {}

    /** Forget bodies (a snapshot changed sizes or groups). */
    reset() {
        this.bodies.clear();
        this.speeds.clear();
        this.gridEpoch = Number.NaN;
        this.placedNow.clear();
        this.resolvedNow.clear();
        this.epoch = Number.NaN;
    }

    resetStats() {
        this.spentMs = 0;
        this.eased = 0;
        this.pushed = 0;
        this.clusters = 0;
    }

    private bodyOf(e: E): ResolveBody {
        let b = this.bodies.get(e);
        if (!b) this.bodies.set(e, (b = this.hooks.body(e)));
        return b;
    }

    /** When the grid was last laid (s), and each entry's top speed (m/s, worked out once). */
    private gridEpoch = Number.NaN;
    private readonly speeds = new Map<E, number>();
    private speedOf(e: E): number {
        let v = this.speeds.get(e);
        if (v === undefined) this.speeds.set(e, (v = this.hooks.speed(e)));
        return v;
    }

    /**
     * A new moment: who is where, roughly. Each is listed in every cell its body could reach until GRID_HOLD from now:
     * round where it was last worked out, as far as its body reaches plus how far it could have gone by then (so a
     * search needs only its own reach). The grid is laid again every GRID_HOLD seconds, not every frame.
     */
    private begin(epoch: number) {
        if (epoch === this.epoch) return;
        this.epoch = epoch;
        this.placedNow.clear();
        this.resolvedNow.clear();
        if (!(epoch >= this.gridEpoch && epoch <= this.gridEpoch + GRID_HOLD)) {
            this.gridEpoch = epoch;
            this.grid.clear();
            for (const e of this.hooks.everyone()) {
                const last = this.hooks.last(e);
                if (!last) continue;
                const body = this.bodyOf(e);
                const r = body.half + body.radius + Math.min(this.speedOf(e) * (Math.abs(epoch - last.at) + GRID_HOLD), MOST_TRAVEL) + 0.05;
                for (let i = Math.floor((last.x - r) / CELL); i <= Math.floor((last.x + r) / CELL); i++) {
                    for (let j = Math.floor((last.z - r) / CELL); j <= Math.floor((last.z + r) / CELL); j++) {
                        const k = key(i, j);
                        const list = this.grid.get(k);
                        if (list) list.push(e);
                        else this.grid.set(k, [e]);
                    }
                }
            }
        }
    }

    /** Its pose now out of anything solid (worked out once a moment). */
    private placed(e: E, epoch: number, base?: ResolvePose | null): ResolvePose | null {
        if (this.placedNow.has(e)) return this.placedNow.get(e)!;
        const pose = base === undefined ? this.hooks.base(e, epoch) : base;
        const set = this.hooks.colliders();
        let out: ResolvePose | null = pose;
        if (pose && set) {
            const moved = pushOut(set, this.bodyOf(e), pose);
            if (moved.moved > 0) {
                this.pushed++;
                out = {...pose, x: moved.x, z: moved.z};
            }
        }
        this.placedNow.set(e, out);
        return out;
    }

    /** Everyone touching it now (their poses out of anything solid). */
    private touching(e: E, self: ResolvePose, epoch: number): E[] {
        const body = this.bodyOf(e);
        const range = body.half + body.radius + 0.05;
        const out: E[] = [];
        const seen = new Set<E>();
        for (let i = Math.floor((self.x - range) / CELL); i <= Math.floor((self.x + range) / CELL); i++) {
            for (let j = Math.floor((self.z - range) / CELL); j <= Math.floor((self.z + range) / CELL); j++) {
                for (const other of this.grid.get(key(i, j)) ?? []) {
                    if (other === e || seen.has(other)) continue;
                    seen.add(other);
                    const last = this.hooks.last(other)!;
                    const ob = this.bodyOf(other);
                    const could = body.half + body.radius + ob.half + ob.radius + Math.min(this.speedOf(other) * Math.abs(epoch - last.at), MOST_TRAVEL) + 0.05;
                    if (Math.abs(last.x - self.x) > could || Math.abs(last.z - self.z) > could) continue;
                    const pose = this.placed(other, epoch);
                    if (pose && inContact(body, self, ob, pose)) out.push(other);
                }
            }
        }
        return out;
    }

    /** Its pose now with the collisions: `base` is its pose before them (the schedule's, as `hooks.base` would give it). */
    apply(e: E, epoch: number, base: ResolvePose): {x: number; z: number} {
        const set = this.hooks.colliders();
        if (!set) return {x: base.x, z: base.z};
        const started = typeof performance !== "undefined" ? performance.now() : 0;
        this.begin(epoch);
        const done = this.resolvedNow.get(e);
        if (done) return done;
        const self = this.placed(e, epoch, base)!;
        // Its cluster: everyone touching it, and everyone touching them.
        const members: E[] = [e];
        const seen = new Set<E>(members);
        for (let k = 0; k < members.length && members.length < 400; k++) {
            const pose = this.placed(members[k], epoch)!;
            for (const other of this.touching(members[k], pose, epoch)) {
                if (seen.has(other)) continue;
                seen.add(other);
                members.push(other);
            }
        }
        let out = {x: self.x, z: self.z};
        if (members.length > 1) {
            this.clusters++;
            const at = separateCluster(set, members.map((m) => ({body: this.bodyOf(m), pose: this.placed(m, epoch)!})));
            members.forEach((m, k) => this.resolvedNow.set(m, at[k]));
            out = at[0];
            if (out.x !== self.x || out.z !== self.z) this.eased++;
        } else this.resolvedNow.set(e, out);
        if (started) this.spentMs += performance.now() - started;
        return out;
    }
}
