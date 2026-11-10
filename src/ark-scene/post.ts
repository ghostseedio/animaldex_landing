/**
 * The finish on the picture, in three tiers (`three/examples/jsm/postprocessing`):
 *
 * - high: ground-truth ambient occlusion (GTAO), a soft bloom on the
 *   brightest highlights, tilt-shift depth of field when the world is seen
 *   from far (the miniature look), a colour grade and vignette, SMAA;
 * - medium: tilt-shift, grade and vignette, FXAA;
 * - low: none — straight to the screen.
 *
 * The scene picks the tier (`tierFor`, then drops one if frames run long).
 */

import {Vector2, type Camera, type Scene, type WebGLRenderer} from "three";
import {EffectComposer} from "three/examples/jsm/postprocessing/EffectComposer.js";
import {RenderPass} from "three/examples/jsm/postprocessing/RenderPass.js";
import {GTAOPass} from "three/examples/jsm/postprocessing/GTAOPass.js";
import {UnrealBloomPass} from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import {ShaderPass} from "three/examples/jsm/postprocessing/ShaderPass.js";
import {OutputPass} from "three/examples/jsm/postprocessing/OutputPass.js";
import {SMAAPass} from "three/examples/jsm/postprocessing/SMAAPass.js";
import {FXAAShader} from "three/examples/jsm/shaders/FXAAShader.js";
import {HorizontalTiltShiftShader} from "three/examples/jsm/shaders/HorizontalTiltShiftShader.js";
import {VerticalTiltShiftShader} from "three/examples/jsm/shaders/VerticalTiltShiftShader.js";

export type QualityTier = "high" | "medium" | "low";

/** A first guess from what the device says about itself. */
export function tierFor(): QualityTier {
    if (typeof window === "undefined") return "medium";
    const nav = navigator as Navigator & {deviceMemory?: number};
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    const cores = nav.hardwareConcurrency || 4;
    const memory = nav.deviceMemory ?? 8;
    if (!coarse && cores >= 8 && memory >= 8) return "high";
    if (cores >= 6 && memory >= 4) return "medium";
    return coarse ? "low" : "medium";
}

export function lowerTier(tier: QualityTier): QualityTier {
    return tier === "high" ? "medium" : "low";
}

/** Warm highlights, cool shadows, a touch more colour, and a soft vignette (on the sRGB picture). */
const GradeShader = {
    uniforms: {
        tDiffuse: {value: null},
        vignette: {value: 0.28},
        saturation: {value: 1.08},
        contrast: {value: 1.04}
    },
    vertexShader: `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `
uniform sampler2D tDiffuse;
uniform float vignette;
uniform float saturation;
uniform float contrast;
varying vec2 vUv;
void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    vec3 c = texel.rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c = mix(vec3(l), c, saturation);
    c = (c - 0.5) * contrast + 0.5;
    c += vec3(0.028, 0.012, -0.022) * smoothstep(0.45, 1.0, l);
    c += vec3(-0.012, 0.0, 0.018) * (1.0 - smoothstep(0.0, 0.45, l));
    vec2 d = (vUv - 0.5) * vec2(1.15, 1.0);
    c *= mix(1.0, 1.0 - vignette, smoothstep(0.3, 0.85, length(d)));
    gl_FragColor = vec4(clamp(c, 0.0, 1.0), texel.a);
}`
};

export class ArkPost {
    private composer: EffectComposer | null = null;
    private tiltH: ShaderPass | null = null;
    private tiltV: ShaderPass | null = null;
    private fxaa: ShaderPass | null = null;
    private width = 1;
    private height = 1;
    private pixelRatio = 1;
    private tilt = 0;

    constructor(private readonly renderer: WebGLRenderer, private readonly scene: Scene, private readonly camera: Camera, private tier: QualityTier) {
        this.build();
    }

    get current(): QualityTier {
        return this.tier;
    }

    setTier(tier: QualityTier) {
        if (tier === this.tier) return;
        this.tier = tier;
        this.build();
    }

    private build() {
        this.composer?.dispose();
        this.composer = null;
        this.tiltH = this.tiltV = this.fxaa = null;
        if (this.tier === "low") return;
        const composer = new EffectComposer(this.renderer);
        composer.addPass(new RenderPass(this.scene, this.camera));
        if (this.tier === "high") {
            const gtao = new GTAOPass(this.scene, this.camera, this.width, this.height);
            gtao.blendIntensity = 0.85;
            gtao.updateGtaoMaterial({radius: 1.2, distanceExponent: 1.4, thickness: 1.2, scale: 1.0, samples: 12});
            composer.addPass(gtao);
            composer.addPass(new UnrealBloomPass(new Vector2(this.width, this.height), 0.22, 0.55, 0.92));
        }
        this.tiltH = new ShaderPass(HorizontalTiltShiftShader);
        this.tiltV = new ShaderPass(VerticalTiltShiftShader);
        composer.addPass(this.tiltH);
        composer.addPass(this.tiltV);
        composer.addPass(new OutputPass());
        composer.addPass(new ShaderPass(GradeShader));
        if (this.tier === "high") {
            composer.addPass(new SMAAPass(this.width * this.pixelRatio, this.height * this.pixelRatio));
        } else {
            this.fxaa = new ShaderPass(FXAAShader);
            composer.addPass(this.fxaa);
        }
        this.composer = composer;
        this.setSize(this.width, this.height, this.pixelRatio);
        this.setTiltShift(this.tilt);
    }

    setSize(width: number, height: number, pixelRatio: number) {
        this.width = width;
        this.height = height;
        this.pixelRatio = pixelRatio;
        if (!this.composer) return;
        this.composer.setPixelRatio(pixelRatio);
        this.composer.setSize(width, height);
        if (this.fxaa) (this.fxaa.uniforms.resolution.value as Vector2).set(1 / (width * pixelRatio), 1 / (height * pixelRatio));
        this.setTiltShift(this.tilt);
    }

    /** 0 sharp everywhere … 1 the full miniature: the top and bottom of the picture soften. */
    setTiltShift(amount: number) {
        this.tilt = amount;
        if (!this.tiltH || !this.tiltV) return;
        const blur = 6 * amount;
        this.tiltH.uniforms.h.value = blur / (this.width * this.pixelRatio);
        this.tiltV.uniforms.v.value = blur / (this.height * this.pixelRatio);
        this.tiltH.uniforms.r.value = 0.5;
        this.tiltV.uniforms.r.value = 0.5;
        this.tiltH.enabled = amount > 0.02;
        this.tiltV.enabled = amount > 0.02;
    }

    render() {
        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        this.composer?.dispose();
        this.composer = null;
    }
}
