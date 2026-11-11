/**
 * The behaviour audit's measurements (pure): fed the samples of every
 * animal at each moment, it keeps running counts per check and gives one
 * result object per tree. `report.ts` turns two of them into the
 * before/after table. What each check means is in `docs/ark/behaviour-audit.md`.
 */

import {FLOCKING_SOCIAL, GROUPED_SOCIAL} from "./fixture";
import type {AuditModel, AuditSample, AuditSubject} from "./types";

const TAU = Math.PI * 2;
const GRAZERS = new Set(["grazer"]);
/** Prey "sees" a predator within this many metres (both on the ground, both awake). */
export const SIGHT_M = 25;

function wrap(a: number): number {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
}

function median(list: number[]): number | null {
    if (!list.length) return null;
    const s = Array.from(list).sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
}

function pct(n: number, d: number): number | null {
    return d ? Math.round((1000 * n) / d) / 10 : null;
}

export function isFlyerProfile(subject: AuditSubject): boolean {
    const p = subject.profile;
    return p.move === "fly" || p.moves.includes("fly");
}
export function isAmphibious(subject: AuditSubject): boolean {
    const p = subject.profile;
    const swims = p.move === "swim" || p.moves.includes("swim");
    const lands = p.move === "walk" || p.moves.includes("walk") || p.move === "fly" || p.moves.includes("fly");
    return swims && lands && !p.seabed;
}
export function isLandOnly(subject: AuditSubject): boolean {
    const p = subject.profile;
    return !(p.move === "swim" || p.moves.includes("swim") || p.seabed || p.move === "fly" || p.moves.includes("fly"));
}
export function isWaterOnly(subject: AuditSubject): boolean {
    const p = subject.profile;
    return (p.move === "swim" && !p.moves.some((m) => m === "walk" || m === "fly" || m === "crawl")) || p.seabed;
}

class Grid {
    private cells = new Map<number, number[]>();
    constructor(private size: number) {}
    clear() {
        this.cells.clear();
    }
    key(x: number, z: number) {
        return (Math.floor(x / this.size) + 2048) * 4096 + (Math.floor(z / this.size) + 2048);
    }
    add(i: number, x: number, z: number) {
        const k = this.key(x, z);
        const list = this.cells.get(k);
        if (list) list.push(i);
        else this.cells.set(k, [i]);
    }
    near(x: number, z: number, r: number, out: number[]) {
        out.length = 0;
        const span = Math.ceil(r / this.size);
        const cx = Math.floor(x / this.size);
        const cz = Math.floor(z / this.size);
        for (let dx = -span; dx <= span; dx++) {
            for (let dz = -span; dz <= span; dz++) {
                const list = this.cells.get((cx + dx + 2048) * 4096 + (cz + dz + 2048));
                if (list) for (const i of list) out.push(i);
            }
        }
        return out;
    }
}

/** An encounter: when it began, when the prey first looked, the closest the hunter came, and who (prey, hunter) and where. */
type Encounter = {start: number; looked: number | null; nearest: number; prey: number; hunter: number; x: number; z: number};
/** How often (s) pass A looks for predators near prey. */
export const SIGHT_EVERY_S = 60;

export class AuditMeter {
    private readonly n: number;
    private readonly subjects: AuditSubject[];
    // Pass A (states, every `stepA` s over the whole period).
    private stepA = 0;
    private stateCount: Array<Map<string, number>>;
    private prev: Array<AuditSample | null>;
    private airborne: Float64Array;
    private airborneClosed: Float64Array;
    private awakeSamples: Float64Array;
    private grazeLabel: Float64Array;
    private headDown: Float64Array;
    private standing: Float64Array;
    private walking: Float64Array;
    private transitions: Array<{walked: number; flew: number; snapped: number; inPlace: number}>;
    private invalidSurface: Float64Array;
    private floating: Float64Array;
    private sinking: Float64Array;
    private overlapping: Float64Array;
    private overlapCause = {sameSpecies: 0, otherSpecies: 0, asleep: 0, small: 0};
    private samplesA = 0;
    private distance: Float64Array;
    private restSpots: Array<Set<number>>;
    private everDoing: Array<Set<string>>;
    private changes: Float64Array;
    private syncedChanges: Float64Array;
    private species = new Map<string, number[]>();
    private variety = {samples: 0, allSame: 0, distinctSum: 0, awakeSamples: 0, awakeAllSame: 0, bySpecies: new Map<string, {samples: number; allSame: number}>()};
    private sightClock = Infinity;
    private speciesIndex: Int32Array;
    /** Per prey animal: the species indices that hunt it. */
    private huntersOf: Array<Set<number> | null>;
    private encounterAt: Float64Array;
    private encounterOpen: Int32Array;
    private encounterLog: Encounter[] = [];
    private inSight = 0;
    private looked = 0;
    // Pass B (flyers, every 1 s).
    private flyers: number[] = [];
    private flightB: Map<number, {air: number; closed: number; turn: number; circling: number; path: number; ys: number[]; together: Map<number, number>; heading: number | null; last: {x: number; z: number} | null; window: Array<{x: number; z: number; turn: number}>; landings: Set<string>}> = new Map();
    private grid = new Grid(8);
    private hunterGrid = new Grid(12.5);
    private fineGrid = new Grid(2);
    private overlapClock = Infinity;
    private overlapChecks = 0;
    private hunterIndices: number[] = [];
    private groups: number[][] = [];
    private groupSlugs: string[] = [];
    private scratch: number[] = [];

    constructor(private readonly model: AuditModel, private readonly preyOf: Map<string, Set<string>>) {
        this.subjects = model.subjects;
        this.n = this.subjects.length;
        const zeros = () => new Float64Array(this.n);
        this.stateCount = this.subjects.map(() => new Map());
        this.prev = this.subjects.map(() => null);
        this.airborne = zeros();
        this.airborneClosed = zeros();
        this.awakeSamples = zeros();
        this.grazeLabel = zeros();
        this.headDown = zeros();
        this.standing = zeros();
        this.walking = zeros();
        this.transitions = this.subjects.map(() => ({walked: 0, flew: 0, snapped: 0, inPlace: 0}));
        this.invalidSurface = zeros();
        this.floating = zeros();
        this.sinking = zeros();
        this.overlapping = zeros();
        this.distance = zeros();
        this.restSpots = this.subjects.map(() => new Set());
        this.everDoing = this.subjects.map(() => new Set());
        this.changes = zeros();
        this.syncedChanges = zeros();
        this.subjects.forEach((s, i) => {
            const list = this.species.get(s.slug) ?? [];
            list.push(i);
            this.species.set(s.slug, list);
        });
        const slugs = Array.from(this.species.keys());
        const slugIndex = new Map(slugs.map((slug, k) => [slug, k]));
        this.speciesIndex = Int32Array.from(this.subjects.map((s) => slugIndex.get(s.slug)!));
        const hunters = new Map<string, Set<number>>();
        for (const [predator, prey] of Array.from(preyOf.entries())) {
            const k = slugIndex.get(predator);
            if (k === undefined) continue;
            for (const slug of Array.from(prey)) {
                const set = hunters.get(slug) ?? new Set<number>();
                set.add(k);
                hunters.set(slug, set);
            }
        }
        this.huntersOf = this.subjects.map((s) => hunters.get(s.slug) ?? null);
        this.hunterIndices = this.subjects.map((s, i) => (preyOf.has(s.slug) ? i : -1)).filter((i) => i >= 0);
        for (const [slug, members] of Array.from(this.species)) if (members.length >= 3) {
            this.groups.push(members);
            this.groupSlugs.push(slug);
        }
        this.encounterAt = new Float64Array(this.n).fill(NaN);
        this.encounterOpen = new Int32Array(this.n).fill(-1);
    }

    private groundCache: Float64Array = new Float64Array(0);
    /** Ground height under animal i (cached while it stands still: live main's terrain is analytic and slow). */
    private groundAt(i: number, x: number, z: number): number {
        if (this.groundCache.length !== this.n * 3) this.groundCache = new Float64Array(this.n * 3).fill(NaN);
        const c = this.groundCache;
        if (c[i * 3] === x && c[i * 3 + 1] === z) return c[i * 3 + 2];
        const h = this.model.heightAt(x, z);
        c[i * 3] = x;
        c[i * 3 + 1] = z;
        c[i * 3 + 2] = h;
        return h;
    }

    /** One moment of pass A: every animal's sample at `epoch`, `step` s after the last. */
    timing = {first: 0, overlap: 0, groups: 0, sight: 0};
    observeA(epoch: number, step: number, samples: AuditSample[]) {
        let tick = performance.now();
        const lap = (k: keyof AuditMeter["timing"]) => {
            const now = performance.now();
            this.timing[k] += now - tick;
            tick = now;
        };
        this.stepA = step;
        this.samplesA++;
        const changed = new Uint8Array(this.n);
        this.grid.clear();
        for (let i = 0; i < this.n; i++) {
            const s = samples[i];
            const subject = this.subjects[i];
            const label = s.doing ?? s.state;
            const counts = this.stateCount[i];
            counts.set(label, (counts.get(label) ?? 0) + 1);
            this.everDoing[i].add(label);
            const prev = this.prev[i];
            if (prev && (prev.doing ?? prev.state) !== label) {
                changed[i] = 1;
                this.changes[i]++;
            }
            if (s.aloft) {
                this.airborne[i]++;
                if (!s.wingsOpen) this.airborneClosed[i]++;
            }
            const awake = s.state !== "asleep";
            if (awake) this.awakeSamples[i]++;
            if (GRAZERS.has(subject.profile.diet) && awake && !s.inWater) {
                if (s.doing === "graze" && !s.moving) this.grazeLabel[i]++;
                if (s.headDown) this.headDown[i]++;
                if (s.moving) this.walking[i]++;
                else if (s.doing !== "graze") this.standing[i]++;
            }
            if (prev) {
                this.distance[i] += Math.hypot(s.x - prev.x, s.z - prev.z);
                if (prev.inWater !== s.inWater && isAmphibious(subject)) {
                    // How it crossed the shore between two samples: flying, walking/swimming at a believable pace, in place, or a jump.
                    const moved = Math.hypot(s.x - prev.x, s.z - prev.z);
                    const fastest = Math.max(6, subject.length * 10) * step;
                    if (prev.aloft || s.aloft) this.transitions[i].flew++;
                    else if (moved > fastest) this.transitions[i].snapped++;
                    else if (moved > 0.05) this.transitions[i].walked++;
                    else this.transitions[i].inPlace++;
                }
            }
            if (!s.moving && !s.aloft) this.restSpots[i].add((Math.round(s.x / 2) + 4096) * 8192 + Math.round(s.z / 2) + 4096);
            // The ground: on the wrong surface, floating, sinking.
            if (!s.aloft) {
                const ground = this.groundAt(i, s.x, s.z);
                if (isLandOnly(subject) && s.inWater && ground < -0.05) this.invalidSurface[i]++;
                else if (isWaterOnly(subject) && !s.inWater && ground > 0.05) this.invalidSurface[i]++;
                if (!s.raised && !s.inWater && ground > 0.02 && s.y - ground > 0.3) this.floating[i]++;
                if (ground > 0.05 && s.y < ground - 0.08 && !s.inWater) this.sinking[i]++;
                this.grid.add(i, s.x, s.z);
            }
        }
        lap("first");
        // Overlap, once a minute: two on the ground closer than the scene's own room ((la + lb) · 0.42).
        this.overlapClock += step;
        if (this.overlapClock >= SIGHT_EVERY_S) {
            this.overlapClock = 0;
            this.overlapChecks++;
            this.fineGrid.clear();
            for (let i = 0; i < this.n; i++) if (!samples[i].aloft) this.fineGrid.add(i, samples[i].x, samples[i].z);
            for (let i = 0; i < this.n; i++) {
                const s = samples[i];
                if (s.aloft) continue;
                const li = this.subjects[i].length;
                for (const j of this.fineGrid.near(s.x, s.z, (li + 3.5) * 0.42, this.scratch)) {
                    if (j === i) continue;
                    const o = samples[j];
                    const lj = this.subjects[j].length;
                    if (Math.abs(o.y - s.y) > (li + lj) * 0.5) continue;
                    if (Math.hypot(o.x - s.x, o.z - s.z) < (li + lj) * 0.42) {
                        this.overlapping[i]++;
                        if (this.subjects[j].slug === this.subjects[i].slug) this.overlapCause.sameSpecies++;
                        else this.overlapCause.otherSpecies++;
                        if (s.state === "asleep" && o.state === "asleep") this.overlapCause.asleep++;
                        if (li < 0.3) this.overlapCause.small++;
                        break;
                    }
                }
            }
        }
        lap("overlap");
        // Synchronised changes: a member's change that every other member of its species makes in the same step.
        for (let g = 0; g < this.groups.length; g++) {
            const members = this.groups[g];
            const slug = this.groupSlugs[g];
            const labels = new Set(members.map((i) => samples[i].doing ?? samples[i].state));
            // The same, only at moments the whole group is awake (asleep together at night is right).
            if (members.every((i) => samples[i].state !== "asleep" && samples[i].doing !== "sleep" && samples[i].doing !== "to_roost")) {
                this.variety.awakeSamples++;
                if (labels.size === 1) this.variety.awakeAllSame++;
            }
            this.variety.samples++;
            this.variety.distinctSum += labels.size;
            const row = this.variety.bySpecies.get(slug) ?? {samples: 0, allSame: 0};
            row.samples++;
            if (labels.size === 1) {
                this.variety.allSame++;
                row.allSame++;
            }
            this.variety.bySpecies.set(slug, row);
            const changers = members.filter((i) => changed[i]);
            if (changers.length) for (const i of changers) if (changers.length === members.length) this.syncedChanges[i]++;
        }
        lap("groups");
        // Predators and prey on the ground, once a minute: each awake prey's nearest awake predator in sight, and
        // whether it reacts by the tree's own rule (looks: a moving predator within its reach while it stands).
        this.sightClock += step;
        if (this.sightClock >= SIGHT_EVERY_S) {
            this.sightClock = 0;
            const rule = this.model.features.preyLook;
            // Only the hunters go in this grid (far fewer than everyone).
            this.hunterGrid.clear();
            for (const i of this.hunterIndices) {
                const s = samples[i];
                if (!s.aloft && s.state !== "asleep") this.hunterGrid.add(i, s.x, s.z);
            }
            for (let j = 0; j < this.n; j++) {
                const o = samples[j];
                const hunters = this.huntersOf[j];
                if (!hunters || o.aloft || o.state === "asleep") {
                    this.encounterAt[j] = NaN;
                    continue;
                }
                let nearest = Infinity;
                let nearestHunter = -1;
                let looks = false;
                for (const i of this.hunterGrid.near(o.x, o.z, SIGHT_M, this.scratch)) {
                    if (!hunters.has(this.speciesIndex[i])) continue;
                    const s = samples[i];
                    if (s.aloft || s.state === "asleep") continue;
                    const d = Math.hypot(o.x - s.x, o.z - s.z);
                    if (d > SIGHT_M) continue;
                    if (d < nearest) {
                        nearest = d;
                        nearestHunter = i;
                    }
                    if (rule && d < rule.within && (!rule.predatorMoving || s.moving) && !o.moving) looks = true;
                }
                if (nearest === Infinity) {
                    this.encounterAt[j] = NaN;
                    continue;
                }
                this.inSight++;
                if (Number.isNaN(this.encounterAt[j])) {
                    this.encounterAt[j] = epoch;
                    this.encounterLog.push({start: epoch, looked: null, nearest, prey: j, hunter: nearestHunter, x: o.x, z: o.z});
                    this.encounterOpen[j] = this.encounterLog.length - 1;
                }
                const e = this.encounterLog[this.encounterOpen[j]];
                e.nearest = Math.min(e.nearest, nearest);
                if (looks) {
                    this.looked++;
                    if (e.looked === null) e.looked = epoch - e.start;
                }
            }
        }
        lap("sight");
        for (let i = 0; i < this.n; i++) this.prev[i] = samples[i];
    }

    /**
     * Pass C's camera stops (where a viewer would be watching): up to `max` of pass A's encounters in which the hunter
     * came within 15 m, one per prey species (the earliest by a seeded order), so many kinds of prey and hunter are seen.
     */
    cameraStops(max = 40): Array<{epoch: number; prey: number; hunter: number}> {
        const close = this.encounterLog.filter((e) => e.nearest < 15 && e.hunter >= 0);
        const hash = (n: number) => {
            let h = 2166136261 ^ n;
            h = Math.imul(h ^ (h >>> 15), 2246822507);
            h = Math.imul(h ^ (h >>> 13), 3266489909);
            return (h ^ (h >>> 16)) >>> 0;
        };
        const sorted = close.map((e, k) => ({e, k: hash(k)})).sort((a, b) => a.k - b.k).map((x) => x.e);
        const seen = new Set<string>();
        const out: Array<{epoch: number; prey: number; hunter: number}> = [];
        for (const e of sorted) {
            const slug = this.subjects[e.prey].slug;
            if (seen.has(slug)) continue;
            seen.add(slug);
            out.push({epoch: e.start, prey: e.prey, hunter: e.hunter});
            if (out.length >= max) break;
        }
        return out;
    }

    /** Which animals pass B follows (flyers). */
    flyerIndices(): number[] {
        if (!this.flyers.length) this.flyers = this.subjects.map((s, i) => (isFlyerProfile(s) || s.driver === "flyer-circle" ? i : -1)).filter((i) => i >= 0);
        return this.flyers;
    }

    /** One second of pass B: the flyers' samples (same order as `flyerIndices`). */
    observeB(samples: AuditSample[]) {
        const flyers = this.flyerIndices();
        this.grid.clear();
        const heading: number[] = [];
        for (let k = 0; k < flyers.length; k++) {
            const i = flyers[k];
            const s = samples[k];
            let row = this.flightB.get(i);
            if (!row) this.flightB.set(i, (row = {air: 0, closed: 0, turn: 0, circling: 0, path: 0, ys: [], together: new Map(), heading: null, last: null, window: [], landings: new Set()}));
            heading[k] = NaN;
            if (s.aloft) {
                row.air++;
                if (!s.wingsOpen) row.closed++;
                const ground = Math.max(this.model.heightAt(s.x, s.z), 0);
                if (row.ys.length < 50000) row.ys.push(s.y - ground);
                if (row.last) {
                    const dx = s.x - row.last.x;
                    const dz = s.z - row.last.z;
                    const step = Math.hypot(dx, dz);
                    row.path += step;
                    if (step > 0.05) {
                        const h = Math.atan2(dx, dz);
                        heading[k] = h;
                        const turn = row.heading === null ? 0 : Math.abs(wrap(h - row.heading));
                        row.turn += turn;
                        row.heading = h;
                        row.window.push({x: s.x, z: s.z, turn});
                        if (row.window.length > 60) row.window.shift();
                        // Circling: over the last minute in the air, a full turn or more inside a 20 m circle.
                        if (row.window.length >= 30) {
                            const turned = row.window.reduce((sum, w) => sum + w.turn, 0);
                            const cx = row.window.reduce((sum, w) => sum + w.x, 0) / row.window.length;
                            const cz = row.window.reduce((sum, w) => sum + w.z, 0) / row.window.length;
                            const far = Math.max(...row.window.map((w) => Math.hypot(w.x - cx, w.z - cz)));
                            if (turned >= TAU && far <= 20) row.circling++;
                        }
                    }
                }
                row.last = {x: s.x, z: s.z};
                this.grid.add(k, s.x, s.z);
            } else {
                if (row.last) row.landings.add(`${Math.round(s.x / 3)},${Math.round(s.z / 3)}`);
                row.last = null;
                row.heading = null;
                row.window.length = 0;
            }
        }
        // Flying together: another flyer within max(4 m, 3 lengths), heading within 30°.
        for (let k = 0; k < flyers.length; k++) {
            const s = samples[k];
            if (!s.aloft || Number.isNaN(heading[k])) continue;
            const i = flyers[k];
            const reach = Math.max(4, this.subjects[i].length * 3);
            for (const m of this.grid.near(s.x, s.z, reach, this.scratch)) {
                if (m === k || Number.isNaN(heading[m])) continue;
                const o = samples[m];
                if (Math.hypot(o.x - s.x, o.z - s.z, o.y - s.y) > reach) continue;
                if (Math.abs(wrap(heading[m] - heading[k])) > Math.PI / 6) continue;
                const row = this.flightB.get(i)!;
                row.together.set(flyers[m], (row.together.get(flyers[m]) ?? 0) + 1);
            }
        }
    }

    result(meta: {days: number; stepA: number; secondsB: number}) {
        const subjects = this.subjects;
        const bySpecies = <T>(pick: (i: number) => T | null) => {
            const out = new Map<string, T[]>();
            subjects.forEach((s, i) => {
                const v = pick(i);
                if (v === null) return;
                const list = out.get(s.slug) ?? [];
                list.push(v);
                out.set(s.slug, list);
            });
            return out;
        };
        // 1. Flight.
        let air = 0;
        let closed = 0;
        const flightSpecies = new Map<string, {air: number; closed: number}>();
        subjects.forEach((s, i) => {
            air += this.airborne[i];
            closed += this.airborneClosed[i];
            if (this.airborne[i]) {
                const row = flightSpecies.get(s.slug) ?? {air: 0, closed: 0};
                row.air += this.airborne[i];
                row.closed += this.airborneClosed[i];
                flightSpecies.set(s.slug, row);
            }
        });
        const flyerSpecies = new Set(subjects.filter(isFlyerProfile).map((s) => s.slug));
        // 2. Roaming (pass B).
        const flightRows = Array.from(this.flightB.entries()).filter(([, row]) => row.air > 0);
        const airSeconds = flightRows.reduce((sum, [, r]) => sum + r.air, 0);
        const circlingSeconds = flightRows.reduce((sum, [, r]) => sum + r.circling, 0);
        const loopsPerAirMinute = airSeconds ? flightRows.reduce((sum, [, r]) => sum + r.turn, 0) / TAU / (airSeconds / 60) : null;
        let followers = 0;
        let followersNotFlocking = 0;
        let followersOtherSpecies = 0;
        const followerExamples: string[] = [];
        for (const [i, row] of flightRows) {
            let best = 0;
            let partner = -1;
            for (const [j, n] of Array.from(row.together)) if (n > best) [best, partner] = [n, j];
            if (row.air >= 30 && best / row.air >= 0.5) {
                followers++;
                const flocking = FLOCKING_SOCIAL.has(subjects[i].profile.social);
                if (!flocking) followersNotFlocking++;
                if (subjects[partner].slug !== subjects[i].slug) followersOtherSpecies++;
                if (!flocking && followerExamples.length < 12) followerExamples.push(`${subjects[i].slug} (${subjects[i].profile.social}) with ${subjects[partner].slug} ${Math.round((100 * best) / row.air)}%`);
            }
        }
        const heights = flightRows.flatMap(([, r]) => r.ys);
        const speciesCruise = new Map<string, number[]>();
        for (const [i, r] of flightRows) {
            const m = median(r.ys);
            if (m !== null) speciesCruise.set(subjects[i].slug, [...(speciesCruise.get(subjects[i].slug) ?? []), m]);
        }
        const heightSd = (() => {
            if (!heights.length) return null;
            const mean = heights.reduce((a, b) => a + b, 0) / heights.length;
            return Math.sqrt(heights.reduce((a, b) => a + (b - mean) ** 2, 0) / heights.length);
        })();
        const straightness = flightRows.map(([i, r]) => r.path).filter((p) => p > 0).length;
        // 3. Grazing.
        let grazeAwake = 0;
        let grazeLabel = 0;
        let grazeHead = 0;
        let grazeStand = 0;
        let grazeWalk = 0;
        let grazers = 0;
        let grazersNeverGrazed = 0;
        subjects.forEach((s, i) => {
            if (!GRAZERS.has(s.profile.diet)) return;
            grazers++;
            const awake = this.grazeLabel[i] + this.standing[i] + this.walking[i];
            grazeAwake += awake;
            grazeLabel += this.grazeLabel[i];
            grazeHead += this.headDown[i];
            grazeStand += this.standing[i];
            grazeWalk += this.walking[i];
            if (!this.everDoing[i].has("graze")) grazersNeverGrazed++;
        });
        // 4. Land and water.
        const amphibious = subjects.map((s, i) => (isAmphibious(s) ? i : -1)).filter((i) => i >= 0);
        const transitionTotals = amphibious.reduce((t, i) => ({walked: t.walked + this.transitions[i].walked, flew: t.flew + this.transitions[i].flew, snapped: t.snapped + this.transitions[i].snapped, inPlace: t.inPlace + this.transitions[i].inPlace}), {walked: 0, flew: 0, snapped: 0, inPlace: 0});
        const amphibiousWithAny = amphibious.filter((i) => this.transitions[i].walked + this.transitions[i].flew + this.transitions[i].snapped + this.transitions[i].inPlace > 0).length;
        const ducks = amphibious.filter((i) => /duck|teal|mallard|wigeon|goose|swan|merganser|eider|pochard|scaup|grebe|coot|moorhen/.test(subjects[i].slug));
        const duckTransitions = ducks.reduce((t, i) => t + this.transitions[i].walked + this.transitions[i].flew + this.transitions[i].snapped + this.transitions[i].inPlace, 0);
        const duckWalked = ducks.reduce((t, i) => t + this.transitions[i].walked, 0);
        // 6. Predators and prey: at spawn, and over the period.
        const spawnDistances: number[] = [];
        const within: Record<string, number> = {"5": 0, "10": 0, "20": 0};
        const closePairs: string[] = [];
        let predatorsWithPrey = 0;
        subjects.forEach((p, i) => {
            const prey = this.preyOf.get(p.slug);
            if (!prey) return;
            let best = Infinity;
            let bestJ = -1;
            subjects.forEach((q, j) => {
                if (!prey.has(q.slug)) return;
                const d = Math.hypot(p.home.x - q.home.x, p.home.z - q.home.z);
                if (d < best) [best, bestJ] = [d, j];
            });
            if (bestJ < 0) return;
            predatorsWithPrey++;
            spawnDistances.push(best);
            for (const k of Object.keys(within)) if (best < Number(k)) within[k]++;
            if (best < 10 && closePairs.length < 15) closePairs.push(`${p.slug} ${best.toFixed(1)} m from ${subjects[bestJ].slug}`);
        });
        const lookTimes = this.encounterLog.filter((e) => e.looked !== null).map((e) => e.looked!);
        // 7. Variety.
        const speciesVariety = Array.from(this.variety.bySpecies.entries()).map(([slug, r]) => ({slug, allSame: r.allSame / r.samples}));
        const changes = subjects.reduce((sum, _s, i) => sum + this.changes[i], 0);
        const synced = subjects.reduce((sum, _s, i) => sum + this.syncedChanges[i], 0);
        // Environment.
        const per = (arr: Float64Array) => {
            let animals = 0;
            let samples = 0;
            subjects.forEach((_s, i) => {
                if (arr[i]) animals++;
                samples += arr[i];
            });
            return {animals, sharePct: pct(samples, this.samplesA * this.n)};
        };
        const everDid = (doing: string, want: (s: AuditSubject) => boolean) => {
            const list = subjects.map((s, i) => (want(s) ? i : -1)).filter((i) => i >= 0);
            return {animals: list.length, never: list.filter((i) => !this.everDoing[i].has(doing)).length};
        };
        const destinations = bySpecies((i) => (this.restSpots[i].size ? this.restSpots[i].size / meta.days : null));
        const distance = bySpecies((i) => this.distance[i] / meta.days);
        const flatDistance = Array.from(distance.values()).flat();
        const stillAll = subjects.filter((_s, i) => this.distance[i] < 0.5).length;
        return {
            label: this.model.label,
            commit: this.model.commit,
            features: this.model.features,
            period: {days: meta.days, stepSecondsA: meta.stepA, flightSecondsB: meta.secondsB, animals: this.n, species: this.species.size},
            flight: {
                flyingSpeciesInCatalogue: flyerSpecies.size,
                speciesThatFly: flightSpecies.size,
                airborneAnimalSamples: air,
                airborneWingsClosedPct: pct(closed, air),
                wingShaderBirdSpecies: this.model.features.wingShaderSpecies,
                flightClipsPlayable: this.model.features.flightClips
            },
            roaming: {
                airborneSeconds: airSeconds,
                circlingPct: pct(circlingSeconds, airSeconds),
                fullTurnsPerAirMinute: loopsPerAirMinute === null ? null : Math.round(loopsPerAirMinute * 100) / 100,
                flyersTracked: flightRows.length,
                followers,
                followersNotFlockingSpecies: followersNotFlocking,
                followersOfAnotherSpecies: followersOtherSpecies,
                followerExamples,
                airHeightAboveGroundM: heights.length ? {p10: quantile(heights, 0.1), median: quantile(heights, 0.5), p90: quantile(heights, 0.9), sd: heightSd === null ? null : Math.round(heightSd * 10) / 10} : null,
                distinctSpeciesCruiseHeights: new Set(Array.from(speciesCruise.values()).map((l) => Math.round((median(l) ?? 0) / 2) * 2)).size,
                landingSpotsPerFlyerDay: median(flightRows.map(([, r]) => r.landings.size)),
                distanceMPerAnimalDay: {median: round1(median(flatDistance)), p90: round1(quantile(flatDistance, 0.9)), animalsThatNeverMove: stillAll},
                restSpotsPerAnimalDay: round1(median(Array.from(destinations.values()).flat())),
                flyersWithPathSamples: straightness
            },
            grazing: {
                grazerAnimals: grazers,
                awakeSamples: grazeAwake,
                grazeLabelAtGrassPct: pct(grazeLabel, grazeAwake),
                headDownGrazingPct: pct(grazeHead, grazeAwake),
                standingPct: pct(grazeStand, grazeAwake),
                walkingPct: pct(grazeWalk, grazeAwake),
                grazersThatNeverGrazed: grazersNeverGrazed,
                grazePoseExists: this.model.features.grazePose
            },
            landWater: {
                amphibiousAnimals: amphibious.length,
                amphibiousWithATransition: amphibiousWithAny,
                transitions: transitionTotals,
                transitionsPerAmphibiousDay: round1((transitionTotals.walked + transitionTotals.flew + transitionTotals.snapped + transitionTotals.inPlace) / Math.max(amphibious.length, 1) / meta.days),
                ducksAndKin: ducks.length,
                duckTransitions,
                duckWalkedTransitions: duckWalked,
                entryExitClip: false
            },
            predatorPrey: {
                predatorsWithPreyAboard: predatorsWithPrey,
                spawnNearestPreyM: {min: round1(Math.min(...spawnDistances)), p10: round1(quantile(spawnDistances, 0.1)), median: round1(median(spawnDistances))},
                predatorsWithPreyWithinM: within,
                closeExamples: closePairs,
                sightRadiusM: SIGHT_M,
                encounters: this.encounterLog.length,
                encountersCloserThan6M: this.encounterLog.filter((e) => e.nearest < 6).length,
                sightCheckEveryS: SIGHT_EVERY_S,
                encountersWithALook: lookTimes.length,
                encountersWithFlight: 0,
                preyReactPct: pct(lookTimes.length, this.encounterLog.length),
                medianSecondsToLook: median(lookTimes),
                rule: this.model.features.preyLook,
                flee: this.model.features.preyFlee
            },
            variety: {
                speciesWith3Plus: this.variety.bySpecies.size,
                allSameStatePct: pct(this.variety.allSame, this.variety.samples),
                awakeAllSamePct: pct(this.variety.awakeAllSame, this.variety.awakeSamples),
                meanDistinctStates: this.variety.samples ? Math.round((100 * this.variety.distinctSum) / this.variety.samples) / 100 : null,
                speciesAlwaysInStep: speciesVariety.filter((r) => r.allSame >= 0.999).length,
                stateChangesInStepPct: pct(synced, changes),
                individualVariationWired: this.model.features.individualVariation
            },
            environment: {
                invalidSurface: per(this.invalidSurface),
                floating: per(this.floating),
                sinking: per(this.sinking),
                overlapping: {animals: subjects.filter((_s, i) => this.overlapping[i] > 0).length, sharePct: pct(subjects.reduce((sum, _s, i) => sum + this.overlapping[i], 0), this.overlapChecks * this.n), causes: this.overlapCause, checks: this.overlapChecks},
                interactions: {
                    grazersAtGrass: everDid("graze", (s) => GRAZERS.has(s.profile.diet)),
                    drinkersAtWaterEdge: everDid("drink", (s) => s.profile.interactions.includes("drink_edge")),
                    perchersOnAPerch: everDid("perch", (s) => s.profile.interactions.some((x) => x === "perch_branch" || x === "perch_rock" || x === "cliff_ledge"))
                }
            },
            stateMix: mix(this.stateCount)
        };
    }
}

function quantile(list: number[], q: number): number | null {
    if (!list.length) return null;
    const s = Array.from(list).sort((a, b) => a - b);
    return Math.round(s[Math.min(Math.floor(q * s.length), s.length - 1)] * 10) / 10;
}
function round1(v: number | null): number | null {
    return v === null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10;
}
function mix(counts: Array<Map<string, number>>): Record<string, number> {
    const total = new Map<string, number>();
    let all = 0;
    for (const c of counts) for (const [k, v] of Array.from(c)) {
        total.set(k, (total.get(k) ?? 0) + v);
        all += v;
    }
    return Object.fromEntries(Array.from(total.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, Math.round((1000 * v) / all) / 10]));
}

export type AuditResult = ReturnType<AuditMeter["result"]>;
export {GROUPED_SOCIAL};
