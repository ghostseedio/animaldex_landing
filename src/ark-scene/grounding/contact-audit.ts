/**
 * The contact audit (lane ARK-CONTACT, decision 447): for every species of an Ark (the validator's every-species list,
 * or a snapshot) through an Ark day, each state's contact with what it is on, by the rules before this lane
 * (`before`) and with them (`after`), on the same poses. Pure (node): the scene's own modules, with the few lines of
 * `index.ts` that place a pose mirrored, as `audit.ts` (lane L3) does; `grounding/contact.ts` holds the rules both use.
 *
 * States and what counts as an offender (tolerance: 2 cm or 3% of its drawn height, `groundingTolerance`):
 * - `walk` / `idle` (on the ground): its lowest contact off the drawn ground (lane L3's measure, `auditGrounding`).
 * - `sleep` (lying on the ground): any of its body's points down its middle, chin to tail, under the drawn ground.
 * - `perch` (on a raised point, a micro surface): lane L3's surface measure (in a crown, upright through a trunk).
 * - `wade` (no water band, over water): its back under the surface (on the bed in water deeper than its legs).
 * - `edge` (sliding into or out of the water): its body under the bank it is on.
 * - `bed` (a sea star, an urchin, a sea cucumber, a sessile animal): creeping faster than 1 cm/s.
 * - `shadow` (every model, near and far): its contact shadow's area off its body's footprint by more than 0.6-1.8 times.
 *
 * Clip lift (a clip played in place lifting the body off the ground: the hovering cat) is measured on the rig files
 * (`scripts/ark-contact-audit.mts --rigs`), and zoom stability in the browser (`scripts/ark-contact-shots.mjs`).
 */

import {bodyLengthsPerSecond} from "@/ark-scene/behaviour-profile";
import {poseOnTrip, tripAt, waterEdgeAt, type Trip} from "@/ark-scene/behaviour-schedule";
import {waterSurfaceOf} from "@/ark-scene/behaviour-water";
import {arkDayEpochs, auditGrounding, groundingSubjects, groundingTolerance, type Subject} from "@/ark-scene/grounding/audit";
import {groundedSlugs, modelBase} from "@/ark-scene/grounding/base";
import {benthicCreep, edgeBase, livesUnderWater, shadowFootprint, wadeBase} from "@/ark-scene/grounding/contact";
import {drawnGroundHeight} from "@/ark-scene/grounding/drawn-ground";
import {lieOnGround, type LyingTorso} from "@/ark-scene/grounding/stand";
import {inDepthBand} from "@/ark-scene/schedule-water";
import {floatLine, swimDepth} from "@/ark-scene/sea-depth";
import {lyingTorso} from "@/ark-scene/sleep";
import type {ArkAnimal} from "@/ark-scene/types";
import {heightAt} from "@/ark-scene/world";
import {islandHours} from "@/lib/ark-clock";

export type ContactState = "walk" | "idle" | "sleep" | "perch" | "wade" | "edge" | "bed" | "shadow";
export type ContactRules = "before" | "after";
export type ContactOffender = {state: ContactState; slug: string; gap: number; detail: string};
export type ContactAudit = {
    animals: number;
    species: number;
    /** Samples per state, and offenders (samples, then species) per rule set. */
    samples: Record<ContactState, number>;
    offenders: Record<ContactRules, Record<ContactState, {samples: number; species: number}>>;
    /** The worst few per state, after (and before, for the report). */
    worst: Record<ContactRules, ContactOffender[]>;
};

const STATES: ContactState[] = ["walk", "idle", "sleep", "perch", "wade", "edge", "bed", "shadow"];
const empty = <T>(make: () => T) => Object.fromEntries(STATES.map((s) => [s, make()])) as Record<ContactState, T>;

/** A model's box from the base file (model units): centred across and along, from its lowest point up. */
function boxOf(slug: string): {min: {x: number; y: number; z: number}; max: {x: number; y: number; z: number}} | null {
    const found = modelBase(slug);
    if (!found) return null;
    const {x, y, z} = found.size;
    return {min: {x: -x / 2, y: found.near.minY, z: -z / 2}, max: {x: x / 2, y: found.near.minY + y, z: z / 2}};
}

/** Its lying body's points down its middle, chin to tail, at its belly's height, against the drawn ground (lowest gap, m). */
function lyingGap(x: number, z: number, yaw: number, scale: number, torso: LyingTorso, rootY: number, pitch: number): number {
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const xc = (torso.x0 + torso.x1) / 2;
    const ends = torso.ends ?? {z0: torso.z0, z1: torso.z1};
    let lowest = Infinity;
    for (let i = 0; i <= 8; i++) {
        const lz = ends.z0 + ((ends.z1 - ends.z0) * i) / 8;
        const y1 = torso.bottom * scale;
        const z1 = lz * scale;
        const y2 = y1 * cp - z1 * sp;
        const z2 = y1 * sp + z1 * cp;
        const wx = x + xc * scale * cy + z2 * sy;
        const wz = z - xc * scale * sy + z2 * cy;
        lowest = Math.min(lowest, rootY + y2 - drawnGroundHeight(wx, wz));
    }
    return lowest;
}

/** The speed rule before this lane (the stat curve's, 0.4 lengths a second at least). */
function oldPace(speed: number | null): number {
    return Math.min(Math.max(0.6 + ((speed ?? 40) / 100) * 1.4, 0.4), 2.2);
}

export function auditContact(animals: ArkAnimal[], options: {epochs?: number[]} = {}): ContactAudit {
    const epochs = options.epochs ?? arkDayEpochs();
    const samples = empty(() => 0);
    const hits: Record<ContactRules, Record<ContactState, {samples: number; species: Set<string>}>> = {before: empty(() => ({samples: 0, species: new Set<string>()})), after: empty(() => ({samples: 0, species: new Set<string>()}))};
    const worst: Record<ContactRules, ContactOffender[]> = {before: [], after: []};
    const offend = (rules: ContactRules, state: ContactState, slug: string, gap: number, detail: string) => {
        hits[rules][state].samples++;
        hits[rules][state].species.add(slug);
        worst[rules].push({state, slug, gap, detail});
    };

    // walk, idle and perch: lane L3's audit on the same day (its legacy rules are this audit's "before" for those).
    const grounding = auditGrounding(animals, {epochs});
    for (const sample of grounding.samples) {
        // (Lane L3's grounded rules are the base branch's: this lane leaves standing and perching as they are, so its
        // before and after are both theirs. Floating and sinking only: inside scenery is the collisions'.)
        if (!sample.id.endsWith("#grounded")) continue;
        const state: ContactState | null = sample.kind === "ground" ? (sample.moving ? "walk" : "idle") : sample.kind === "surface" ? "perch" : null;
        if (!state) continue;
        samples[state]++;
        const problems = sample.problems.filter((p) => p !== "inside");
        if (problems.length) for (const rules of ["before", "after"] as const) offend(rules, state, sample.slug, sample.gap, problems.join("+") + (sample.detail ? ` ${sample.detail}` : ""));
    }

    const {subjects, world, sampler} = groundingSubjects(animals);
    const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
    const surfaceAt = (x: number, z: number) => waterSurfaceOf(sampler, x, z);
    const benthicSeen = new Set<string>();
    for (const s of subjects) {
        const own = s.sched;
        if (!own) continue;
        const slug = s.animal.model_slug;
        const tol = groundingTolerance(s.height);
        const band = swimDepth(slug, s.animal.zone);
        // bed: its creep, from its own schedule (moved over 10 s through the day), and the pace rule before.
        const creep = benthicCreep(own.profile);
        if (creep !== null && !benthicSeen.has(slug)) {
            benthicSeen.add(slug);
            const before = oldPace(own.profile.speed) * Math.max(s.length, 0.05);
            let fastest = 0;
            for (const epoch of epochs) {
                const trip = tripAt(world, own.profile, own.animal, epoch, hoursAt, s.animal.activity, null);
                const a = poseOnTrip(world, trip, epoch);
                const t2 = tripAt(world, own.profile, own.animal, epoch + 10, hoursAt, s.animal.activity, trip);
                const b = poseOnTrip(world, t2, epoch + 10);
                fastest = Math.max(fastest, Math.hypot(b.x - a.x, b.z - a.z) / 10);
            }
            samples.bed++;
            if (before > 0.01) offend("before", "bed", slug, before, `${(before * 100).toFixed(1)} cm/s (the stat curve's pace)`);
            if (fastest > 0.01) offend("after", "bed", slug, fastest, `${(fastest * 100).toFixed(1)} cm/s on its schedule`);
            void bodyLengthsPerSecond;
        }
        const box = boxOf(slug);
        let trip: Trip | null = null;
        for (const epoch of epochs) {
            if (!trip || epoch < trip.start || epoch >= trip.end) trip = tripAt(world, own.profile, own.animal, epoch, hoursAt, s.animal.activity, trip);
            const at = poseOnTrip(world, trip, epoch);
            if (at.aloft) continue;
            const ground = heightAt(at.x, at.z);
            const waterTop = surfaceAt(at.x, at.z);
            // wade: no band, over water, standing (the scene's `fromSchedule` branch).
            const act = (at as {act?: {own?: boolean} | null}).act;
            if (!band && !act?.own && ground < waterTop - 0.02 && at.y >= ground - 0.01 && at.y <= waterTop + 0.02) {
                samples.wade++;
                // (One that lives under the water, a sea anemone, an urchin, a crab, is on its bed as it should be.)
                if (livesUnderWater(own.profile, s.plan)) continue;
                // (Under: its head, the top tenth of its height, below the surface: it walks the bed.)
                const under = (base: number) => waterTop - (base + s.height * 0.9);
                if (under(ground) > 0) offend("before", "wade", slug, -under(ground), `${((waterTop - ground) * 100).toFixed(0)} cm of water, on the bed`);
                const after = wadeBase(ground, waterTop, s.height, own.profile.water, s.plan).base;
                if (under(after) > 0) offend("after", "wade", slug, -under(after), `${((waterTop - ground) * 100).toFixed(0)} cm of water`);
            }
            // sleep: lying on the ground (not in the water, not raised).
            if (box && (trip.doing === "sleep" || trip.doing === "rest") && !at.moving && !inDepthBand(band, at, ground, waterTop) && Math.abs(at.y - Math.max(ground, drawnGroundHeight(at.x, at.z))) < 0.06 && ground > 0.02) {
                samples.sleep++;
                const torso = lyingTorso(box, 0.5);
                const g = drawnGroundHeight(at.x, at.z);
                const normal = drawnNormal(at.x, at.z);
                // (Nosed down as a sleeper is, a little: `sleep.ts` lies a body 0.06 rad nose down at most.)
                const nose = 0.06;
                const was = lieOnGround(at.x, at.z, at.yaw, s.scale, {...torso, ends: undefined}, nose, 0, g, normal);
                const now = lieOnGround(at.x, at.z, at.yaw, s.scale, torso, nose, 0, g, normal, drawnGroundHeight);
                const gapWas = lyingGap(at.x, at.z, at.yaw, s.scale, torso, was.rootY, was.pitch + nose);
                const gapNow = lyingGap(at.x, at.z, at.yaw, s.scale, torso, now.rootY, now.pitch + nose);
                if (gapWas < -tol) offend("before", "sleep", slug, gapWas, `${(-gapWas * 100).toFixed(0)} cm of its body in the ground`);
                if (gapNow < -tol) offend("after", "sleep", slug, gapNow, `${(-gapNow * 100).toFixed(0)} cm of its body in the ground`);
            }
        }
        // edge: every slide into or out of the water on its day's trips, at a quarter, half and three quarters.
        if (band) {
            const seen = new Set<number>();
            for (const epoch of epochs) {
                const t = tripAt(world, own.profile, own.animal, epoch, hoursAt, s.animal.activity, null);
                if (seen.has(t.start) || !t.legs.some((leg) => leg.mode === "enter" || leg.mode === "exit")) continue;
                seen.add(t.start);
                for (let e = t.start; e < t.end; e += 0.25) {
                    const edge = waterEdgeAt(t, e);
                    if (!edge || ![0.25, 0.5, 0.75].some((u) => Math.abs(edge.u - u) < 0.25 / Math.max(edge.seconds, 0.25) / 2 + 1e-9)) continue;
                    const at = poseOnTrip(world, t, e);
                    const ground = heightAt(at.x, at.z);
                    const leg = t.legs.find((l) => l.mode === edge.mode)!;
                    const wetEnd = edge.mode === "enter" ? leg.to : leg.from;
                    const top = surfaceAt(wetEnd.x, wetEnd.z);
                    const sm = edge.u * edge.u * (3 - 2 * edge.u);
                    const k = edge.mode === "enter" ? sm : 1 - sm;
                    const stand = Math.max(at.y, ground);
                    const fitted = top - floatLine(band.kind) * s.height;
                    const drawn = Math.max(ground, drawnGroundHeight(at.x, at.z));
                    samples.edge++;
                    const was = stand + (fitted - stand) * k;
                    const now = edgeBase(stand, fitted, k, drawn);
                    if (was < drawn - tol) offend("before", "edge", slug, was - drawn, `${((drawn - was) * 100).toFixed(0)} cm into the bank (${edge.mode})`);
                    if (now < drawn - tol) offend("after", "edge", slug, now - drawn, `${((drawn - now) * 100).toFixed(0)} cm into the bank (${edge.mode})`);
                }
            }
        }
    }

    // shadow: every listed model at a body of its kind's size (1 m long here; the ratio does not depend on it), near and far.
    for (const slug of groundedSlugs()) {
        const box = boxOf(slug);
        const found = modelBase(slug);
        if (!box || !found) continue;
        for (const [length, level] of [[1, "near"], [0.05, "far"], [0.3, "far"], [3, "far"]] as const) {
            const scale = length / Math.max(found.size.z, 0.05);
            const body = found.size.x * scale * found.size.z * scale;
            // Before: the box's width x 1.15 by its length, at least 40 cm across from afar (with the pass off: always).
            const wasW = Math.max(found.size.x * scale * 1.15, level === "near" ? 0.05 : 0.4);
            const wasL = Math.max(found.size.z * scale, level === "near" ? 0.05 : 0);
            const foot = shadowFootprint(box, scale, 0, 0);
            const ratio = (w: number, l: number) => (w * l) / Math.max(body, 1e-9);
            samples.shadow++;
            const r0 = ratio(wasW, wasL);
            const r1 = ratio(Math.max(foot.width, 0.004), Math.max(foot.length, 0.004));
            if (r0 < 0.6 || r0 > 1.8) offend("before", "shadow", slug, r0, `${level} at ${length} m: ${r0.toFixed(1)}x its body's footprint`);
            if (r1 < 0.6 || r1 > 1.8) offend("after", "shadow", slug, r1, `${level} at ${length} m: ${r1.toFixed(1)}x its body's footprint`);
        }
    }

    const offenders = {} as ContactAudit["offenders"];
    for (const rules of ["before", "after"] as const) offenders[rules] = Object.fromEntries(STATES.map((state) => [state, {samples: hits[rules][state].samples, species: hits[rules][state].species.size}])) as Record<ContactState, {samples: number; species: number}>;
    for (const rules of ["before", "after"] as const) worst[rules].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
    return {animals: animals.length, species: new Set(animals.map((a) => a.model_slug)).size, samples, offenders, worst};
}

/** The drawn ground's normal (central differences on the drawn triangles, 0.3 m apart). */
function drawnNormal(x: number, z: number): {nx: number; ny: number; nz: number} {
    const d = 0.3;
    const hx = (drawnGroundHeight(x + d, z) - drawnGroundHeight(x - d, z)) / (2 * d);
    const hz = (drawnGroundHeight(x, z + d) - drawnGroundHeight(x, z - d)) / (2 * d);
    const n = Math.hypot(hx, 1, hz);
    return {nx: -hx / n, ny: 1 / n, nz: -hz / n};
}

export type {Subject};
