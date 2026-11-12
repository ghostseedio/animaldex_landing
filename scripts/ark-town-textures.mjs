#!/usr/bin/env node
/**
 * The town island's paving textures (lane GA, docs/ark/town-island.md §11): six CC0 Poly Haven sets (docs/ark-credits.md),
 * packed as two KTX2 2D arrays (Basis Universal), one 512 px layer per material, with mipmaps:
 *
 *   public/ark/graphics/town-albedo.ktx2   ETC1S, sRGB: RGB the albedo (high-passed), A the roughness
 *   public/ark/graphics/town-normal.ktx2   UASTC + Zstandard, linear: the OpenGL normal map (medium and high only)
 *
 *   layer 0 asphalt · 1 paving slabs · 2 granite setts · 3 gravel · 4 block paving · 5 granite (kerbs, quays)
 *
 * The downloads stay outside the repo:
 *   node scripts/ark-town-textures.mjs --src <dir of <name>_{diff,nor_gl,rough}_1k.jpg> [--out public/ark/graphics] [--size 512]
 * Prints each layer's mean linear colour for `TOWN_LAYER_MEANS` (`islands/town/render/textures.ts`).
 * Needs `basisu` 2.x (`brew install basis_universal`); only ETC1S and UASTC LDR 4x4, which three's transcoder reads.
 */

import {execFileSync} from "node:child_process";
import {mkdirSync, mkdtempSync, rmSync, statSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const src = arg("src", null);
if (!src) throw new Error("--src <folder of the Poly Haven 1k JPGs> is required");
const out = path.resolve(arg("out", path.join(root, "public/ark/graphics")));
const size = Number(arg("size", "512"));

/** The layers, in the shader's order; Poly Haven's names (each CC0, polyhaven.com/a/<name>). */
export const TOWN_TEXTURE_SETS = ["asphalt_02", "concrete_pavement", "cobblestone_floor_03", "gravel_floor", "patterned_brick_floor", "granite_tile"];

const work = mkdtempSync(path.join(os.tmpdir(), "ark-town-tex-"));
const toLinear = (v) => Math.pow(v / 255, 2.2);

/**
 * High-pass a tileable albedo: divide out the light drift of a large blur (worked on a 3×3 tiling so the blur wraps
 * and the edges still meet), keeping the overall colour. So the repeats don't show as a grid of lighter and darker tiles.
 */
async function highPass(file) {
    const image = sharp(file).removeAlpha();
    const {width, height} = await image.metadata();
    const raw = await image.raw().toBuffer();
    const tiled = await sharp({create: {width: width * 3, height: height * 3, channels: 3, background: "#000"}})
        .composite(Array.from({length: 9}, (_, i) => ({input: raw, raw: {width, height, channels: 3}, left: (i % 3) * width, top: Math.floor(i / 3) * height})))
        .raw()
        .toBuffer();
    const blurred = await sharp(tiled, {raw: {width: width * 3, height: height * 3, channels: 3}}).blur(width / 10).extract({left: width, top: height, width, height}).raw().toBuffer();
    const mean = [0, 0, 0];
    for (let i = 0; i < raw.length; i++) mean[i % 3] += raw[i];
    for (let c = 0; c < 3; c++) mean[c] /= raw.length / 3;
    const outRaw = Buffer.alloc(raw.length);
    for (let i = 0; i < raw.length; i++) {
        const c = i % 3;
        // Half the drift taken out: a full division flattens the stone's own light and dark slabs too.
        const k = Math.pow(mean[c] / Math.max(blurred[i], 1), 0.6);
        outRaw[i] = Math.max(0, Math.min(255, Math.round(raw[i] * k)));
    }
    return {raw: outRaw, width, height};
}

const albedoFiles = [];
const normalFiles = [];
const means = [];
for (const [layer, name] of TOWN_TEXTURE_SETS.entries()) {
    const diff = path.join(src, `${name}_diff_1k.jpg`);
    const nor = path.join(src, `${name}_nor_gl_1k.jpg`);
    const rough = path.join(src, `${name}_rough_1k.jpg`);
    const hp = await highPass(diff);
    const rgb = await sharp(hp.raw, {raw: {width: hp.width, height: hp.height, channels: 3}}).resize(size, size, {kernel: "lanczos3"}).raw().toBuffer();
    const r = await sharp(rough).greyscale().resize(size, size, {kernel: "lanczos3"}).raw().toBuffer();
    const rgba = Buffer.alloc(size * size * 4);
    const sum = [0, 0, 0];
    for (let i = 0; i < size * size; i++) {
        for (let c = 0; c < 3; c++) {
            rgba[i * 4 + c] = rgb[i * 3 + c];
            sum[c] += toLinear(rgb[i * 3 + c]);
        }
        rgba[i * 4 + 3] = r[i];
    }
    means.push(sum.map((v) => Number((v / (size * size)).toFixed(4))));
    const albedoPng = path.join(work, `albedo-${layer}.png`);
    await sharp(rgba, {raw: {width: size, height: size, channels: 4}}).png().toFile(albedoPng);
    const normalPng = path.join(work, `normal-${layer}.png`);
    await sharp(nor).removeAlpha().resize(size, size, {kernel: "lanczos3"}).png().toFile(normalPng);
    albedoFiles.push(albedoPng);
    normalFiles.push(normalPng);
    console.log(`layer ${layer} ${name}: mean linear ${JSON.stringify(means[layer])}`);
}

mkdirSync(out, {recursive: true});
const albedoOut = path.join(out, "town-albedo.ktx2");
const normalOut = path.join(out, "town-normal.ktx2");
execFileSync("basisu", ["-ktx2", "-etc1s", "-quality", "85", "-effort", "6", "-srgb", "-mipmap", "-mip_srgb", "-tex_type", "2darray", "-tex_array", "-no_stats", "-quiet", "-output_file", albedoOut, ...albedoFiles.flatMap((f) => ["-file", f])], {stdio: "inherit"});
execFileSync("basisu", ["-ktx2", "-uastc", "-uastc_level", "2", "-uastc_rdo_l", "3", "-linear", "-normal_map", "-mipmap", "-mip_linear", "-mip_renorm", "-tex_type", "2darray", "-tex_array", "-ktx2_zstandard_level", "19", "-no_stats", "-quiet", "-output_file", normalOut, ...normalFiles.flatMap((f) => ["-file", f])], {stdio: "inherit"});
for (const file of [albedoOut, normalOut]) console.log(`${path.relative(root, file)}: ${(statSync(file).size / 1024).toFixed(0)} KB`);
console.log(`TOWN_LAYER_MEANS = ${JSON.stringify(means)}`);
rmSync(work, {recursive: true, force: true});
