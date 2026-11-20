/**
 * Round wheels for the town's hand-built vehicles (lane ark-world, decision 447: the owner, "the trucks have square
 * wheels"). The safari trucks' wheels were four boxes, and the mobile hen house's were vertical cylinders lying flat
 * (`Geo.cylinder` stands along y: a "wheel" of it is a table top). A wheel here is a solid of revolution about the
 * frame's local x (`farm-machines.ts` `spinX`): a tyre with rounded shoulders and a ribbed crown, a dished hub with a
 * centre cap; the vehicle rolls along the frame's local z.
 */

import {spinX} from "@/ark-scene/islands/town/render/farm-machines";
import {Geo, tone, type Frame} from "@/ark-scene/islands/town/render/kit";

type RGB = [number, number, number];

const TYRE = tone("#1f1f20");
const HUB = tone("#8a8f93");
const CAP = tone("#3b3e41");

const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

export type WheelStyle = {
    tyre?: RGB;
    hub?: RGB;
    /** Faces round the tyre (16 reads as round at a truck's size; 10 for a tiny wheel). */
    sides?: number;
};

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
    spinX(geo, f, lx, ly, lz, profile, sides, (band) => shade(tyre, band === 5 ? 0.78 : band === 0 || band === 10 ? 1.18 : band % 2 ? 0.92 : 1));
    // The hub: a rim ring, dished in from the outer wall, and its centre cap (on the outer side; the inner face is closed below).
    const out = side * half;
    const rim: Array<[number, number]> = side > 0 ? [[out - 0.01, hubR], [out - 0.05, hubR * 0.86], [out - 0.08, hubR * 0.38], [out - 0.04, hubR * 0.3], [out - 0.04, 0]] : [[out + 0.04, 0], [out + 0.04, hubR * 0.3], [out + 0.08, hubR * 0.38], [out + 0.05, hubR * 0.86], [out + 0.01, hubR]];
    spinX(geo, f, lx, ly, lz, rim, Math.max(8, sides - 4), (band) => (band === 0 || band === 3 ? CAP : shade(hub, 0.9 + 0.1 * (band % 2))));
    // The inner face of the hub, so the wheel is closed from inside (a body's arch shows it).
    const back: Array<[number, number]> = side > 0 ? [[-half + 0.02, 0], [-half + 0.02, hubR]] : [[half - 0.02, hubR], [half - 0.02, 0]];
    spinX(geo, f, lx, ly, lz, back, Math.max(8, sides - 4), () => shade(hub, 0.55));
}
