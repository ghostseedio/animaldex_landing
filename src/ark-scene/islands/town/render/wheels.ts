/**
 * Round wheels for the town's hand-built vehicles (lane ark-world, decision 447: the owner, "the trucks have square
 * wheels"). The safari trucks' wheels were four boxes, and the mobile hen house's were vertical cylinders lying flat
 * (`Geo.cylinder` stands along y: a "wheel" of it is a table top). A wheel here is a solid of revolution about the
 * frame's local x (`farm-machines.ts` `spinX`): a tyre with rounded shoulders and a ribbed crown, a dished hub with a
 * centre cap; the vehicle rolls along the frame's local z.
 */

import {at, Geo, tone, type Frame, type V3} from "@/ark-scene/islands/town/render/kit";

type RGB = [number, number, number];

const TYRE = tone("#1f1f20");
const HUB = tone("#8a8f93");
const CAP = tone("#3b3e41");

const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

export type WheelStyle = {
    tyre?: RGB;
    hub?: RGB;
    /** Faces round the tyre (shaded smooth round; 24 on a truck, 12 on a tiny wheel). */
    sides?: number;
};

/**
 * A solid of revolution about the frame's local x, shaded SMOOTH round it (ark-world, the owner again: "round, not
 * faceted"; `farm-machines.ts` spinX draws each of its sides flat, so a 16-sided tyre read as a polygon close up):
 * each corner's normal is the profile's own (its slope between the rings) turned to that corner's angle, so the light
 * rolls round the tyre and only the outline shows its sides. Faces wind outward. `colour(band)`: between ring k and k+1.
 */
function spinRound(geo: Geo, f: Frame, lx: number, ly: number, lz: number, profile: ReadonlyArray<readonly [number, number]>, sides: number, colour: (band: number) => RGB) {
    const point = (x: number, a: number, r: number): V3 => at(f, lx + x, ly + Math.sin(a) * r, lz + Math.cos(a) * r);
    const origin = at(f, 0, 0, 0);
    const dir = (x: number, y: number, z: number): V3 => {
        const p = at(f, x, y, z);
        return [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]];
    };
    const axis = dir(1, 0, 0);
    for (let k = 0; k + 1 < profile.length; k++) {
        const [x0, r0] = profile[k];
        const [x1, r1] = profile[k + 1];
        // The profile's outward normal in (along the axis, out from it): (-(r1 - r0), x1 - x0), then normalised.
        const len = Math.hypot(r1 - r0, x1 - x0) || 1;
        const na = -(r1 - r0) / len;
        const nr = (x1 - x0) / len;
        const normalAt = (a: number): V3 => {
            const radial = dir(0, Math.sin(a), Math.cos(a));
            return [axis[0] * na + radial[0] * nr, axis[1] * na + radial[1] * nr, axis[2] * na + radial[2] * nr];
        };
        const c = colour(k);
        for (let i = 0; i < sides; i++) {
            const a0 = (i / sides) * Math.PI * 2;
            const a1 = ((i + 1) / sides) * Math.PI * 2;
            const A = point(x0, a0, r0);
            const B = point(x1, a0, r1);
            const C = point(x1, a1, r1);
            const D = point(x0, a1, r0);
            const n0 = normalAt(a0);
            const n1 = normalAt(a1);
            // (Wound as spinX's: A B C, A C D; a ring at r = 0 makes its quad a triangle.)
            if (r1 > 1e-6) geo.triShaded(A, B, C, n0, n0, n1, c, c, c);
            if (r0 > 1e-6) geo.triShaded(A, C, D, n0, n1, n1, c, c, c);
        }
    }
}

/**
 * A wheel about the frame's local x, its centre at (lx, ly, lz) in the frame, radius `R`, tyre width `w`. `side` is the
 * way its outer face looks along local x (+1 on the right of the vehicle, -1 on the left), so the hub shows outward.
 */
export function roundWheel(geo: Geo, f: Frame, lx: number, ly: number, lz: number, R: number, w: number, side: 1 | -1, style: WheelStyle = {}) {
    const tyre = style.tyre ?? TYRE;
    const hub = style.hub ?? HUB;
    const sides = style.sides ?? 16;
    const half = w / 2;
    const sh = Math.min(0.09, R * 0.16);
    const hubR = R * 0.56;
    // The tyre, inner wall to outer wall: the sidewall, a rounded shoulder, a crown ribbed in three (a groove between
    // the ribs), the other shoulder, the sidewall.
    const profile: Array<[number, number]> = [[-half, hubR], [-half, R - sh], [-half + sh * 0.55, R - sh * 0.2], [-half + sh, R], [-half * 0.34, R], [-half * 0.3, R - sh * 0.3], [half * 0.3, R - sh * 0.3], [half * 0.34, R], [half - sh, R], [half - sh * 0.55, R - sh * 0.2], [half, R - sh], [half, hubR]];
    spinRound(geo, f, lx, ly, lz, profile, sides, (band) => shade(tyre, band === 5 ? 0.78 : band === 0 || band === 10 ? 1.18 : band % 2 ? 0.92 : 1));
    // The hub: a rim ring, dished in from the outer wall, and its centre cap (on the outer side; the inner face is closed below).
    const out = side * half;
    const rim: Array<[number, number]> = side > 0 ? [[out - 0.01, hubR], [out - 0.05, hubR * 0.86], [out - 0.08, hubR * 0.38], [out - 0.04, hubR * 0.3], [out - 0.04, 0]] : [[out + 0.04, 0], [out + 0.04, hubR * 0.3], [out + 0.08, hubR * 0.38], [out + 0.05, hubR * 0.86], [out + 0.01, hubR]];
    spinRound(geo, f, lx, ly, lz, rim, Math.max(8, sides - 4), (band) => (band === 0 || band === 3 ? CAP : shade(hub, 0.9 + 0.1 * (band % 2))));
    // The inner face of the hub, so the wheel is closed from inside (a body's arch shows it).
    const back: Array<[number, number]> = side > 0 ? [[-half + 0.02, 0], [-half + 0.02, hubR]] : [[half - 0.02, hubR], [half - 0.02, 0]];
    spinRound(geo, f, lx, ly, lz, back, Math.max(8, sides - 4), () => shade(hub, 0.55));
}
