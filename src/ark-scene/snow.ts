/**
 * The mountain's snow as the terrain shader draws it (terrain.ts, batch 4), for the sampler (`surfaceAt`): so an
 * animal that needs snow stands on drawn snow, and the others do not.
 *
 * The shader's rule: a snow line at 27 m that the weather's snow cover brings down 12 m; snow continuous from 4 m
 * under it to 2.5 m over it, along a line that wanders a few metres with the ground; the upper third holding snow on
 * all but its steepest faces; bare rock ribs on the steep faces; thinner on steep ground below the high slopes; then
 * drawn where that comes to 0.12–0.8. The ice's snow is the ground's own layer (polar, on land).
 *
 * The shader's noise (the line's wander, the wind streaks, the ribs, which rock bed is hard) is per pixel and its
 * hash rounds differently on every GPU, so it cannot be repeated here exactly. It is taken at its mean for the
 * expected cover, and at its worst case for where snow is sure. The patches of snow on the ledges below the line
 * are not counted: they are patchy, never sure.
 *
 * `src/lib/ark-attach.test.ts` holds this to terrain.ts's lines: change one, change the other.
 */

/** The snow line (m) at no snow cover, and how far full cover brings it down. */
export const SNOW_LINE = {base: 27, fall: 12};

/** The shader's noise, measured over the island (its statistics, not its values). */
const NOISE = {
    /** The line's wander, 5 (fbm − ½) + 1.2 (noise − ½): never more than 5 × ½ + 1.2 × ½ = 3.1 m (about ±2.3 m seen). */
    wander: 3.1,
    /** The wind streaks' mix(0.8, 1, streak), at its mean. */
    streaks: 0.9,
    /** smoothstep(0.55, 0.85, rib), at its mean: how often a steep face is a bare rib. */
    ribs: 0.68,
    /** How often a rock bed is hard (step(0.42, hash)). */
    hard: 0.58
};

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** The snow line (m) at this snow cover (0–1). */
export function snowLine(cover: number): number {
    return SNOW_LINE.base - SNOW_LINE.fall * cover;
}

/**
 * The shader's mountain snow weight (its `alpine`) at a height and slope (1 − the ground normal's y), with the line's
 * wander `wander` metres up (0 for the mean; −NOISE.wander for where it is sure).
 */
function alpine(height: number, slope: number, cover: number, wander: number): number {
    const line = snowLine(cover);
    let snow = smoothstep(line - 4, line + 2.5, height + wander);
    const high = smoothstep(line + 2, line + 11, height);
    const holdTo = mix(0.48, 0.7, high) - 0.12 * NOISE.hard * smoothstep(0.4, 0.6, slope);
    snow *= 1 - smoothstep(holdTo, holdTo + 0.28, slope);
    snow *= NOISE.streaks * smoothstep(0, 0.25, snow);
    snow *= 1 - NOISE.ribs * smoothstep(0.32, 0.55, slope) * (1 - 0.5 * high);
    return snow;
}

/** How much of the point the shader paints white: its `smoothstep(0.12, 0.8, snow)`. */
function drawn(weight: number, height: number, slope: number, cover: number): number {
    const high = smoothstep(snowLine(cover) + 2, snowLine(cover) + 11, height);
    const steep = smoothstep(0.22, 0.42, slope);
    return smoothstep(0.12, 0.8, weight * (1 - steep * 0.5 * (1 - high)));
}

/**
 * Snow at a point: `mean`, the expected drawn cover (0–1); `sure`, the cover even where the line wanders its
 * highest (snow is drawn there whatever the noise does). `ice` is the ground's own snow layer there (the polar
 * zone's: terrain.ts `polar × smoothstep(0.3, 1, land)`).
 */
export function snowCover(height: number, slope: number, ice: number, cover: number): {mean: number; sure: number} {
    const mean = drawn(Math.max(ice, alpine(height, slope, cover, 0)), height, slope, cover);
    const sure = drawn(Math.max(ice, alpine(height, slope, cover, -NOISE.wander)), height, slope, cover);
    return {mean, sure};
}
