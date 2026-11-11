/**
 * The home area's plots as the props lay them out (docs/ark/props.md, "Home
 * plots"): pure (no three.js, no `sampler.ts`, so the sampler can import it
 * without a cycle) and deterministic per plot id.
 *
 * The owner's hamlet grows by plots: a house with its garden, a smallholding
 * with its paddock and coop. The map lane builds the layout (`homePlots()`);
 * until it lands, `defaultHomePlots()` is today's island: the cottage's plot
 * and the barn's smallholding. Every detail the props draw on a plot (its
 * fences, path, beds, compost, water butt, hay shelter, paddock, troughs,
 * coop) is laid out in the plot's own frame and seeded from its id, so a new
 * plot gets its own.
 *
 * `fencePostTops(plots)` lists the tops of every fence post the props draw,
 * for the sampler's `fence_post` attach points (`fence_post:paddock:<n>`,
 * `fence_post:picket:<n>`).
 */

import {forestFill, worldDecor} from "@/ark-scene/decor";
import {fieldCropAt} from "@/ark-scene/fields";
import {COTTAGE} from "@/ark-scene/micro-decor";
import {hashString, riverDistance, sampleGround, seeded} from "@/ark-scene/world";
import type {CottageStyle} from "@/ark-scene/micro-scene";
import type {BarnStyle} from "@/ark-scene/vegetation";

export type HomePlotKind = "house" | "smallholding";

/**
 * One plot. Its frame: the origin at (x, z), turned by `rotation` about y
 * (three's: local +z → (sin, cos)); a house plot's local origin is its
 * house's middle, the house facing local +z; a smallholding's is its barn's
 * (or the yard's) middle, the barn's long side along local x.
 */
export type HomePlot = {
    id: string;
    kind: HomePlotKind;
    x: number;
    z: number;
    rotation: number;
    /** A house plot: the house's floor height (the cottage's plinth). Default: the ground at the origin plus the cottage's plinth. */
    floor?: number;
    /** A smallholding: whether a barn stands at its origin (its loft door and the hay shelter against its gable). */
    barn?: boolean;
};

export type Vec3 = {x: number; y: number; z: number};

/** Today's island: the cottage's plot and the barn's smallholding (the map lane's `homePlots()` replaces this). */
export function defaultHomePlots(): HomePlot[] {
    const plots: HomePlot[] = [{id: "house-0", kind: "house", x: COTTAGE.x, z: COTTAGE.z, rotation: 0, floor: COTTAGE.floor}];
    const barn = worldDecor().find((item) => item.kind === "barn");
    if (barn) plots.push({id: "smallholding-0", kind: "smallholding", x: barn.x, z: barn.z, rotation: barn.rotation, barn: true});
    return plots;
}

export type PlotFrame = {
    plot: HomePlot;
    /** Local (x, z) to the world. */
    toWorld: (lx: number, lz: number) => {x: number; z: number};
    /** The world to local (x, z). */
    toLocal: (x: number, z: number) => {x: number; z: number};
    /** The ground's height under a local point. */
    ground: (lx: number, lz: number) => number;
    /** A house plot's floor (else the ground at the origin). */
    floor: number;
    /** A stable random for one detail of this plot. */
    random: (detail: string) => () => number;
};

export function plotFrame(plot: HomePlot): PlotFrame {
    const c = Math.cos(plot.rotation);
    const s = Math.sin(plot.rotation);
    const toWorld = (lx: number, lz: number) => ({x: plot.x + lx * c + lz * s, z: plot.z - lx * s + lz * c});
    const toLocal = (x: number, z: number) => {
        const dx = x - plot.x;
        const dz = z - plot.z;
        return {x: dx * c - dz * s, z: dx * s + dz * c};
    };
    const ground = (lx: number, lz: number) => {
        const w = toWorld(lx, lz);
        return sampleGround(w.x, w.z).height;
    };
    const plinth = COTTAGE.floor - sampleGround(COTTAGE.x, COTTAGE.z).height;
    const floor = plot.floor ?? (plot.kind === "house" ? sampleGround(plot.x, plot.z).height + plinth : sampleGround(plot.x, plot.z).height);
    return {plot, toWorld, toLocal, ground, floor, random: (detail) => seeded(hashString(`${plot.id}:${detail}`))};
}

// MARK: - The buildings' looks, per plot

/** A plot's own draw from its id, 0…1 (stable across viewers and sessions). */
function draw(plot: HomePlot, what: string): number {
    return (hashString(`${plot.id}:${what}`) % 100000) / 100000;
}

const pick = <T,>(list: readonly T[], u: number): T => list[Math.min(Math.floor(u * list.length), list.length - 1)];

/** Today's cottage's look (micro-scene.ts COTTAGE_STYLE): the first house plot keeps it. */
const TODAYS_COTTAGE: CottageStyle = {wall: "#e3d5bb", tile: "#9c5a3c", wood: "#6f4f36", chimney: 1, porch: true};

/**
 * A house plot's cottage: limewash, tiles and woodwork, the chimney's side, a porch or not, and its size (`scale`,
 * 0.9–1 of today's, the garden's house-hung details scaled with it), all from its id, so the hamlet is not one
 * cottage cloned. The first plot ("house-0") is today's.
 */
export function cottageStyle(plot: HomePlot): CottageStyle & {scale: number} {
    if (plot.id === "house-0") return {...TODAYS_COTTAGE, scale: 1};
    return {
        wall: pick(["#e3d5bb", "#eadfc8", "#d9cbb0", "#e9dccb", "#d8d3c6", "#efe3cf", "#e4cdb2"], draw(plot, "wall")),
        tile: pick(["#9c5a3c", "#7d4a36", "#5f5a55", "#8a6a4a", "#6d4038", "#4f5560", "#a8664a"], draw(plot, "tile")),
        wood: pick(["#6f4f36", "#4c5b4a", "#5a4a3e", "#3f4f5f", "#7a3b30", "#55606a"], draw(plot, "wood")),
        chimney: draw(plot, "chimney") < 0.5 ? 1 : -1,
        porch: draw(plot, "porch") > 0.3,
        scale: 0.9 + 0.1 * draw(plot, "size")
    };
}

/** Today's barn's look (vegetation.ts BARN_STYLE). */
const TODAYS_BARN: BarnStyle = {wall: "#9b4b36", roof: "#4d4440", trim: "#efe6d6", size: [1, 1, 1]};

/** A smallholding's barn, or a smaller farm shed, its colours and size from its id. The first ("smallholding-0") is today's. */
export function barnStyle(plot: HomePlot): BarnStyle & {shed: boolean} {
    if (plot.id === "smallholding-0") return {...TODAYS_BARN, shed: false};
    const shed = draw(plot, "shed") < 0.4;
    const k = 0.9 + 0.12 * draw(plot, "size");
    return {
        wall: pick(["#9b4b36", "#8a5a3a", "#6b5a48", "#5c6a5a", "#a35a40", "#7a4a3a"], draw(plot, "wall")),
        roof: pick(["#4d4440", "#5a524a", "#3f4a52", "#62574d"], draw(plot, "roof")),
        trim: pick(["#efe6d6", "#e2d8c4", "#f3eee4"], draw(plot, "trim")),
        size: shed ? [0.62, 0.72, 0.7] : [k, k, k],
        shed
    };
}

/** The house's chimney top in the world (micro-scene.ts: the stack on the back slope, on its style's side), for its smoke. */
export function chimneyTop(plot: HomePlot): Vec3 {
    const frame = plotFrame(plot);
    const style = cottageStyle(plot);
    const halfD = COTTAGE.depth / 2;
    const roof = (fromRidge: number) => COTTAGE.wall + COTTAGE.ridge * (1 - fromRidge / halfD);
    const w = frame.toWorld(-1.4 * style.chimney * style.scale, -0.9 * style.scale);
    return {x: w.x, y: frame.floor + (roof(0.9) + 0.6 + 0.78) * style.scale, z: w.z};
}

// MARK: - The house's garden

/** The front garden's picket fence runs (local: a → b), the gate's gap at the path, and where the path meets it. */
export const GARDEN = {gateZ: 8.6, side: 4.6, gateFrom: -0.75, gateTo: 0.55};

export function picketRuns(): Array<[number, number, number, number]> {
    const halfD = COTTAGE.depth / 2;
    const {gateZ, side, gateFrom, gateTo} = GARDEN;
    return [
        [-side, gateZ, gateFrom, gateZ],
        [gateTo, gateZ, side, gateZ],
        [-side, halfD + 0.4, -side, gateZ],
        [side, halfD + 0.4, side, gateZ]
    ];
}

/** A picket fence's posts: one every 1.2 m or so along each run, its ends included (local), with their run's direction. */
export function picketPosts(): Array<{x: number; z: number; along: {x: number; z: number}}> {
    const posts: Array<{x: number; z: number; along: {x: number; z: number}}> = [];
    for (const [ax, az, bx, bz] of picketRuns()) {
        const length = Math.hypot(bx - ax, bz - az);
        const count = Math.max(1, Math.round(length / 1.2));
        const along = {x: (bx - ax) / length, z: (bz - az) / length};
        for (let k = 0; k <= count; k++) posts.push({x: ax + (bx - ax) * (k / count), z: az + (bz - az) * (k / count), along});
    }
    return posts;
}

/** The picket fence's post height (its top over the ground). */
export const PICKET_POST_TOP = 0.95;

/** The vegetable patch west of the house (local): ridged beds `pitch` apart from `x0`, `width` wide, running z0…z1; the bean wigwam at the last row's end. */
export const GARDEN_BEDS = {x0: -7.6, rows: 4, pitch: 0.95, width: 0.6, z0: -1.6, z1: 2.4, wigwam: {z: 0.4, r: 0.5}} as const;

/** The compost bin behind the house (local): its middle and half its size. */
export const COMPOST = {x: 3.4, z: -COTTAGE.depth / 2 - 2.2, half: 0.75} as const;

// MARK: - The smallholding's paddock

/** Trees, rocks and buildings a fence or a coop must not run through (the decor's and the forest fill's). */
let obstacleCache: Array<{x: number; z: number; r: number}> | null = null;
export function homeObstacles(): Array<{x: number; z: number; r: number}> {
    if (obstacleCache) return obstacleCache;
    const solid = new Set(["broadleaf", "rainforest", "conifer", "acacia", "palm", "orchard", "rock", "canopy", "cactus", "shrub", "barn", "hay", "cottage"]);
    obstacleCache = [...worldDecor(), ...forestFill()]
        .filter((item) => solid.has(item.kind))
        .map((item) => ({x: item.x, z: item.z, r: item.kind === "rock" ? item.scale * 0.9 : item.kind === "shrub" ? 0.5 * item.scale : item.kind === "barn" ? 3.6 : item.kind === "cottage" ? 3.4 : 0.45 * Math.max(item.scale, 1)}));
    return obstacleCache;
}

export type PaddockRect = {x0: number; x1: number; z0: number; z1: number};

const paddockCache = new Map<string, PaddockRect>();

/**
 * The paddock's rectangle in the smallholding's frame: of the candidates
 * round its origin (either side, shifted along it), the one on open, dry
 * pasture (the graphics lane's fields keep their crops) whose fence line no
 * tree, rock or building stands in, fewest trees inside next.
 */
export function paddockRect(plot: HomePlot): PaddockRect {
    const cached = paddockCache.get(plot.id);
    if (cached) return cached;
    const frame = plotFrame(plot);
    const width = 9.5;
    const depth = 7.4;
    const near = homeObstacles().filter((o) => Math.hypot(o.x - plot.x, o.z - plot.z) < 30);
    let best: PaddockRect = {x0: -4.5, x1: 5, z0: 3.4, z1: 10.8};
    let bestScore = Infinity;
    for (const side of [1, -1]) {
        for (const shift of [0, -3, 3, -6, 6, -9, 9]) {
            for (const gap of [3.4, 5]) {
                const z0 = side > 0 ? gap : -gap - depth;
                const rect = {x0: shift - width / 2, x1: shift + width / 2, z0, z1: z0 + depth};
                let score = Math.abs(shift) * 0.05 + (gap - 3.4) * 0.1 + (side < 0 ? 0.2 : 0);
                for (const [lx, lz] of [[rect.x0, rect.z0], [rect.x1, rect.z0], [rect.x1, rect.z1], [rect.x0, rect.z1], [(rect.x0 + rect.x1) / 2, (rect.z0 + rect.z1) / 2]]) {
                    const p = frame.toWorld(lx, lz);
                    const ground = sampleGround(p.x, p.z);
                    if (ground.land < 0.9 || ground.height < 0.4 || riverDistance(p.x, p.z) < 3) score += 100;
                }
                for (let gx = 0; gx < 4; gx++) {
                    for (let gz = 0; gz < 3; gz++) {
                        const p = frame.toWorld(rect.x0 + ((gx + 0.5) / 4) * width, rect.z0 + ((gz + 0.5) / 3) * depth);
                        if (fieldCropAt(p.x, p.z)) score += 4;
                    }
                }
                for (const o of near) {
                    const p = frame.toLocal(o.x, o.z);
                    const inside = p.x > rect.x0 && p.x < rect.x1 && p.z > rect.z0 && p.z < rect.z1;
                    const edge = Math.min(Math.abs(p.x - rect.x0), Math.abs(p.x - rect.x1), Math.abs(p.z - rect.z0), Math.abs(p.z - rect.z1));
                    const onLine = p.x > rect.x0 - o.r - 0.6 && p.x < rect.x1 + o.r + 0.6 && p.z > rect.z0 - o.r - 0.6 && p.z < rect.z1 + o.r + 0.6 && (inside ? edge < o.r + 0.6 : true);
                    if (onLine) score += 10;
                    else if (inside) score += 1;
                }
                if (score < bestScore) {
                    bestScore = score;
                    best = rect;
                }
            }
        }
    }
    paddockCache.set(plot.id, best);
    return best;
}

/** The paddock's fence: its segments (local) between posts, every 2.4 m or so, and the gate's gap (east side, middle). */
export function paddockSegments(rect: PaddockRect): Array<{a: {x: number; z: number}; b: {x: number; z: number}; gate: boolean}> {
    const corners: Array<[number, number]> = [[rect.x0, rect.z0], [rect.x1, rect.z0], [rect.x1, rect.z1], [rect.x0, rect.z1]];
    const out: Array<{a: {x: number; z: number}; b: {x: number; z: number}; gate: boolean}> = [];
    for (let e = 0; e < 4; e++) {
        const [ax, az] = corners[e];
        const [bx, bz] = corners[(e + 1) % 4];
        const segments = Math.ceil(Math.hypot(bx - ax, bz - az) / 2.4);
        for (let k = 0; k < segments; k++) {
            out.push({
                a: {x: ax + (bx - ax) * (k / segments), z: az + (bz - az) * (k / segments)},
                b: {x: ax + (bx - ax) * ((k + 1) / segments), z: az + (bz - az) * ((k + 1) / segments)},
                gate: e === 1 && k === Math.floor(segments / 2)
            });
        }
    }
    return out;
}

/** The paddock's post height (its top over the ground). */
export const PADDOCK_POST_TOP = 1.075;

/** Where the smallholding's coop stands (local): just outside the paddock's corner nearest its origin, clear of trees. */
export function coopSpot(plot: HomePlot): {x: number; z: number; turn: number} {
    const rect = paddockRect(plot);
    const frame = plotFrame(plot);
    const near = homeObstacles().filter((o) => Math.hypot(o.x - plot.x, o.z - plot.z) < 30);
    const zNear = Math.abs(rect.z0) < Math.abs(rect.z1) ? rect.z0 : rect.z1;
    const outward = zNear === rect.z0 ? -1 : 1;
    const candidates = [
        {x: rect.x0 - 1.6, z: zNear + outward * 0.2},
        {x: rect.x1 + 1.6, z: zNear + outward * 0.2},
        {x: rect.x0 + 1.4, z: (rect.z0 + rect.z1) / 2},
        {x: rect.x1 - 1.4, z: (rect.z0 + rect.z1) / 2}
    ];
    const random = frame.random("coop");
    const turn = (random() - 0.5) * 0.3;
    for (const spot of candidates) {
        const w = frame.toWorld(spot.x, spot.z);
        const g = sampleGround(w.x, w.z);
        if (g.land < 0.9 || g.height < 0.4) continue;
        if (near.some((o) => Math.hypot(o.x - w.x, o.z - w.z) < o.r + 1.2)) continue;
        return {x: spot.x, z: spot.z, turn};
    }
    return {x: rect.x0 + 1.4, z: (rect.z0 + rect.z1) / 2, turn};
}

// MARK: - Fence posts, for the sampler

export type FencePostTop = {
    /** `paddock` or `picket` (the sampler's ids: `fence_post:<fence>:<n>`). */
    fence: "paddock" | "picket";
    /** Its index among that fence kind's posts, over all the plots in order. */
    n: number;
    plot: string;
    /** The post's top, in the world. */
    position: Vec3;
    /** Along the fence (unit, level). */
    forward: Vec3;
};

/**
 * The top of every fence post the props draw (`props/areas.ts` draws them
 * from these same layouts): the paddocks' posts and the picket fences'
 * posts, plot by plot. Pure, deterministic.
 */
export function fencePostTops(plots: HomePlot[] = defaultHomePlots()): FencePostTop[] {
    const out: FencePostTop[] = [];
    let paddock = 0;
    let picket = 0;
    const turn = (frame: PlotFrame, v: {x: number; z: number}) => {
        const o = frame.toWorld(0, 0);
        const w = frame.toWorld(v.x, v.z);
        const l = Math.hypot(w.x - o.x, w.z - o.z) || 1;
        return {x: (w.x - o.x) / l, y: 0, z: (w.z - o.z) / l};
    };
    for (const plot of plots) {
        const frame = plotFrame(plot);
        if (plot.kind === "house") {
            for (const post of picketPosts()) {
                const w = frame.toWorld(post.x, post.z);
                out.push({fence: "picket", n: picket++, plot: plot.id, position: {x: w.x, y: sampleGround(w.x, w.z).height + PICKET_POST_TOP, z: w.z}, forward: turn(frame, post.along)});
            }
        } else {
            for (const segment of paddockSegments(paddockRect(plot))) {
                if (segment.gate) continue;
                const w = frame.toWorld(segment.a.x, segment.a.z);
                const length = Math.hypot(segment.b.x - segment.a.x, segment.b.z - segment.a.z) || 1;
                out.push({fence: "paddock", n: paddock++, plot: plot.id, position: {x: w.x, y: sampleGround(w.x, w.z).height + PADDOCK_POST_TOP, z: w.z}, forward: turn(frame, {x: (segment.b.x - segment.a.x) / length, z: (segment.b.z - segment.a.z) / length})});
            }
        }
    }
    return out;
}

// MARK: - Where no animal stands

/** Something the props lay on a plot that an animal should not stand on: a rectangle in the plot's frame. */
export type PlotKeepOut = {what: "beds" | "compost" | "water_butt" | "hay_shelter" | "hay" | "trough" | "coop"; x0: number; x1: number; z0: number; z1: number};

/**
 * What the props lay on a plot that no animal should stand on (in the plot's frame, `plotFrame`): a house plot's
 * vegetable beds and bean wigwam, compost bin and water butt; a smallholding's hay shelter, loose hay, troughs and the
 * coop's house (its run is the hens' and stays open). Lawns, paths, the paddock's grass, mud and puddles are walked on.
 * The same numbers `props/areas.ts` draws from.
 */
export function plotKeepOuts(plot: HomePlot): PlotKeepOut[] {
    if (plot.kind === "house") {
        const k = cottageStyle(plot).scale;
        const bedsX1 = GARDEN_BEDS.x0 + (GARDEN_BEDS.rows - 1) * GARDEN_BEDS.pitch + GARDEN_BEDS.wigwam.r;
        return [
            {what: "beds", x0: GARDEN_BEDS.x0 - GARDEN_BEDS.width / 2, x1: bedsX1, z0: GARDEN_BEDS.z0, z1: GARDEN_BEDS.z1},
            {what: "compost", x0: COMPOST.x - COMPOST.half, x1: COMPOST.x + COMPOST.half, z0: COMPOST.z - COMPOST.half, z1: COMPOST.z + COMPOST.half},
            {what: "water_butt", x0: (COTTAGE.width / 2 + 0.3) * k - 0.4, x1: (COTTAGE.width / 2 + 0.3) * k + 0.4, z0: (COTTAGE.depth / 2 + 0.25) * k - 0.4, z1: (COTTAGE.depth / 2 + 0.25) * k + 0.4}
        ];
    }
    const out: PlotKeepOut[] = [
        {what: "hay_shelter", x0: -6.7, x1: -3.5, z0: -1.9, z1: 1.9},
        {what: "hay", x0: -4.3, x1: -2.5, z0: -0.3, z1: 1.5}
    ];
    for (const trough of troughSpots(plot)) out.push({what: "trough", x0: trough.x - trough.length / 2 - 0.1, x1: trough.x + trough.length / 2 + 0.1, z0: trough.z - 0.35, z1: trough.z + 0.35});
    const coop = coopSpot(plot);
    out.push({what: "coop", x0: coop.x - 0.8, x1: coop.x + 0.8, z0: coop.z - 0.55, z1: coop.z + 1.1});
    return out;
}

/** A smallholding's troughs (local): one in the paddock, one by the barn's door; `length` along the plot's x. */
export function troughSpots(plot: HomePlot): Array<{x: number; z: number; length: number}> {
    const paddock = paddockRect(plot);
    return [
        {x: paddock.x0 + (paddock.x1 - paddock.x0) * 0.75, z: paddock.z0 + (paddock.z1 - paddock.z0) * 0.38, length: 2.2},
        {x: 1.2, z: 3.0, length: 1.6}
    ];
}

/** Is a world point on something an animal should not stand on, on any of these plots (with `margin` m round it)? */
export function onHomeKeepOut(x: number, z: number, plots: HomePlot[] = defaultHomePlots(), margin = 0.3): PlotKeepOut | null {
    for (const plot of plots) {
        if (Math.abs(x - plot.x) > 30 || Math.abs(z - plot.z) > 30) continue;
        const local = plotFrame(plot).toLocal(x, z);
        for (const out of plotKeepOuts(plot)) if (local.x > out.x0 - margin && local.x < out.x1 + margin && local.z > out.z0 - margin && local.z < out.z1 + margin) return out;
    }
    return null;
}
