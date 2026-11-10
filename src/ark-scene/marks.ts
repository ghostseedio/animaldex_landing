/**
 * What sits on the ground under the animals: a soft contact shadow under
 * each one, and rings — the viewer's own animals ("My animals"), the
 * selected one, and the ripple an animal makes when it comes aboard. One
 * draw call each.
 */

import {
    CanvasTexture,
    Color,
    DynamicDrawUsage,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    MeshBasicMaterial,
    PlaneGeometry,
    RingGeometry,
    ShaderMaterial,
    UniformsLib,
    UniformsUtils
} from "three";

function radialTexture(): CanvasTexture {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.45, "rgba(255,255,255,0.65)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    return new CanvasTexture(canvas);
}

export type Shadow = {x: number; y: number; z: number; width: number; length: number; yaw: number; strength: number};

export class ContactShadows {
    readonly mesh: InstancedMesh;
    private readonly texture = radialTexture();
    private readonly material: MeshBasicMaterial;
    private capacity = 0;
    private readonly matrix = new Matrix4();
    private readonly rotation = new Matrix4();

    constructor() {
        this.material = new MeshBasicMaterial({color: 0x1d1a12, alphaMap: this.texture, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2});
        const geometry = new PlaneGeometry(1, 1);
        geometry.rotateX(-Math.PI / 2);
        this.mesh = new InstancedMesh(geometry, this.material, 1);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 1;
        this.grow(64);
    }

    private grow(capacity: number) {
        this.capacity = capacity;
        const matrices = new InstancedBufferAttribute(new Float32Array(capacity * 16), 16);
        matrices.setUsage(DynamicDrawUsage);
        this.mesh.instanceMatrix = matrices;
    }

    set(shadows: Shadow[]) {
        if (shadows.length > this.capacity) this.grow(Math.max(shadows.length, this.capacity * 2));
        shadows.forEach((shadow, i) => {
            this.matrix.makeScale(shadow.width * shadow.strength, 1, shadow.length * shadow.strength);
            this.rotation.makeRotationY(shadow.yaw);
            this.matrix.premultiply(this.rotation).setPosition(shadow.x, shadow.y + 0.05, shadow.z);
            this.mesh.setMatrixAt(i, this.matrix);
        });
        this.mesh.count = shadows.length;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.visible = shadows.length > 0;
    }

    dispose() {
        this.mesh.geometry.dispose();
        this.material.dispose();
        this.texture.dispose();
        this.mesh.dispose();
    }
}

export type Ring = {x: number; y: number; z: number; radius: number; color: Color; alpha: number};

export class GroundRings {
    readonly mesh: InstancedMesh;
    private readonly material: ShaderMaterial;
    private capacity = 0;
    private alphaAttribute!: InstancedBufferAttribute;
    private colorAttribute!: InstancedBufferAttribute;
    private readonly matrix = new Matrix4();

    constructor() {
        this.material = new ShaderMaterial({
            vertexShader: `
#include <common>
#include <fog_pars_vertex>
attribute vec3 ringColor;
attribute float ringAlpha;
varying vec3 vColor;
varying float vAlpha;
void main() {
    vColor = ringColor;
    vAlpha = ringAlpha;
    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}`,
            fragmentShader: `
#include <common>
#include <fog_pars_fragment>
varying vec3 vColor;
varying float vAlpha;
void main() {
    gl_FragColor = vec4(vColor, vAlpha);
    #include <colorspace_fragment>
    #include <fog_fragment>
}`,
            uniforms: UniformsUtils.merge([UniformsLib.fog]),
            transparent: true,
            depthWrite: false,
            fog: true,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -4
        });
        const geometry = new RingGeometry(0.93, 1, 64, 1);
        geometry.rotateX(-Math.PI / 2);
        this.mesh = new InstancedMesh(geometry, this.material, 1);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 3;
        this.grow(32);
    }

    private grow(capacity: number) {
        this.capacity = capacity;
        const geometry = this.mesh.geometry;
        this.alphaAttribute = new InstancedBufferAttribute(new Float32Array(capacity), 1);
        this.colorAttribute = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
        this.alphaAttribute.setUsage(DynamicDrawUsage);
        this.colorAttribute.setUsage(DynamicDrawUsage);
        geometry.setAttribute("ringAlpha", this.alphaAttribute);
        geometry.setAttribute("ringColor", this.colorAttribute);
        const matrices = new InstancedBufferAttribute(new Float32Array(capacity * 16), 16);
        matrices.setUsage(DynamicDrawUsage);
        this.mesh.instanceMatrix = matrices;
    }

    set(rings: Ring[]) {
        if (rings.length > this.capacity) this.grow(Math.max(rings.length, this.capacity * 2));
        rings.forEach((ring, i) => {
            this.matrix.makeScale(ring.radius, 1, ring.radius).setPosition(ring.x, ring.y + 0.08, ring.z);
            this.mesh.setMatrixAt(i, this.matrix);
            this.alphaAttribute.setX(i, ring.alpha);
            this.colorAttribute.setXYZ(i, ring.color.r, ring.color.g, ring.color.b);
        });
        this.mesh.count = rings.length;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.alphaAttribute.needsUpdate = true;
        this.colorAttribute.needsUpdate = true;
        this.mesh.visible = rings.length > 0;
    }

    dispose() {
        this.mesh.geometry.dispose();
        this.material.dispose();
        this.mesh.dispose();
    }
}
