/**
 * The collisions' layer in a scene (motion pass L5): each scheduled animal's pose, as its schedule (and recipe and
 * liveliness) give it, made to stand clear of anything solid and eased off its neighbours (`resolve.ts`).
 *
 * Its neighbours' poses are theirs at the same moment, worked out from their own schedules (pure), never what this
 * viewer happened to draw last: who is near is found from where each was last worked out, widened by how far it could
 * have gone since, so every animal that touches it now is found. Touching animals are eased apart as one cluster (all
 * that touch, transitively), so the answer is the same for every viewer, whatever each has drawn and when. The push
 * apart is worked out at the shared clock's SEPARATION_EASE moments and eased between them (decision 204: it never
 * jumps); out of anything solid is exact at every moment.
 */

import type {ColliderSet} from "@/ark-scene/collide/colliders";
import {clipMove, inContact, pushOut, separateCluster, separationMoments, SEPARATION_EASE, type ResolveBody, type ResolvePose} from "@/ark-scene/collide/resolve";

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

/** The same surface points (each point's place, reach and host); none, null and an empty list are the same to `pushOut`. */
function sameAttached(a: ResolvePose["attached"], b: ResolvePose["attached"]): boolean {
    const n = a?.length ?? 0;
    if (n !== (b?.length ?? 0)) return false;
    for (let i = 0; i < n; i++) if (a![i].x !== b![i].x || a![i].z !== b![i].z || a![i].r !== b![i].r || a![i].host !== b![i].host) return false;
    return true;
}
/** The most the search widens for how far a neighbour could have gone since it was last placed (m). */
const MOST_TRAVEL = 30;
/** How long a laid grid serves (s): every entry is listed as far as it could go by then. */
const GRID_HOLD = 0.3;
const key = (i: number, j: number) => (i + 32768) * 65536 + (j + 32768);

export class CollideLayer<E> {
    private epoch = Number.NaN;
    private readonly grid = new Map<number, E[]>();
    /** Poses out of anything solid, by moment (now, and the two easing moments round it). */
    private readonly placedBy = new Map<number, Map<E, ResolvePose | null>>();
    /** The push apart at an easing moment, by moment (everyone's in a cluster worked out at once). */
    private readonly pushBy = new Map<number, Map<E, {dx: number; dz: number}>>();
    private readonly resolvedNow = new Map<E, {x: number; z: number}>();
    private readonly bodies = new Map<E, ResolveBody>();
    /**
     * Each one's last way out of anything solid, with what it was worked out from (mobile performance lane): `pushOut`
     * is a pure function of the colliders, the body and the pose's place, height, heading, surface points and hold, so
     * the same inputs give the same answer. One at rest (most of the island, most of the time) asks again every moment
     * with the very same pose; a wedged one's ring search (thousands of probes) ran again each time. Kept per animal
     * (weakly: an animal gone from the Ark takes its entry with it).
     */
    private outMemo = new WeakMap<object, {set: ColliderSet; body: ResolveBody; x: number; z: number; y: number; yaw: number; fixed: boolean | undefined; attached: ResolvePose["attached"]; out: {x: number; z: number; moved: number}}>();
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
        this.placedBy.clear();
        this.pushBy.clear();
        this.resolvedNow.clear();
        this.outMemo = new WeakMap();
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
        this.resolvedNow.clear();
        // (Kept: the two easing moments round now; anything else was another frame's.)
        const {q0, q1} = separationMoments(epoch);
        for (const k of Array.from(this.placedBy.keys())) if (k !== q0 && k !== q1) this.placedBy.delete(k);
        for (const k of Array.from(this.pushBy.keys())) if (k !== q0 && k !== q1) this.pushBy.delete(k);
        if (!(epoch >= this.gridEpoch && epoch <= this.gridEpoch + GRID_HOLD)) {
            this.gridEpoch = epoch;
            this.grid.clear();
            for (const e of this.hooks.everyone()) {
                const last = this.hooks.last(e);
                if (!last) continue;
                const body = this.bodyOf(e);
                // (And as far as it could go to either easing moment round now, which are at most SEPARATION_EASE away.)
                const r = body.half + body.radius + Math.min(this.speedOf(e) * (Math.abs(epoch - last.at) + GRID_HOLD + SEPARATION_EASE), MOST_TRAVEL) + 0.05;
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

    /** Its pose at a moment out of anything solid (worked out once a moment). */
    private placed(e: E, epoch: number, base?: ResolvePose | null): ResolvePose | null {
        let placedNow = this.placedBy.get(epoch);
        if (!placedNow) this.placedBy.set(epoch, (placedNow = new Map()));
        if (placedNow.has(e)) return placedNow.get(e)!;
        const pose = base === undefined ? this.hooks.base(e, epoch) : base;
        const set = this.hooks.colliders();
        let out: ResolvePose | null = pose;
        if (pose && set) {
            const moved = this.pushOutOnce(e, set, pose);
            if (moved.moved > 0) {
                this.pushed++;
                out = {...pose, x: moved.x, z: moved.z};
            }
        }
        placedNow.set(e, out);
        return out;
    }

    /** `pushOut`, or its last answer when nothing it reads has changed (exactly the same answer: see `outMemo`). */
    private pushOutOnce(e: E, set: ColliderSet, pose: ResolvePose): {x: number; z: number; moved: number} {
        const body = this.bodyOf(e);
        const memo = this.outMemo.get(e as object);
        if (memo && memo.set === set && memo.body === body && memo.x === pose.x && memo.z === pose.z && memo.y === pose.y && memo.yaw === pose.yaw && memo.fixed === pose.fixed && sameAttached(memo.attached, pose.attached)) return memo.out;
        const out = pushOut(set, body, pose);
        this.outMemo.set(e as object, {set, body, x: pose.x, z: pose.z, y: pose.y, yaw: pose.yaw, fixed: pose.fixed, attached: pose.attached ? pose.attached.map((q) => ({...q})) : pose.attached, out});
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

    /**
     * Its push apart at an easing moment: its cluster then (everyone touching it, and everyone touching them, at their
     * poses then) eased apart, each member's push the way it moved (worked out once a moment for the whole cluster).
     */
    private pushAt(e: E, q: number): {dx: number; dz: number} {
        let pushes = this.pushBy.get(q);
        if (!pushes) this.pushBy.set(q, (pushes = new Map()));
        const known = pushes.get(e);
        if (known) return known;
        const set = this.hooks.colliders();
        const self = this.placed(e, q);
        const none = {dx: 0, dz: 0};
        if (!self || !set) {
            pushes.set(e, none);
            return none;
        }
        const members: E[] = [e];
        const seen = new Set<E>(members);
        for (let k = 0; k < members.length && members.length < 400; k++) {
            const pose = this.placed(members[k], q)!;
            for (const other of this.touching(members[k], pose, q)) {
                if (seen.has(other)) continue;
                seen.add(other);
                members.push(other);
            }
        }
        if (members.length < 2) {
            pushes.set(e, none);
            return none;
        }
        this.clusters++;
        const poses = members.map((m) => this.placed(m, q)!);
        const at = separateCluster(set, members.map((m, k) => ({body: this.bodyOf(m), pose: poses[k]})));
        members.forEach((m, k) => pushes!.set(m, {dx: at[k].x - poses[k].x, dz: at[k].z - poses[k].z}));
        return pushes.get(e)!;
    }

    /**
     * Its pose now with the collisions: `base` is its pose before them (the schedule's, as `hooks.base` would give it).
     * Out of anything solid, exactly, now; then its push apart, eased between the two easing moments round now, as far as
     * it goes without touching anything solid (sliding along what stops it).
     */
    apply(e: E, epoch: number, base: ResolvePose): {x: number; z: number} {
        const set = this.hooks.colliders();
        if (!set) return {x: base.x, z: base.z};
        const started = typeof performance !== "undefined" ? performance.now() : 0;
        this.begin(epoch);
        const done = this.resolvedNow.get(e);
        if (done) return done;
        const self = this.placed(e, epoch, base)!;
        const {q0, q1, s} = separationMoments(epoch);
        const a = this.pushAt(e, q0);
        const b = this.pushAt(e, q1);
        const dx = a.dx + (b.dx - a.dx) * s;
        const dz = a.dz + (b.dz - a.dz) * s;
        let out = {x: self.x, z: self.z};
        if (Math.abs(dx) > 1e-6 || Math.abs(dz) > 1e-6) {
            out = clipMove(set, this.bodyOf(e), self, {x: self.x + dx, z: self.z + dz}, self);
            if (out.x !== self.x || out.z !== self.z) this.eased++;
        }
        this.resolvedNow.set(e, out);
        if (started) this.spentMs += performance.now() - started;
        return out;
    }
}
