/**
 * The mountain's snow as the terrain shader draws it (terrain.ts, batch 4 and on), for the sampler (`surfaceAt`):
 * so an animal that needs snow stands on drawn snow, and the others do not.
 *
 * The shader's rule (batch 6, 39f06ddc): a snow line at 27 m that the weather's snow cover brings down 12 m; snow
 * continuous from 4 m under it to 2.5 m over it, along a line that wanders a few metres with the ground; an upper
 * reach whose line runs down the gullies and up the ribs; held on all but the steepest faces (how steep wanders in
 * broad patches); bare rock ribs on the steep faces, their cut wobbling; thinner on steep ground below the upper
 * reach; then drawn where that comes to 0.22–0.6. The ice's snow is the ground's own layer (polar, on land).
 *
 * The shader's noise (the line's wander, the ribs, the patches, the streaks, the wobbles) is per pixel and its hash
 * rounds differently on every GPU, so it cannot be repeated here exactly. It is taken at its mean for the expected
 * cover (`mean`), and at its worst for snow, term by term, for where snow is sure (`sure`). The patches of snow on
 * the ledges below the line (weighted 0.5) are not counted: they are patchy, never sure.
 *
 * `src/lib/ark-attach.test.ts` holds this to terrain.ts's lines: change one, change the other.
 */

/** The snow line (m) at no snow cover, and how far full cover brings it down. */
export const SNOW_LINE = {base: 27, fall: 12};

/** The shader's noise, measured over the island (its statistics, not its values): [mean, worst for snow]. */
const NOISE = {
    /** The line's wander, 5 (fbm − ½) + 1.2 (noise − ½): never more than ±3.1 m (about ±2.3 m seen). */
    wander: [0, -3.1],
    /** The ribs, 1 − |2 mix(fbm, fbm) − 1| (0 in a gully, 1 on a rib). */
    rib: [0.815, 1],
    /** holdTo's broad patches, 0.16 (noise − ½). */
    hold: [0, -0.08],
    /** The slope's wobble where snow lets go, 0.14 (noise − ½). */
    slip: [0, 0.07],
    /** The wind streaks' mix(0.8, 1, streak). */
    streaks: [0.9, 0.8],
    /** smoothstep(0.6, 0.88, rib + 0.2 (noise − ½)): how much a steep face is a bare rib. */
    ribCut: [0.71, 1],
    /** The steepness wobble in the final thinning, 0.12 (noise − ½). */
    steep: [0, 0.06]
} as const;

function smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
    return t * t * (3 - 2 * t);
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;

/** The snow line (m) at this snow cover (0–1). */
export function snowLine(cover: number): number {
    return SNOW_LINE.base - SNOW_LINE.fall * cover;
}

/** The drawn cover at a height and slope (1 − the ground normal's y), the noise taken at its mean (0) or worst (1). */
function drawn(height: number, slope: number, ice: number, cover: number, k: 0 | 1): number {
    const line = snowLine(cover);
    const snowAt = height + NOISE.wander[k];
    let alpine = smoothstep(line - 4, line + 2.5, snowAt);
    const high = smoothstep(line + 2, line + 11, snowAt + 6 * (0.5 - NOISE.rib[k]));
    const holdTo = mix(0.48, 0.7, high) + NOISE.hold[k];
    alpine *= 1 - smoothstep(holdTo, holdTo + 0.28, slope + NOISE.slip[k]);
    alpine *= NOISE.streaks[k] * smoothstep(0, 0.25, alpine);
    alpine *= 1 - NOISE.ribCut[k] * smoothstep(0.36, 0.58, slope) * (1 - 0.85 * high);
    const weight = Math.max(ice, alpine);
    const steep = smoothstep(0.22, 0.42, slope + NOISE.steep[k]);
    return smoothstep(0.22, 0.6, weight * (1 - steep * 0.5 * (1 - high)));
}

/**
 * Snow at a point: `mean`, the expected drawn cover (0–1); `sure`, the cover even where every bit of the shader's
 * noise goes against snow (snow is drawn there whatever it does). `ice` is the ground's own snow layer there (the
 * polar zone's: terrain.ts `polar × smoothstep(0.3, 1, land)`).
 */
export function snowCover(height: number, slope: number, ice: number, cover: number): {mean: number; sure: number} {
    return {mean: drawn(height, slope, ice, cover, 0), sure: drawn(height, slope, ice, cover, 1)};
}
