/**
 * What grows under the sea (graphics pass, batch 4): the reef's corals,
 * sponges and anemones, the seagrass meadows of the sandy shallows and the
 * kelp forests off the rocky coasts, each placed by the water's depth and
 * what the bed is made of there. Pure and deterministic (fixed seeds, no
 * three.js): every viewer gets the same reef, and the map's spawn tags
 * (`map/world-sampler.ts` on the map lane: coral_reef, seagrass, kelp,
 * anemone, cleaner_station) line up with what is drawn.
 *
 * `reef-render.ts` draws it (instanced, near and far versions, swaying in
 * the shared surge); `fish-schools.ts` reads the landmarks.
 *
 * Rules (real reefs, not pastel discs):
 * - Nothing stony grows shallower than 1.9 m (the beach's clear shallows stay clear).
 * - Corals need hard ground: the reef's patch reefs (bommies) and its rocky slopes.
 *   The flat and crest (1.9–3.5 m): branching and table corals, brain and boulder
 *   corals, anemones. The upper slope (3.5–6 m): tables, brain and boulder corals,
 *   the first sea fans and sponges. Deeper (6 m on): sea fans, barrel and tube sponges.
 * - Seagrass grows on sand from 1.2 to 3.5 m: the lagoon between the reef and the
 *   shore, and patchy meadows off the beach (never in the swash).
 * - Kelp stands on rock off the cliff coasts, 2.2 to 9 m, reaching for the surface.
 * - Colours are the real ones: tans, browns, olive and ochre stony corals with
 *   pale or blue tips, red and purple fans, orange and purple sponges. Depth takes
 *   the red out (the material, as the sea floor does).
 */

import {ZONE_SITES, arkWorld, coastRadius, fbm, hashString, noise, onArkWorld, sampleGround, seeded, smoothstep, type GroundSample} from "@/ark-scene/world";
import {wildScenery} from "@/ark-scene/islands/wild/scenery";

export const REEF_KINDS = ["branching", "table", "brain", "massive", "encrusting", "fan", "anemone", "barrel_sponge", "tube_sponge", "ball_sponge", "kelp", "seagrass"] as const;
export type ReefKind = typeof REEF_KINDS[number];

/** What the sea bed is made of: the reef's own framework, bare rock, broken rubble, sand. */
export type Substrate = "reef" | "rock" | "rubble" | "sand";

export type ReefItem = {
    kind: ReefKind;
    /** Which of the kind's shapes. */
    variant: number;
    x: number;
    /** The bed under it (m, mean tide). */
    y: number;
    z: number;
    scale: number;
    rotation: number;
    /** A lean toward the bed's slope (radians about x, then turned by `rotation`). */
    tilt: number;
    color: string;
    /** Water over it at mean tide (m). */
    depth: number;
    substrate: Substrate;
};

/** No stony coral, sponge or anemone shallower than this (m): the beach's clear shallows. */
export const CORAL_MIN_DEPTH = 1.9;

/** The variants each kind has (the renderer builds one shape per variant). */
export const REEF_VARIANTS: Record<ReefKind, number> = {
    branching: 2,
    table: 2,
    brain: 2,
    massive: 2,
    encrusting: 2,
    fan: 2,
    anemone: 2,
    barrel_sponge: 1,
    tube_sponge: 2,
    ball_sponge: 1,
    kelp: 3,
    seagrass: 2
};

/** Real reef colours (albedo before the water takes the red out). */
const COLOURS: Record<ReefKind, string[]> = {
    // Staghorn and bushy Acropora/Pocillopora: tan and brown, olive; the tips are baked paler (or blue) in the shape.
    branching: ["#b39060", "#a5845a", "#a08c5c", "#bb9a6c", "#94785a"],
    table: ["#a8845a", "#9c875c", "#919066", "#a57e5e"],
    brain: ["#b8994f", "#9fa35a", "#c48e58", "#a8925a", "#86a06a"],
    massive: ["#c6a874", "#b49466", "#bc946a", "#a07f86"],
    // The cover on the reef's framework between the heads: turf, encrusting corals, pink and purple coralline algae.
    encrusting: ["#76704c", "#80694a", "#6c7350", "#7a6b4e", "#8a6870", "#70664e"],
    // Gorgonians and sea whips: deep purple, red, orange-yellow.
    fan: ["#7e2f56", "#a63d2c", "#c08f2f", "#8a3a6e", "#b4532e"],
    anemone: ["#c9b48a", "#9fb05a", "#c98a8a", "#b8c08a"],
    barrel_sponge: ["#8a4f3a", "#9a6b4a", "#7d4a3d"],
    tube_sponge: ["#6c5288", "#c99a3a", "#c06a3a", "#86609a"],
    ball_sponge: ["#c98a3a", "#b0a040", "#c46a30"],
    kelp: ["#8f7632", "#83692c", "#977d38", "#7c6c2e"],
    seagrass: ["#46683a", "#4e6f3c", "#57763e", "#4a6236"]
};

type Mix = Array<[ReefKind, number]>;

/** What the reef's hard ground grows, by depth band. */
const BANDS: Array<{to: number; mix: Mix}> = [
    // The flat and the crest.
    {to: 3.5, mix: [["branching", 36], ["table", 12], ["brain", 17], ["massive", 13], ["anemone", 9], ["ball_sponge", 7], ["tube_sponge", 6]]},
    // The upper slope.
    {to: 6, mix: [["table", 18], ["brain", 17], ["massive", 17], ["branching", 14], ["fan", 12], ["tube_sponge", 9], ["barrel_sponge", 6], ["anemone", 7]]},
    // Deeper.
    {to: 99, mix: [["fan", 26], ["barrel_sponge", 19], ["massive", 19], ["tube_sponge", 14], ["brain", 12], ["table", 5], ["branching", 5]]}
];

function pick(mix: Mix, roll: number): ReefKind {
    const total = mix.reduce((sum, [, weight]) => sum + weight, 0);
    let at = roll * total;
    for (const [kind, weight] of mix) {
        at -= weight;
        if (at <= 0) return kind;
    }
    return mix[mix.length - 1][0];
}

/** Usual size per kind (scale 1 is the shape's own size; see reef-render.ts). */
const SIZE: Record<ReefKind, [number, number]> = {
    branching: [0.6, 1.35],
    table: [0.55, 1.3],
    brain: [0.4, 1.05],
    massive: [0.45, 1.15],
    encrusting: [0.6, 1.2],
    fan: [0.6, 1.25],
    anemone: [0.6, 1.1],
    barrel_sponge: [0.55, 1.15],
    tube_sponge: [0.6, 1.2],
    ball_sponge: [0.5, 1.1],
    kelp: [0.85, 1.08],
    seagrass: [0.75, 1.25]
};

// MARK: - The sea bed

const coastCliffs = new Map<number, number>();

/** How much a sea cliff the coast is at this bearing (sampled just inside the coast line, as the map lane's tags do). */
export function coastCliff(theta: number): number {
    const key = Math.round(theta * 40);
    let cliff = coastCliffs.get(key);
    if (cliff === undefined) {
        const t = key / 40;
        const r = coastRadius(t) - 3;
        cliff = sampleGround(Math.cos(t) * r, Math.sin(t) * r).cliff;
        coastCliffs.set(key, cliff);
    }
    return cliff;
}

export type SeaBed = {
    /** Water over the bed at mean tide (0 on land). */
    depth: number;
    height: number;
    /** 0 flat … about 1 at 45°. */
    slope: number;
    substrate: Substrate;
    /** 0…1 how close to the coral reef (world.ts `reef`). */
    reef: number;
    /** 0…1 the patch reefs' framework here (hard ground the corals build on). */
    framework: number;
    /** The seashore zone's weight (the beach's own water). */
    shore: number;
    /** Metres inside the coast (negative at sea). */
    inland: number;
    /** The coast's cliff at this bearing. */
    cliff: number;
};

/** The bed's slope at a point (rise over run, from four samples 0.6 m apart). */
export function bedSlope(x: number, z: number): number {
    const e = 0.6;
    const hx = sampleGround(x + e, z).height - sampleGround(x - e, z).height;
    const hz = sampleGround(x, z + e).height - sampleGround(x, z - e).height;
    return Math.hypot(hx, hz) / (2 * e);
}

/** The sea bed from a ground sample and its slope (the growth loops pass a slope they already have). */
function bedFrom(x: number, z: number, s: GroundSample, slope: number): SeaBed {
    const depth = Math.max(-s.height, 0);
    const cliff = coastCliff(Math.atan2(z, x));
    // Patch reefs: knolls of framework, more of them toward the reef's middle, sand channels between.
    const framework = s.reef > 0.3 ? smoothstep(0.47, 0.6, fbm(x * 0.11 + 3.3, z * 0.11 - 7.1) + 0.22 * (s.reef - 0.3)) : 0;
    let substrate: Substrate = "sand";
    if (framework > 0.5) substrate = "reef";
    else if (slope > 0.42 || (cliff > 0.3 && s.inland > -22 && depth > 1.2)) substrate = "rock";
    else if (s.reef > 0.25 && framework > 0.08) substrate = "rubble";
    return {depth, height: s.height, slope, substrate, reef: s.reef, framework, shore: s.weights.seashore ?? 0, inland: s.inland, cliff};
}

/** The sea bed at a point: its depth, slope and what it is made of. */
export function seaBedAt(x: number, z: number): SeaBed {
    return bedFrom(x, z, sampleGround(x, z), bedSlope(x, z));
}

// MARK: - Landmarks

/** Each kind's height at scale 1 (m): reef-render.ts builds its shapes this tall. */
export const REEF_HEIGHT: Record<ReefKind, number> = {
    branching: 0.75,
    table: 0.62,
    brain: 0.55,
    massive: 0.8,
    encrusting: 0.09,
    fan: 1.05,
    anemone: 0.32,
    barrel_sponge: 0.95,
    tube_sponge: 0.85,
    ball_sponge: 0.4,
    kelp: 1,
    seagrass: 0.4
};

export type ReefLandmarks = {
    /** The anemone patch (the map lane's `anemone` anchor). */
    anemones: {x: number; z: number; radius: number};
    /** The cleaning station: a big coral head (the map lane's `cleaner_station` anchor); `top` is its crown's height. */
    cleaning: {x: number; z: number; radius: number; top: number};
    /** The biggest coral heads (bommies), where reef fish hover: the bed under each, its size and its crown's height. */
    heads: Array<{x: number; y: number; z: number; radius: number; top: number}>;
};

let landmarks: ReefLandmarks | null = null;

export function reefLandmarks(): ReefLandmarks {
    if (landmarks) return landmarks;
    const reef = ZONE_SITES.coral_reef;
    const heads: ReefLandmarks["heads"] = [];
    const items = reefGrowth();
    // The biggest stony heads deeper than 2.4 m, spread out.
    const big = items.filter((item) => (item.kind === "brain" || item.kind === "massive" || item.kind === "table") && item.depth > 2.4).sort((a, b) => b.scale - a.scale);
    for (const item of big) {
        if (heads.length >= 8) break;
        if (heads.some((head) => Math.hypot(head.x - item.x, head.z - item.z) < 5)) continue;
        heads.push({x: item.x, y: item.y, z: item.z, radius: 0.7 * item.scale, top: item.y + REEF_HEIGHT[item.kind] * item.scale});
    }
    const cleaningX = reef.x + 4;
    const cleaningZ = reef.z + 3;
    const station = items.find((item) => item.kind === "massive" && Math.hypot(item.x - cleaningX, item.z - cleaningZ) < 0.01);
    const cleaningTop = station ? station.y + REEF_HEIGHT.massive * station.scale : sampleGround(cleaningX, cleaningZ).height + 0.5;
    landmarks = {anemones: {x: reef.x - 3, z: reef.z - 2, radius: 1.6}, cleaning: {x: cleaningX, z: cleaningZ, radius: 2, top: cleaningTop}, heads};
    return landmarks;
}

// MARK: - Growth

let cached: ReefItem[] | null = null;

// The world's switch (docs/ark/wild-island.md §8): the reef, its landmarks and the coast's cliffs are the world's own.
onArkWorld(() => {
    cached = null;
    landmarks = null;
    coastCliffs.clear();
});

/** Runtime prebuild hook (runtime/prebuild.ts): the same list, placed in the scenery worker before the mount. */
export function primeReefGrowth(items: ReefItem[]): void {
    cached = items;
}

/** Everything that grows under the sea, placed once. */
export function reefGrowth(): ReefItem[] {
    if (cached) return cached;
    const items: ReefItem[] = [];
    const reef = ZONE_SITES.coral_reef;
    const colour = (kind: ReefKind, roll: number) => COLOURS[kind][Math.floor(roll * COLOURS[kind].length) % COLOURS[kind].length];
    const size = (kind: ReefKind, roll: number) => SIZE[kind][0] + (SIZE[kind][1] - SIZE[kind][0]) * roll;
    const put = (kind: ReefKind, x: number, z: number, bed: SeaBed, random: () => number, scale?: number) => {
        // Nothing reaches closer than 0.9 m under the mean sea (it stays under at the lowest tide).
        const own = scale ?? size(kind, random());
        const fitted = kind === "seagrass" ? own : Math.min(own, (bed.depth - 0.9) / REEF_HEIGHT[kind]);
        if (fitted < 0.3) return;
        const roll = random();
        items.push({
            kind,
            // Column corals are the rarer boulders.
            variant: kind === "massive" ? (roll < 0.75 ? 0 : 1) : kind === "branching" ? (roll < 0.6 ? 0 : 1) : Math.floor(roll * REEF_VARIANTS[kind]) % REEF_VARIANTS[kind],
            x,
            y: bed.height,
            z,
            scale: fitted,
            rotation: random() * Math.PI * 2,
            // Corals grow up toward the light whatever the slope; they only lean a little with it.
            tilt: kind === "kelp" || kind === "seagrass" ? 0 : Math.min(bed.slope, 0.6) * 0.35 * (random() - 0.5),
            color: colour(kind, random()),
            depth: bed.depth,
            substrate: bed.substrate
        });
    };

    // 1. The reef: a jittered grid over it; corals on the hard ground by depth, seagrass on the lagoon's sand.
    {
        const random = seeded(4_2026_1111);
        const cell = 0.85;
        const half = 34;
        const n = Math.ceil((2 * half) / cell) + 1;
        // The bed's heights at the grid's corners once, for every point's slope (the points' own heights are exact).
        const corners = new Float32Array(n * n);
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) corners[i * n + j] = sampleGround(reef.x - half + i * cell, reef.z - half + j * cell).height;
        for (let i = 0; i < n - 1; i++) {
            for (let j = 0; j < n - 1; j++) {
                const gx = -half + i * cell;
                const gz = -half + j * cell;
                const jx = random();
                const jz = random();
                const roll = random();
                const kindRoll = random();
                const x = reef.x + gx + jx * cell;
                const z = reef.z + gz + jz * cell;
                if (Math.hypot(x - reef.x, z - reef.z) > half) continue;
                const h00 = corners[i * n + j];
                const h10 = corners[(i + 1) * n + j];
                const h01 = corners[i * n + j + 1];
                const h11 = corners[(i + 1) * n + j + 1];
                const slope = Math.hypot((h10 - h00) * (1 - jz) + (h11 - h01) * jz, (h01 - h00) * (1 - jx) + (h11 - h10) * jx) / cell;
                const ground = sampleGround(x, z);
                if (ground.height > -0.9) continue;
                const bed = bedFrom(x, z, ground, slope);
                const local = seeded(Math.floor(jx * 1e9) ^ Math.floor(jz * 7e8));
                if (bed.substrate === "reef" || (bed.substrate === "rock" && bed.reef > 0.3)) {
                    if (bed.depth < CORAL_MIN_DEPTH || bed.depth > 10) continue;
                    // The framework's cover between the heads (turf, encrusting corals, coralline algae).
                    if (local() < 0.5 + 0.35 * bed.framework) {
                        const ex = x + (local() - 0.5) * 0.4;
                        const ez = z + (local() - 0.5) * 0.4;
                        // (Its own point is a little off the head's: it keeps the shallows' rule too. Never so on v1's reef.)
                        const under = bedFrom(ex, ez, sampleGround(ex, ez), slope);
                        if (under.depth >= CORAL_MIN_DEPTH) put("encrusting", ex, ez, under, local);
                    }
                    // Dense on the knolls' tops, thinner on their flanks.
                    const cover = 0.22 + 0.5 * bed.framework;
                    if (roll > cover) continue;
                    const band = BANDS.find((b) => bed.depth < b.to) ?? BANDS[BANDS.length - 1];
                    put(pick(band.mix, kindRoll), x, z, bed, local);
                } else if (bed.substrate === "rubble") {
                    // Rubble: the odd boulder coral, sponge or anemone.
                    if (bed.depth < CORAL_MIN_DEPTH) continue;
                    if (local() < 0.3) put("encrusting", x, z, bed, local);
                    if (roll > 0.06) continue;
                    put(kindRoll < 0.45 ? "massive" : kindRoll < 0.75 ? "ball_sponge" : "anemone", x, z, bed, local);
                } else if (bed.substrate === "sand") {
                    // The lagoon's seagrass: on sand between the reef and the shore, 1.2–3.5 m, in meadows with sand between.
                    if (bed.depth < 1.2 || bed.depth > 3.5 || bed.inland < -18 || bed.reef < 0.1 || bed.reef > 0.6) continue;
                    if (meadow(x, z, true) < 0.46 || roll > 0.85) continue;
                    put("seagrass", x, z, bed, local);
                }
            }
        }
    }

    // 2. The anemone patch and the cleaning station's big head (the map lane's anchors).
    {
        const random = seeded(77_1111);
        const marks = {anemones: {x: reef.x - 3, z: reef.z - 2}, cleaning: {x: reef.x + 4, z: reef.z + 3}};
        for (let i = 0; i < 9; i++) {
            const angle = random() * Math.PI * 2;
            const r = 1.4 * Math.sqrt(random());
            const x = marks.anemones.x + Math.cos(angle) * r;
            const z = marks.anemones.z + Math.sin(angle) * r;
            const bed = seaBedAt(x, z);
            if (bed.depth < CORAL_MIN_DEPTH) continue;
            put("anemone", x, z, bed, random, 0.75 + random() * 0.45);
        }
        const bed = seaBedAt(marks.cleaning.x, marks.cleaning.z);
        if (bed.depth >= CORAL_MIN_DEPTH) put("massive", marks.cleaning.x, marks.cleaning.z, bed, random, 1.6);
    }

    // The bigger wild island (v2): beyond its reef site's patch reefs, the island's own lagoon, kelp and seagrass (5).
    const v2 = arkWorld() === "v2";

    // 3. Seagrass off the beach: patchy meadows on its sand, 1.4–3.5 m, never in the swash.
    if (!v2) {
        const random = seeded(55_2026);
        const beach = ZONE_SITES.seashore;
        const theta0 = Math.atan2(beach.z, beach.x);
        for (let theta = theta0 - 0.42; theta < theta0 + 0.42; theta += 0.0075) {
            const coast = coastRadius(theta);
            for (let out = 2.5; out < 12; out += 0.62) {
                const jitterT = (random() - 0.5) * 0.0075;
                const jitterR = (random() - 0.5) * 0.62;
                const roll = random();
                const r = coast + out + jitterR;
                const x = Math.cos(theta + jitterT) * r;
                const z = Math.sin(theta + jitterT) * r;
                if (roll > 0.78 || meadow(x, z) < 0.56) continue;
                const ground = sampleGround(x, z);
                if (ground.height > -1.8 || ground.height < -3.5 || (ground.weights.seashore ?? 0) < 0.4) continue;
                const bed = bedFrom(x, z, ground, bedSlope(x, z));
                if (bed.substrate !== "sand") continue;
                put("seagrass", x, z, bed, seeded(Math.floor(roll * 1e9)));
            }
        }
    }

    // 4. Kelp forests off the cliff coasts: on rock, 2.2–9 m, in stands with gaps; a few anemones and sponges at their feet.
    if (!v2) {
        const random = seeded(31_2026);
        for (let theta = -Math.PI; theta < Math.PI; theta += 0.022) {
            if (coastCliff(theta) < 0.3) continue;
            const coast = coastRadius(theta);
            for (let out = 3; out < 24; out += 2) {
                const jitterT = (random() - 0.5) * 0.022;
                const jitterR = (random() - 0.5) * 2;
                const roll = random();
                const r = coast + out + jitterR;
                const x = Math.cos(theta + jitterT) * r;
                const z = Math.sin(theta + jitterT) * r;
                const stand = noise(x * 0.16 + 9, z * 0.16 - 3);
                if (stand < 0.38) continue;
                const ground = sampleGround(x, z);
                if (ground.inland < -22 || ground.height > -2.2 || ground.height < -9) continue;
                // Off a cliff coast the bed is rock (bedFrom), unless the reef's framework is there.
                const bed = bedFrom(x, z, ground, 0);
                if (bed.substrate !== "rock") continue;
                const local = seeded(Math.floor(roll * 1e9) + 17);
                if (roll < 0.62 * smoothstep(0.38, 0.6, stand)) {
                    // Tall enough to reach about 0.4–1.2 m under the surface: the variant by depth, then a small stretch.
                    const reach = bed.depth - 0.4 - local() * 0.8;
                    const variant = reach < 3.6 ? 0 : reach < 6 ? 1 : 2;
                    const own = KELP_HEIGHTS[variant];
                    // Turned so its blades trail along the coast (the current runs along it): every plant the same way.
                    const along = -(Math.atan2(z, x) + Math.PI / 2) + (local() - 0.5) * 0.5;
                    items.push({kind: "kelp", variant, x, y: bed.height, z, scale: Math.min(Math.max(reach / own, 0.7), 1.12), rotation: along, tilt: 0, color: colour("kelp", local()), depth: bed.depth, substrate: bed.substrate});
                } else if (roll > 0.94) {
                    put(roll > 0.975 ? "anemone" : "ball_sponge", x, z, bed, local);
                }
            }
        }
    }

    // 5. The bigger wild island (v2, P3's shared path): the island's generator (`islands/wild/scenery.ts`) lays its coral
    // heads over the whole lagoon (its reef field), its kelp in the cold north-west (its kelp field) and its seagrass in
    // the warm shallows; each becomes the reef's own, under the reef's rules here (corals on hard ground 1.9–10 m by
    // depth band with their cover, seagrass on sand 1.2–3.5 m, kelp on rock 2.2–9 m reaching to 0.4–1.2 m under the surface
    // along the coast).
    // The reef site's patch reefs (1, 2) keep their circle; the generator's heads inside it are left to them.
    if (v2) {
        const half = 34;
        for (const item of wildScenery()) {
            if (item.kind !== "coral" && item.kind !== "kelp" && item.kind !== "seagrass") continue;
            const {x, z} = item;
            const local = seeded(hashString(`reef-v2:${item.kind}:${x.toFixed(2)},${z.toFixed(2)}`));
            const ground = sampleGround(x, z);
            if (item.kind === "kelp") {
                const bed = bedFrom(x, z, ground, 0);
                if (bed.depth < 2.2 || bed.depth > 9) continue;
                const reach = bed.depth - 0.4 - local() * 0.8;
                const variant = reach < 3.6 ? 0 : reach < 6 ? 1 : 2;
                const along = -(Math.atan2(z, x) + Math.PI / 2) + (local() - 0.5) * 0.5;
                items.push({kind: "kelp", variant, x, y: bed.height, z, scale: Math.min(Math.max(reach / KELP_HEIGHTS[variant], 0.7), 1.12), rotation: along, tilt: 0, color: colour("kelp", local()), depth: bed.depth, substrate: "rock"});
                continue;
            }
            const bed = bedFrom(x, z, ground, bedSlope(x, z));
            if (item.kind === "seagrass") {
                if (bed.depth < 1.2 || bed.depth > 3.5 || bed.substrate !== "sand") continue;
                put("seagrass", x, z, bed, local);
                continue;
            }
            if (Math.hypot(x - reef.x, z - reef.z) <= half || bed.depth < CORAL_MIN_DEPTH || bed.depth > 10) continue;
            // A head on the lagoon's hard ground: the reef's framework where it is, else the generator's head is its own knoll.
            const hard: SeaBed = bed.substrate === "sand" || bed.substrate === "rubble" ? {...bed, substrate: "reef"} : bed;
            if (local() < 0.5) {
                const ex = x + (local() - 0.5) * 0.6;
                const ez = z + (local() - 0.5) * 0.6;
                const under = bedFrom(ex, ez, sampleGround(ex, ez), bed.slope);
                if (under.depth >= CORAL_MIN_DEPTH) put("encrusting", ex, ez, {...under, substrate: hard.substrate}, local);
            }
            const band = BANDS.find((b) => hard.depth < b.to) ?? BANDS[BANDS.length - 1];
            put(pick(band.mix, local()), x, z, hard, local);
        }
    }

    cached = items;
    return items;
}

/** A look into a kelp forest for the golden shots: the middle of the densest stand, and its bed. */
export function kelpStandSpot(): {x: number; y: number; z: number; azimuth: number} | null {
    const kelp = reefGrowth().filter((item) => item.kind === "kelp");
    let best: {x: number; y: number; z: number; score: number} | null = null;
    for (const item of kelp) {
        if (item.depth < 4 || item.depth > 7.5) continue;
        const around = kelp.filter((other) => Math.hypot(other.x - item.x, other.z - item.z) < 6).length;
        if (!best || around > best.score) best = {x: item.x, y: item.y, z: item.z, score: around};
    }
    // Looking along the coast (across the stand), not straight at the cliff.
    return best ? {x: best.x, y: best.y, z: best.z, azimuth: Math.atan2(best.x, best.z) + Math.PI / 2} : null;
}

/** The kelp shapes' own heights (m) by variant: reef-render.ts builds them this tall. */
export const KELP_HEIGHTS = [3, 5, 7.5];

/** Seagrass meadows: patches with sand between (0…1); the lagoon's field is its own. */
function meadow(x: number, z: number, lagoon = false): number {
    return lagoon ? fbm(x * 0.11 + 23, z * 0.11 - 41) : fbm(x * 0.09 - 11, z * 0.09 + 5);
}

/**
 * A close look at the reef for the golden shots: of the coral heads reef fish hover over (`fish-schools.ts` takes the
 * first five landmark heads deeper than 1.7 m), the one with the most corals round it, and a bearing from the open
 * water side, so the reef rises in front and its fish are in the picture.
 */
export function reefCloseupSpot(): {x: number; y: number; z: number; azimuth: number} {
    const reef = ZONE_SITES.coral_reef;
    const corals = reefGrowth().filter((item) => item.kind !== "seagrass" && item.kind !== "kelp");
    const heads = reefLandmarks().heads.filter((head) => head.top < -1.7).slice(0, 5);
    let best = {x: reef.x, z: reef.z, y: sampleGround(reef.x, reef.z).height, score: -Infinity};
    for (const head of heads) {
        const kinds = new Set<ReefKind>();
        let around = 0;
        for (const other of corals) {
            if (Math.hypot(other.x - head.x, other.z - head.z) < 3) {
                around += other.scale;
                kinds.add(other.kind);
            }
        }
        const score = around + kinds.size * 1.5;
        if (score > best.score) best = {x: head.x, z: head.z, y: head.y, score};
    }
    return {x: best.x, y: best.y, z: best.z, azimuth: Math.atan2(best.x, best.z)};
}
