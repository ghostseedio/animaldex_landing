/**
 * Mobbing (3.3 batch, lane B; owner 2026-11-16): small birds dive at a hawk, an owl or another predator that is near
 * them, swoop past its head and climb away, several taking turns. Only the species whose own stored text says so
 * (`bird-moves.json` `mob`, from the catalogue's rows: crows, magpies, mynas, bulbuls, gulls at the colony…).
 *
 * The flight is a ring round the predator, above it, every bird on it a share of the circle apart; in its turn a bird
 * leaves the ring for half a turn, spiralling in and down past the predator's head and out and up again on the far
 * side. PURE in the time: the angle always advances at the ring's rate, the dive only draws the radius and the height
 * in, so the path has no corner. It never comes nearer the predator's top than the ring's `gap` (it is always above
 * it), and never below `gap` over the ground under it.
 *
 * Viewer-local and visual only, like the reactive layer (`reactive.ts`): it starts for birds near the camera when one
 * of their predators (the ecology's food links, `canEat`) stands near them, lasts under half a minute and eases each
 * bird back to where the shared schedule has it. It never touches a meal, and the predator is not moved.
 * The scene gives it its entries through a host; this module only says, per frame, which act pose each bird takes.
 */

import type {ActPose} from "@/ark-scene/acts";

export type MobRing = {
    /** The ring's radius round the predator's middle (m), and how near its middle a dive passes (m, level). */
    radius: number;
    pass: number;
    /** The ring's height over the predator's top (m), and the least a dive keeps over it (m). */
    height: number;
    gap: number;
    /** The turn rate (rad/s) and a dive's length (s): half a turn. */
    omega: number;
    dive: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const ease = (u: number) => {
    const c = clamp(u, 0, 1);
    return c * c * (3 - 2 * c);
};

/** The ring for a predator of this drawn size and birds of this drawn length. */
export function mobRing(threat: {length: number; height: number}, birdLength: number): MobRing {
    const body = Math.max(birdLength, 0.08);
    const gap = Math.max(body * 1.5, 0.4);
    const pass = Math.max(threat.length, 0.2) * 0.3 + Math.max(body * 1.5, 0.4);
    const radius = Math.max(threat.length * 1.1, 1.2) + 1.6 + body * 2;
    const height = gap + Math.max(1.8, threat.height * 0.8, body * 5);
    const dive = 2.6;
    return {radius, pass, height, gap, omega: Math.PI / dive, dive};
}

/**
 * Bird `k` of `n`, `s` seconds into the mobbing: its offset from the predator's middle (m, level), its height over the
 * predator's top, and how far through its dive it is (0 on the ring). One bird dives at a time, in turn.
 */
export function mobFlight(ring: MobRing, k: number, n: number, s: number): {x: number; z: number; up: number; diving: number} {
    const turns = Math.max(n, 2);
    const theta = (k / Math.max(n, 1)) * Math.PI * 2 + ring.omega * s;
    const slot = Math.floor(s / ring.dive);
    const u = s >= 0 && slot % turns === k % turns ? s / ring.dive - slot : 0;
    const c = Math.cos(Math.PI * u);
    const out = c * c;
    const r = ring.pass + (ring.radius - ring.pass) * out;
    return {x: Math.sin(theta) * r, z: Math.cos(theta) * r, up: ring.gap + (ring.height - ring.gap) * out, diving: u};
}

/**
 * Whether a species' sentence fits the predator in front of it: a line that names its foe ("an owl", "a bird of prey",
 * "a crow", "a snake"; `bird-moves.json` `foe`) is said only of that kind of animal, the others of any predator.
 */
export function mobFoeFits(foe: string | null | undefined, threatSlug: string, threatPlan: string | null): boolean {
    if (!foe) return true;
    if (foe === "owl") return /(^|-)owl(et)?(-|$)/.test(threatSlug);
    if (foe === "raptor") return /(^|-)(owl|owlet|hawk|eagle|falcon|kite|buzzard|harrier|kestrel|osprey|goshawk|sparrowhawk|caracara|vulture)(-|$)/.test(threatSlug);
    if (foe === "crow") return /(^|-)(crow|raven|drongo)(-|$)/.test(threatSlug);
    if (foe === "snake") return threatPlan === "snake";
    return false;
}

type Ground = (x: number, z: number) => number;
type Spot = {x: number; y: number; z: number};
export type MobCentre = {x: number; z: number; /** The predator's top (m, world). */ top: number};

/** Where bird `k` is at `s` on the ring round a predator (world), never under `gap` over the ground below it. */
export function mobSpot(centre: MobCentre, ring: MobRing, k: number, n: number, s: number, ground: Ground): Spot {
    const f = mobFlight(ring, k, n, s);
    const x = centre.x + f.x;
    const z = centre.z + f.z;
    return {x, z, y: Math.max(centre.top + f.up, ground(x, z) + ring.gap)};
}

/**
 * A standing model in the air lies forward into flight (the scene's own tilt for a bird aloft on its schedule; its
 * shader beats the wings). A rig that flies takes its own flight frame's pitch instead.
 */
export const FLIGHT_TILT = 0.95;

/** A flying pose from where it is now and a moment on: heading and nose along its path, banked into its turn. */
export function flightPose(now: Spot, next: Spot, dt: number, diving: number, bank: number): ActPose {
    const dx = next.x - now.x;
    const dz = next.z - now.z;
    const flat = Math.hypot(dx, dz);
    const speed = Math.hypot(flat, next.y - now.y) / dt;
    return {x: now.x, z: now.z, base: now.y, yaw: Math.atan2(dx, dz), pitch: FLIGHT_TILT + clamp(Math.atan2(now.y - next.y, Math.max(flat, 1e-4)), -0.6, 0.5), roll: bank, scale: 1, dim: 0, hidden: false, state: diving > 0.05 && diving < 0.5 ? "glide" : "fly", speed};
}

export type MobHost<E> = {
    id: (entry: E) => string;
    slug: (entry: E) => string;
    /** Its species mobs (`bird-moves.json`). */
    mobs: (entry: E) => boolean;
    /** Free to start: awake, on its schedule, not acting anything out. */
    free: (entry: E) => boolean;
    /** Where it is drawn now (its feet), or null when it is not drawn (held, hidden). */
    place: (entry: E) => {x: number; y: number; z: number; yaw: number} | null;
    /** Where its day has it now, to go back to. */
    home: (entry: E, epoch: number) => {x: number; y: number; z: number; yaw: number} | null;
    length: (entry: E) => number;
    height: (entry: E) => number;
    /** `threat` is a predator of `bird`, standing or perched where it can be mobbed (not in the air, not in the water). */
    threatens: (threat: E, bird: E) => boolean;
    ground: Ground;
    act: (entry: E) => ActPose | null;
    setAct: (entry: E, pose: ActPose | null, aloft: boolean) => void;
};

/** How near a predator must be to a bird for it to start (m), how far its kin come from, and how many go at most. */
export const MOB_REACH = 16;
export const MOB_KIN_REACH = 30;
export const MOB_BIRDS_MAX = 4;
export const MOB_APPROACH = 3;
export const MOB_SECONDS = 21;
/** A bird that has mobbed leaves it be this long (s). */
export const MOB_REST = 150;
const DT = 0.08;

type Bird<E> = {entry: E; from: Spot; last: ActPose | null; back: {from: Spot; seconds: number} | null; gone: boolean};
type Episode<E> = {key: string; t0: number; threat: E; centre: MobCentre; ring: MobRing; birds: Bird<E>[]; end: number};

export class Mobbing<E> {
    private episodes: Episode<E>[] = [];
    private rested = new Map<string, number>();
    private lookedAt = -Infinity;

    constructor(private readonly host: MobHost<E>) {}

    get active(): boolean {
        return this.episodes.length > 0;
    }

    /** Time to look for a predator near the birds again (once a second). */
    due(epoch: number): boolean {
        return Math.abs(epoch - this.lookedAt) >= 1;
    }

    clear(): void {
        for (const ep of this.episodes) for (const b of ep.birds) if (b.last && this.host.act(b.entry) === b.last) this.host.setAct(b.entry, null, false);
        this.episodes = [];
    }

    /** The birds mobbing now (past their way up), for the live log: one episode key for the whole group. */
    seen(epoch: number): Array<{entry: E; episode: string; threat: E}> {
        const out: Array<{entry: E; episode: string; threat: E}> = [];
        for (const ep of this.episodes) {
            const s = epoch - ep.t0;
            if (s < MOB_APPROACH || s > ep.end) continue;
            for (const b of ep.birds) if (b.last) out.push({entry: b.entry, episode: ep.key, threat: ep.threat});
        }
        return out;
    }

    private look(epoch: number, near: readonly E[]): void {
        const h = this.host;
        if (this.rested.size > 2000) this.rested.clear();
        const taken = new Set<E>();
        for (const ep of this.episodes) {
            taken.add(ep.threat);
            for (const b of ep.birds) taken.add(b.entry);
        }
        const ok = (e: E) => h.mobs(e) && !taken.has(e) && h.free(e) && (this.rested.get(h.id(e)) ?? -Infinity) <= epoch;
        for (const bird of near) {
            if (this.episodes.length >= 2) return;
            if (!ok(bird)) continue;
            const at = h.place(bird);
            if (!at) continue;
            let threat: {entry: E; at: Spot; d: number} | null = null;
            for (const other of near) {
                if (other === bird || taken.has(other) || h.mobs(other) || !h.threatens(other, bird)) continue;
                const p = h.place(other);
                const d = p ? Math.hypot(p.x - at.x, p.z - at.z) : Infinity;
                if (p && d <= MOB_REACH && (!threat || d < threat.d)) threat = {entry: other, at: p, d};
            }
            if (!threat) continue;
            this.begin(epoch, bird, threat.entry, near, taken);
        }
    }

    /** These birds' mobbing of this predator starts now: the bird and its kin near enough (the nearest first, ties by id). */
    begin(epoch: number, bird: E, threat: E, near: readonly E[], taken = new Set<E>(), kinReach = MOB_KIN_REACH): boolean {
        const h = this.host;
        const at = h.place(bird);
        const foe = h.place(threat);
        if (!at || !foe) return false;
        const kin = near
            .filter((e) => e !== bird && h.slug(e) === h.slug(bird) && !taken.has(e) && h.free(e) && (this.rested.get(h.id(e)) ?? -Infinity) <= epoch)
            .map((e) => ({e, p: h.place(e)}))
            .filter((c): c is {e: E; p: {x: number; y: number; z: number; yaw: number}} => c.p !== null && Math.hypot(c.p.x - at.x, c.p.z - at.z) <= kinReach)
            .sort((a, b) => Math.hypot(a.p.x - at.x, a.p.z - at.z) - Math.hypot(b.p.x - at.x, b.p.z - at.z) || (h.id(a.e) < h.id(b.e) ? -1 : 1))
            .slice(0, MOB_BIRDS_MAX - 1);
        const birds: Bird<E>[] = [{entry: bird, from: at, last: null, back: null, gone: false}, ...kin.map((c) => ({entry: c.e, from: c.p as Spot, last: null, back: null, gone: false}))];
        const ring = mobRing({length: h.length(threat), height: h.height(threat)}, h.length(bird));
        this.episodes.push({key: `mob:${h.id(bird)}:${Math.round(epoch)}`, t0: epoch, threat, centre: {x: foe.x, z: foe.z, top: foe.y + h.height(threat)}, ring, birds, end: MOB_APPROACH + MOB_SECONDS});
        taken.add(threat);
        for (const b of birds) {
            taken.add(b.entry);
            this.rested.set(h.id(b.entry), epoch + MOB_REST);
        }
        return true;
    }

    /** A frame: `near` is who is drawn near the camera now. */
    step(epoch: number, near: readonly E[]): void {
        const h = this.host;
        if (this.due(epoch)) {
            this.lookedAt = epoch;
            this.look(epoch, near);
        }
        if (!this.episodes.length) return;
        for (const ep of this.episodes) {
            const s = epoch - ep.t0;
            const n = ep.birds.length;
            // The predator where it is drawn now; gone from view, they break off.
            const at = h.place(ep.threat);
            if (at) ep.centre = {x: at.x, z: at.z, top: at.y + h.height(ep.threat)};
            else ep.end = Math.min(ep.end, Math.max(s, 0));
            let left = 0;
            ep.birds.forEach((b, k) => {
                if (b.gone) return;
                // (Taken by something else since, a meal or a birth of the record: it is theirs.)
                if (h.act(b.entry) !== b.last) {
                    b.last = null;
                    return void this.drop(b);
                }
                if (s < 0) {
                    // (The clock set back to before it began: it waits on its schedule.)
                    if (b.last) h.setAct(b.entry, null, false);
                    b.last = null;
                    left++;
                    return;
                }
                const ring = (t: number) => mobSpot(ep.centre, ep.ring, k, n, t, h.ground);
                let spot: (t: number) => Spot;
                if (s < ep.end) {
                    spot = (t) => {
                        const r = ring(t);
                        const m = ease(t / MOB_APPROACH);
                        return {x: b.from.x + (r.x - b.from.x) * m, y: b.from.y + (r.y - b.from.y) * m, z: b.from.z + (r.z - b.from.z) * m};
                    };
                } else {
                    // Back to where its day has it now.
                    const home = h.home(b.entry, epoch);
                    if (!home) return void this.drop(b);
                    if (!b.back) {
                        const from = ring(ep.end);
                        b.back = {from, seconds: clamp(Math.hypot(home.x - from.x, home.y - from.y, home.z - from.z) / 4, 3, 8)};
                    }
                    const back = b.back;
                    if (s - ep.end >= back.seconds) return void this.drop(b);
                    spot = (t) => {
                        const m = ease((t - ep.end) / back.seconds);
                        return {x: back.from.x + (home.x - back.from.x) * m, y: back.from.y + (home.y - back.from.y) * m, z: back.from.z + (home.z - back.from.z) * m};
                    };
                }
                const f = mobFlight(ep.ring, k, n, s);
                const pose = flightPose(spot(s), spot(s + DT), DT, s < ep.end ? f.diving : 0, s >= MOB_APPROACH && s < ep.end ? 0.3 : 0);
                h.setAct(b.entry, pose, true);
                b.last = pose;
                left++;
            });
            if (!left) ep.birds = [];
        }
        this.episodes = this.episodes.filter((ep) => ep.birds.length > 0);
    }

    private drop(b: Bird<E>): void {
        if (b.last && this.host.act(b.entry) === b.last) this.host.setAct(b.entry, null, false);
        b.last = null;
        b.back = null;
        b.gone = true;
    }

    debug(): Array<{key: string; t0: number; birds: number; end: number}> {
        return this.episodes.map((ep) => ({key: ep.key, t0: ep.t0, birds: ep.birds.filter((b) => b.last).length, end: ep.end}));
    }
}
