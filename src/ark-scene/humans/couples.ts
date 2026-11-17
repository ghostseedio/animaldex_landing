/**
 * Couples and children among the town's humans (owner 2026-11-17: "humans should be able to reproduce too but they
 * should find a mate and it should take a very long time (due to dating etc. like in real life)"; AnimalDex decision
 * 380). The record decides every one of these (the server's courtship: who is dating whom, who moved in together, whose
 * child a young human is: `voyage_human_bonds_v1`, read through `/api/ark/human-bonds`); the scene never pairs anyone.
 * Here: the record's rows decoded, and what a couple does together on the shared island clock so every viewer sees the
 * same date at the same bench: a walk side by side, a bench shared, dinner at a table at home (seen through its
 * window). A child is a smaller figure by its age, beside a parent wherever that parent is.
 *
 * Pure functions of the pair, the island clock and the Ark day. Privacy as every human: generic figures, no names.
 */

import {chance, type TownClock} from "@/ark-scene/islands/town/people";

/** A child is grown at this age (Ark days: 18 Ark years, about 252 real days), as the server's courtship.ts GROWN_DAYS. */
export const GROWN_DAYS = 18 * 365;
/** A newborn's size as a share of its grown one (carried by a parent until it walks). */
export const BABY_SCALE = 0.3;
/** Carried in a parent's arms until this age (Ark days: about 1.5 Ark years, 21 real days). */
export const CARRIED_DAYS = 548;

export type HumanBond = {
    a: string;
    b: string;
    /** `dating`: they meet for dates and live apart; `together`: they share `home`'s house. */
    stage: "dating" | "together";
    /** The Ark day the stage began. */
    since: number;
    /** Whose house they share (an animal id of the two), when together. */
    home: string | null;
    /** Expecting a child until this Ark day (the birth), or null. */
    expectingUntil: number | null;
};

export type HumanChild = {id: string; parents: [string, string]; born: number};

export type HumanBonds = {bonds: HumanBond[]; children: HumanChild[]};

const id = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{8,64}$/i.test(v) ? v : null);
const day = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The server's rows (`{bonds, children}`), decoded; anything malformed is left out. A human is in one bond at most. */
export function decodeHumanBonds(raw: unknown): HumanBonds {
    const out: HumanBonds = {bonds: [], children: []};
    if (!raw || typeof raw !== "object") return out;
    const row = raw as {bonds?: unknown; children?: unknown};
    const taken = new Set<string>();
    for (const item of Array.isArray(row.bonds) ? row.bonds : []) {
        const r = item as {a?: unknown; b?: unknown; stage?: unknown; since?: unknown; home?: unknown; expecting_until?: unknown} | null;
        const a = id(r?.a);
        const b = id(r?.b);
        if (!r || !a || !b || a === b || taken.has(a) || taken.has(b) || (r.stage !== "dating" && r.stage !== "together")) continue;
        taken.add(a);
        taken.add(b);
        const home = id(r.home);
        out.bonds.push({a, b, stage: r.stage, since: day(r.since) ?? 0, home: r.stage === "together" ? (home === b ? b : a) : null, expectingUntil: day(r.expecting_until)});
    }
    for (const item of Array.isArray(row.children) ? row.children : []) {
        const r = item as {id?: unknown; parents?: unknown; born?: unknown} | null;
        const child = id(r?.id);
        const parents = Array.isArray(r?.parents) ? r!.parents.map(id) : [];
        const born = day(r?.born);
        if (!child || parents.length !== 2 || !parents[0] || !parents[1] || born === null) continue;
        out.children.push({id: child, parents: [parents[0], parents[1]], born});
    }
    return out;
}

/** The pair's key, whichever way round. */
export function pairKey(a: string, b: string): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export type Together =
    /** Walking side by side along one of the town's walks (`walk`: which, by the pair and the day). */
    | {kind: "walk"; pick: number; share: number}
    /** Sitting together on a bench (`pick`: which). */
    | {kind: "bench"; pick: number}
    /** Dinner at the table at home (the host's, or the shared home), seen through the window. */
    | {kind: "dinner"; home: string}
    /** An evening on the sofa at the shared home. */
    | {kind: "sofa"; home: string};

const within = (h: number, from: number, to: number) => h >= from && h < to;

/**
 * What a couple does together at this moment of the island clock, or null (each goes about their own day).
 * - Dating: a date on most days: an afternoon walk (15:00–16:30) on three days in five, then a bench (16:30–17:30) on half
 *   of those, and dinner at one's home (19:00–20:30, the host by the day) on two days in three.
 * - Together: dinner at home every evening they are in (18:30–19:30), the sofa after (19:30–their bedtime is the town
 *   schedule's own), a walk at the weekend.
 */
export function togetherNow(bond: HumanBond, clock: TownClock): Together | null {
    const key = pairKey(bond.a, bond.b);
    const h = clock.hours;
    const weekend = ((clock.day % 7) + 7) % 7 === 0 || ((clock.day % 7) + 7) % 7 === 6;
    if (bond.stage === "dating") {
        const walks = chance(key, clock.day, "walk") < 0.6;
        if (walks && within(h, 15, 16.5)) return {kind: "walk", pick: chance(key, clock.day, "where"), share: (h - 15) / 1.5};
        if (walks && chance(key, clock.day, "bench") < 0.5 && within(h, 16.5, 17.5)) return {kind: "bench", pick: chance(key, clock.day, "seat")};
        if (chance(key, clock.day, "dinner") < 0.67 && within(h, 19, 20.5)) {
            // (The host by the day, whichever way round the record names the pair.)
            const [lo, hi] = bond.a < bond.b ? [bond.a, bond.b] : [bond.b, bond.a];
            return {kind: "dinner", home: chance(key, clock.day, "host") < 0.5 ? lo : hi};
        }
        return null;
    }
    const home = bond.home ?? bond.a;
    if (weekend && within(h, 14.5, 16)) return {kind: "walk", pick: chance(key, clock.day, "where"), share: (h - 14.5) / 1.5};
    if (within(h, 18.5, 19.5)) return {kind: "dinner", home};
    if (within(h, 19.5, 21.5)) return {kind: "sofa", home};
    return null;
}

/** A child's size (share of its grown one) at an age in Ark days: a baby's, growing evenly to grown. */
export function childScale(ageDays: number): number {
    const k = Math.min(Math.max(ageDays / GROWN_DAYS, 0), 1);
    return BABY_SCALE + (1 - BABY_SCALE) * k;
}

/** Whether a child of this age is carried (a babe in arms) rather than walking beside its parent. */
export function carried(ageDays: number): boolean {
    return ageDays < CARRIED_DAYS;
}

/** The parent a child is with at this moment: turn and turn about by the hour (the same for every viewer). */
export function parentNow(child: HumanChild, clock: TownClock): string {
    return chance(child.id, clock.day, Math.floor(clock.hours / 3)) < 0.5 ? child.parents[0] : child.parents[1];
}

/** Whether a human is grown (an adult of the town's schedule), by its birth's Ark day; arrivals are adults. */
export function isGrown(bornArkDay: number | null | undefined, origin: string | null | undefined, arkDay: number): boolean {
    return origin !== "born" || bornArkDay === null || bornArkDay === undefined || arkDay - bornArkDay >= GROWN_DAYS;
}
