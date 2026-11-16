/**
 * The ground at bug scale, in the ground shaders (pass 2, lane GROUND; the owner, 2026-11-16: "can we make the ground
 * more realistic and better quality when you zoom up close too, to see bugs"). The photo layers are 512 px over 2.5 to
 * 4 m, so from a beetle's height they were a blur: a few millimetres of ground per pixel stretched over a centimetre.
 *
 * This paints what a texture that size can never hold, procedurally and only where a pixel is a few millimetres of
 * ground or less (so it costs nothing at the island view, and no tile repeats): soil crumbs about a centimetre across,
 * small stones a few centimetres across, sand's light and dark grains, gravel on the paths, and on grass the dead blades
 * lying in the thatch. Each crumb and stone is a little dome with its own tone, it tips the shading normal (so the sun
 * picks out its top and its side falls into shade) and it shades a thin ring of ground round its foot.
 *
 * One crumb and one stone per cell (cells a crumb's and a stone's size; each grain inside its cell), so a pixel reads two
 * cells and one thatch cell: no loops, a handful of hashes.
 *
 * Used by `terrain.ts` (both wild islands) and the town's `islands/town/render/surfaces.ts`.
 */

export const ARK_BUG_GROUND_GLSL = `
// A hash that stays even at the town's coordinates (hundreds of metres in thousands of cells).
vec3 arkBugHash3(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yxz + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
}
// The grain of cell floor(q) (q in cells): x its dome's height (0 off it), yz its slope (the normal's tip), w the shade
// ring round its foot; tone 0..1 its own colour. fill: the share of cells that hold one.
vec4 arkBugGrain(vec2 q, float fill, out float tone) {
    vec2 c = floor(q);
    vec3 h = arkBugHash3(c);
    tone = fract(h.x * 7.13 + h.y);
    if (h.z >= fill) return vec4(0.0);
    float r = 0.2 + 0.24 * h.x;
    vec2 centre = c + 0.5 + (h.yx - 0.5) * (1.0 - 2.0 * r);
    vec2 d = q - centre;
    // A little oval, turned its own way.
    float a = h.y * 6.2832;
    vec2 e = vec2(cos(a) * d.x + sin(a) * d.y, -sin(a) * d.x + cos(a) * d.y) * vec2(1.0, 1.0 + 0.6 * h.z / max(fill, 1e-3));
    // Irregular, not a disc: its edge wanders with the angle (a crumb, a chip of stone).
    float lobes = 1.0 + 0.22 * sin(atan(e.y, e.x) * 3.0 + h.x * 17.0) + 0.12 * sin(atan(e.y, e.x) * 5.0 + h.z * 23.0);
    float t = length(e) / (r * lobes);
    // Flat-topped (a crumb lies, it is not a bead), with a sharp shoulder.
    float dome = sqrt(max(1.0 - t * t * t * t, 0.0));
    float ring = smoothstep(1.4, 1.0, t) * step(1.0, t);
    vec2 slope = t < 1.0 ? d / r * smoothstep(0.55, 1.0, t) * 1.6 : vec2(0.0);
    return vec4(dome, slope, ring);
}
// The ground's colour and tangent normal (x along +x, y along +z) at bug scale. pixel: metres of ground per pixel here.
// soil, sand, grass, forest, gravel: how much of each covers the point. Returns how much of it showed (0 from afar).
float arkBugGround(vec2 p, float pixel, float soil, float sand, float grass, float forest, float gravel, inout vec3 col, inout vec3 nT) {
    float on = 1.0 - smoothstep(0.0025, 0.0065, pixel);
    if (on <= 0.0) return 0.0;
    float crumbsOn = on * (1.0 - smoothstep(0.0014, 0.0032, pixel));
    // Crumbs and sand grains (1.3 cm cells), and stones (4.6 cm cells, turned off the crumbs' grid).
    float t1;
    float t2;
    vec4 g1 = arkBugGrain(p / 0.013, clamp(soil * 0.62 + sand * 0.3 + forest * 0.45 + gravel * 0.9 + grass * 0.18, 0.0, 0.92), t1);
    vec4 g2 = arkBugGrain(mat2(0.8, -0.6, 0.6, 0.8) * p / 0.046 + 17.3, clamp(soil * 0.14 + sand * 0.03 + forest * 0.07 + gravel * 0.62 + grass * 0.03, 0.0, 0.8), t2);
    float lum = dot(col, vec3(0.3333));
    // Crumbs: the ground's own colour, each its own shade (a few darker, a few paler); sand's grains pale with a few
    // dark ones; gravel's grey.
    vec3 crumb = col * mix(0.62, 1.32, t1 * t1) * (0.88 + 0.16 * g1.x);
    crumb = mix(crumb, vec3(lum) * mix(vec3(1.12, 1.08, 1.0), vec3(0.5, 0.47, 0.44), step(0.82, t1)), sand * 0.55);
    crumb = mix(crumb, vec3(lum * mix(0.7, 1.3, t1)), gravel * 0.7);
    col = mix(col, crumb, smoothstep(0.0, 0.25, g1.x) * crumbsOn * 0.8);
    col *= 1.0 - 0.18 * g1.w * crumbsOn;
    // Stones: the ground's tone greyed, darker or paler stone by stone, a dark crease at the foot.
    vec3 stone = mix(vec3(lum), vec3(0.16, 0.15, 0.13), 0.35) * mix(0.65, 1.45, t2) * mix(vec3(1.0), vec3(1.05, 1.0, 0.92), t2) * (0.82 + 0.25 * g2.x);
    col = mix(col, stone, smoothstep(0.0, 0.2, g2.x) * on * 0.92);
    col *= 1.0 - 0.32 * g2.w * on;
    // The thatch: dead blades lying flat in the grass, straw-pale with a shadow along one side (2.4 cm cells).
    if (grass > 0.05) {
        vec2 q = p / 0.024;
        vec2 c = floor(q);
        vec3 h = arkBugHash3(c + 91.7);
        float a = h.x * 3.1416;
        vec2 dir = vec2(cos(a), sin(a));
        vec2 d = q - (c + 0.5 + (h.yz - 0.5) * 0.4);
        float along = dot(d, dir);
        float across = dot(d, vec2(-dir.y, dir.x));
        float blade = smoothstep(0.075, 0.03, abs(across)) * smoothstep(0.62, 0.45, abs(along)) * step(0.45, h.z);
        float shade = smoothstep(0.16, 0.08, abs(across - 0.1)) * (1.0 - blade) * smoothstep(0.62, 0.45, abs(along)) * step(0.45, h.z);
        col = mix(col, col * vec3(1.35, 1.28, 0.9) + vec3(0.03, 0.025, 0.0), blade * grass * crumbsOn * 0.75);
        col *= 1.0 - 0.25 * shade * grass * crumbsOn;
    }
    nT = normalize(nT + vec3((g1.yz * 0.35 * crumbsOn + g2.yz * 0.6 * on), 0.0));
    return on;
}
`;
