/**
 * The light of the hour (`lib/ark-daylight.ts`, from the viewer's clock):
 * three's physically based Sky as the backdrop, the same sky turned into
 * image-based light (PMREM) so every material picks it up, a sun (the moon at
 * night) with soft shadows fitted to what the camera sees, and a hemisphere
 * fill. The haze colour follows the sky's horizon, so the far sea melts into
 * it. At night a dome of deep blue with stars is laid over the sky.
 *
 * At 17:00 it is the v1 Ark's golden hour exactly. The sky's light is a picture
 * of the sky, made again only when the sun has moved a degree or a few; between
 * pictures its strength follows the sun (`sky-light.ts`), so the light never
 * steps: through dusk and dawn the sky dims by a third every three degrees.
 */

import {
    BackSide,
    Color,
    DataUtils,
    DirectionalLight,
    HalfFloatType,
    HemisphereLight,
    MathUtils,
    Mesh,
    PMREMGenerator,
    Scene,
    ShaderMaterial,
    SphereGeometry,
    Vector3,
    type Fog,
    type Texture,
    type WebGLRenderer
} from "three";
import {Sky} from "three/examples/jsm/objects/Sky.js";
import {readUntilIn} from "@/ark-scene/model-files";
import {RGBELoader} from "three/examples/jsm/loaders/RGBELoader.js";

/** The CC0 sky (docs/ark-credits.md): where its sun is, as a bearing round y (atan2(z, x)), to turn it onto the scene's sun. */
const HDRI_SUN_BEARING = 0.59;
import {ARK_DAYLIGHT, ARK_ENV, ARK_GLINT, ARK_RIM, ARK_SKY_HORIZON, ARK_SKY_ZENITH, ARK_SUN, ARK_TIME, ARK_WIND, NOISE_GLSL} from "@/ark-scene/glsl";
import {daylightAt, type ArkDaylight} from "@/lib/ark-daylight";
import {equirectSkyLight, generatedSkyLight, type Rgb} from "@/ark-scene/sky-light";

const SKY_SETTINGS = {turbidity: 3.2, rayleigh: 1.8, mieCoefficient: 0.003, mieDirectionalG: 0.82};
/**
 * Where the photographed sky takes over from the generated one, by the sun's height (degrees): under `from` the
 * generated sky alone, over `to` the photographed one alone, and between them one picture of both, the photographed
 * sky laid over the generated one more and more (a real cross-fade of the light, not a swap).
 */
const HANDOVER = {from: 9, to: 15};
/**
 * The photographed sky's own strength on the scene's sky light. (1.15 on three's own conversion of the picture, which
 * reads the picture's sun at a quarter of the resolution and came out a ninth brighter than the picture is; the same
 * light from the dome's picture of it, which the cross-fade needs, is 1.29: measured on four views, within 1/255.)
 */
const DAY_SKY_GAIN = 1.29;
/** A sky that arrives late (the photographed sky's file, after the first frames) comes in over this long (s). */
const ARRIVAL_SECONDS = 2.5;

const UP = new Vector3(0, 1, 0);

/** The photographed sky as a dome in the picture the sky's light is made from (an equirectangular map, as it lies: the scene turns the picture so its sun is ours). */
const DAY_DOME_FRAGMENT = `
uniform sampler2D map;
uniform float gain;
uniform float weight;
varying vec3 vDirection;
void main() {
    vec3 d = normalize(vDirection);
    vec2 uv = vec2(atan(d.z, d.x) * 0.15915494309189535 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.3183098861837907 + 0.5);
    gl_FragColor = vec4(texture2D(map, uv).rgb * gain, weight);
}`;

/** The night: a deep blue dome, lighter at the horizon, with stars that twinkle a little. Faded in with `night`. */
const NIGHT_VERTEX = `
varying vec3 vDirection;
void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position.z = gl_Position.w;
}`;
const NIGHT_FRAGMENT = `
uniform vec3 horizon;
uniform vec3 zenith;
uniform float night;
uniform float arkTime;
uniform vec3 moonDirection;
varying vec3 vDirection;
float starHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main() {
    vec3 d = normalize(vDirection);
    float up = clamp(d.y, 0.0, 1.0);
    vec3 colour = mix(horizon, zenith, pow(up, 0.55));
    // Stars: one per cell of a fine grid on the sphere, most of them dark.
    vec3 cell = floor(d * 180.0);
    float h = starHash(cell);
    float star = smoothstep(0.9965, 1.0, h) * smoothstep(0.04, 0.3, d.y);
    star *= 0.65 + 0.35 * sin(arkTime * (1.5 + h * 3.0) + h * 40.0);
    colour += vec3(0.85, 0.9, 1.0) * star * 1.6;
    // The moon (graphics pass): a disc with soft maria, and a glow round it.
    float m = dot(d, normalize(moonDirection));
    float disc = smoothstep(0.99935, 0.99952, m);
    float maria = 0.82 + 0.18 * sin(d.x * 900.0) * sin(d.z * 760.0 + d.y * 500.0);
    colour = mix(colour, vec3(0.93, 0.95, 1.0) * 2.2 * maria, disc);
    colour += vec3(0.55, 0.65, 0.9) * pow(max(m, 0.0), 220.0) * 0.35 + vec3(0.3, 0.38, 0.6) * pow(max(m, 0.0), 12.0) * 0.08;
    gl_FragColor = vec4(colour, night);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

/**
 * Clouds (graphics pass, batch 2): a dome of drifting fbm clouds over the sky, lit from the sun (or moon) with a
 * silver edge toward it, thicker with the weather's cloud cover, dim and blue at night. Drawn after the sky.
 */
const CLOUD_FRAGMENT = `
uniform float arkTime;
uniform vec2 arkWind;
uniform vec3 sunDirection;
uniform vec3 sunColour;
uniform vec3 skyTint;
uniform float cover;
uniform float daylight;
varying vec3 vDirection;
${NOISE_GLSL}
void main() {
    vec3 d = normalize(vDirection);
    if (d.y < 0.0) discard;
    // Onto a flat cloud deck: far clouds bunch toward the horizon.
    vec2 p = d.xz / (d.y + 0.12) * 1.6 + arkWind * arkTime * 0.004;
    float base = arkFbm(p * 0.55) * 0.65 + arkFbm(p * 1.7 + 3.0) * 0.35;
    float thresh = mix(0.68, 0.36, cover);
    float density = smoothstep(thresh, thresh + 0.22, base);
    // Lit side: brighter where the sun is behind the cloud's edge.
    float toward = max(dot(d, normalize(sunDirection)), 0.0);
    float edge = density * (1.0 - smoothstep(thresh + 0.05, thresh + 0.3, base));
    vec3 lit = mix(skyTint * 0.75, sunColour, 0.55 + 0.45 * smoothstep(thresh, thresh + 0.4, arkFbm(p * 0.55 + vec2(0.06, 0.04))));
    vec3 colour = lit * mix(0.82, 1.0, 1.0 - density * cover) + sunColour * edge * pow(toward, 6.0) * 0.8;
    colour *= mix(0.16, 1.0, daylight);
    float fade = smoothstep(0.0, 0.12, d.y);
    gl_FragColor = vec4(colour, density * fade * mix(0.55, 0.95, cover));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`;

export class ArkLighting {
    readonly sky: Sky;
    readonly sun: DirectionalLight;
    readonly fill: HemisphereLight;
    environment: Texture;
    /** The haze at the horizon, for the fog. */
    readonly horizon = new Color("#d9c9b4");
    private readonly direction = new Vector3();
    private readonly nightDome: Mesh;
    private readonly nightMaterial: ShaderMaterial;
    private readonly pmrem: PMREMGenerator;
    private readonly skyScene = new Scene();
    private readonly skyCopy = new Sky();
    private readonly nightCopy: Mesh;
    /** What the sky's light was last made for (the sun's height in steps, and how much of the photographed sky is in it). */
    private builtFor: string | null = null;
    /** The light of the sky in that picture (`sky-light.ts`), per unit of strength. */
    private builtLight = 0;
    /** The photographed sky's light at its own strength (`DAY_SKY_GAIN`), the same measure (0 until it is loaded). */
    private dayLight = 0;
    /** The sky light's strength for this hour, before a late sky's ease. */
    private skyStrength = 0.75;
    /** A sky arrived late, in a world already drawn: when (s), and when its share was last drawn into the picture. */
    private arrival: {at: number; applied: number} | null = null;
    /** A frame has been drawn (`step` runs once a frame). */
    private drawn = false;
    private readonly nightHorizon = new Color();
    private readonly nightZenith = new Color();
    /** The photographed sky's own picture, kept for the cross-fade (256 × 128, a quarter of a megabyte), and its dome. */
    private dayPicture: Texture | null = null;
    private readonly dayDome: Mesh;
    private readonly dayDomeMaterial: ShaderMaterial;
    private current: ArkDaylight;
    /** The photographed sky's light (batch 1), used while the sun is well up; the generated sky's at dusk, dawn and night. */
    private dayEnvironment: Texture | null = null;
    /** Under the sea: much less light reaches the bed (graphics pass). */
    private underwater = false;
    private readonly clouds: Mesh;
    private readonly cloudMaterial: ShaderMaterial;

    constructor(private readonly renderer: WebGLRenderer, private readonly scene: Scene, hours = 17) {
        this.current = daylightAt(hours);
        this.sky = new Sky();
        this.sky.scale.setScalar(4500);
        Object.assign(this.sky.material.uniforms.turbidity, {value: SKY_SETTINGS.turbidity});
        this.sky.material.uniforms.rayleigh.value = SKY_SETTINGS.rayleigh;
        this.sky.material.uniforms.mieCoefficient.value = SKY_SETTINGS.mieCoefficient;
        this.sky.material.uniforms.mieDirectionalG.value = SKY_SETTINGS.mieDirectionalG;
        this.sky.frustumCulled = false;
        this.sky.renderOrder = -10;

        this.nightMaterial = new ShaderMaterial({
            vertexShader: NIGHT_VERTEX,
            fragmentShader: NIGHT_FRAGMENT,
            uniforms: {horizon: {value: new Color()}, zenith: {value: new Color()}, night: {value: 0}, arkTime: ARK_TIME, moonDirection: ARK_SUN},
            side: BackSide,
            transparent: true,
            depthWrite: false,
            fog: false
        });
        this.nightDome = new Mesh(new SphereGeometry(4000, 32, 16), this.nightMaterial);
        this.cloudMaterial = new ShaderMaterial({
            vertexShader: NIGHT_VERTEX,
            fragmentShader: CLOUD_FRAGMENT,
            uniforms: {arkTime: ARK_TIME, arkWind: ARK_WIND, sunDirection: ARK_SUN, sunColour: {value: new Color("#fff4e0")}, skyTint: {value: new Color("#9fb6cc")}, cover: ARK_ENV.cloud, daylight: ARK_DAYLIGHT},
            side: BackSide,
            transparent: true,
            depthWrite: false,
            fog: false
        });
        this.clouds = new Mesh(new SphereGeometry(3800, 32, 16), this.cloudMaterial);
        this.clouds.frustumCulled = false;
        this.clouds.renderOrder = -8;
        this.nightDome.frustumCulled = false;
        this.nightDome.renderOrder = -9;

        // The copies the sky's light is made from.
        this.skyCopy.scale.setScalar(4500);
        this.skyCopy.material.uniforms.turbidity.value = SKY_SETTINGS.turbidity;
        this.skyCopy.material.uniforms.rayleigh.value = SKY_SETTINGS.rayleigh;
        this.skyCopy.material.uniforms.mieCoefficient.value = SKY_SETTINGS.mieCoefficient;
        this.skyCopy.material.uniforms.mieDirectionalG.value = SKY_SETTINGS.mieDirectionalG;
        this.nightCopy = new Mesh(this.nightDome.geometry, this.nightMaterial);
        this.dayDomeMaterial = new ShaderMaterial({
            vertexShader: NIGHT_VERTEX,
            fragmentShader: DAY_DOME_FRAGMENT,
            uniforms: {map: {value: null}, gain: {value: DAY_SKY_GAIN}, weight: {value: 0}},
            side: BackSide,
            transparent: true,
            depthWrite: false,
            depthTest: false,
            fog: false,
            toneMapped: false
        });
        this.dayDome = new Mesh(this.nightDome.geometry, this.dayDomeMaterial);
        this.dayDome.frustumCulled = false;
        this.dayDome.renderOrder = 10;
        this.dayDome.visible = false;
        this.skyScene.add(this.skyCopy, this.nightCopy, this.dayDome);
        this.pmrem = new PMREMGenerator(renderer);

        this.sun = new DirectionalLight(new Color("#ffd9a8"), 2.6);
        this.sun.castShadow = false;
        this.sun.shadow.bias = -0.0004;
        this.sun.shadow.normalBias = 0.04;
        this.sun.shadow.camera.near = 1;
        this.sun.shadow.camera.far = 900;
        this.fill = new HemisphereLight(new Color("#c9dbe8"), new Color("#6f6248"), 0.55);

        this.environment = this.pmrem.fromScene(this.skyScene, 0, 0.1, 6000).texture;
        scene.add(this.sky, this.nightDome, this.clouds, this.sun, this.sun.target, this.fill);
        scene.environment = this.environment;
        scene.environmentIntensity = 0.75;
        this.apply(this.current, null);
    }

    /** Disposed: the day sky is not read again. */
    private gone = false;

    /** Load the photographed day sky (once); it takes over the image-based light while the sun is up. */
    loadDaySky(url: string) {
        // (Read until it is in: a dropped request left the generated sky's light for the whole visit.)
        void readUntilIn("day sky", () => new RGBELoader().loadAsync(url), () => !this.gone).then((texture) => {
            // How much light it gives (`sky-light.ts`), and its picture kept for the cross-fade with the generated sky.
            const {data, width, height} = texture.image as unknown as {data: Uint16Array | Float32Array; width: number; height: number};
            const half = texture.type === HalfFloatType;
            this.dayLight = equirectSkyLight((index) => (half ? DataUtils.fromHalfFloat(data[index]) : data[index]), width, height, data.length / (width * height)) * DAY_SKY_GAIN;
            this.dayPicture = texture;
            this.dayDomeMaterial.uniforms.map.value = texture;
            // Its light for the day: the dome alone, unturned (the scene turns it with the sun), made the way the
            // cross-fade's pictures are, so the two meet exactly where one hands over to the other.
            this.skyCopy.visible = false;
            this.nightCopy.visible = false;
            this.dayDome.visible = true;
            this.dayDome.rotation.set(0, 0, 0);
            this.dayDome.updateMatrixWorld();
            this.dayDomeMaterial.uniforms.weight.value = 1;
            this.dayDomeMaterial.uniforms.gain.value = 1;
            this.dayEnvironment = this.pmrem.fromScene(this.skyScene, 0, 0.1, 6000).texture;
            this.dayDomeMaterial.uniforms.gain.value = DAY_SKY_GAIN;
            this.dayDome.visible = false;
            // In a world already drawn (a slow link) it joins the sky's light over a few seconds, laid over the generated
            // sky by a growing share as in the hand-over; before the first frame, at once.
            this.arrival = this.drawn ? {at: performance.now() / 1000, applied: -1} : null;
            this.builtFor = null;
            this.apply(this.current, null);
        }).catch(() => undefined);
    }

    /** How much of the photographed sky is in yet, 0–1 (1 unless it arrived late and is still coming in). */
    private arrived(): number {
        if (!this.arrival) return 1;
        const t = (performance.now() / 1000 - this.arrival.at) / ARRIVAL_SECONDS;
        // (A clock set back or far on, as the visual tests' frozen clocks are: in.)
        return t < 0 || t >= 1 ? 1 : MathUtils.smoothstep(t, 0, 1);
    }

    /** Every frame: a late sky brought in, a picture every eighth of a second (nothing otherwise). */
    step(now: number) {
        this.drawn = true;
        if (!this.arrival) return;
        const t = now - this.arrival.at;
        if (t < 0 || t >= ARRIVAL_SECONDS) {
            this.arrival = null;
            this.builtFor = null;
            this.apply(this.current, null);
        } else if (now - this.arrival.applied > 0.125) {
            this.arrival.applied = now;
            this.apply(this.current, null);
        }
    }

    get daylight(): ArkDaylight {
        return this.current;
    }

    /** The light for this hour; the sky's light is built again only when the sun has moved enough. */
    setHours(hours: number, fog: Fog | null) {
        this.apply(daylightAt(hours), fog);
    }

    /** Under the sea: the sky and the night dome are hidden (the water is all round). */
    setUnderwater(under: boolean) {
        this.underwater = under;
        this.sky.visible = !under;
        this.nightDome.visible = !under;
        this.clouds.visible = !under;
        this.apply(this.current, null);
    }

    private apply(day: ArkDaylight, fog: Fog | null) {
        this.current = day;
        const sunDirection = new Vector3().setFromSphericalCoords(1, MathUtils.degToRad(90 - day.elevation), MathUtils.degToRad(day.azimuth));
        this.direction.setFromSphericalCoords(1, MathUtils.degToRad(90 - day.light.elevation), MathUtils.degToRad(day.light.azimuth));
        // The water glints toward the light that is up: the sun, or the moon.
        ARK_SUN.value.copy(this.direction);
        // (The glint fades out and in with the light where the sun hands over to the moon, 2° under the horizon.)
        ARK_GLINT.value.set(day.light.color).multiplyScalar((day.elevation > -2 ? 1 : 0.6) * MathUtils.smoothstep(Math.abs(day.elevation + 2), 0, 3));
        ARK_SKY_HORIZON.value.set(day.horizon);
        ARK_SKY_ZENITH.value.set(day.zenith);
        ARK_DAYLIGHT.value = day.daylight;
        ARK_RIM.value.setRGB(1.0, 0.82, 0.6).multiplyScalar(day.rim);

        this.sky.material.uniforms.sunPosition.value.copy(sunDirection);
        this.skyCopy.material.uniforms.sunPosition.value.copy(sunDirection);
        // Under water the domes stay hidden (setUnderwater): else the sky shows past the terrain's edge as a white band.
        this.sky.visible = day.night < 0.995 && !this.underwater;
        this.nightMaterial.uniforms.horizon.value.set(day.horizon);
        this.nightMaterial.uniforms.zenith.value.set(day.zenith);
        this.nightMaterial.uniforms.night.value = day.night;
        this.nightDome.visible = day.night > 0.005 && !this.underwater;
        this.nightCopy.visible = day.night > 0.005;
        this.skyCopy.visible = day.night < 0.995;

        this.sun.color.set(day.light.color);
        this.sun.intensity = day.light.intensity * (1 - 0.35 * ARK_ENV.cloud.value) * (this.underwater ? 0.5 : 1);
        (this.cloudMaterial.uniforms.sunColour.value as Color).set(day.light.color).lerp(new Color("#ffffff"), 0.35);
        (this.cloudMaterial.uniforms.skyTint.value as Color).set(day.zenith).lerp(new Color(day.horizon), 0.5);
        // Moonlight casts softer, lighter shadows than the sun (batch 1: the night stays readable in the shade).
        this.sun.shadow.intensity = 1 - 0.5 * day.night;
        this.fill.color.set(day.fill.sky);
        this.fill.groundColor.set(day.fill.ground);
        this.fill.intensity = day.fill.intensity;
        this.horizon.set(day.fog);
        if (fog) fog.color.copy(this.horizon);

        // The sky's light. By day the photographed sky: real clouds and sky, turned so its sun is ours. At dusk, dawn and
        // night the generated sky, a picture of it made again each degree the sun moves while it is low (its colours turn
        // fast there), every three degrees otherwise. Between pictures the strength follows the sky's own light
        // (`sky-light.ts`): a picture kept for three degrees was a step of a fifth to a third of the scene's brightness
        // every twelve minutes through dusk and dawn. Where one sky hands over to the other (the sun 9° to 15° up) the
        // picture is of both, the photographed sky laid over the generated one by its share: swapped in one frame they
        // were a jump of a quarter of the picture's brightness (the photographed sky lights the ground twice as much).
        this.nightHorizon.set(day.horizon);
        this.nightZenith.set(day.zenith);
        const generated = generatedSkyLight(day.elevation, day.night, this.nightHorizon.toArray() as Rgb, this.nightZenith.toArray() as Rgb, SKY_SETTINGS);
        const arrived = this.arrived();
        const share = this.dayPicture ? MathUtils.smoothstep(day.elevation, HANDOVER.from, HANDOVER.to) * arrived : 0;
        const turn = Math.PI / 2 - MathUtils.degToRad(day.azimuth) - HDRI_SUN_BEARING;
        if (this.dayEnvironment && share >= 1) {
            this.builtFor = null;
            this.builtLight = this.dayLight / DAY_SKY_GAIN;
            this.scene.environment = this.dayEnvironment;
            this.scene.environmentRotation.set(0, turn, 0);
            this.skyStrength = day.environment * DAY_SKY_GAIN;
        } else {
            // (With the photographed sky in the picture, the picture is turned as the day's own is: the dome unturned, so
            // its sun falls on the same texels in every picture and the light it gives never wavers from one to the next,
            // and the generated sky made turned back by as much.)
            this.scene.environmentRotation.set(0, share > 0 ? turn : 0, 0);
            const light = generated + (this.dayLight - generated) * share;
            const low = day.elevation > -16 && day.elevation < HANDOVER.from;
            // (In the cross-fade a picture every eighth of a degree, about half a minute: each is a small step of its own,
            // the two skies' light falling differently on the ground and on walls.)
            const key = share > 0 ? `both ${Math.round(day.elevation * 8)} ${Math.round(arrived * 20)}` : low ? `low ${Math.round(day.elevation)}` : `${Math.round(day.elevation / 3)}`;
            if (this.builtFor !== key || this.builtLight <= 0 || this.scene.environment === this.dayEnvironment) {
                this.builtFor = key;
                this.builtLight = light;
                this.dayDome.visible = share > 0;
                this.dayDomeMaterial.uniforms.weight.value = share;
                if (share > 0) this.skyCopy.material.uniforms.sunPosition.value.copy(sunDirection).applyAxisAngle(UP, -turn);
                const next = this.pmrem.fromScene(this.skyScene, 0, 0.1, 6000).texture;
                this.scene.environment = next;
                if (this.environment !== this.dayEnvironment) this.environment.dispose();
                this.environment = next;
            }
            this.skyStrength = day.environment * MathUtils.clamp(light / this.builtLight, 0.4, 2.5);
        }
        this.scene.environmentIntensity = this.skyStrength;
    }

    /** Soft shadows from a map this many texels wide; 0 for none. */
    setShadows(renderer: WebGLRenderer, size: number) {
        renderer.shadowMap.enabled = size > 0;
        this.sun.castShadow = size > 0;
        if (size > 0 && this.sun.shadow.mapSize.x !== size) {
            this.sun.shadow.mapSize.set(size, size);
            this.sun.shadow.map?.dispose();
            this.sun.shadow.map = null;
        }
        this.sun.shadow.radius = size >= 2048 ? 3 : 2;
    }

    /** The shadow's box follows what the camera looks at, wide enough for the view. */
    fitShadow(target: Vector3, viewDistance: number) {
        const half = MathUtils.clamp(viewDistance * 0.85, 14, 170);
        const camera = this.sun.shadow.camera;
        // Whole texels, so the edges don't crawl as the view moves.
        const texel = (half * 2) / Math.max(this.sun.shadow.mapSize.x, 1);
        const cx = Math.round(target.x / texel) * texel;
        const cz = Math.round(target.z / texel) * texel;
        this.sun.target.position.set(cx, 0, cz);
        this.sun.position.set(cx, 0, cz).addScaledVector(this.direction, 400);
        if (camera.right !== half) {
            camera.left = -half;
            camera.right = half;
            camera.top = half;
            camera.bottom = -half;
            camera.updateProjectionMatrix();
        }
        this.sun.target.updateMatrixWorld();
    }

    dispose() {
        this.gone = true;
        this.environment.dispose();
        this.clouds.geometry.dispose();
        this.cloudMaterial.dispose();
        this.sky.geometry.dispose();
        this.sky.material.dispose();
        this.skyCopy.geometry.dispose();
        this.skyCopy.material.dispose();
        this.nightDome.geometry.dispose();
        this.nightMaterial.dispose();
        this.pmrem.dispose();
        this.dayPicture?.dispose();
        this.dayDomeMaterial.dispose();
        if (this.dayEnvironment && this.dayEnvironment !== this.environment) this.dayEnvironment.dispose();
        this.sun.shadow.map?.dispose();
    }
}
