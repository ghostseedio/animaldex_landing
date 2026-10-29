/**
 * The call camera's vignette and ambient occlusion, drawn the way SceneKit
 * draws them on iOS (the numbers, the measurements and which animals get the
 * occlusion: `@/lib/talking-models/effects`).
 *
 * The vignette is the last step of each of the animal's own materials, on
 * colour only: SceneKit's leaves alpha alone, so on the call's clear canvas it
 * falls on the animal and not on the habitat behind it, as in the app.
 *
 * The occlusion, for an animal without fur: its skin, mouth, eyes, nose and
 * the floor are drawn once more as depth and normals at half the drawing
 * buffer's size; a hemisphere of samples about each point gives the
 * occlusion, counting only surfaces near in depth and turned away from this
 * one (SceneKit's depth and normal thresholds: a crease, not the same curve
 * going on); a 4×4 blur keeps to one surface; and the skin's environment
 * light is dimmed by it, as SceneKit dims its lighting environment. Three
 * small passes over a quarter of the pixels.
 */

import {
    DataTexture,
    DepthTexture,
    HalfFloatType,
    LinearFilter,
    Matrix4,
    Mesh,
    NearestFilter,
    OrthographicCamera,
    PlaneGeometry,
    RGBAFormat,
    Scene,
    ShaderMaterial,
    UnsignedByteType,
    UnsignedIntType,
    Vector2,
    Vector3,
    WebGLRenderTarget,
    type PerspectiveCamera,
    type Texture,
    type WebGLRenderer
} from "three";
import {
    ambientOcclusionQualityFor,
    CALL_AMBIENT_OCCLUSION,
    CALL_VIGNETTE,
    occlusionKernel,
    WEB_OCCLUSION_KERNEL,
    type AmbientOcclusionQuality
} from "@/lib/talking-models/effects";

/** This device's starting quality (`ambientOcclusionQualityFor`). */
export function deviceAmbientOcclusionQuality(): AmbientOcclusionQuality {
    if (typeof window === "undefined") return "high";
    const info = navigator as Navigator & {deviceMemory?: number};
    return ambientOcclusionQualityFor({
        coarsePointer: window.matchMedia?.("(pointer: coarse)").matches ?? false,
        cores: Number.isFinite(info.hardwareConcurrency) ? info.hardwareConcurrency : null,
        memoryGB: typeof info.deviceMemory === "number" && Number.isFinite(info.deviceMemory) ? info.deviceMemory : null
    });
}

/** The vignette's uniforms, shared by every material; `vignetteSize` is the drawing buffer in pixels. */
export function vignetteUniforms() {
    return {
        vignetteSize: {value: new Vector2(1, 1)},
        vignetteIntensity: {value: CALL_VIGNETTE.intensity as number},
        vignettePower: {value: CALL_VIGNETTE.power as number}
    };
}

export const VIGNETTE_DECLARATIONS = `
uniform vec2 vignetteSize;
uniform float vignetteIntensity;
uniform float vignettePower;
float talkingVignette() {
    vec2 uv = gl_FragCoord.xy / vignetteSize;
    float shape = clamp(16.0 * uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y), 0.0, 1.0);
    return mix(1.0, pow(shape, vignettePower), vignetteIntensity);
}
`;

/** After `opaque_fragment`, while the colour is still linear (the tone mapping is linear too). */
export const VIGNETTE_FRAGMENT = "gl_FragColor.rgb *= talkingVignette();";

export const SCREEN_OCCLUSION_DECLARATIONS = `
uniform sampler2D screenOcclusion;
uniform vec2 screenOcclusionSize;
`;

/** At `aomap_fragment`: what three does with an ambient occlusion map, with the screen's occlusion here. */
export const SCREEN_OCCLUSION_FRAGMENT = `
{
    float screenAo = texture2D(screenOcclusion, gl_FragCoord.xy / screenOcclusionSize).r;
    reflectedLight.indirectDiffuse *= screenAo;
    #if defined( USE_CLEARCOAT )
        clearcoatSpecularIndirect *= screenAo;
    #endif
    #if defined( USE_ENVMAP ) && defined( STANDARD )
        float screenDotNV = saturate( dot( geometryNormal, geometryViewDir ) );
        reflectedLight.indirectSpecular *= computeSpecularOcclusion( screenDotNV, screenAo, material.roughness );
    #endif
}
`;

const FULLSCREEN_VERTEX = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const VIEW_POSITION = `
uniform sampler2D tDepth;
uniform mat4 inverseProjection;
vec3 viewPositionAt(vec2 uv, float depth) {
    vec4 view = inverseProjection * vec4(vec3(uv, depth) * 2.0 - 1.0, 1.0);
    return view.xyz / view.w;
}
`;

const OCCLUSION_FRAGMENT = `
${VIEW_POSITION}
uniform sampler2D tNormal;
uniform mat4 projection;
uniform float radius;
uniform float intensity;
uniform float depthThreshold;
uniform float normalThreshold;
uniform vec3 kernel[KERNEL_SIZE];
varying vec2 vUv;

// Interleaved gradient noise: each pixel's samples turned differently; the blur evens it out.
float turn(vec2 pixel) {
    return fract(52.9829189 * fract(dot(pixel, vec2(0.06711056, 0.00583715))));
}

void main() {
    float depth = texture2D(tDepth, vUv).x;
    if (depth >= 1.0) {
        gl_FragColor = vec4(1.0);
        return;
    }
    vec3 position = viewPositionAt(vUv, depth);
    vec3 normal = normalize(texture2D(tNormal, vUv).xyz * 2.0 - 1.0);
    float angle = turn(gl_FragCoord.xy) * 6.2831853;
    vec3 across = vec3(cos(angle), sin(angle), 0.0);
    vec3 tangent = normalize(across - normal * dot(across, normal) + vec3(1e-4, 0.0, 0.0));
    mat3 basis = mat3(tangent, cross(normal, tangent), normal);
    float occlusion = 0.0;
    for (int i = 0; i < KERNEL_SIZE; i++) {
        vec3 probe = position + basis * kernel[i] * radius;
        vec4 clip = projection * vec4(probe, 1.0);
        vec2 at = clip.xy / clip.w * 0.5 + 0.5;
        float there = texture2D(tDepth, at).x;
        if (there >= 1.0) continue;
        float surface = viewPositionAt(at, there).z;
        // Only what is near in depth occludes (SceneKit's depth threshold).
        float near = smoothstep(0.0, 1.0, depthThreshold / max(abs(position.z - surface), 1e-4));
        // And only a surface turned away from this one: a crease, not the same curve going on.
        vec3 facing = texture2D(tNormal, at).xyz * 2.0 - 1.0;
        float turned = dot(normal, facing) < 1.0 - normalThreshold ? 1.0 : 0.0;
        occlusion += (surface >= probe.z + 0.002 ? 1.0 : 0.0) * near * turned;
    }
    float ao = 1.0 - intensity * occlusion / float(KERNEL_SIZE);
    gl_FragColor = vec4(ao, ao, ao, 1.0);
}
`;

const BLUR_FRAGMENT = `
${VIEW_POSITION}
uniform sampler2D tOcclusion;
uniform sampler2D tNormal;
uniform vec2 texel;
uniform float normalThreshold;
uniform float depthThreshold;
varying vec2 vUv;

// 4x4 about the pixel, keeping only neighbours on the same surface: facing
// the same way (SceneKit's normal threshold) and at about the same depth.
void main() {
    float depth = texture2D(tDepth, vUv).x;
    if (depth >= 1.0) {
        gl_FragColor = vec4(1.0);
        return;
    }
    float z = viewPositionAt(vUv, depth).z;
    vec3 normal = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
    float sum = 0.0;
    float weight = 0.0;
    for (int x = -2; x < 2; x++) {
        for (int y = -2; y < 2; y++) {
            vec2 at = vUv + (vec2(float(x), float(y)) + 0.5) * texel;
            float there = texture2D(tDepth, at).x;
            if (there >= 1.0) continue;
            vec3 facing = texture2D(tNormal, at).xyz * 2.0 - 1.0;
            float same = step(1.0 - normalThreshold, dot(normal, facing)) * step(abs(viewPositionAt(at, there).z - z), depthThreshold);
            sum += texture2D(tOcclusion, at).r * same;
            weight += same;
        }
    }
    float ao = weight > 0.0 ? sum / weight : texture2D(tOcclusion, vUv).r;
    gl_FragColor = vec4(ao, ao, ao, 1.0);
}
`;

function whiteTexel(): DataTexture {
    const texture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
    texture.needsUpdate = true;
    return texture;
}

/**
 * The occlusion passes. `render` hands its target to `prepass`, which draws
 * the occluders' normals (and so their depth) into it; the caller swaps the
 * meshes' materials for that.
 */
export class ScreenSpaceOcclusion {
    /** For the skin's shader: the screen's occlusion, and the drawing buffer's size to read it at. */
    readonly uniforms = {
        screenOcclusion: {value: null as Texture | null},
        screenOcclusionSize: {value: new Vector2(1, 1)}
    };
    private readonly white = whiteTexel();
    private readonly input: WebGLRenderTarget;
    private readonly raw: WebGLRenderTarget;
    private readonly blurred: WebGLRenderTarget;
    private readonly quad: Mesh;
    private readonly quadScene = new Scene();
    private readonly quadCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    private readonly occlusion = new Map<number, ShaderMaterial>();
    private readonly blur: ShaderMaterial;
    private readonly inverseProjection = new Matrix4();
    private enabled = true;

    constructor(private readonly renderer: WebGLRenderer, private readonly scale = 0.5) {
        const depthTexture = new DepthTexture(1, 1, UnsignedIntType);
        this.input = new WebGLRenderTarget(1, 1, {type: UnsignedByteType, minFilter: NearestFilter, magFilter: NearestFilter, depthTexture, depthBuffer: true});
        // Half floats where the GPU can draw into them; bytes are plenty otherwise.
        const type = renderer.extensions.has("EXT_color_buffer_float") || renderer.extensions.has("EXT_color_buffer_half_float") ? HalfFloatType : UnsignedByteType;
        this.raw = new WebGLRenderTarget(1, 1, {type, minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: false});
        this.blurred = new WebGLRenderTarget(1, 1, {type, minFilter: LinearFilter, magFilter: LinearFilter, depthBuffer: false});
        this.blur = new ShaderMaterial({
            vertexShader: FULLSCREEN_VERTEX,
            fragmentShader: BLUR_FRAGMENT,
            uniforms: {
                tDepth: {value: depthTexture},
                tNormal: {value: this.input.texture},
                tOcclusion: {value: this.raw.texture},
                inverseProjection: {value: this.inverseProjection},
                texel: {value: new Vector2(1, 1)},
                normalThreshold: {value: CALL_AMBIENT_OCCLUSION.normalThreshold},
                depthThreshold: {value: CALL_AMBIENT_OCCLUSION.depthThreshold}
            },
            depthTest: false,
            depthWrite: false
        });
        this.quad = new Mesh(new PlaneGeometry(2, 2), this.blur);
        this.quad.frustumCulled = false;
        this.quadScene.add(this.quad);
        this.uniforms.screenOcclusion.value = this.blurred.texture;
    }

    private occlusionMaterial(samples: number): ShaderMaterial {
        let material = this.occlusion.get(samples);
        if (!material) {
            material = new ShaderMaterial({
                defines: {KERNEL_SIZE: samples},
                vertexShader: FULLSCREEN_VERTEX,
                fragmentShader: OCCLUSION_FRAGMENT,
                uniforms: {
                    tDepth: {value: this.input.depthTexture},
                    tNormal: {value: this.input.texture},
                    projection: {value: new Matrix4()},
                    inverseProjection: {value: this.inverseProjection},
                    radius: {value: WEB_OCCLUSION_KERNEL.radius},
                    intensity: {value: CALL_AMBIENT_OCCLUSION.intensity},
                    depthThreshold: {value: WEB_OCCLUSION_KERNEL.depthReach},
                    normalThreshold: {value: CALL_AMBIENT_OCCLUSION.normalThreshold},
                    kernel: {value: occlusionKernel(samples).map(([x, y, z]) => new Vector3(x, y, z))}
                },
                depthTest: false,
                depthWrite: false
            });
            this.occlusion.set(samples, material);
        }
        return material;
    }

    /** The drawing buffer's size, in pixels. */
    setSize(width: number, height: number) {
        this.uniforms.screenOcclusionSize.value.set(width, height);
        const w = Math.max(1, Math.round(width * this.scale));
        const h = Math.max(1, Math.round(height * this.scale));
        this.input.setSize(w, h);
        this.raw.setSize(w, h);
        this.blurred.setSize(w, h);
        (this.blur.uniforms.texel.value as Vector2).set(1 / w, 1 / h);
    }

    /** Off: the skin reads one white texel (no occlusion) and nothing more is drawn. */
    setEnabled(on: boolean) {
        this.enabled = on;
        this.uniforms.screenOcclusion.value = on ? this.blurred.texture : this.white;
    }

    get isEnabled(): boolean {
        return this.enabled;
    }

    /** This frame's occlusion, from `samples` directions a point. */
    render(camera: PerspectiveCamera, samples: number, prepass: () => void) {
        if (!this.enabled) return;
        const renderer = this.renderer;
        const previousTarget = renderer.getRenderTarget();
        this.inverseProjection.copy(camera.projectionMatrixInverse);

        renderer.setRenderTarget(this.input);
        renderer.clear(true, true, false);
        prepass();

        const occlusion = this.occlusionMaterial(samples);
        (occlusion.uniforms.projection.value as Matrix4).copy(camera.projectionMatrix);
        this.quad.material = occlusion;
        renderer.setRenderTarget(this.raw);
        renderer.render(this.quadScene, this.quadCamera);

        this.quad.material = this.blur;
        renderer.setRenderTarget(this.blurred);
        renderer.render(this.quadScene, this.quadCamera);

        renderer.setRenderTarget(previousTarget);
    }

    dispose() {
        this.input.depthTexture?.dispose();
        this.input.dispose();
        this.raw.dispose();
        this.blurred.dispose();
        this.white.dispose();
        this.blur.dispose();
        this.occlusion.forEach((material) => material.dispose());
        this.quad.geometry.dispose();
    }
}
