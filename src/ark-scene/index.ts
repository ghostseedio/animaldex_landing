/**
 * The shared Ark, drawn: `mountArk(el, options)` (Ark v1 contract, section 5).
 *
 * Framework-free: TypeScript and three.js only, so the website's /ark page
 * imports it and `scripts/build-ark-bundle.mjs` packs it for the apps'
 * WebView (`public/ark/embed.html`).
 *
 * One world (`world.ts`, `terrain.ts`) holding every animal of a snapshot.
 * Each species is one InstancedMesh per level of detail: the near model
 * (~3,000 triangles, moving on its own) within about 25 m of the camera, the
 * far one (~600, still) beyond that, and past about 120 m a token with the
 * species' icon (`icons.ts`). At most 150 animals and 60 species are drawn
 * near at once; the rest fall back to the far level. Models load as the
 * camera comes near their animals. Orbit, pan and zoom (OrbitControls, one
 * finger turns, two pan and pinch), out to the whole world.
 *
 * It draws only when something changes: the camera, an entrance, a model or
 * icon arriving, or animals near enough to move.
 */

import {
    Color,
    DirectionalLight,
    DynamicDrawUsage,
    Fog,
    HemisphereLight,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    NeutralToneMapping,
    PerspectiveCamera,
    Quaternion,
    Scene,
    Sphere,
    Spherical,
    Frustum,
    Vector3,
    WebGLRenderer,
    type MeshStandardMaterial
} from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import {animalMaterial, ARK_CLOCK} from "@/ark-scene/animal-material";
import {IconTokens, type TokenInstance} from "@/ark-scene/icons";
import {ContactShadows, GroundRings, type Ring, type Shadow} from "@/ark-scene/marks";
import {ModelLibrary, type SpeciesModel} from "@/ark-scene/models";
import {SKY} from "@/ark-scene/palettes";
import {placeAnimals, type Placement} from "@/ark-scene/placement";
import {displayLength, SWIMMING_PLANS} from "@/ark-scene/sizes";
import {buildLandscape} from "@/ark-scene/terrain";
import {
    ARK_REGIONS,
    type ArkAnimal,
    type ArkRegion,
    type ArkSceneHandle,
    type ArkSceneOptions,
    type ArkSceneStats,
    type ArkSnapshot
} from "@/ark-scene/types";
import {heightAt, regionCentre, regionLabelAnchor, WORLD_RADIUS} from "@/ark-scene/world";

export * from "@/ark-scene/types";
export {decodeArkSnapshot} from "@/ark-scene/snapshot";

/** Near level within this distance (m), far beyond it, tokens past SPRITE_DISTANCE. */
const NEAR_DISTANCE = 25;
const SPRITE_DISTANCE = 120;
/** Switching back needs this much more, so an animal at the edge doesn't flicker. */
const HYSTERESIS = 2.5;
const NEAR_INSTANCE_CAP = 150;
const NEAR_SPECIES_CAP = 60;
/** Models are fetched when their animals come this close. */
const LOAD_FAR_WITHIN = 175;
const LOAD_NEAR_WITHIN = 48;
const FOV = 40;
const MAX_DISTANCE = 330;
const ENTRANCE_SECONDS = 1.6;
const RIPPLE_SECONDS = 2.6;
/** Close to an animal the camera looks more across the ground than down on it (radians from straight down). */
const CLOSE_POLAR = 1.13;

type Level = "near" | "far" | "token";

type Entry = {
    animal: ArkAnimal;
    place: Placement;
    length: number;
    /** When it came aboard in this view (an entrance), or null for animals already here. */
    arrivedAt: number | null;
    level: Level;
    phase: number;
    /** Where it was drawn this frame (its middle), for picking; null when not drawn. */
    middle: Vector3 | null;
    /** Its height in metres as drawn. */
    drawnHeight: number;
};

type SpeciesMeshes = {
    near: InstancedMesh | null;
    far: InstancedMesh | null;
    nearMaterial: MeshStandardMaterial | null;
    farMaterial: MeshStandardMaterial | null;
};

const MINE = new Color("#a7f432");
const SELECTED = new Color("#ffffff");
const ARRIVAL = new Color("#fff3d6");

function easeOutBack(t: number): number {
    const c = 1.4;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

function easeInOut(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function phaseOf(id: string): number {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    return ((h >>> 0) % 10000) / 10000;
}

export function mountArk(el: HTMLElement, options: ArkSceneOptions): ArkSceneHandle {
    const renderer = new WebGLRenderer({antialias: true, powerPreference: "high-performance"});
    renderer.toneMapping = NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.style.outline = "none";
    canvas.tabIndex = 0;
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.appendChild(canvas);

    const labelLayer = document.createElement("div");
    labelLayer.setAttribute("aria-hidden", "true");
    Object.assign(labelLayer.style, {position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden"});
    el.appendChild(labelLayer);

    const reducedMotion = Boolean(options.reducedMotion);
    const scene = new Scene();
    const horizon = new Color(SKY.horizon);
    scene.fog = new Fog(horizon, 190, 720);
    scene.background = horizon;

    const sunDirection = new Vector3(-0.78, 0.46, -0.32).normalize();
    const hemisphere = new HemisphereLight(new Color("#dfe6ea"), new Color(SKY.bounce), 1.55);
    const sun = new DirectionalLight(new Color(SKY.sun), 2.5);
    sun.position.copy(sunDirection).multiplyScalar(200);
    scene.add(hemisphere, sun);

    const landscape = buildLandscape(sunDirection);
    scene.add(landscape.group);
    scene.add(landscape.sky);

    const camera = new PerspectiveCamera(FOV, 1, 0.4, 5000);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.085;
    controls.minDistance = 4;
    controls.maxDistance = MAX_DISTANCE;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = 1.36;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 1.1;
    controls.panSpeed = 0.9;
    controls.screenSpacePanning = false;
    controls.zoomToCursor = true;

    const shadows = new ContactShadows();
    const rings = new GroundRings();
    const tokens = new IconTokens(options.iconUrl);
    scene.add(shadows.mesh, rings.mesh, tokens.mesh);

    const library = new ModelLibrary(options.modelBase);
    const species = new Map<string, SpeciesMeshes>();
    let entries: Entry[] = [];
    let entryById = new Map<string, Entry>();
    let mineOnly = Boolean(options.mineOnly);
    let selectedId: string | null = null;
    let dirty = true;
    let disposed = false;
    let width = 1;
    let height = 1;
    let onScreen = true;
    let animating = false;
    const started = performance.now();

    // MARK: Labels

    const labels = new Map<ArkRegion, HTMLSpanElement>();
    for (const region of ARK_REGIONS) {
        const text = options.regionLabels?.[region];
        if (!text) continue;
        const label = document.createElement("span");
        label.textContent = text;
        Object.assign(label.style, {
            position: "absolute",
            left: "0",
            top: "0",
            transform: "translate(-50%, -50%)",
            whiteSpace: "nowrap",
            font: "600 11px/1 var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "rgba(255, 255, 255, 0.94)",
            textShadow: "0 1px 2px rgba(20, 24, 16, 0.45), 0 0 14px rgba(20, 24, 16, 0.35)",
            opacity: "0",
            transition: "opacity 260ms ease",
            willChange: "transform"
        });
        labelLayer.appendChild(label);
        labels.set(region, label);
    }
    const labelPoint = new Vector3();
    const tokenPoint = new Vector3();
    const labelSizes = new Map<ArkRegion, {w: number; h: number}>();
    /** Nudges tried in turn, in CSS pixels: on the spot, then above, below and beside it, further each time. */
    const NUDGES: Array<[number, number]> = [[0, 0], [0, -26], [0, 26], [0, -44], [0, 44], [-1, 0], [1, 0], [0, -64], [0, 64], [-1, -30], [1, -30], [-1, 30], [1, 30], [0, -88], [0, 88]];
    type Box = [number, number, number, number];
    const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    const placeLabels = () => {
        const distance = camera.position.distanceTo(controls.target);
        const show = distance > 95;
        // What the names must keep clear of: every token on screen.
        const taken: Box[] = [];
        if (show) {
            for (const entry of entries) {
                if (entry.level !== "token" || !entry.middle) continue;
                tokenPoint.copy(entry.middle).project(camera);
                if (tokenPoint.z > 1) continue;
                const sx = (tokenPoint.x + 1) / 2 * width;
                const sy = (1 - tokenPoint.y) / 2 * height;
                const pixels = tokens.pixelSize(Math.max(entry.length * 1.1, 1.6), camera.position.distanceTo(entry.middle));
                taken.push([sx - pixels / 2, sy - pixels, sx + pixels / 2, sy]);
            }
        }
        labels.forEach((label, region) => {
            const anchor = regionLabelAnchor(region);
            // The mountains' name reads over their slopes, not down in the saddle.
            labelPoint.set(anchor.x, Math.max(heightAt(anchor.x, anchor.z), 0) + (region === "high_cold" ? 14 : 0), anchor.z).project(camera);
            const visible = show && labelPoint.z < 1 && Math.abs(labelPoint.x) < 1.05 && Math.abs(labelPoint.y) < 1.05;
            label.style.opacity = visible ? "1" : "0";
            if (!visible) return;
            let size = labelSizes.get(region);
            if (!size || !size.w) {
                size = {w: label.offsetWidth, h: label.offsetHeight};
                labelSizes.set(region, size);
            }
            const ax = (labelPoint.x + 1) / 2 * width;
            const ay = (1 - labelPoint.y) / 2 * height;
            let best: Box | null = null;
            let bestCost = Infinity;
            for (const [dx, dy] of NUDGES) {
                // Kept inside the view, so a name near the edge is never cut off.
                const cx = Math.min(Math.max(ax + dx * (size.w / 2 + 30), size.w / 2 + 10), width - size.w / 2 - 10);
                const cy = ay + dy;
                const box: Box = [cx - size.w / 2 - 6, cy - size.h / 2 - 4, cx + size.w / 2 + 6, cy + size.h / 2 + 4];
                const cost = taken.reduce((sum, other) => sum + overlap(box, other), 0);
                if (cost < bestCost) {
                    best = box;
                    bestCost = cost;
                }
                if (cost === 0) break;
            }
            const box = best!;
            // Other names keep a line's distance from this one, so two never read as one.
            taken.push([box[0] - 8, box[1] - 12, box[2] + 8, box[3] + 12]);
            label.style.transform = `translate(${((box[0] + box[2]) / 2).toFixed(1)}px, ${((box[1] + box[3]) / 2).toFixed(1)}px) translate(-50%, -50%)`;
        });
    };

    // MARK: Snapshot

    const setSnapshot = (snapshot: ArkSnapshot, entrances: boolean) => {
        const now = performance.now() / 1000;
        const places = placeAnimals(snapshot.animals);
        const next: Entry[] = [];
        const nextById = new Map<string, Entry>();
        for (const animal of snapshot.animals) {
            const place = places.get(animal.id)!;
            const before = entryById.get(animal.id);
            const entry: Entry = before
                ? {...before, animal, place}
                : {
                    animal,
                    place,
                    length: displayLength(animal.model_slug, null),
                    arrivedAt: entrances ? now : null,
                    level: "token",
                    phase: phaseOf(animal.id),
                    middle: null,
                    drawnHeight: 1
                };
            next.push(entry);
            nextById.set(animal.id, entry);
            tokens.ensure(animal.model_slug);
        }
        entries = next;
        entryById = nextById;
        if (selectedId && !entryById.has(selectedId)) {
            selectedId = null;
            options.onSelect?.(null);
        }
        dirty = true;
    };

    // MARK: Models

    const speciesMeshes = (slug: string): SpeciesMeshes => {
        let meshes = species.get(slug);
        if (!meshes) {
            meshes = {near: null, far: null, nearMaterial: null, farMaterial: null};
            species.set(slug, meshes);
        }
        return meshes;
    };

    const instancedFor = (model: SpeciesModel, level: "near" | "far", needed: number): InstancedMesh | null => {
        const source = level === "near" ? model.near : model.far;
        if (!source) return null;
        const meshes = speciesMeshes(model.slug);
        let mesh = level === "near" ? meshes.near : meshes.far;
        if (mesh && mesh.instanceMatrix.count >= needed) return mesh;
        const capacity = Math.max(needed, 4, mesh ? mesh.instanceMatrix.count * 2 : 0);
        let material = level === "near" ? meshes.nearMaterial : meshes.farMaterial;
        if (!material) {
            const box = source.geometry.boundingBox!;
            material = animalMaterial({map: source.map, behaviour: model.behaviour, minY: box.min.y, maxY: box.max.y, animated: level === "near" && !reducedMotion});
            if (level === "near") meshes.nearMaterial = material;
            else meshes.farMaterial = material;
        }
        if (mesh) {
            scene.remove(mesh);
            mesh.dispose();
        }
        mesh = new InstancedMesh(source.geometry, material, capacity);
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        const instance = new InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
        instance.setUsage(DynamicDrawUsage);
        // The geometry is this level's own (one mesh per species and level), so its instanced attribute is too.
        source.geometry.setAttribute("arkInstance", instance);
        mesh.frustumCulled = false;
        mesh.count = 0;
        scene.add(mesh);
        if (level === "near") meshes.near = mesh;
        else meshes.far = mesh;
        return mesh;
    };

    library.onLoad = (slug) => {
        const model = library.get(slug);
        if (model?.behaviour?.plan) {
            for (const entry of entries) {
                if (entry.animal.model_slug === slug) entry.length = displayLength(slug, model.behaviour.plan);
            }
        }
        dirty = true;
    };
    tokens.onIconLoad = () => {
        dirty = true;
    };

    // MARK: Per frame

    const frustum = new Frustum();
    const projection = new Matrix4();
    const sphere = new Sphere();
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const scale = new Vector3();
    const position = new Vector3();
    const up = new Vector3(0, 1, 0);
    let counts = {near: 0, far: 0, token: 0};

    const updateInstances = (now: number) => {
        projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projection);
        const cameraPosition = camera.position;
        animating = false;

        // Which level each animal wants, before the caps.
        type Candidate = {entry: Entry; distance: number; model: SpeciesModel | undefined; visible: boolean};
        const candidates: Candidate[] = [];
        for (const entry of entries) {
            const slug = entry.animal.model_slug;
            const distance = cameraPosition.distanceTo(position.set(entry.place.x, Math.max(entry.place.ground, 0), entry.place.z));
            if (distance < LOAD_FAR_WITHIN && library.has(slug)) library.request(slug, "far");
            if (distance < LOAD_NEAR_WITHIN && library.has(slug)) library.request(slug, "near");
            sphere.center.copy(position);
            sphere.radius = entry.length * 1.5 + 2;
            candidates.push({entry, distance, model: library.get(slug), visible: frustum.intersectsSphere(sphere)});
        }

        const nearWanted = candidates
            .filter((c) => c.visible && c.model?.near && c.distance < NEAR_DISTANCE + (c.entry.level === "near" ? HYSTERESIS : 0))
            .sort((a, b) => a.distance - b.distance);
        const nearIds = new Set<string>();
        const nearSpecies = new Set<string>();
        for (const candidate of nearWanted) {
            if (nearIds.size >= NEAR_INSTANCE_CAP) break;
            const slug = candidate.entry.animal.model_slug;
            if (!nearSpecies.has(slug) && nearSpecies.size >= NEAR_SPECIES_CAP) continue;
            nearSpecies.add(slug);
            nearIds.add(candidate.entry.animal.id);
        }

        const perMesh = new Map<InstancedMesh, number>();
        const used = new Set<InstancedMesh>();
        const tokenList: TokenInstance[] = [];
        const shadowList: Shadow[] = [];
        const ringList: Ring[] = [];
        counts = {near: 0, far: 0, token: 0};

        // How many of each species at each level, so the meshes are big enough first.
        const needs = new Map<string, {near: number; far: number}>();
        const levels = new Map<Entry, Level>();
        for (const candidate of candidates) {
            const {entry, distance, model} = candidate;
            let level: Level;
            if (nearIds.has(entry.animal.id)) level = "near";
            else if (model?.far && distance < SPRITE_DISTANCE + (entry.level === "token" ? -HYSTERESIS : HYSTERESIS)) level = "far";
            else level = "token";
            entry.level = level;
            levels.set(entry, level);
            if (!candidate.visible) continue;
            if (level !== "token") {
                const need = needs.get(entry.animal.model_slug) ?? {near: 0, far: 0};
                need[level]++;
                needs.set(entry.animal.model_slug, need);
            }
        }
        needs.forEach((need, slug) => {
            const model = library.get(slug)!;
            if (need.near) instancedFor(model, "near", need.near);
            if (need.far) instancedFor(model, "far", need.far);
        });

        for (const candidate of candidates) {
            const {entry, model} = candidate;
            const level = levels.get(entry)!;
            const animal = entry.animal;
            const dim = mineOnly && !animal.mine ? 1 : 0;
            let grow = 1;
            if (entry.arrivedAt !== null) {
                const t = (now - entry.arrivedAt) / ENTRANCE_SECONDS;
                if (t < 1 && !reducedMotion) {
                    grow = Math.max(easeOutBack(Math.max(t, 0)), 0.001);
                    animating = true;
                }
                const ripple = (now - entry.arrivedAt) / RIPPLE_SECONDS;
                if (ripple < 1 && !reducedMotion) {
                    animating = true;
                    ringList.push({x: entry.place.x, y: Math.max(entry.place.ground, 0), z: entry.place.z, radius: entry.length * (0.8 + 2.6 * ripple), color: ARRIVAL, alpha: 0.85 * (1 - ripple) ** 1.5});
                }
            }

            // Its feet: on the ground, or afloat (the sea, the lake), or wading in the shallows.
            const plan = model?.behaviour?.plan ?? null;
            const modelScale = model ? entry.length / model.length : 1;
            const modelHeight = model ? model.height * modelScale : entry.length * 0.6;
            let base = entry.place.ground;
            if (entry.place.water && entry.place.ground < -0.45) base = -(SWIMMING_PLANS.has(plan ?? "") ? 0.5 : 0.28) * modelHeight;
            else if (entry.place.water) base = Math.max(entry.place.ground, -0.3);
            entry.drawnHeight = modelHeight;

            if (!candidate.visible) {
                entry.middle = null;
                continue;
            }
            entry.middle = (entry.middle ?? new Vector3()).set(entry.place.x, base + modelHeight / 2, entry.place.z);

            const rest = Math.max(entry.place.ground, 0);
            if (level === "token") {
                counts.token++;
                tokenList.push({
                    slug: animal.model_slug,
                    x: entry.place.x,
                    y: Math.max(base + modelHeight * 0.75, rest + 0.4),
                    z: entry.place.z,
                    size: Math.max(entry.length * 1.1, 1.6),
                    dim,
                    ring: selectedId === animal.id ? 2 : mineOnly && animal.mine ? 1 : 0,
                    grow
                });
                entry.middle.y = Math.max(base + modelHeight * 0.75, rest + 0.4);
                continue;
            }

            const mesh = (level === "near" ? species.get(animal.model_slug)?.near : species.get(animal.model_slug)?.far) ?? null;
            if (!mesh || !model) continue;
            const index = perMesh.get(mesh) ?? 0;
            perMesh.set(mesh, index + 1);
            used.add(mesh);
            if (level === "near") counts.near++;
            else counts.far++;
            const s = modelScale * grow;
            rotation.setFromAxisAngle(up, entry.place.yaw);
            position.set(entry.place.x, base - model.minY * s - (1 - Math.min(grow, 1)) * modelHeight * 0.3, entry.place.z);
            matrix.compose(position, rotation, scale.set(s, s, s));
            mesh.setMatrixAt(index, matrix);
            (mesh.geometry.getAttribute("arkInstance") as InstancedBufferAttribute).setXY(index, entry.phase, dim);

            const afloat = base < rest - 0.01 || entry.place.ground < 0;
            if (!afloat) {
                const box = (level === "near" ? model.near : model.far)!.geometry.boundingBox!;
                shadowList.push({
                    x: entry.place.x,
                    y: rest,
                    z: entry.place.z,
                    width: Math.max((box.max.x - box.min.x) * modelScale * 1.2, 0.4),
                    length: model.length * modelScale * 1.05,
                    yaw: entry.place.yaw,
                    strength: grow
                });
            }
            if (selectedId === animal.id) ringList.push({x: entry.place.x, y: afloat ? 0 : rest, z: entry.place.z, radius: Math.max(entry.length * 0.68, 0.6), color: SELECTED, alpha: 0.85});
            else if (mineOnly && animal.mine) ringList.push({x: entry.place.x, y: afloat ? 0 : rest, z: entry.place.z, radius: Math.max(entry.length * 0.68, 0.6), color: MINE, alpha: 0.95});
        }

        species.forEach((meshes) => {
            for (const mesh of [meshes.near, meshes.far]) {
                if (!mesh) continue;
                const count = used.has(mesh) ? perMesh.get(mesh) ?? 0 : 0;
                mesh.count = count;
                mesh.visible = count > 0;
                if (count) {
                    mesh.instanceMatrix.needsUpdate = true;
                    (mesh.geometry.getAttribute("arkInstance") as InstancedBufferAttribute).needsUpdate = true;
                }
            }
        });
        tokens.set(tokenList, camera);
        shadows.set(shadowList);
        rings.set(ringList);
        if (counts.near > 0 && !reducedMotion) animating = true;
    };

    // MARK: Camera

    /** A flight keeps the camera's bearing; `polar` (from straight down) eases too when given. */
    type Flight = {from: Vector3; to: Vector3; fromDistance: number; toDistance: number; fromPolar: number; toPolar: number; start: number; seconds: number};
    let flight: Flight | null = null;
    const offset = new Vector3();
    const spherical = new Spherical();

    const fly = (target: Vector3, distance: number, seconds = 1.1, polar?: number) => {
        distance = Math.min(Math.max(distance, controls.minDistance), MAX_DISTANCE);
        spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
        const toPolar = polar ?? spherical.phi;
        if (reducedMotion || seconds <= 0) {
            spherical.radius = distance;
            spherical.phi = toPolar;
            controls.target.copy(target);
            camera.position.copy(target).add(offset.setFromSpherical(spherical));
            controls.update();
            dirty = true;
            return;
        }
        flight = {from: controls.target.clone(), to: target.clone(), fromDistance: spherical.radius, toDistance: distance, fromPolar: spherical.phi, toPolar, start: performance.now() / 1000, seconds};
    };

    const stepFlight = (now: number) => {
        if (!flight) return;
        const t = Math.min((now - flight.start) / flight.seconds, 1);
        const k = easeInOut(t);
        spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
        controls.target.lerpVectors(flight.from, flight.to, k);
        spherical.radius = flight.fromDistance + (flight.toDistance - flight.fromDistance) * k;
        spherical.phi = flight.fromPolar + (flight.toPolar - flight.fromPolar) * k;
        camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
        dirty = true;
        if (t >= 1) flight = null;
    };
    controls.addEventListener("start", () => {
        flight = null;
    });
    controls.addEventListener("change", () => {
        dirty = true;
    });

    /** The whole world in view, from the south and above. */
    const homeView = () => {
        const aspect = width / Math.max(height, 1);
        const vertical = FOV * Math.PI / 180;
        const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
        const fit = Math.min(vertical, horizontal);
        const radius = aspect < 0.8 ? 84 : 80;
        const distance = Math.min(radius / Math.sin(fit / 2) * 0.8, MAX_DISTANCE);
        const polar = 0.98;
        return {target: new Vector3(0, 0, 10), position: new Vector3(0, Math.cos(polar) * distance, 10 + Math.sin(polar) * distance)};
    };

    // Keep the view over the world and above the ground.
    const keepInWorld = () => {
        const target = controls.target;
        const reach = Math.hypot(target.x, target.z);
        if (reach > WORLD_RADIUS) {
            const pull = WORLD_RADIUS / reach;
            const dx = target.x * pull - target.x;
            const dz = target.z * pull - target.z;
            target.x += dx;
            target.z += dz;
            camera.position.x += dx;
            camera.position.z += dz;
        }
        const groundUnderTarget = Math.max(heightAt(target.x, target.z), 0);
        const lift = (groundUnderTarget - target.y) * 0.15;
        if (Math.abs(lift) > 0.001) {
            target.y += lift;
            camera.position.y += lift;
        }
        const floor = Math.max(heightAt(camera.position.x, camera.position.z), 0) + 1.2;
        if (camera.position.y < floor) camera.position.y = floor;
    };

    // MARK: Picking

    const projected = new Vector3();
    const pick = (clientX: number, clientY: number): Entry | null => {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        let best: Entry | null = null;
        let bestScore = Infinity;
        for (const entry of entries) {
            if (!entry.middle) continue;
            projected.copy(entry.middle).project(camera);
            if (projected.z > 1) continue;
            const sx = (projected.x + 1) / 2 * width;
            const sy = (1 - projected.y) / 2 * height;
            const distance = camera.position.distanceTo(entry.middle);
            let radius: number;
            if (entry.level === "token") {
                const pixels = tokens.pixelSize(Math.max(entry.length * 1.1, 1.6), distance);
                radius = pixels / 2 + 4;
                // The token stands on its spot: its middle is half a token up.
                const centreY = sy - pixels / 2;
                const d = Math.hypot(x - sx, y - centreY);
                if (d < radius && d / radius < bestScore) {
                    best = entry;
                    bestScore = d / radius;
                }
                continue;
            }
            const perPixel = 2 * Math.tan(FOV * Math.PI / 360) * distance / height;
            radius = Math.max(Math.max(entry.length, entry.drawnHeight) / perPixel / 2, 22);
            const d = Math.hypot(x - sx, y - sy);
            if (d < radius && d / radius < bestScore) {
                best = entry;
                bestScore = d / radius;
            }
        }
        return best;
    };

    const select = (id: string | null, flyTo: boolean) => {
        selectedId = id;
        const entry = id ? entryById.get(id) : null;
        options.onSelect?.(entry?.animal ?? null);
        if (entry && flyTo) {
            const distance = camera.position.distanceTo(controls.target);
            const target = new Vector3(entry.place.x, Math.max(entry.place.ground, 0) + entry.drawnHeight * 0.4, entry.place.z);
            const close = distance > 40 ? 10 + entry.length * 4 : Math.min(distance, 10 + entry.length * 6);
            fly(target, close, 1.2, CLOSE_POLAR);
        }
        dirty = true;
    };

    let down: {x: number; y: number; time: number; id: number} | null = null;
    let pointers = 0;
    const onPointerDown = (event: PointerEvent) => {
        pointers++;
        down = pointers === 1 ? {x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId} : null;
    };
    const onPointerUp = (event: PointerEvent) => {
        pointers = Math.max(pointers - 1, 0);
        if (!down || down.id !== event.pointerId) return;
        const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
        const quick = performance.now() - down.time < 500;
        down = null;
        if (moved > 8 || !quick) return;
        const hit = pick(event.clientX, event.clientY);
        select(hit ? hit.animal.id : null, Boolean(hit));
    };
    const onPointerCancel = () => {
        pointers = Math.max(pointers - 1, 0);
        down = null;
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);

    // MARK: Size

    // The view's inset at the foot (setViewInset), eased toward its target.
    let inset = 0;
    let insetTarget = 0;
    const applyInset = () => {
        if (inset < 0.5) camera.clearViewOffset();
        else camera.setViewOffset(width, height, 0, inset / 2, width, height);
        camera.updateProjectionMatrix();
    };
    const stepInset = () => {
        if (inset === insetTarget) return false;
        inset += (insetTarget - inset) * (reducedMotion ? 1 : 0.18);
        if (Math.abs(insetTarget - inset) < 0.5) inset = insetTarget;
        applyInset();
        return true;
    };

    const resize = () => {
        const rect = el.getBoundingClientRect();
        width = Math.max(1, Math.round(rect.width));
        height = Math.max(1, Math.round(rect.height));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        applyInset();
        tokens.setViewport(FOV, height, width < 640);
        dirty = true;
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(el);
    resize();
    const visibility = new IntersectionObserver(([entry]) => {
        onScreen = entry?.isIntersecting ?? true;
        dirty = true;
    });
    visibility.observe(el);

    // MARK: First view

    setSnapshot(options.snapshot, false);
    const home = homeView();
    controls.target.copy(home.target);
    camera.position.copy(home.position);
    controls.update();

    // A beginning Ark (a few animals): open on the newest arrival, after a moment over the whole world.
    let introTimer: ReturnType<typeof setTimeout> | null = null;
    const newest = [...options.snapshot.animals].sort((a, b) => b.arrived_at.localeCompare(a.arrived_at))[0];
    if (newest && options.snapshot.animals.length <= 3) {
        introTimer = setTimeout(() => {
            const entry = entryById.get(newest.id);
            if (!entry || flight || disposed) return;
            fly(new Vector3(entry.place.x, Math.max(entry.place.ground, 0) + 0.6, entry.place.z), 6 + entry.length * 2.4, 2.6, CLOSE_POLAR);
        }, reducedMotion ? 0 : 900);
    }

    // MARK: Loop

    const frameTimes: number[] = [];
    const frameIntervals: number[] = [];
    let lastDrawn = 0;
    let slowFrames = 0;
    let ready = false;
    let raf = 0;

    const frame = () => {
        raf = requestAnimationFrame(frame);
        if (!onScreen || disposed) return;
        const startedAt = performance.now();
        const now = startedAt / 1000;
        stepFlight(now);
        if (stepInset()) dirty = true;
        const moved = controls.update();
        if (moved || flight) keepInWorld();
        if (!dirty && !moved && !animating && !flight) return;
        if (!reducedMotion) ARK_CLOCK.value = (now - started / 1000) % 3600;
        landscape.sky.position.copy(camera.position);
        updateInstances(now);
        landscape.tick(now);
        renderer.render(scene, camera);
        placeLabels();
        dirty = false;

        const spent = performance.now() - startedAt;
        frameTimes.push(spent);
        if (frameTimes.length > 60) frameTimes.shift();
        if (lastDrawn) {
            const interval = startedAt - lastDrawn;
            if (interval < 250) {
                frameIntervals.push(interval);
                if (frameIntervals.length > 60) frameIntervals.shift();
                // A device that can't keep up draws fewer pixels, down to one per CSS pixel.
                slowFrames = interval > 34 ? slowFrames + 1 : Math.max(slowFrames - 2, 0);
                if (slowFrames > 45 && pixelRatio > 1) {
                    pixelRatio = Math.max(1, pixelRatio - 0.25);
                    renderer.setPixelRatio(pixelRatio);
                    resize();
                    slowFrames = 0;
                }
            }
        }
        lastDrawn = startedAt;
        if (!ready) {
            ready = true;
            options.onReady?.();
        }
    };
    raf = requestAnimationFrame(frame);

    const mean = (values: number[]) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);

    return {
        update: (snapshot) => setSnapshot(snapshot, true),
        setMineOnly: (value) => {
            mineOnly = value;
            dirty = true;
        },
        select: (id) => select(id, true),
        setViewInset: (bottomPixels) => {
            insetTarget = Math.max(0, Math.min(bottomPixels, height * 0.6));
            dirty = true;
        },
        focusRegion: (region) => {
            if (!region) {
                const view = homeView();
                fly(view.target, view.position.distanceTo(view.target), 1.4);
                return;
            }
            const centre = regionCentre(region);
            fly(new Vector3(centre.x, Math.max(heightAt(centre.x, centre.z), 0), centre.z), Math.min(Math.max(centre.radius * 1.9, 48), 150), 1.4);
        },
        stats: (): ArkSceneStats => ({
            drawCalls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            frameMs: Math.round(mean(frameTimes) * 100) / 100,
            intervalMs: Math.round(mean(frameIntervals) * 100) / 100,
            near: counts.near,
            far: counts.far,
            sprites: counts.token,
            pixelRatio,
            modelsLoaded: library.loadedCount
        }),
        dispose: () => {
            disposed = true;
            cancelAnimationFrame(raf);
            if (introTimer) clearTimeout(introTimer);
            resizeObserver.disconnect();
            visibility.disconnect();
            canvas.removeEventListener("pointerdown", onPointerDown);
            canvas.removeEventListener("pointerup", onPointerUp);
            canvas.removeEventListener("pointercancel", onPointerCancel);
            controls.dispose();
            species.forEach((meshes) => {
                meshes.near?.dispose();
                meshes.far?.dispose();
                meshes.nearMaterial?.dispose();
                meshes.farMaterial?.dispose();
            });
            library.dispose();
            tokens.dispose();
            shadows.dispose();
            rings.dispose();
            landscape.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
            canvas.remove();
            labelLayer.remove();
        }
    };
}
