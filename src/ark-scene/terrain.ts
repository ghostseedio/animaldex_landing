/**
 * The world's ground, water, sky and what grows on it: one terrain mesh
 * coloured per vertex from the zones' palettes, one water plane that reads
 * the depth under it from a small map, a sky dome, and one instanced mesh
 * per kind of decor. Ten draw calls for the whole landscape.
 */

import {
    BackSide,
    BufferAttribute,
    BufferGeometry,
    Color,
    ConeGeometry,
    CylinderGeometry,
    DataTexture,
    DodecahedronGeometry,
    DoubleSide,
    Group,
    IcosahedronGeometry,
    InstancedMesh,
    LinearFilter,
    Matrix4,
    Mesh,
    MeshLambertMaterial,
    PlaneGeometry,
    Quaternion,
    RGBAFormat,
    ShaderMaterial,
    SphereGeometry,
    UniformsLib,
    UniformsUtils,
    Vector3,
    type Material
} from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {worldDecor, type DecorKind} from "@/ark-scene/decor";
import {FIELD_TONES, ROCK, SKY, SNOW, WATER, WET_SAND, ZONE_PALETTES} from "@/ark-scene/palettes";
import {fbm, LAKE, noise, sampleGround, smoothstep, TERRAIN_HALF} from "@/ark-scene/world";

const SEGMENTS = 132;

function srgb(hex: string): Color {
    return new Color(hex);
}

// MARK: - Ground

function groundGeometry(): {geometry: BufferGeometry; depth: DataTexture} {
    const geometry = new PlaneGeometry(TERRAIN_HALF * 2, TERRAIN_HALF * 2, SEGMENTS, SEGMENTS);
    geometry.rotateX(-Math.PI / 2);
    const position = geometry.getAttribute("position") as BufferAttribute;
    const colors = new Float32Array(position.count * 3);
    // How much of each vertex is farmland: the fragment shader draws the fields there, crisp at any distance.
    const farmland = new Float32Array(position.count);
    const color = new Color();
    const mix = new Color();
    const palettes = Object.fromEntries(Object.entries(ZONE_PALETTES).map(([zone, palette]) => [zone, [srgb(palette.ground[0]), srgb(palette.ground[1])]])) as Record<string, [Color, Color]>;
    const sand = srgb(ZONE_PALETTES.seashore.ground[0]);
    const wetSand = srgb(WET_SAND);
    const reefFloor = srgb(ZONE_PALETTES.coral_reef.ground[0]);
    const seaFloor = srgb(ZONE_PALETTES.open_ocean.ground[0]);
    const snow = srgb(SNOW);

    // The water plane reads depth (r), reef (g) and fresh water (b) from this map.
    const size = SEGMENTS + 1;
    const depthPixels = new Uint8Array(size * size * 4);

    for (let i = 0; i < position.count; i++) {
        const x = position.getX(i);
        const z = position.getZ(i);
        const sample = sampleGround(x, z);
        position.setY(i, sample.height);

        color.setRGB(0, 0, 0);
        for (const [zone, weight] of Object.entries(sample.weights)) {
            if (weight < 0.004) continue;
            const [a, b] = palettes[zone];
            mix.copy(a).lerp(b, fbm(x * 0.07 + 11, z * 0.07 - 3));
            color.r += mix.r * weight;
            color.g += mix.g * weight;
            color.b += mix.b * weight;
        }
        farmland[i] = (sample.weights.farm_garden ?? 0) * smoothstep(0.6, 1, sample.land) * (sample.height > 0.2 ? 1 : 0);
        const polar = sample.weights.polar ?? 0;
        // A beach round the coast, except where the coast is ice.
        const beach = (1 - smoothstep(0.45, 1, sample.land)) * (1 - polar);
        color.lerp(sand, beach * 0.85);
        if (sample.height < 0.25 && sample.height > -0.5) color.lerp(wetSand, 0.45 * (1 - polar));
        // Snow up high.
        color.lerp(snow, smoothstep(17, 26, sample.height + 3 * (noise(x * 0.3, z * 0.3) - 0.5)));
        // Under water: the floor fades to the sea's colour with depth, bright sand on the reef.
        if (sample.height < 0) {
            const depth = -sample.height;
            const floor = mix.copy(seaFloor).lerp(reefFloor, sample.reef);
            color.lerp(floor, smoothstep(0.2, 3, depth));
        }
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        // PlaneGeometry rows run from -z (top) to +z: the map's row 0 is z = -HALF.
        const column = i % size;
        const row = Math.floor(i / size);
        const at = (row * size + column) * 4;
        const depth = Math.max(-sample.height, 0);
        depthPixels[at] = Math.min(255, Math.round(depth / 12 * 255));
        depthPixels[at + 1] = Math.round(sample.reef * 255);
        const fresh = smoothstep(LAKE.r + 4, LAKE.r, Math.hypot(x - LAKE.x, z - LAKE.z)) + (sample.river < 4 && sample.inland > 6 ? 1 : 0);
        depthPixels[at + 2] = Math.round(Math.min(fresh, 1) * 255);
        depthPixels[at + 3] = 255;
    }
    geometry.computeVertexNormals();

    // Steep ground shows bare rock.
    const normal = geometry.getAttribute("normal") as BufferAttribute;
    const rock = srgb(ROCK);
    for (let i = 0; i < position.count; i++) {
        const steep = smoothstep(0.86, 0.62, normal.getY(i));
        if (steep <= 0 || position.getY(i) < 0.5) continue;
        color.setRGB(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]).lerp(rock, steep * 0.8);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute("color", new BufferAttribute(colors, 3));
    geometry.setAttribute("farmland", new BufferAttribute(farmland, 1));

    const depth = new DataTexture(depthPixels, size, size, RGBAFormat);
    depth.flipY = false;
    depth.magFilter = LinearFilter;
    depth.minFilter = LinearFilter;
    depth.needsUpdate = true;
    return {geometry, depth};
}

// MARK: - Water

const WATER_VERTEX = `
#include <common>
#include <fog_pars_vertex>
varying vec3 vWorld;
void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
}
`;

const WATER_FRAGMENT = `
#include <common>
#include <fog_pars_fragment>
uniform sampler2D depthMap;
uniform float halfSize;
uniform float time;
uniform vec3 deep;
uniform vec3 open;
uniform vec3 shallow;
uniform vec3 reef;
uniform vec3 lake;
uniform vec3 sky;
uniform vec3 sunDirection;
uniform vec3 sunColor;
varying vec3 vWorld;

float ripple(vec2 p) {
    return sin(p.x * 0.9 + time * 0.6) * sin(p.y * 0.7 - time * 0.45) * 0.5
         + sin(p.x * 0.31 - p.y * 0.42 + time * 0.3) * 0.5;
}

void main() {
    vec2 uv = (vWorld.xz + halfSize) / (2.0 * halfSize);
    float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
    vec3 at = texture2D(depthMap, clamp(uv, 0.0, 1.0)).rgb;
    float depth = mix(10.0, at.r * 12.0, inside);
    float reefy = at.g * inside;
    float fresh = at.b * inside;

    vec3 colour = mix(shallow, open, smoothstep(0.2, 3.5, depth));
    colour = mix(colour, deep, smoothstep(4.0, 11.0, depth));
    colour = mix(colour, reef, reefy * (1.0 - smoothstep(2.0, 6.0, depth)) * 0.85);
    colour = mix(colour, lake, fresh);

    // A calm surface: a slow ripple tilts the normal a touch, the sky and the sun on it.
    vec2 p = vWorld.xz;
    // The ripple fades with distance, before it is finer than a pixel and shimmers into stripes.
    float near = 1.0 - smoothstep(25.0, 90.0, distance(cameraPosition, vWorld));
    vec3 n = normalize(vec3(ripple(p) * 0.06 * near, 1.0, ripple(p.yx * 1.3 + 4.0) * 0.06 * near));
    vec3 view = normalize(cameraPosition - vWorld);
    float fresnel = pow(1.0 - max(dot(n, view), 0.0), 4.0);
    colour = mix(colour, sky, fresnel * 0.55);
    vec3 halfway = normalize(view + sunDirection);
    colour += sunColor * pow(max(dot(n, halfway), 0.0), 180.0) * 0.6;

    // The waterline: a pale edge where it meets the shore.
    colour = mix(colour, vec3(0.92, 0.9, 0.84), (1.0 - smoothstep(0.0, 0.18, depth)) * 0.5 * inside);

    float alpha = mix(0.55, 1.0, smoothstep(0.1, 6.0, depth));
    alpha = max(alpha, fresh * 0.86);
    gl_FragColor = vec4(colour, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
}
`;

function waterMesh(depth: DataTexture, sunDirection: Vector3): {mesh: Mesh; material: ShaderMaterial} {
    const material = new ShaderMaterial({
        vertexShader: WATER_VERTEX,
        fragmentShader: WATER_FRAGMENT,
        uniforms: UniformsUtils.merge([
            UniformsLib.fog,
            {
                depthMap: {value: null},
                halfSize: {value: TERRAIN_HALF},
                time: {value: 0},
                deep: {value: srgb(WATER.deep)},
                open: {value: srgb(WATER.open)},
                shallow: {value: srgb(WATER.shallow)},
                reef: {value: srgb(WATER.reef)},
                lake: {value: srgb(WATER.lake)},
                sky: {value: srgb(SKY.horizon)},
                sunDirection: {value: sunDirection.clone()},
                sunColor: {value: srgb(SKY.sun)}
            }
        ]),
        transparent: true,
        depthWrite: false,
        fog: true
    });
    material.uniforms.depthMap.value = depth;
    const geometry = new PlaneGeometry(2400, 2400, 1, 1);
    geometry.rotateX(-Math.PI / 2);
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = 2;
    return {mesh, material};
}

// MARK: - Sky

function skyDome(sunDirection: Vector3): Mesh {
    const material = new ShaderMaterial({
        vertexShader: `
varying vec3 vDirection;
void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
        fragmentShader: `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 sunColor;
uniform vec3 sunDirection;
varying vec3 vDirection;
void main() {
    float up = clamp(vDirection.y, 0.0, 1.0);
    vec3 colour = mix(horizon, zenith, pow(up, 0.55));
    float sun = max(dot(normalize(vDirection), sunDirection), 0.0);
    colour += sunColor * (pow(sun, 24.0) * 0.35 + pow(sun, 600.0) * 0.6);
    gl_FragColor = vec4(colour, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
}`,
        uniforms: {
            zenith: {value: srgb(SKY.zenith)},
            horizon: {value: srgb(SKY.horizon)},
            sunColor: {value: srgb(SKY.sun)},
            sunDirection: {value: sunDirection.clone()}
        },
        side: BackSide,
        depthWrite: false,
        fog: false
    });
    const mesh = new Mesh(new SphereGeometry(2600, 32, 16), material);
    mesh.renderOrder = -10;
    mesh.frustumCulled = false;
    return mesh;
}

// MARK: - Decor

/** A part of a decor shape: its geometry and a shade (1 = the instance's colour). */
function part(geometry: BufferGeometry, shade: number, lift = 0, shadeLow = shade): BufferGeometry {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    flat.deleteAttribute("uv");
    const position = flat.getAttribute("position");
    flat.computeBoundingBox();
    const box = flat.boundingBox!;
    const colors = new Float32Array(position.count * 3);
    // How much of each vertex is farmland: the fragment shader draws the fields there, crisp at any distance.
    const farmland = new Float32Array(position.count);
    for (let i = 0; i < position.count; i++) {
        const t = (position.getY(i) - box.min.y) / Math.max(box.max.y - box.min.y, 1e-4);
        const value = shadeLow + (shade - shadeLow) * t;
        colors[i * 3] = value;
        colors[i * 3 + 1] = value;
        colors[i * 3 + 2] = value;
    }
    flat.setAttribute("color", new BufferAttribute(colors, 3));
    if (lift) flat.translate(0, lift, 0);
    return flat;
}

function decorGeometry(kind: DecorKind): BufferGeometry {
    const trunk = (height: number, radius: number) => {
        const geometry = new CylinderGeometry(radius * 0.7, radius, height, 5);
        return part(geometry, 0.55, height / 2);
    };
    switch (kind) {
        case "broadleaf": {
            const canopy = new IcosahedronGeometry(1.35, 1);
            canopy.scale(1, 0.85, 1);
            return mergeGeometries([trunk(1.8, 0.17), part(canopy, 1.08, 2.7, 0.72)])!;
        }
        case "conifer": {
            const tiers = [
                part(new ConeGeometry(1.15, 1.9, 7), 0.95, 1.6, 0.68),
                part(new ConeGeometry(0.88, 1.6, 7), 1.0, 2.45, 0.74),
                part(new ConeGeometry(0.6, 1.3, 7), 1.06, 3.25, 0.8)
            ];
            return mergeGeometries([trunk(1.2, 0.13), ...tiers])!;
        }
        case "acacia": {
            const crown = new CylinderGeometry(2.3, 1.5, 0.55, 9);
            return mergeGeometries([trunk(2.6, 0.13), part(crown, 1.05, 2.75, 0.7)])!;
        }
        case "rock": {
            const rock = new DodecahedronGeometry(0.8, 0);
            rock.scale(1.15, 0.62, 0.95);
            return part(rock, 1.05, 0.15, 0.78);
        }
        case "reed": {
            const blades = [-0.18, 0, 0.16].map((offset, i) => {
                const blade = new ConeGeometry(0.05, 1.3 + 0.3 * i, 4);
                blade.translate(offset, (1.3 + 0.3 * i) / 2, (i - 1) * 0.12);
                return part(blade, 1.05, 0, 0.75);
            });
            return mergeGeometries(blades)!;
        }
        case "coral": {
            const coral = new IcosahedronGeometry(0.55, 0);
            coral.scale(1, 0.85, 1);
            return part(coral, 1.08, 0.2, 0.8);
        }
    }
}

function decorMeshes(): Array<{mesh: InstancedMesh; material: Material}> {
    const items = worldDecor();
    const kinds: DecorKind[] = ["broadleaf", "conifer", "acacia", "rock", "reed", "coral"];
    const meshes: Array<{mesh: InstancedMesh; material: Material}> = [];
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const up = new Vector3(0, 1, 0);
    const scale = new Vector3();
    const at = new Vector3();
    const color = new Color();
    for (const kind of kinds) {
        const mine = items.filter((item) => item.kind === kind);
        if (!mine.length) continue;
        const material = new MeshLambertMaterial({vertexColors: true, flatShading: kind !== "reed"});
        if (kind === "reed") material.side = DoubleSide;
        const mesh = new InstancedMesh(decorGeometry(kind), material, mine.length);
        mine.forEach((item, i) => {
            rotation.setFromAxisAngle(up, item.rotation);
            const s = item.scale;
            scale.set(s, kind === "rock" ? s * (0.8 + 0.4 * ((i * 7) % 5) / 5) : s, s);
            at.set(item.x, item.y - 0.12, item.z);
            matrix.compose(at, rotation, scale);
            mesh.setMatrixAt(i, matrix);
            mesh.setColorAt(i, color.set(item.color));
        });
        mesh.computeBoundingSphere();
        meshes.push({mesh, material});
    }
    return meshes;
}

// MARK: - The landscape

export type Landscape = {
    group: Group;
    sky: Mesh;
    tick: (time: number) => void;
    dispose: () => void;
};

export function buildLandscape(sunDirection: Vector3): Landscape {
    const group = new Group();
    const {geometry, depth} = groundGeometry();
    const groundMaterial = new MeshLambertMaterial({vertexColors: true});
    // Close up, the ground has grain: two octaves of world-space noise shade it a few percent.
    groundMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nattribute float farmland;\nvarying float vFarmland;\nvarying vec3 vGroundWorld;")
            .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvGroundWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvFarmland = farmland;");
        shader.uniforms.fieldTones = {value: FIELD_TONES.map(srgb)};
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
varying vec3 vGroundWorld;
varying float vFarmland;
uniform vec3 fieldTones[${FIELD_TONES.length}];
float groundHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float groundNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(groundHash(i), groundHash(i + vec2(1.0, 0.0)), f.x), mix(groundHash(i + vec2(0.0, 1.0)), groundHash(i + vec2(1.0, 1.0)), f.x), f.y);
}`)
            .replace("#include <color_fragment>", `#include <color_fragment>
{
    float fade = 1.0 - smoothstep(30.0, 110.0, distance(cameraPosition, vGroundWorld));
    float grain = groundNoise(vGroundWorld.xz * 1.7) * 0.55 + groundNoise(vGroundWorld.xz * 0.35) * 0.45;
    // Home's patchwork: fields a few metres across, turned a little off the grid, hedges between them.
    if (vFarmland > 0.01) {
        vec2 f = vec2(dot(vGroundWorld.xz, vec2(0.94, 0.34)) / 9.0, dot(vGroundWorld.xz, vec2(-0.34, 0.94)) / 6.5);
        f.x += floor(f.y) * 0.37;
        vec2 cell = floor(f);
        int pick = int(floor(groundHash(cell * 1.31 + 7.0) * ${FIELD_TONES.length}.0));
        vec3 field = fieldTones[0];
        for (int k = 1; k < ${FIELD_TONES.length}; k++) { if (k == pick) field = fieldTones[k]; }
        vec2 edge = abs(fract(f) - 0.5);
        // The farmland's edge wanders and fades into the next zone, hedges first.
        float farm = smoothstep(0.3, 0.98, vFarmland + (groundNoise(vGroundWorld.xz * 0.11 + 3.0) - 0.5) * 0.4);
        float hedge = smoothstep(0.455, 0.49, max(edge.x * 1.0, edge.y)) * smoothstep(0.45, 0.95, farm);
        field *= mix(1.0, 0.62, hedge);
        // Rows across each field, faint.
        field *= 1.0 + 0.05 * sin(f.x * 6.2831 * 7.0) * fade;
        diffuseColor.rgb = mix(diffuseColor.rgb, field, farm * 0.92);
    }
    diffuseColor.rgb *= 1.0 + (grain - 0.5) * 0.16 * fade;
}`);
    };
    const ground = new Mesh(geometry, groundMaterial);
    group.add(ground);

    const water = waterMesh(depth, sunDirection);
    group.add(water.mesh);

    const decor = decorMeshes();
    for (const {mesh} of decor) group.add(mesh);

    const sky = skyDome(sunDirection);

    return {
        group,
        sky,
        tick: (time) => {
            water.material.uniforms.time.value = time;
        },
        dispose: () => {
            geometry.dispose();
            groundMaterial.dispose();
            depth.dispose();
            water.mesh.geometry.dispose();
            water.material.dispose();
            for (const {mesh, material} of decor) {
                mesh.geometry.dispose();
                material.dispose();
                mesh.dispose();
            }
            sky.geometry.dispose();
            (sky.material as Material).dispose();
        }
    };
}
