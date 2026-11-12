/**
 * The island's rocks, made here in code (scenery lane, the motion 100x pass; the owner: "mountain rocks look like
 * rectangles"). No downloaded models: every rock is a sphere broken the way rock breaks.
 *
 * A rock starts as a lumpy ellipsoid (an icosphere, so no poles or seams) and is fractured: a handful of planes cut
 * it, each pushing everything beyond it back onto it, which leaves the flat joint faces and sharp-ish arrises real
 * stone has. Bedded rock (the mountain's crags and shelves) is then stepped along tilted bedding planes, each bed set
 * a little back or proud of the next, and split by near-vertical joints, so an outcrop reads as weathered strata,
 * not a pile of boxes. A fine grain roughens every face; the base is cut flat to sit into the ground.
 *
 * Colour is per vertex: the stone's own tone with a little drift, darker in crevices and under overhangs (the
 * surface's own concavity, measured on the mesh), fresher on the joint faces, a band of tone per bed. The material
 * (`asset-rocks.ts`) adds grain, lichen, wet and salt from the place.
 *
 * Pure (no three.js, no DOM): the renderer builds its geometry from these arrays, and the map, the attach points and
 * the checks read the same surface. Deterministic: a rock is a function of its style, variant and detail.
 */

export type RockStyle = "boulder" | "crag" | "slab" | "scree";

export type RockMesh = {
    /** xyz per vertex (m, the rock's own frame: y up, base at y = 0). */
    positions: Float32Array;
    normals: Float32Array;
    /** Linear rgb per vertex (the stone's shading: tone, crevices, beds). */
    colors: Float32Array;
    index: Uint32Array;
    bounds: {min: [number, number, number]; max: [number, number, number]};
    triangles: number;
};

// MARK: - Noise (seeded, smooth, pure)

function hash3(x: number, y: number, z: number, seed: number): number {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ Math.imul(seed | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

function smooth(t: number): number {
    return t * t * (3 - 2 * t);
}

/** Value noise in 3D, 0…1. */
function noise3(x: number, y: number, z: number, seed: number): number {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const zi = Math.floor(z);
    const fx = smooth(x - xi);
    const fy = smooth(y - yi);
    const fz = smooth(z - zi);
    const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, seed);
    const x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * fx;
    const x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * fx;
    const x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * fx;
    const x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * fx;
    const y0 = x00 + (x10 - x00) * fy;
    const y1 = x01 + (x11 - x01) * fy;
    return y0 + (y1 - y0) * fz;
}

function fbm3(x: number, y: number, z: number, seed: number, octaves = 3): number {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
        sum += amp * noise3(x * f, y * f, z * f, seed + o * 101);
        amp *= 0.5;
        f *= 2.03;
    }
    return sum / (1 - 0.5 ** octaves);
}

/** A seeded stream of 0…1 (mulberry32). */
function stream(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// MARK: - The sphere

const icoCache = new Map<number, {positions: number[]; index: number[]}>();

/** A unit icosphere: 20 × 4^detail triangles, shared vertices. */
function icosphere(detail: number): {positions: number[]; index: number[]} {
    const cached = icoCache.get(detail);
    if (cached) return {positions: cached.positions.slice(), index: cached.index.slice()};
    const t = (1 + Math.sqrt(5)) / 2;
    const positions: number[] = [-1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, 0, 0, -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, t, 0, -1, t, 0, 1, -t, 0, -1, -t, 0, 1];
    let index: number[] = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1];
    for (let i = 0; i < positions.length; i += 3) {
        const l = Math.hypot(positions[i], positions[i + 1], positions[i + 2]);
        positions[i] /= l;
        positions[i + 1] /= l;
        positions[i + 2] /= l;
    }
    for (let d = 0; d < detail; d++) {
        const mid = new Map<number, number>();
        const middle = (a: number, b: number) => {
            const key = a < b ? a * 1e6 + b : b * 1e6 + a;
            const known = mid.get(key);
            if (known !== undefined) return known;
            const x = positions[a * 3] + positions[b * 3];
            const y = positions[a * 3 + 1] + positions[b * 3 + 1];
            const z = positions[a * 3 + 2] + positions[b * 3 + 2];
            const l = Math.hypot(x, y, z);
            positions.push(x / l, y / l, z / l);
            const id = positions.length / 3 - 1;
            mid.set(key, id);
            return id;
        };
        const next: number[] = [];
        for (let i = 0; i < index.length; i += 3) {
            const [a, b, c] = [index[i], index[i + 1], index[i + 2]];
            const ab = middle(a, b);
            const bc = middle(b, c);
            const ca = middle(c, a);
            next.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
        }
        index = next;
    }
    icoCache.set(detail, {positions, index});
    return {positions: positions.slice(), index: index.slice()};
}

// MARK: - Fracture

type Plane = {nx: number; ny: number; nz: number; d: number; /** 1: a clean joint face; less leaves a little bulge. */ hard: number};

function cut(p: number[], plane: Plane) {
    for (let i = 0; i < p.length; i += 3) {
        const s = p[i] * plane.nx + p[i + 1] * plane.ny + p[i + 2] * plane.nz - plane.d;
        if (s <= 0) continue;
        const k = s * plane.hard;
        p[i] -= plane.nx * k;
        p[i + 1] -= plane.ny * k;
        p[i + 2] -= plane.nz * k;
    }
}

function randomPlane(random: () => number, reach: number, spread: number, hard: number, bias?: {x: number; y: number; z: number; w: number}): Plane {
    let x = random() * 2 - 1;
    let y = random() * 2 - 1;
    let z = random() * 2 - 1;
    if (bias) {
        x += bias.x * bias.w;
        y += bias.y * bias.w;
        z += bias.z * bias.w;
    }
    const l = Math.hypot(x, y, z) || 1;
    return {nx: x / l, ny: y / l, nz: z / l, d: reach * (1 - spread * random()), hard};
}

/** The look of each style: proportions, fracture, bedding, grain. */
type Recipe = {
    radii: (r: () => number) => [number, number, number];
    cuts: number;
    /** Cut planes sit this far out (share of the radius), less up to `spread`. */
    reach: number;
    spread: number;
    /** Horizontal-normal (joint) cuts among them: near-vertical faces. */
    joints: number;
    /** Bedding: beds per metre of height (0: none), how far a bed steps, the bedding's tilt (rad). */
    beds: number;
    step: number;
    tilt: number;
    lump: number;
    grain: number;
    /** The flat base: cut at this share of the height up from the bottom. */
    base: number;
    /** A few lobes merged (a crag of blocks). */
    lobes: number;
};

const RECIPES: Record<RockStyle, Recipe> = {
    // A boulder: a block broken out of the mountain and tumbled, edges worn but its joint faces still flat.
    boulder: {radii: (r) => [1, 0.55 + 0.25 * r(), 0.7 + 0.25 * r()], cuts: 10, reach: 0.84, spread: 0.3, joints: 3, beds: 0, step: 0, tilt: 0, lump: 0.08, grain: 0.022, base: 0.16, lobes: 1},
    // A crag: bedded rock standing out of the slope, its beds stepped and split by joints into a few blocks.
    crag: {radii: (r) => [1, 1.05 + 0.45 * r(), 0.72 + 0.2 * r()], cuts: 8, reach: 0.86, spread: 0.28, joints: 4, beds: 2.6, step: 0.13, tilt: 0.25, lump: 0.07, grain: 0.02, base: 0.1, lobes: 4},
    // A shelf of bedded rock barely out of the ground: low, wide, its beds stepped.
    slab: {radii: (r) => [1.25 + 0.3 * r(), 0.45 + 0.12 * r(), 0.95 + 0.2 * r()], cuts: 8, reach: 0.86, spread: 0.3, joints: 3, beds: 4.2, step: 0.06, tilt: 0.14, lump: 0.06, grain: 0.018, base: 0.22, lobes: 2},
    // A scree stone: a sharp fragment.
    scree: {radii: (r) => [1, 0.45 + 0.3 * r(), 0.6 + 0.3 * r()], cuts: 6, reach: 0.8, spread: 0.35, joints: 1, beds: 0, step: 0, tilt: 0, lump: 0.05, grain: 0, base: 0.2, lobes: 1}
};

/** The stone's tones (linear-ish rgb before the material's lift): grey granite, warmer sandstone. */
const STONE: Record<RockStyle, [number, number, number]> = {
    // A touch darker and warmer than bare grey: the mountain's own rock (terrain.ts) round them.
    boulder: [0.118, 0.109, 0.096],
    crag: [0.124, 0.113, 0.098],
    slab: [0.132, 0.12, 0.1],
    scree: [0.122, 0.114, 0.102]
};

/** How far an ellipsoid of these radii reaches along a unit direction (its support). */
function support(nx: number, ny: number, nz: number, rx: number, ry: number, rz: number): number {
    return Math.hypot(nx * rx, ny * ry, nz * rz);
}

/** One lobe: a fractured ellipsoid in the rock's frame, before bedding. */
function lobe(recipe: Recipe, random: () => number, detail: number, seed: number): {p: number[]; index: number[]; cutDepth: number[]} {
    const {positions: p, index} = icosphere(detail);
    const [rx, ry, rz] = recipe.radii(random);
    const lumpSeed = Math.floor(random() * 1e6);
    // A lumpy ellipsoid.
    for (let i = 0; i < p.length; i += 3) {
        const n = fbm3(p[i] * 1.3 + 7, p[i + 1] * 1.3, p[i + 2] * 1.3, lumpSeed, 3);
        const k = 1 + recipe.lump * (n * 2 - 1);
        p[i] *= rx * k;
        p[i + 1] *= ry * k;
        p[i + 2] *= rz * k;
    }
    const before = p.slice();
    // Fracture: joints first (near-vertical faces), then cuts every way; harder planes for fresher faces.
    for (let c = 0; c < recipe.joints; c++) {
        const plane = randomPlane(random, 1, recipe.spread, 1);
        // Mostly horizontal normals: the face stands near-vertical.
        const h = Math.hypot(plane.nx, plane.nz) || 1;
        const lean = 0.18 * (random() * 2 - 1);
        const nx = (plane.nx / h) * Math.cos(lean);
        const nz = (plane.nz / h) * Math.cos(lean);
        const ny = Math.sin(lean);
        cut(p, {nx, ny, nz, d: support(nx, ny, nz, rx, ry, rz) * recipe.reach * (1 - recipe.spread * random()), hard: plane.hard});
    }
    for (let c = 0; c < recipe.cuts; c++) {
        const plane = randomPlane(random, 1, recipe.spread, 0.9 + 0.1 * random());
        cut(p, {...plane, d: support(plane.nx, plane.ny, plane.nz, rx, ry, rz) * recipe.reach * (1 - recipe.spread * random())});
    }
    const cutDepth: number[] = [];
    for (let i = 0; i < p.length; i += 3) cutDepth.push(Math.hypot(before[i] - p[i], before[i + 1] - p[i + 1], before[i + 2] - p[i + 2]));
    void seed;
    return {p, index, cutDepth};
}

/**
 * A rock of a style: `variant` picks its shape (any integer: a different rock), `detail` its mesh (0 → 20
 * triangles a lobe, 1 → 80, 2 → 320, 3 → 1280). The same variant at every detail is the same rock, coarser.
 */
export function rockMesh(style: RockStyle, variant: number, detail: number): RockMesh {
    const recipe = RECIPES[style];
    const seed = 7919 * (variant + 1) + style.length * 104729 + style.charCodeAt(0) * 31;
    const random = stream(seed);
    const lobes: Array<{p: number[]; index: number[]; cutDepth: number[]}> = [];
    const count = recipe.lobes > 1 ? recipe.lobes - Math.floor(random() * Math.min(recipe.lobes - 1, 2)) : 1;
    for (let k = 0; k < count; k++) {
        const one = lobe(recipe, random, detail, seed + k);
        if (k > 0) {
            // Further blocks along the band (its x), either side in turn: smaller, lower, a little in or out of line.
            const s = 0.5 + 0.35 * random();
            const side = k % 2 ? 1 : -1;
            const out = side * (0.75 + 0.45 * random()) * (1 + 0.35 * Math.floor((k - 1) / 2));
            const off = (random() - 0.5) * 0.5;
            for (let i = 0; i < one.p.length; i += 3) {
                one.p[i] = one.p[i] * s + out;
                one.p[i + 1] = one.p[i + 1] * s - 0.2 * (1 - s);
                one.p[i + 2] = one.p[i + 2] * s + off;
            }
        }
        lobes.push(one);
    }
    const p: number[] = [];
    const index: number[] = [];
    const cutDepth: number[] = [];
    const lobeOf: number[] = [];
    lobes.forEach((one, k) => {
        const offset = p.length / 3;
        p.push(...one.p);
        cutDepth.push(...one.cutDepth);
        for (const i of one.index) index.push(i + offset);
        for (let i = 0; i < one.p.length / 3; i++) lobeOf.push(k);
    });
    // Bedding: stepped along tilted planes, each bed set back or proud, its own tone.
    const bedOf: number[] = new Array(p.length / 3).fill(0);
    if (recipe.beds > 0) {
        const tiltAxis = random() * Math.PI * 2;
        const ux = Math.sin(recipe.tilt) * Math.cos(tiltAxis);
        const uz = Math.sin(recipe.tilt) * Math.sin(tiltAxis);
        const uy = Math.cos(recipe.tilt);
        const thickness = 1 / recipe.beds;
        const phase = random();
        const setback: number[] = Array.from({length: 64}, () => (random() * 2 - 1));
        for (let i = 0; i < p.length; i += 3) {
            const h = p[i] * ux + p[i + 1] * uy + p[i + 2] * uz;
            const t = h / thickness + phase;
            const bed = Math.floor(t);
            const f = t - bed;
            // The step: a bed's top rounds over into the next one's face (a terrace with worn lips).
            const terrace = (bed + smooth(Math.min(Math.max((f - 0.55) / 0.45, 0), 1)) - t) * thickness;
            const along = 0.8;
            p[i] += ux * terrace * along;
            p[i + 1] += uy * terrace * along;
            p[i + 2] += uz * terrace * along;
            // Each bed in or out a little, toward or away from the rock's middle.
            const back = setback[((bed % 64) + 64) % 64] * recipe.step;
            const r = Math.hypot(p[i], p[i + 2]) || 1;
            p[i] += (p[i] / r) * back;
            p[i + 2] += (p[i + 2] / r) * back;
            bedOf[i / 3] = bed;
        }
    }
    // Grain: a fine roughness along the surface's own outward direction.
    if (recipe.grain > 0) {
        const grainSeed = Math.floor(random() * 1e6);
        for (let i = 0; i < p.length; i += 3) {
            const l = Math.hypot(p[i], p[i + 1], p[i + 2]) || 1;
            const n = fbm3(p[i] * 4.1, p[i + 1] * 4.1, p[i + 2] * 4.1, grainSeed, 2) * 2 - 1;
            const k = recipe.grain * n;
            p[i] += (p[i] / l) * k;
            p[i + 1] += (p[i + 1] / l) * k;
            p[i + 2] += (p[i + 2] / l) * k;
        }
    }
    // The base: cut flat, then everything set on y = 0.
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < p.length; i += 3) {
        minY = Math.min(minY, p[i]);
        maxY = Math.max(maxY, p[i]);
    }
    const floor = minY + (maxY - minY) * recipe.base;
    for (let i = 1; i < p.length; i += 3) p[i] = Math.max(p[i], floor) - floor;

    // Normals (smooth over the shared vertices: a joint face stays flat, its edge softens).
    const vertices = p.length / 3;
    const normals = new Float32Array(p.length);
    for (let i = 0; i < index.length; i += 3) {
        const [a, b, c] = [index[i] * 3, index[i + 1] * 3, index[i + 2] * 3];
        const e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
        const e2 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
        const nx = e1[1] * e2[2] - e1[2] * e2[1];
        const ny = e1[2] * e2[0] - e1[0] * e2[2];
        const nz = e1[0] * e2[1] - e1[1] * e2[0];
        for (const v of [a, b, c]) {
            normals[v] += nx;
            normals[v + 1] += ny;
            normals[v + 2] += nz;
        }
    }
    for (let i = 0; i < normals.length; i += 3) {
        const l = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
        normals[i] /= l;
        normals[i + 1] /= l;
        normals[i + 2] /= l;
    }
    // Concavity: how far a vertex sits in from its neighbours' middle, along its normal (crevices, under beds).
    const sum = new Float32Array(p.length);
    const count2 = new Uint16Array(vertices);
    for (let i = 0; i < index.length; i += 3) {
        for (let e = 0; e < 3; e++) {
            const a = index[i + e];
            const b = index[i + ((e + 1) % 3)];
            sum[a * 3] += p[b * 3];
            sum[a * 3 + 1] += p[b * 3 + 1];
            sum[a * 3 + 2] += p[b * 3 + 2];
            count2[a]++;
            sum[b * 3] += p[a * 3];
            sum[b * 3 + 1] += p[a * 3 + 1];
            sum[b * 3 + 2] += p[a * 3 + 2];
            count2[b]++;
        }
    }
    const height = maxY - floor || 1;
    const [r0, g0, b0] = STONE[style];
    const toneSeed = Math.floor(random() * 1e6);
    const colors = new Float32Array(p.length);
    for (let v = 0; v < vertices; v++) {
        const i = v * 3;
        const n = count2[v] || 1;
        const dx = sum[i] / n - p[i];
        const dy = sum[i + 1] / n - p[i + 1];
        const dz = sum[i + 2] / n - p[i + 2];
        // Positive: the neighbours stand out past this vertex (a hollow).
        const hollow = (dx * normals[i] + dy * normals[i + 1] + dz * normals[i + 2]) / (0.06 * height + 0.02);
        const occlusion = 1 - 0.45 * Math.min(Math.max(hollow, 0), 1);
        // Under an overhang (facing down) and near the ground: darker; the tops catch light and dry paler.
        const low = 0.82 + 0.18 * Math.min(p[i + 1] / (0.35 * height), 1);
        const up = 0.92 + 0.12 * normals[i + 1];
        // Fresh joint faces (deep cuts) a touch paler and cooler; each bed its own tone; a slow drift over the stone.
        const fresh = Math.min(cutDepth[v] / (0.12 * height + 0.05), 1) * 0.07;
        const bed = recipe.beds > 0 ? (hash3(bedOf[v], lobeOf[v], 3, toneSeed) - 0.5) * 0.16 : 0;
        const drift = (fbm3(p[i] * 0.9, p[i + 1] * 0.9, p[i + 2] * 0.9, toneSeed, 2) - 0.5) * 0.18;
        const shade = occlusion * low * up * (1 + bed + drift);
        colors[i] = (r0 + fresh * 0.9) * shade;
        colors[i + 1] = (g0 + fresh) * shade;
        colors[i + 2] = (b0 + fresh * 1.15) * shade;
    }
    // Crisp joint edges: each corner's normal averages only the faces round its vertex within the crease angle of its
    // own face, so a joint face stays flat to its edge and the arris between two faces shows.
    const faces = index.length / 3;
    const faceNormal = new Float32Array(faces * 3);
    const faceUnit = new Float32Array(faces * 3);
    // Faces round each vertex, as flat arrays (start, count) rather than a list per vertex.
    const degree = new Uint16Array(vertices);
    for (let i = 0; i < index.length; i++) degree[index[i]]++;
    const start = new Uint32Array(vertices + 1);
    for (let v = 0; v < vertices; v++) start[v + 1] = start[v] + degree[v];
    const fill = start.slice(0, vertices);
    const around = new Uint32Array(index.length);
    for (let f = 0; f < faces; f++) {
        const [a, b, c] = [index[f * 3] * 3, index[f * 3 + 1] * 3, index[f * 3 + 2] * 3];
        const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
        const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
        // Area-weighted (the cross product's length is twice the area).
        const nx = e1y * e2z - e1z * e2y;
        const ny = e1z * e2x - e1x * e2z;
        const nz = e1x * e2y - e1y * e2x;
        const l = Math.hypot(nx, ny, nz) || 1;
        faceNormal[f * 3] = nx;
        faceNormal[f * 3 + 1] = ny;
        faceNormal[f * 3 + 2] = nz;
        faceUnit[f * 3] = nx / l;
        faceUnit[f * 3 + 1] = ny / l;
        faceUnit[f * 3 + 2] = nz / l;
        for (let k = 0; k < 3; k++) around[fill[index[f * 3 + k]]++] = f;
    }
    const crease = Math.cos(CREASE);
    const outP = new Float32Array(faces * 9);
    const outN = new Float32Array(faces * 9);
    const outC = new Float32Array(faces * 9);
    for (let f = 0; f < faces; f++) {
        const ox = faceUnit[f * 3], oy = faceUnit[f * 3 + 1], oz = faceUnit[f * 3 + 2];
        for (let k = 0; k < 3; k++) {
            const v = index[f * 3 + k];
            let nx = 0, ny = 0, nz = 0;
            for (let j = start[v]; j < start[v + 1]; j++) {
                const g = around[j];
                if (faceUnit[g * 3] * ox + faceUnit[g * 3 + 1] * oy + faceUnit[g * 3 + 2] * oz < crease) continue;
                nx += faceNormal[g * 3];
                ny += faceNormal[g * 3 + 1];
                nz += faceNormal[g * 3 + 2];
            }
            const l = Math.hypot(nx, ny, nz) || 1;
            const o = f * 9 + k * 3;
            outN[o] = nx / l;
            outN[o + 1] = ny / l;
            outN[o + 2] = nz / l;
            outP[o] = p[v * 3];
            outP[o + 1] = p[v * 3 + 1];
            outP[o + 2] = p[v * 3 + 2];
            outC[o] = colors[v * 3];
            outC[o + 1] = colors[v * 3 + 1];
            outC[o + 2] = colors[v * 3 + 2];
        }
    }
    const min: [number, number, number] = [Infinity, Infinity, Infinity];
    const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < p.length; i += 3) {
        for (let k = 0; k < 3; k++) {
            min[k] = Math.min(min[k], p[i + k]);
            max[k] = Math.max(max[k], p[i + k]);
        }
    }
    // Shared again where corners agree (the same vertex, the same normal): a joint face's corners are one vertex each.
    const seen = new Map<string, number>();
    const index2 = new Uint32Array(faces * 3);
    const keepP: number[] = [];
    const keepN: number[] = [];
    const keepC: number[] = [];
    for (let c = 0; c < faces * 3; c++) {
        const o = c * 3;
        const key = `${index[c]}:${Math.round(outN[o] * 1e4)},${Math.round(outN[o + 1] * 1e4)},${Math.round(outN[o + 2] * 1e4)}`;
        let id = seen.get(key);
        if (id === undefined) {
            id = keepP.length / 3;
            seen.set(key, id);
            keepP.push(outP[o], outP[o + 1], outP[o + 2]);
            keepN.push(outN[o], outN[o + 1], outN[o + 2]);
            keepC.push(outC[o], outC[o + 1], outC[o + 2]);
        }
        index2[c] = id;
    }
    return {positions: new Float32Array(keepP), normals: new Float32Array(keepN), colors: new Float32Array(keepC), index: index2, bounds: {min, max}, triangles: faces};
}

/** Faces meeting at more than this (radians) keep their own normals: a joint's edge. */
const CREASE = 0.62;

// MARK: - Sizes and shared facts

const meshCache = new Map<string, RockMesh>();

/** The rock's mesh, cached (one per style, variant and detail). */
export function cachedRock(style: RockStyle, variant: number, detail: number): RockMesh {
    const key = `${style}:${variant}:${detail}`;
    let mesh = meshCache.get(key);
    if (!mesh) {
        mesh = rockMesh(style, variant, detail);
        meshCache.set(key, mesh);
    }
    return mesh;
}

/** How many shapes of each style the island draws (each a mesh per detail; every rock of the style is one of them). */
export const ROCK_VARIANTS: Record<RockStyle, number> = {boulder: 6, crag: 8, slab: 3, scree: 4};

/** The detail of each level of detail (near, middle, far). */
export const ROCK_DETAIL: Record<RockStyle, [number, number, number]> = {boulder: [3, 2, 1], crag: [3, 2, 1], slab: [3, 2, 1], scree: [1, 1, 0]};

// MARK: - Attach points on a rock made here

/** An attach point on a rock's own surface (asset space, as `public/ark/assets/v1/rocks/attach.json` rows). */
export type RockAttachRow = {tag: "ledge" | "rock_face"; p: [number, number, number]; n: [number, number, number]; size: [number, number]; spot: "rocks"};

const rowCache = new Map<string, RockAttachRow[]>();

/**
 * Where small animals can sit on a rock made here, on its drawn near mesh: ledges (the highest faces that look up,
 * spread apart) and rock faces (the sides, round the rock and at two heights). Deterministic, in the rock's own metres.
 */
export function rockAttachRows(style: RockStyle, variant: number): RockAttachRow[] {
    const key = `${style}:${variant}`;
    const known = rowCache.get(key);
    if (known) return known;
    const mesh = cachedRock(style, variant, ROCK_DETAIL[style][0]);
    const p = mesh.positions;
    const height = mesh.bounds.max[1];
    const width = Math.min(mesh.bounds.max[0] - mesh.bounds.min[0], mesh.bounds.max[2] - mesh.bounds.min[2]);
    const cx = (mesh.bounds.min[0] + mesh.bounds.max[0]) / 2;
    const cz = (mesh.bounds.min[2] + mesh.bounds.max[2]) / 2;
    type Face = {c: [number, number, number]; n: [number, number, number]; area: number};
    const faces: Face[] = [];
    const ix = mesh.index;
    for (let t = 0; t < ix.length; t += 3) {
        const [a, b, c] = [ix[t] * 3, ix[t + 1] * 3, ix[t + 2] * 3];
        const e1 = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]];
        const e2 = [p[c] - p[a], p[c + 1] - p[a + 1], p[c + 2] - p[a + 2]];
        const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const l = Math.hypot(n[0], n[1], n[2]);
        if (l < 1e-9) continue;
        faces.push({c: [(p[a] + p[b] + p[c]) / 3, (p[a + 1] + p[b + 1] + p[c + 1]) / 3, (p[a + 2] + p[b + 2] + p[c + 2]) / 3], n: [n[0] / l, n[1] / l, n[2] / l], area: l / 2});
    }
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    const row = (tag: RockAttachRow["tag"], f: Face, size: number): RockAttachRow => ({tag, p: [r3(f.c[0]), r3(f.c[1]), r3(f.c[2])], n: [r3(f.n[0]), r3(f.n[1]), r3(f.n[2])], size: [0.005, r3(size)], spot: "rocks"});
    const rows: RockAttachRow[] = [];
    // Ledges: up-facing faces high on the rock, highest first, at least a third of its width apart.
    const tops = faces.filter((f) => f.n[1] >= 0.8 && f.c[1] > height * 0.55).sort((a, b) => b.c[1] - a.c[1]);
    const ledges: Face[] = [];
    for (const f of tops) {
        if (ledges.length >= 4) break;
        if (ledges.some((l) => Math.hypot(l.c[0] - f.c[0], l.c[2] - f.c[2]) < width / 3)) continue;
        ledges.push(f);
        rows.push(row("ledge", f, Math.min(1.2, width * 0.55)));
    }
    // Rock faces: the sides, in eight directions round the rock's middle at a low and a high band, the face nearest
    // each direction that looks out.
    for (const band of [0.3, 0.65]) {
        for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            const want = [Math.cos(a), Math.sin(a)];
            let best: Face | null = null;
            let score = -Infinity;
            for (const f of faces) {
                if (Math.abs(f.n[1]) > 0.5 || Math.abs(f.c[1] / height - band) > 0.18) continue;
                const dx = f.c[0] - cx;
                const dz = f.c[2] - cz;
                const l = Math.hypot(dx, dz) || 1;
                const outward = (f.n[0] * dx + f.n[2] * dz) / l;
                if (outward < 0.3) continue;
                const s = (dx * want[0] + dz * want[1]) / l + 0.3 * outward;
                if (s > score) {
                    score = s;
                    best = f;
                }
            }
            if (best && !rows.some((r) => r.tag === "rock_face" && Math.hypot(r.p[0] - best!.c[0], r.p[1] - best!.c[1], r.p[2] - best!.c[2]) < 0.05)) rows.push(row("rock_face", best, Math.min(0.8, height * 0.5)));
        }
    }
    rowCache.set(key, rows);
    return rows;
}

// MARK: - Placing a rock (shared by the layout, the decor's rocks, the map's boxes and the checks)

/** Rotation of (x, y, z) by the tilt-then-turn the renderer composes: quaternion(up) · quaternion(yaw about y). */
export function orient(up: [number, number, number], yaw: number): (x: number, y: number, z: number) => [number, number, number] {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    // The shortest arc from +y to `up` (three's setFromUnitVectors), as a matrix (Rodrigues).
    const [ux, uy, uz] = up;
    const k = 1 / (1 + uy);
    const m00 = uy + uz * uz * k;
    const m02 = -ux * uz * k;
    const m22 = uy + ux * ux * k;
    return (x, y, z) => {
        // Turn about y first (three: x' = x cos + z sin, z' = -x sin + z cos), then tilt.
        const tx = x * c + z * s;
        const tz = -x * s + z * c;
        return [m00 * tx + ux * y + m02 * tz, -ux * tx + uy * y - uz * tz, m02 * tx + uz * y + m22 * tz];
    };
}

/**
 * A placed rock's box as `map/rocks.ts` keeps rocks: in its turned frame on the ground (local x = dx cos − dz sin,
 * local z = dx sin + dz cos), the tilt folded in; its foot and top (world).
 */
export function tiltedBox(bounds: {min: number[]; max: number[]}, scale: number, up: [number, number, number], yaw: number, y: number): {hx0: number; hx1: number; hz0: number; hz1: number; y0: number; y1: number} {
    const rotate = orient(up, yaw);
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    let hx0 = Infinity, hx1 = -Infinity, hz0 = Infinity, hz1 = -Infinity;
    for (const x of [bounds.min[0], bounds.max[0]]) for (const yy of [bounds.min[1], bounds.max[1]]) for (const z of [bounds.min[2], bounds.max[2]]) {
        const [dx, , dz] = rotate(x * scale, yy * scale, z * scale);
        const lx = dx * c - dz * s;
        const lz = dx * s + dz * c;
        hx0 = Math.min(hx0, lx);
        hx1 = Math.max(hx1, lx);
        hz0 = Math.min(hz0, lz);
        hz1 = Math.max(hz1, lz);
    }
    // Its top and foot: of the ellipsoid inside its bounds (a rock is round-ish), not the turned box's corners, which
    // stand well above a leaning rock's real top. Unleaned, exactly the bounds' top and bottom.
    const half = [0, 1, 2].map((k) => ((bounds.max[k] - bounds.min[k]) / 2) * scale);
    const [, cy] = rotate(((bounds.min[0] + bounds.max[0]) / 2) * scale, ((bounds.min[1] + bounds.max[1]) / 2) * scale, ((bounds.min[2] + bounds.max[2]) / 2) * scale);
    // The world y of each of the rock's own axes (the rotation's second row).
    const ax = rotate(1, 0, 0)[1];
    const ay = rotate(0, 1, 0)[1];
    const az = rotate(0, 0, 1)[1];
    const reach = Math.hypot(half[0] * ax, half[1] * ay, half[2] * az);
    return {hx0, hx1, hz0, hz1, y0: y + cy - reach, y1: y + cy + reach};
}

/** A rock's base outline (an ellipse inside its bounds' footprint, `inset` of it) and middle, offsets from its origin. */
export function baseOutline(bounds: {min: number[]; max: number[]}, scale: number, up: [number, number, number], yaw: number, inset = 0.9): Array<[number, number, number]> {
    const rotate = orient(up, yaw);
    const points: Array<[number, number, number]> = [];
    for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const x = ((Math.cos(a) * 0.5 + 0.5) * (bounds.max[0] - bounds.min[0]) + bounds.min[0]) * inset;
        const z = ((Math.sin(a) * 0.5 + 0.5) * (bounds.max[2] - bounds.min[2]) + bounds.min[2]) * inset;
        points.push(rotate(x * scale, 0, z * scale));
    }
    points.push(rotate(((bounds.min[0] + bounds.max[0]) / 2) * scale, 0, ((bounds.min[2] + bounds.max[2]) / 2) * scale));
    return points;
}
