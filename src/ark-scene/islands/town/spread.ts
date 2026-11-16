/**
 * Kept animals sharing a place stand apart (the owner, 2026-11-16: "why are most the animals just still or overlaying
 * each other. e.g. the dogs or chickens").
 *
 * Each kept animal's spot is a rendezvous hash over its home's, farm's or enclosure's few spots, and its step off the
 * spot was its own hash too (`placement.ts` offset), blind to who else stands there: three in eight stood exactly on the
 * spot (no step at all), and the rest at hashed angles that could land on one another. With hundreds of dogs, cats and
 * chickens on a few hundred spots, many stood inside one another, and most of them are drawn as the live budget's
 * resting figures (lane TB, decision 255), which never move, so the overlap stayed on screen.
 *
 * This pass, run once over a place's members after they are placed, pushes apart any two closer than their bodies
 * allow, a few rounds, each pushed back inside its bounds by `keep`. Pure and deterministic: the members in id order,
 * a coincident pair split along a hashed direction, so every viewer sees the same layout.
 */

import {hashText} from "@/ark-scene/islands/town/geom";

export type SpreadMember = {id: string; x: number; z: number; /** Half the room it needs (m): about half its body length. */ radius: number};

/** Rounds of pushing apart (each round every overlapping pair once). */
export const SPREAD_ROUNDS = 24;

/**
 * Pushes the members of one place apart, in place. `keep` returns a point back inside the member's bounds (its paddock,
 * its enclosure, clear of walls); a member pushed against a bound stays there and the other moves on.
 */
export function spreadApart<T extends SpreadMember>(members: T[], keep: (member: T, x: number, z: number) => {x: number; z: number}): void {
    if (members.length < 2) return;
    members.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    // Those standing on one point (no step off a shared spot) first laid out on a sunflower about it, the k-th at
    // golden-angle turns, so the pushing starts from a spread and not from a pile.
    const piles = new Map<string, number>();
    for (const m of members) {
        const key = `${Math.round(m.x * 1000)}|${Math.round(m.z * 1000)}`;
        const k = piles.get(key) ?? 0;
        piles.set(key, k + 1);
        if (!k) continue;
        const angle = k * 2.399963 + ((hashText(key) % 6283) / 1000);
        const r = 2 * m.radius * Math.sqrt(k) * 0.9;
        const p = keep(m, m.x + Math.cos(angle) * r, m.z + Math.sin(angle) * r);
        m.x = p.x;
        m.z = p.z;
    }
    for (let round = 0; round < SPREAD_ROUNDS; round++) {
        let moved = false;
        for (let i = 0; i < members.length; i++) {
            for (let j = i + 1; j < members.length; j++) {
                const a = members[i];
                const b = members[j];
                const need = a.radius + b.radius;
                let dx = b.x - a.x;
                let dz = b.z - a.z;
                let d = Math.hypot(dx, dz);
                if (d >= need - 1e-4) continue;
                if (d < 1e-6) {
                    const angle = ((hashText(`${a.id}|${b.id}#spread`) % 6283) / 1000);
                    dx = Math.cos(angle);
                    dz = Math.sin(angle);
                    d = 0;
                } else {
                    dx /= d;
                    dz /= d;
                }
                const half = (need - d) / 2 + 1e-3;
                const pa = keep(a, a.x - dx * half, a.z - dz * half);
                const pb = keep(b, b.x + dx * half, b.z + dz * half);
                a.x = pa.x;
                a.z = pa.z;
                b.x = pb.x;
                b.z = pb.z;
                moved = true;
            }
        }
        if (!moved) return;
    }
}

/** Pairs in `members` closer than their radii allow (for the tests and the report). */
export function overlapsOf(members: ReadonlyArray<SpreadMember>, slack = 0.98): number {
    let count = 0;
    for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
            if (Math.hypot(members[i].x - members[j].x, members[i].z - members[j].z) < (members[i].radius + members[j].radius) * slack) count++;
        }
    }
    return count;
}
