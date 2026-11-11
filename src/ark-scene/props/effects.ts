/**
 * The props' moving air and light, each one draw call of points or a few
 * quads, moved in the vertex shader from the shared clock (`ARK_TIME`) and
 * seeded so every viewer sees the same:
 *
 * - chimney smoke, leaning with the wind;
 * - moths round the porch light at night;
 * - dew: sparkles on the meadows near the camera's ground and beads on the
 *   webs, at dawn after a still night;
 * - morning mist lying over the lake, the wetland, the river and the
 *   woods' floor;
 * - snow blown off the mountain and across the ice in a cold wind;
 * - dust lifted off the dry savanna and desert in the wind.
 *
 * None at the low tier (the tier's `particles` is 0); fewer at medium.
 */

import {AdditiveBlending, BufferAttribute, BufferGeometry, Color, Mesh, NormalBlending, PlaneGeometry, Points, ShaderMaterial, Vector3, type Group} from "three";
import {ARK_TIME, NOISE_GLSL} from "@/ark-scene/glsl";
import type {PropsConditions} from "@/ark-scene/props/conditions";
import {namedPlace, propRandom} from "@/ark-scene/props/sampler";
import {LAKE, RIVER, sampleGround, ZONE_SITES, zoneAt} from "@/ark-scene/world";

type Field = {points: Points; material: ShaderMaterial; base: number};

const SOFT_FRAGMENT = `
uniform vec3 tint;
uniform float opacity;
varying float vAlpha;
void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = (1.0 - smoothstep(0.2, 1.0, r)) * vAlpha * opacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(tint, a);
}`;

const GLINT_FRAGMENT = `
uniform vec3 tint;
uniform float opacity;
varying float vAlpha;
void main() {
    vec2 d = gl_PointCoord - 0.5;
    float core = 1.0 - smoothstep(0.05, 0.32, length(d));
    float cross = (1.0 - smoothstep(0.0, 0.05, abs(d.x))) * (1.0 - smoothstep(0.1, 0.5, abs(d.y))) + (1.0 - smoothstep(0.0, 0.05, abs(d.y))) * (1.0 - smoothstep(0.1, 0.5, abs(d.x)));
    float a = clamp(core + cross * 0.5, 0.0, 1.0) * vAlpha * opacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(tint * a, a);
}`;

function field(positions: number[], seeds: number[], vertex: string, fragment: string, uniforms: Record<string, {value: unknown}>, options: {additive?: boolean; order?: number} = {}): Field {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("seed", new BufferAttribute(new Float32Array(seeds), 1));
    const material = new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        uniforms: {arkTime: ARK_TIME, pixelRatio: {value: 1}, opacity: {value: 0}, ...uniforms},
        transparent: true,
        depthWrite: false,
        blending: options.additive ? AdditiveBlending : NormalBlending
    });
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    points.renderOrder = options.order ?? 7;
    points.visible = false;
    return {points, material, base: seeds.length};
}

// MARK: - Smoke

const SMOKE_VERTEX = `
attribute float seed;
uniform float arkTime;
uniform float pixelRatio;
uniform vec2 wind;
varying float vAlpha;
void main() {
    float t = fract(arkTime * 0.11 + seed);
    vec3 p = position;
    p.y += t * 4.2;
    p.xz += wind * t * t * 5.0 + vec2(sin(seed * 40.0 + arkTime * 0.7), cos(seed * 31.0 + arkTime * 0.6)) * t * 0.5;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = smoothstep(0.0, 0.08, t) * (1.0 - t) * 0.55;
    gl_PointSize = pixelRatio * (0.5 + 2.2 * t) * 300.0 / -mv.z;
}`;

// MARK: - Moths

const MOTH_VERTEX = `
attribute float seed;
uniform float arkTime;
uniform float pixelRatio;
varying float vAlpha;
void main() {
    float t = arkTime * (1.6 + seed * 1.4) + seed * 60.0;
    vec3 p = position + vec3(sin(t) * (0.18 + seed * 0.2), sin(t * 2.3 + seed * 9.0) * 0.12, cos(t * 1.3) * (0.16 + seed * 0.18));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = 0.75 + 0.25 * sin(t * 9.0);
    gl_PointSize = pixelRatio * clamp(0.9 * 300.0 * 0.03 / -mv.z * 6.0, 1.5, 7.0);
}`;

// MARK: - Dew

const DEW_VERTEX = `
attribute float seed;
uniform float arkTime;
uniform float pixelRatio;
uniform vec3 sun;
uniform float size;
varying float vAlpha;
void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vec3 toCamera = normalize(cameraPosition - world.xyz);
    // A drop glints when the camera sees the sun's reflection in it, more or less, and twinkles as the view moves.
    float facing = 0.35 + 0.65 * pow(max(dot(reflect(-sun, vec3(0.0, 1.0, 0.0)), toCamera), 0.0), 3.0);
    float twinkle = 0.6 + 0.4 * sin(seed * 91.0 + dot(world.xz, vec2(3.1, 2.7)) + arkTime * 1.5 + cameraPosition.x * 4.0);
    float d = length(cameraPosition - world.xyz);
    vec4 mv = viewMatrix * world;
    gl_Position = projectionMatrix * mv;
    vAlpha = facing * twinkle * (1.0 - smoothstep(14.0, 32.0, d));
    gl_PointSize = pixelRatio * clamp(size * 300.0 / -mv.z, 1.0, 6.0);
}`;

// MARK: - Drifting snow and dust: particles carried along the wind through a box, wrapping round it

const DRIFT_VERTEX = `
attribute float seed;
uniform float arkTime;
uniform float pixelRatio;
uniform vec2 wind;
uniform vec3 box;
uniform float speed;
uniform float size;
varying float vAlpha;
void main() {
    vec3 p = position;
    vec2 travel = wind * arkTime * speed * (0.7 + seed * 0.6);
    p.xz = mod(p.xz + travel + box.xz * 0.5, box.xz) - box.xz * 0.5;
    p.y += sin(arkTime * (1.0 + seed) + seed * 50.0) * 0.4 + fract(seed * 7.0 + arkTime * 0.05) * 0.5;
    p.x += sin(arkTime * 2.0 + seed * 20.0) * 0.3;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vec2 edge = abs(p.xz) / (box.xz * 0.5);
    vAlpha = 1.0 - smoothstep(0.7, 1.0, max(edge.x, edge.y));
    gl_PointSize = pixelRatio * clamp(size * 300.0 / -mv.z, 1.0, 9.0);
}`;

// MARK: - Mist

const MIST_VERTEX = `
varying vec3 vWorld;
void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
}`;

const MIST_FRAGMENT = `
${NOISE_GLSL}
uniform float arkTime;
uniform float opacity;
uniform vec3 tint;
uniform vec3 centre;
uniform float radius;
varying vec3 vWorld;
void main() {
    vec2 p = vWorld.xz * 0.08 + vec2(arkTime * 0.012, arkTime * 0.007);
    float n = arkFbm(p) * 0.7 + arkFbm(p * 2.3 - 4.0) * 0.3;
    // Soft at its edges: a wide fade to nothing, broken up by the noise so the rim is never a circle.
    float edge = 1.0 - smoothstep(radius * 0.3, radius, length(vWorld.xz - centre.xz) * (0.85 + 0.3 * n));
    // A sheet seen from its own height reads as a frosted band: fade it as the camera comes down to it,
    // and wherever it is seen edge-on.
    vec3 toEye = cameraPosition - vWorld;
    float above = smoothstep(0.6, 4.0, toEye.y);
    float faceOn = smoothstep(0.12, 0.45, abs(toEye.y) / max(length(toEye), 1e-3));
    float a = smoothstep(0.32, 0.72, n) * edge * above * faceOn * opacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(tint, a * 0.55);
}`;


export type Effects = {
    setTier: (particles: number) => void;
    setPixelRatio: (ratio: number) => void;
    /** Per frame (cheap): the conditions now and the camera. */
    update: (conditions: PropsConditions, camera: Vector3, sun: Vector3) => void;
    /** The webs' dew beads and the slime trails' glints (rebuilt with the homes). */
    setGlints: (beads: Float32Array, slime: Float32Array) => void;
    dispose: () => void;
};

export function buildEffects(group: Group, chimney: Vector3): Effects {
    const random = propRandom("effects");
    const fields: Field[] = [];
    const add = (f: Field) => {
        group.add(f.points);
        fields.push(f);
        return f;
    };
    const windUniform = {value: new Float32Array([0.5, 0.2])};

    // Smoke from the cottage's chimney.
    const smokeSeeds = Array.from({length: 46}, (_, k) => k / 46 + random() * 0.01);
    const smoke = add(field(smokeSeeds.flatMap(() => [chimney.x + (random() - 0.5) * 0.15, chimney.y, chimney.z + (random() - 0.5) * 0.15]), smokeSeeds, SMOKE_VERTEX, SOFT_FRAGMENT, {tint: {value: new Color("#c9c6c0")}, wind: windUniform}, {order: 8}));

    // Moths at the porch light.
    const porch = namedPlace("house_porch_light");
    const mothSeeds = Array.from({length: 12}, () => random());
    const moths = add(field(mothSeeds.flatMap(() => [porch.x + (random() - 0.5) * 0.2, porch.y + (random() - 0.3) * 0.3, porch.z + 0.25 + random() * 0.2]), mothSeeds, MOTH_VERTEX, SOFT_FRAGMENT, {tint: {value: new Color("#efe4cf")}}));

    // Dew on the meadows round the places the camera comes close: the garden, the forest floor, the corners, the grass.
    const dewPositions: number[] = [];
    const dewSeeds: number[] = [];
    const sunUniform = {value: new Vector3(0.3, 0.5, 0.8).normalize()};
    for (const name of ["house", "forest_floor", "grassland", "woodland", "fields", "wetland"] as const) {
        const at = namedPlace(name);
        for (let k = 0; k < 900; k++) {
            const a = random() * Math.PI * 2;
            const d = Math.sqrt(random()) * Math.min(at.radius + 8, 22);
            const x = at.x + Math.cos(a) * d;
            const z = at.z + Math.sin(a) * d;
            const ground = sampleGround(x, z);
            if (ground.land < 0.9 || ground.height < 0.3) continue;
            dewPositions.push(x, ground.height + 0.06 + random() * 0.18, z);
            dewSeeds.push(random());
        }
    }
    const dew = add(field(dewPositions, dewSeeds, DEW_VERTEX, GLINT_FRAGMENT, {tint: {value: new Color("#f4fbff")}, sun: sunUniform, size: {value: 0.02}}, {additive: true}));
    let beads = add(field([], [], DEW_VERTEX, GLINT_FRAGMENT, {tint: {value: new Color("#ffffff")}, sun: sunUniform, size: {value: 0.03}}, {additive: true}));
    let slime = add(field([], [], DEW_VERTEX, GLINT_FRAGMENT, {tint: {value: new Color("#f2fbff")}, sun: sunUniform, size: {value: 0.02}}, {additive: true}));
    let ratio = 1;

    // Snow blown over the mountain's top and across the ice; dust over the savanna and the desert.
    const peak = namedPlace("mountain_peak");
    const drift = (centre: {x: number; y: number; z: number}, size: [number, number, number], count: number, tint: string, speed: number, pointSize: number) => {
        const seeds: number[] = [];
        const positions: number[] = [];
        for (let k = 0; k < count; k++) {
            const x = (random() - 0.5) * size[0];
            const z = (random() - 0.5) * size[2];
            positions.push(x, random() * size[1], z);
            seeds.push(random());
        }
        const f = field(positions, seeds, DRIFT_VERTEX, SOFT_FRAGMENT, {tint: {value: new Color(tint)}, wind: windUniform, box: {value: new Vector3(...size)}, speed: {value: speed}, size: {value: pointSize}});
        // Follow the ground: the box sits on it at its middle.
        f.points.position.set(centre.x, centre.y, centre.z);
        return add(f);
    };
    const snowPeak = drift({x: peak.x, y: peak.y - 6, z: peak.z}, [44, 9, 44], 700, "#f6f9ff", 4, 0.05);
    const snowIce = drift({x: ZONE_SITES.polar.x, y: sampleGround(ZONE_SITES.polar.x, ZONE_SITES.polar.z).height + 0.1, z: ZONE_SITES.polar.z}, [44, 2.5, 44], 600, "#f6f9ff", 5, 0.04);
    const dustSavanna = drift({x: ZONE_SITES.grassland.x, y: sampleGround(ZONE_SITES.grassland.x, ZONE_SITES.grassland.z).height + 0.1, z: ZONE_SITES.grassland.z}, [50, 2.2, 50], 380, "#d9c29a", 3, 0.09);
    const dustDesert = drift({x: ZONE_SITES.desert.x, y: sampleGround(ZONE_SITES.desert.x, ZONE_SITES.desert.z).height + 0.1, z: ZONE_SITES.desert.z}, [46, 2.2, 46], 380, "#e3c79a", 3.5, 0.09);

    // Mist: soft sheets lying over the lake, the wetland, the river's valley and the woods' floor.
    const mistMeshes: Mesh[] = [];
    const mistMaterials: ShaderMaterial[] = [];
    const mistAt = [
        {x: LAKE.x, z: LAKE.z, r: LAKE.r + 8, y: 0.5},
        {x: ZONE_SITES.wetland.x, z: ZONE_SITES.wetland.z, r: 24, y: 0.7},
        {x: RIVER[2][0], z: RIVER[2][1], r: 16, y: 0.6},
        {x: RIVER[3][0], z: RIVER[3][1], r: 16, y: 0.6},
        {x: ZONE_SITES.woodland.x, z: ZONE_SITES.woodland.z, r: 26, y: 0},
        {x: ZONE_SITES.farm_garden.x, z: ZONE_SITES.farm_garden.z + 8, r: 24, y: 0}
    ];
    for (const at of mistAt) {
        // The ground under the patch, sampled once per vertex for both layers (the mount's cost), each vertex then
        // raised to the highest of it and its grid neighbours, so a sheet clears the bumps between its vertices.
        const segments = Math.min(Math.max(Math.round((at.r * 2) / 2.2), 8), 36);
        const side = segments + 1;
        const floor = new Float32Array(side * side);
        for (let row = 0; row < side; row++) {
            for (let col = 0; col < side; col++) {
                const x = at.x + (col / segments - 0.5) * at.r * 2;
                const z = at.z + (row / segments - 0.5) * at.r * 2;
                floor[row * side + col] = Math.max(sampleGround(x, z).height, 0);
            }
        }
        const highest = (row: number, col: number) => {
            let high = floor[row * side + col];
            if (row > 0) high = Math.max(high, floor[(row - 1) * side + col]);
            if (row < segments) high = Math.max(high, floor[(row + 1) * side + col]);
            if (col > 0) high = Math.max(high, floor[row * side + col - 1]);
            if (col < segments) high = Math.max(high, floor[row * side + col + 1]);
            return high;
        };
        for (const layer of [0, 1]) {
            // Draped over the ground and the water (every couple of metres), lying low: it never slices through a slope.
            const plane = new PlaneGeometry(at.r * 2, at.r * 2, segments, segments);
            plane.rotateX(-Math.PI / 2);
            const lift = 0.25 + layer * 0.75 + Math.min(at.y, 0.7) * 0.3;
            const position = plane.getAttribute("position");
            // PlaneGeometry's vertices run row by row from its far edge (−z after the turn) to its near, columns −x to +x.
            for (let i = 0; i < position.count; i++) {
                const col = Math.round((position.getX(i) / (at.r * 2) + 0.5) * segments);
                const row = Math.round((position.getZ(i) / (at.r * 2) + 0.5) * segments);
                position.setY(i, highest(Math.min(Math.max(row, 0), segments), Math.min(Math.max(col, 0), segments)) + lift);
            }
            position.needsUpdate = true;
            const material = new ShaderMaterial({
                vertexShader: MIST_VERTEX,
                fragmentShader: MIST_FRAGMENT,
                uniforms: {arkTime: ARK_TIME, opacity: {value: 0}, tint: {value: new Color("#e9eef0")}, centre: {value: new Vector3(at.x, 0, at.z)}, radius: {value: at.r}},
                transparent: true,
                depthWrite: false
            });
            const mesh = new Mesh(plane, material);
            mesh.position.set(at.x, 0, at.z);
            mesh.renderOrder = 9;
            mesh.visible = false;
            mesh.name = "props:mist";
            group.add(mesh);
            mistMeshes.push(mesh);
            mistMaterials.push(material);
        }
    }
    void zoneAt;

    let particles = 1;
    const setCount = (f: Field) => f.points.geometry.setDrawRange(0, Math.round(f.base * particles));
    return {
        setTier: (value) => {
            particles = value;
            for (const f of fields) setCount(f);
        },
        setPixelRatio: (next) => {
            ratio = next;
            for (const f of fields) f.material.uniforms.pixelRatio.value = next;
        },
        update: (c, camera, sun) => {
            windUniform.value[0] = Math.cos(c.windDirection) * (0.25 + c.wind);
            windUniform.value[1] = Math.sin(c.windDirection) * (0.25 + c.wind);
            sunUniform.value.copy(sun);
            const on = particles > 0;
            const near = (p: {x: number; y: number; z: number}, r: number) => Math.hypot(camera.x - p.x, camera.y - p.y, camera.z - p.z) < r;
            // Smoke: a fire is lit in the cold and of an evening, less in the rain's downpour.
            const smokeOn = on && near(chimney, 160) ? Math.min(1, 0.35 + c.cold * 0.7 + c.night * 0.4) * (1 - 0.5 * c.rain) : 0;
            smoke.points.visible = smokeOn > 0.02;
            smoke.material.uniforms.opacity.value = smokeOn;
            moths.points.visible = on && c.night > 0.3 && near(porch, 40) && c.rain < 0.5;
            moths.material.uniforms.opacity.value = c.night;
            dew.points.visible = on && c.dew > 0.05;
            dew.material.uniforms.opacity.value = c.dew;
            beads.points.visible = on && beads.base > 0;
            // Silk catches a little light at any hour; dawn's dew makes it shine.
            beads.material.uniforms.opacity.value = 0.18 + 0.82 * c.dew + 0.4 * c.wetness;
            slime.points.visible = on && slime.base > 0;
            slime.material.uniforms.opacity.value = Math.min(1, 0.2 + c.wetness * 0.9 + c.dawn * 0.4);
            const blowing = on ? Math.max(0, Math.min(1, (c.wind - 0.35) * 2.5)) : 0;
            snowPeak.points.visible = blowing > 0 && c.cold > 0.55 && c.snowCover > 0.3 && near(snowPeak.points.position, 140);
            snowPeak.material.uniforms.opacity.value = blowing * c.snowCover;
            snowIce.points.visible = blowing > 0 && c.cold > 0.45 && near(snowIce.points.position, 120);
            snowIce.material.uniforms.opacity.value = blowing;
            const dusty = blowing * Math.max(0, 1 - c.wetness * 3);
            dustSavanna.points.visible = dusty > 0.02 && near(dustSavanna.points.position, 130);
            dustSavanna.material.uniforms.opacity.value = dusty * 0.6;
            dustDesert.points.visible = dusty > 0.02 && near(dustDesert.points.position, 130);
            dustDesert.material.uniforms.opacity.value = dusty * 0.7;
            const mist = on ? c.mist : 0;
            mistMeshes.forEach((mesh, k) => {
                mesh.visible = mist > 0.03;
                mistMaterials[k].uniforms.opacity.value = mist;
            });
        },
        setGlints: (webBeads, slimePoints) => {
            const rebuild = (old: Field, positions: Float32Array, tint: string, size: number) => {
                group.remove(old.points);
                old.points.geometry.dispose();
                old.material.dispose();
                fields.splice(fields.indexOf(old), 1);
                const seeds = Array.from({length: positions.length / 3}, (_, k) => (k * 0.618) % 1);
                const next = add(field(Array.from(positions), seeds, DEW_VERTEX, GLINT_FRAGMENT, {tint: {value: new Color(tint)}, sun: sunUniform, size: {value: size}}, {additive: true}));
                next.material.uniforms.pixelRatio.value = ratio;
                setCount(next);
                return next;
            };
            beads = rebuild(beads, webBeads, "#ffffff", 0.05);
            slime = rebuild(slime, slimePoints, "#f2fbff", 0.035);
        },
        dispose: () => {
            for (const f of fields) {
                f.points.geometry.dispose();
                f.material.dispose();
            }
            for (const mesh of mistMeshes) mesh.geometry.dispose();
            for (const material of mistMaterials) material.dispose();
        }
    };
}
