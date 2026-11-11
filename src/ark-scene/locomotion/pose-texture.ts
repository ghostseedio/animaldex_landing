/**
 * The live pose texture: per species, one row per rigged instance, each row a bone texture row (per bone the 3×4
 * matrix rows, rest pose to now) written on the CPU by the locomotion layer each frame. The rig shader reads an
 * instance's row from it when its clip row is negative (`liveRowCode`), and the baked rows otherwise, so a rig
 * without the layer (or past its rows) plays exactly as before.
 */

import {DataTexture, FloatType, NearestFilter, RGBAFormat} from "three";

/** Rows per species: the most rigged instances of one species drawn at once (the scene's caps: 24 animals). */
export const LIVE_ROWS = 32;

export type LivePose = {texture: DataTexture; data: Float32Array; bones: number; rows: number};

export function createLivePose(bones: number, rows = LIVE_ROWS): LivePose {
    const data = new Float32Array(bones * 12 * rows);
    const texture = new DataTexture(data, bones * 3, rows, RGBAFormat, FloatType);
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.generateMipmaps = false;
    texture.flipY = false;
    texture.needsUpdate = true;
    return {texture, data, bones, rows};
}

/** The clip-row value that tells the shader to read live row `row` (-1 is row 0, -2 row 1, ...). */
export const liveRowCode = (row: number) => -(row + 1);

/** GLSL: the live texture's declaration (with ARK_RIG_LIVE defined). */
export const LIVE_DECLARATIONS = `
#ifdef ARK_RIG_LIVE
uniform highp sampler2D arkPoseBones;
#endif
`;

/**
 * GLSL: a bone's 3×4 rows at a clip row, from the live texture when the row is negative. Replaces the baked
 * texture read in `arkBone` (animal-material.ts); `x` is the bone's first texel, `row` the clip row.
 */
export const LIVE_FETCH = `
#ifdef ARK_RIG_LIVE
    if (row < -0.5) {
        int live = int(-row + 0.5) - 1;
        r0 = texelFetch(arkPoseBones, ivec2(x, live), 0);
        r1 = texelFetch(arkPoseBones, ivec2(x + 1, live), 0);
        r2 = texelFetch(arkPoseBones, ivec2(x + 2, live), 0);
    }
#endif
`;
