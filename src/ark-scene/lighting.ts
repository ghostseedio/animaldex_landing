/**
 * The light of the hour (`lib/ark-daylight.ts`, from the viewer's clock):
 * three's physically based Sky as the backdrop, the same sky turned into
 * image-based light (PMREM) so every material picks it up, a sun (the moon at
 * night) with soft shadows fitted to what the camera sees, and a hemisphere
 * fill. The haze colour follows the sky's horizon, so the far sea melts into
 * it. At night a dome of deep blue with stars is laid over the sky.
 *
 * At 17:00 it is the v1 Ark's golden hour exactly. The sky's light is built
 * again only when the sun has moved a few degrees (a few times an hour).
 */

import {
    BackSide,
    Color,
    DirectionalLight,
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
import {RGBELoader} from "three/examples/jsm/loaders/RGBELoader.js";

/** The CC0 sky (docs/ark-credits.md): where its sun is, as a bearing round y (atan2(z, x)), to turn it onto the scene's sun. */
const HDRI_SUN_BEARING = 0.59;
import {ARK_DAYLIGHT, ARK_ENV, ARK_GLINT, ARK_RIM, ARK_SKY_HORIZON, ARK_SKY_ZENITH, ARK_SUN, ARK_TIME, ARK_WIND, NOISE_GLSL} from "@/ark-scene/glsl";
import {daylightAt, type ArkDaylight} from "@/lib/ark-daylight";

const SKY_SETTINGS = {turbidity: 3.2, rayleigh: 1.8, mieCoefficient: 0.003, mieDirectionalG: 0.82};

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
    /** The elevation (rounded) the sky's light was last built for. */
    private builtFor: number | null = null;
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
        this.skyScene.add(this.skyCopy, this.nightCopy);
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

    /** Load the photographed day sky (once); it takes over the image-based light while the sun is up. */
    loadDaySky(url: string) {
        new RGBELoader().load(url, (texture) => {
            this.dayEnvironment = this.pmrem.fromEquirectangular(texture).texture;
            texture.dispose();
            this.builtFor = null;
            this.apply(this.current, null);
        }, undefined, () => {});
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
        ARK_GLINT.value.set(day.light.color).multiplyScalar(day.elevation > -2 ? 1 : 0.6);
        ARK_SKY_HORIZON.value.set(day.horizon);
        ARK_SKY_ZENITH.value.set(day.zenith);
        ARK_DAYLIGHT.value = day.daylight;
        ARK_RIM.value.setRGB(1.0, 0.82, 0.6).multiplyScalar(day.rim);

        this.sky.material.uniforms.sunPosition.value.copy(sunDirection);
        this.skyCopy.material.uniforms.sunPosition.value.copy(sunDirection);
        this.sky.visible = day.night < 0.995;
        this.nightMaterial.uniforms.horizon.value.set(day.horizon);
        this.nightMaterial.uniforms.zenith.value.set(day.zenith);
        this.nightMaterial.uniforms.night.value = day.night;
        this.nightDome.visible = day.night > 0.005;
        this.nightCopy.visible = this.nightDome.visible;
        this.skyCopy.visible = this.sky.visible;

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
        this.scene.environmentIntensity = day.environment;

        // The photographed sky by day: the image-based light from real clouds and sky, turned so its sun is ours.
        // Where it hands over to the generated sky (the sun 12° up) the sky light dips softly either side, so the
        // swap never pops (batch 3: smooth day, dusk, night and dawn).
        const handover = 0.4 + 0.6 * MathUtils.smoothstep(Math.abs(day.elevation - 12), 0, 5);
        if (this.dayEnvironment && day.elevation > 12) {
            this.builtFor = null;
            this.scene.environment = this.dayEnvironment;
            this.scene.environmentRotation.set(0, Math.PI / 2 - MathUtils.degToRad(day.azimuth) - HDRI_SUN_BEARING, 0);
            this.scene.environmentIntensity = day.environment * 1.15 * handover;
            return;
        }
        this.scene.environmentRotation.set(0, 0, 0);
        this.scene.environmentIntensity = day.environment * handover;
        const key = Math.round(day.elevation / 3);
        if (this.builtFor !== key) {
            this.builtFor = key;
            const next = this.pmrem.fromScene(this.skyScene, 0, 0.1, 6000).texture;
            this.scene.environment = next;
            if (this.environment !== this.dayEnvironment) this.environment.dispose();
            this.environment = next;
        }
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
        this.sun.shadow.map?.dispose();
    }
}
