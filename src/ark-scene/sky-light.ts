/**
 * How bright the sky's light is, worked out on the CPU (the lighting lane, 2026-11-14).
 *
 * The scene's image-based light is a picture of the sky (`lighting.ts`): three's analytic `Sky` at dawn, dusk and
 * night, a photographed sky by day. A picture is made at one moment and kept while the sun moves on, so the light
 * it gives stood still and then stepped at each new picture: by a fifth to a third of the picture's brightness
 * every twelve minutes through dusk and dawn, and by half where the photographed sky took over (the two skies are
 * not equally bright). The numbers here let `lighting.ts` keep the light continuous: the sky's strength follows the
 * sun between pictures, also through the hand-over's cross-fade of the two skies.
 *
 * `skyRadiance` is three's `Sky` shader (`three/examples/jsm/objects/Sky.js`), line for line, without its sun disc
 * (a few texels of the light's cube: under a hundredth of the light on the ground). Pure: no three, no DOM.
 */

export type SkySettings = {turbidity: number; rayleigh: number; mieCoefficient: number; mieDirectionalG: number};
export type Rgb = [number, number, number];

const TOTAL_RAYLEIGH: Rgb = [5.804542996261093e-6, 1.3562911419845635e-5, 3.0265902468824876e-5];
const MIE_CONST: Rgb = [1.8399918514433978e14, 2.7798023919660528e14, 4.0790479543861094e14];
const CUTOFF_ANGLE = 1.6110731556870734;
const STEEPNESS = 1.5;
const EE = 1000;
const RAYLEIGH_ZENITH = 8.4e3;
const MIE_ZENITH = 1.25e3;
const THREE_OVER_SIXTEEN_PI = 0.05968310365946075;
const ONE_OVER_FOUR_PI = 0.07957747154594767;

function sunIntensity(zenithCos: number): number {
    const c = Math.min(Math.max(zenithCos, -1), 1);
    return EE * Math.max(0, 1 - Math.exp(-((CUTOFF_ANGLE - Math.acos(c)) / STEEPNESS)));
}

/** The analytic sky's radiance (linear, as the shader writes it before tone mapping) toward a unit direction, the sun at `sunY` up in the x–y plane. */
export function skyRadiance(dx: number, dy: number, dz: number, sunElevationRad: number, settings: SkySettings, out: Rgb = [0, 0, 0]): Rgb {
    const sunX = Math.cos(sunElevationRad);
    const sunY = Math.sin(sunElevationRad);
    const sunE = sunIntensity(sunY);
    const zenithAngle = Math.acos(Math.max(0, dy));
    const inverse = 1 / (Math.cos(zenithAngle) + 0.15 * Math.pow(93.885 - (zenithAngle * 180) / Math.PI, -1.253));
    const sR = RAYLEIGH_ZENITH * inverse;
    const sM = MIE_ZENITH * inverse;
    const cosTheta = dx * sunX + dy * sunY;
    const half = cosTheta * 0.5 + 0.5;
    const rPhase = THREE_OVER_SIXTEEN_PI * (1 + half * half);
    const g = settings.mieDirectionalG;
    const mPhase = ONE_OVER_FOUR_PI * ((1 - g * g) / Math.pow(1 - 2 * g * cosTheta + g * g, 1.5));
    const fade = Math.min(Math.max(Math.pow(1 - sunY, 5), 0), 1);
    void dz;
    for (let k = 0; k < 3; k++) {
        const betaR = TOTAL_RAYLEIGH[k] * settings.rayleigh;
        const betaM = 0.434 * (0.2 * settings.turbidity * 10e-18) * MIE_CONST[k] * settings.mieCoefficient;
        const fex = Math.exp(-(betaR * sR + betaM * sM));
        const scatter = sunE * ((betaR * rPhase + betaM * mPhase) / (betaR + betaM));
        let lin = Math.pow(scatter * (1 - fex), 1.5);
        lin *= 1 + (Math.pow(scatter * fex, 0.5) - 1) * fade;
        const tex = (lin + 0.1 * fex) * 0.04 + (k === 1 ? 0.0003 : k === 2 ? 0.00075 : 0);
        out[k] = Math.pow(tex, 1 / 2.4);
    }
    return out;
}

const luminance = (c: Rgb) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/**
 * One number for a sky's light on the scene: six parts what a face turned up gets from it (the ground, the tops of
 * things: its irradiance over π) and four parts its mean over the whole sphere (the same for a face turned any way:
 * walls, trunks, the animals' sides). The two skies differ in shape (the photographed one has its sun in it and a dark
 * ground under it; the generated one is bright all round its horizon and below), so neither part alone says how
 * bright a picture lit by one is beside a picture lit by the other; this mix was within a tenth for the wild
 * island's ground and for the town's walls (measured on both, the two skies swapped at the same hour).
 */
const UP_SHARE = 0.6;

/** The directions the sky is sampled in: rings over the upper half (`y` up), half the turn (the sky is the same either side of the sun). */
const RINGS = 8;
const TURNS = 10;

/**
 * The generated sky's light (see `UP_SHARE`): the analytic sky with the sun `elevation` degrees up, under the night
 * dome faded in by `night` (its horizon and zenith colours linear, as its shader has them). Below the horizon both
 * are their horizon's colour, as they are drawn.
 */
export function generatedSkyLight(elevation: number, night: number, nightHorizon: Rgb, nightZenith: Rgb, settings: SkySettings): number {
    const sun = (elevation * Math.PI) / 180;
    const colour: Rgb = [0, 0, 0];
    const withSky = night < 0.995;
    const withNight = night > 0.005;
    const at = (y: number, turn: number) => {
        const r = Math.sqrt(Math.max(1 - y * y, 0));
        const sky = withSky ? luminance(skyRadiance(r * Math.cos(turn), y, r * Math.sin(turn), sun, settings, colour)) : 0;
        if (!withNight) return sky;
        // The dome over it: lighter at the horizon (`NIGHT_FRAGMENT`), a little starlight.
        const up = Math.pow(y, 0.55);
        const dome = luminance([nightHorizon[0] + (nightZenith[0] - nightHorizon[0]) * up, nightHorizon[1] + (nightZenith[1] - nightHorizon[1]) * up, nightHorizon[2] + (nightZenith[2] - nightHorizon[2]) * up]) + 0.003;
        return sky + (dome - sky) * night;
    };
    let up = 0;
    let above = 0;
    let below = 0;
    for (let j = 0; j < TURNS; j++) {
        const turn = ((j + 0.5) / TURNS) * Math.PI;
        for (let i = 0; i < RINGS; i++) {
            // (Equal steps of the cosine's square: each ring the same share of a face's light; equal steps of the cosine: of the sphere.)
            up += at(Math.sqrt((i + 0.5) / RINGS), turn);
            above += at((i + 0.5) / RINGS, turn);
        }
        below += at(0, turn);
    }
    const sphere = (above / (RINGS * TURNS) + below / TURNS) / 2;
    return UP_SHARE * (up / (RINGS * TURNS)) + (1 - UP_SHARE) * sphere;
}

/**
 * A photographed sky's light, the same measure as `generatedSkyLight`: an equirectangular picture's linear pixels
 * (`channels` a pixel, row 0 the zenith), read every `stride`-th pixel.
 */
export function equirectSkyLight(pixel: (index: number) => number, width: number, height: number, channels: number, stride = 1): number {
    let up = 0;
    let upWeight = 0;
    let sphere = 0;
    let sphereWeight = 0;
    for (let row = 0; row < height; row += stride) {
        const zenith = ((row + 0.5) / height) * Math.PI;
        // Each pixel's share of the sphere is its solid angle (sin(zenith)); of a face's light, cos(zenith) times that.
        const solid = Math.sin(zenith);
        const facing = row < height / 2 ? Math.cos(zenith) * solid : 0;
        for (let column = 0; column < width; column += stride) {
            const at = (row * width + column) * channels;
            const light = 0.2126 * pixel(at) + 0.7152 * pixel(at + 1) + 0.0722 * pixel(at + 2);
            up += light * facing;
            sphere += light * solid;
        }
        upWeight += facing * Math.ceil(width / stride);
        sphereWeight += solid * Math.ceil(width / stride);
    }
    if (upWeight <= 0 || sphereWeight <= 0) return 0;
    return UP_SHARE * (up / upWeight) + (1 - UP_SHARE) * (sphere / sphereWeight);
}
