/**
 * Golden-hour light: three's physically based Sky as the backdrop, the same
 * sky turned into image-based light (PMREM) so every material picks it up,
 * a warm low sun with soft shadows fitted to what the camera sees, and a
 * hemisphere fill. The haze colour is the sky's own horizon, so the far sea
 * melts into it.
 */

import {
    Color,
    DirectionalLight,
    HemisphereLight,
    MathUtils,
    PMREMGenerator,
    Scene,
    Vector3,
    type Texture,
    type WebGLRenderer
} from "three";
import {Sky} from "three/examples/jsm/objects/Sky.js";
import {ARK_SUN} from "@/ark-scene/glsl";

/** Degrees above the horizon, and the bearing it shines from (west-north-west, behind the island's left shoulder). */
const SUN_ELEVATION = 17;
const SUN_AZIMUTH = -118;

export class ArkLighting {
    readonly sky: Sky;
    readonly sun: DirectionalLight;
    readonly fill: HemisphereLight;
    readonly environment: Texture;
    /** The haze at the horizon, for the fog. */
    readonly horizon = new Color("#d9c9b4");
    private readonly direction = new Vector3();

    constructor(renderer: WebGLRenderer, scene: Scene) {
        const phi = MathUtils.degToRad(90 - SUN_ELEVATION);
        const theta = MathUtils.degToRad(SUN_AZIMUTH);
        this.direction.setFromSphericalCoords(1, phi, theta);
        ARK_SUN.value.copy(this.direction);

        this.sky = new Sky();
        this.sky.scale.setScalar(4500);
        const uniforms = this.sky.material.uniforms;
        uniforms.turbidity.value = 5.5;
        uniforms.rayleigh.value = 1.35;
        uniforms.mieCoefficient.value = 0.0045;
        uniforms.mieDirectionalG.value = 0.82;
        uniforms.sunPosition.value.copy(this.direction);
        this.sky.frustumCulled = false;
        this.sky.renderOrder = -10;

        // The sky, once, as light for every surface.
        const pmrem = new PMREMGenerator(renderer);
        const skyScene = new Scene();
        const skyCopy = new Sky();
        skyCopy.scale.setScalar(4500);
        Object.assign(skyCopy.material.uniforms.turbidity, {value: 5.5});
        skyCopy.material.uniforms.rayleigh.value = 1.35;
        skyCopy.material.uniforms.mieCoefficient.value = 0.0045;
        skyCopy.material.uniforms.mieDirectionalG.value = 0.82;
        skyCopy.material.uniforms.sunPosition.value.copy(this.direction);
        skyScene.add(skyCopy);
        this.environment = pmrem.fromScene(skyScene, 0, 0.1, 6000).texture;
        skyCopy.geometry.dispose();
        skyCopy.material.dispose();
        pmrem.dispose();

        this.sun = new DirectionalLight(new Color("#ffd9a8"), 2.6);
        this.sun.castShadow = false;
        this.sun.shadow.bias = -0.0004;
        this.sun.shadow.normalBias = 0.04;
        this.sun.shadow.camera.near = 1;
        this.sun.shadow.camera.far = 900;
        this.fill = new HemisphereLight(new Color("#c9dbe8"), new Color("#6f6248"), 0.55);

        scene.add(this.sky, this.sun, this.sun.target, this.fill);
        scene.environment = this.environment;
        scene.environmentIntensity = 0.75;
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
        this.sky.geometry.dispose();
        this.sky.material.dispose();
        this.sun.shadow.map?.dispose();
    }
}
