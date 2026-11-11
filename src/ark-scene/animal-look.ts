/**
 * The animal-look pass (the owner's performance-and-polish brief, section 1;
 * docs/ark/animal-look.md): the Ark's animals brought up to the detail of the
 * world round them, within the tiers' budgets.
 *
 * - Each species' surface (fur, feathers, scales, skin, shell, slimy) from
 *   its taxonomy and photo (`animal-look.json`, `animal-look-rules.ts`), drawn
 *   by `animal-look-shader.ts` in the animals' own material.
 * - Wet after rain (the island clock's wetness, `ARK_ENV`) or a swim, dusty on
 *   dry open ground: per animal, from its species' realm and where it stands.
 * - Eyes with a catchlight.
 * - Fur shells on the nearest furred mammals, high tier only (`fur-shells.ts`).
 * - The full-resolution skin swapped in close up (`closeup-textures.ts`).
 * - Contact shadows that lie on the ground's slope, or on the wall, leaf or
 *   stone a small animal clings to (`marks.ts`).
 *
 * Deterministic and shared: everything is a function of the species, the
 * animal's id, where it is and the island clock (no `Math.random`), so every
 * viewer sees the same wet seal. Visual only: nothing here decides anything.
 * One switch (`setEnabled`) puts every animal back exactly as before.
 */

import {Color, DynamicDrawUsage, InstancedBufferAttribute, type BufferGeometry, type InstancedMesh, type MeshStandardMaterial, type Texture, type WebGLRenderer, type Scene} from "three";
import table from "@/ark-scene/animal-look.json";
import {LOOK_CLASSES, LOOK_FLAG, type LookClass} from "@/ark-scene/animal-look-rules";
import {lookVectors} from "@/ark-scene/animal-look-shader";
import {ARK_DAYLIGHT} from "@/ark-scene/glsl";
import {FurShells} from "@/ark-scene/fur-shells";
import {CloseUpTextures} from "@/ark-scene/closeup-textures";
import {surfaceAt, groundNormal, type Vec3} from "@/ark-scene/sampler";
import {unit} from "@/lib/ark-clock";
import type {QualityTier} from "@/ark-scene/post";

const ROWS = (table as {species: Record<string, number[]>}).species;

export type SpeciesLook = {
    look: LookClass;
    flags: number;
    /** The two eyes' centres in the mesh's own space and their radius; null without eyes on the skin. */
    eyes: {left: [number, number, number]; right: [number, number, number]; radius: number} | null;
    /** Fur shells close by (a furred mammal). */
    shells: boolean;
};

/**
 * A species' look, its eyes turned with the file's facing turn (the 14 birds
 * modelled facing another way, `ModelLevel.facing`) and kept only when they sit
 * on the mesh's skin (as the talking model draws them).
 */
export function speciesLook(slug: string, plan: string | null | undefined, facingDegrees: number, geometry?: BufferGeometry | null): SpeciesLook | null {
    const row = ROWS[slug];
    if (!row) return null;
    const look = LOOK_CLASSES[row[0]] ?? "skin";
    const [x, y, z, radius] = [row[2], row[3], row[4], row[5]];
    let eyes: SpeciesLook["eyes"] = null;
    if (radius > 0) {
        const turn = (facingDegrees * Math.PI) / 180;
        const c = Math.cos(turn);
        const s = Math.sin(turn);
        const at = (px: number): [number, number, number] => [px * c + z * s, y, -px * s + z * c];
        const left = at(x);
        const right = at(-x);
        const onSkin = (point: [number, number, number]) => {
            const position = geometry?.getAttribute("position");
            if (!position) return true;
            const reach = (2.5 * radius + 0.012) ** 2;
            for (let i = 0; i < position.count; i++) {
                const dx = position.getX(i) - point[0];
                const dy = position.getY(i) - point[1];
                const dz = position.getZ(i) - point[2];
                if (dx * dx + dy * dy + dz * dz <= reach) return true;
            }
            return false;
        };
        const far: [number, number, number] = [1e4, 1e4, 1e4];
        const l = onSkin(left);
        const r = onSkin(right);
        if (l || r) eyes = {left: l ? left : far, right: r ? right : far, radius};
    }
    return {look, flags: row[1], eyes, shells: look === "fur" && plan === "mammal"};
}

/** The pass's switch and tier, read by every animal material when it compiles. */
export const LOOK_STATE = {on: true, tier: 2 as 0 | 1 | 2};

/** A dry, pale film of earth for dusty legs (linear). */
export const ARK_DUST = {value: new Color(0.52, 0.42, 0.29)};

const materials = new Set<MeshStandardMaterial>();

/** Uniforms and defines for an animal material with this look (`animal-material.ts`). */
export function lookUniforms(look: SpeciesLook | null, level: "near" | "far", shellLength: number): Record<string, {value: unknown}> {
    const vectors = lookVectors(look?.look ?? "skin");
    const eyes = level === "near" ? look?.eyes : null;
    return {
        arkLookA: {value: vectors.a},
        arkLookB: {value: vectors.b},
        arkWetDark: {value: vectors.wetDark},
        arkEye: {value: eyes ? [...eyes.left, eyes.radius] : [0, 0, 0, 0]},
        arkEye2: {value: eyes ? eyes.right : [0, 0, 0]},
        arkDustColour: ARK_DUST,
        arkDaylight: ARK_DAYLIGHT,
        arkShellLength: {value: shellLength}
    };
}

/** The defines this material compiles with now: none with the pass off (the material exactly as before). */
export function lookDefines(material: MeshStandardMaterial): Record<string, string> {
    const data = material.userData as {arkLook?: {look: SpeciesLook | null; level: "near" | "far"; shell: boolean}};
    const info = data.arkLook;
    if (!info?.look || !LOOK_STATE.on) return {};
    const tier = info.level === "near" ? LOOK_STATE.tier : 0;
    return {ARK_LOOK: "", ARK_LOOK_TIER: String(tier), ...(info.shell ? {ARK_SHELL: ""} : {})};
}

export function lookCacheKey(material: MeshStandardMaterial): string {
    const defines = lookDefines(material);
    return "ARK_LOOK" in defines ? `-look${defines.ARK_LOOK_TIER}${"ARK_SHELL" in defines ? "s" : ""}` : "";
}

export function registerLookMaterial(material: MeshStandardMaterial) {
    materials.add(material);
    material.addEventListener("dispose", () => materials.delete(material));
}

function refreshMaterials() {
    materials.forEach((material) => {
        const base = {...(material.defines ?? {})};
        for (const key of ["ARK_LOOK", "ARK_LOOK_TIER", "ARK_SHELL"]) delete base[key];
        material.defines = {...base, ...lookDefines(material)};
        material.needsUpdate = true;
    });
}

/** Add the per-animal look attribute (wet, dust) to an instanced geometry. */
export function attachLook(geometry: BufferGeometry, capacity: number): InstancedBufferAttribute {
    const attribute = new InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
    attribute.setUsage(DynamicDrawUsage);
    geometry.setAttribute("arkLook", attribute);
    return attribute;
}

// MARK: - Wet and dusty

const SWIM_SLOT_MS = 15 * 60 * 1000;
const DRY_MS = 6 * 60 * 1000;

/**
 * How wet an animal that swims and comes out is from swimming alone (0–1):
 * in each quarter hour of island time about half of them have a swim that
 * ends at a moment of their own, and they dry over the next minutes. A pure
 * function of its id and the island clock: every viewer sees the same.
 */
export function swimWetness(id: string, islandMs: number): number {
    const slot = Math.floor(islandMs / SWIM_SLOT_MS);
    let wet = 0;
    for (const s of [slot - 1, slot]) {
        if (unit(id, "swim", s) >= 0.5) continue;
        const end = s * SWIM_SLOT_MS + unit(id, "swim-end", s) * SWIM_SLOT_MS;
        const since = islandMs - end;
        if (since < 0) {
            // Still in its swim: wet through.
            if (since > -2.5 * 60 * 1000) wet = 1;
            continue;
        }
        wet = Math.max(wet, Math.exp(-since / DRY_MS));
    }
    return wet;
}

/** How dusty open ground is (0–1): bare sand, soil and tilled earth; little on grass, none in the forest or wet places. */
export function groundDryness(weights: Partial<Record<string, number>>, wetness: number): number {
    const dry = (weights.sand ?? 0) + (weights.soil ?? 0) + 0.8 * (weights.tilled ?? 0) + 0.35 * (weights.rock ?? 0) + 0.12 * (weights.grass ?? 0);
    return Math.max(0, Math.min(1, dry)) * (1 - Math.min(1, wetness * 1.5));
}

export type LookInstance = {
    id: string;
    slug: string;
    x: number;
    y: number;
    z: number;
    /** Metres from the camera. */
    distance: number;
    /** About how many pixels long it is on screen. */
    pixels: number;
    /** In the water now (swimming, afloat, under the surface). */
    inWater: boolean;
    /** On a small surface (a wall, a leaf), not the ground. */
    onSurface: boolean;
};

type TierSettings = {shells: boolean; closeUp: {within: number; cap: number} | null};
const TIERS: Record<QualityTier, TierSettings> = {
    high: {shells: true, closeUp: {within: 9, cap: 8}},
    medium: {shells: false, closeUp: {within: 5.5, cap: 3}},
    low: {shells: false, closeUp: null}
};

export class AnimalLook {
    private tier: QualityTier = "high";
    private lite = false;
    private enabled: boolean;
    private wetness = 0;
    private islandPin: number | null = null;
    private islandNow = 0;
    private readonly dryness = new Map<number, number>();
    private readonly normals = new Map<number, Vec3>();
    readonly shells: FurShells;
    readonly closeUps: CloseUpTextures;
    private readonly bySlug = new Map<string, Set<MeshStandardMaterial>>();

    constructor(options: {scene: Scene; renderer: WebGLRenderer; closeUpBase: string | null; basisBase: string; enabled: boolean; layers?: number}) {
        this.enabled = options.enabled;
        LOOK_STATE.on = options.enabled;
        this.shells = new FurShells(options.scene);
        this.closeUps = new CloseUpTextures(options.closeUpBase, options.basisBase, options.renderer, (slug, texture) => this.swapSkin(slug, texture));
    }

    get on(): boolean {
        return this.enabled;
    }

    /** The pass on or off: off, every animal is drawn exactly as before (no shells, the 512² skins, flat shadows). */
    setEnabled(on: boolean) {
        if (on === this.enabled) return;
        this.enabled = on;
        LOOK_STATE.on = on;
        refreshMaterials();
        if (!on) {
            this.shells.hide();
            this.closeUps.releaseAll();
        }
    }

    setTier(tier: QualityTier, lite: boolean) {
        this.tier = tier;
        this.lite = lite;
        const level = tier === "high" ? 2 : tier === "medium" ? 1 : 0;
        if (level !== LOOK_STATE.tier) {
            LOOK_STATE.tier = level as 0 | 1 | 2;
            refreshMaterials();
        }
        if (!this.settings().shells) this.shells.hide();
    }

    /** Pin the island clock the swims are timed by (golden shots, recordings), or follow it again with null. */
    pinIsland(ms: number | null) {
        this.islandPin = ms;
    }

    private settings(): TierSettings {
        const base = TIERS[this.tier];
        return this.lite ? {shells: false, closeUp: base.closeUp ? {within: base.closeUp.within * 0.6, cap: Math.min(base.closeUp.cap, 2)} : null} : base;
    }

    /** A near-level material of this species (its skin may be swapped for the close-up one). */
    track(slug: string, material: MeshStandardMaterial) {
        const set = this.bySlug.get(slug) ?? new Set<MeshStandardMaterial>();
        set.add(material);
        this.bySlug.set(slug, set);
        (material.userData as {arkSkin?: Texture | null}).arkSkin = material.map;
        material.addEventListener("dispose", () => set.delete(material));
        const closeUp = this.closeUps.texture(slug);
        if (closeUp && this.enabled) material.map = closeUp;
    }

    private swapSkin(slug: string, texture: Texture | null) {
        this.bySlug.get(slug)?.forEach((material) => {
            const own = (material.userData as {arkSkin?: Texture | null}).arkSkin ?? null;
            material.map = texture && this.enabled ? texture : own;
        });
    }

    /** Each frame, before the animals: the weather's wetness and the island's time. */
    begin(wetness: number) {
        this.wetness = Math.max(0, Math.min(1, wetness));
        this.islandNow = this.islandPin ?? Date.now();
        this.shells.begin();
        this.closeUps.begin();
    }

    /** One animal drawn this frame at `index` of `mesh`: its wet and dust, and (near) shells and close-up skin. */
    instance(mesh: InstancedMesh, index: number, animal: LookInstance, near: boolean) {
        const attribute = mesh.geometry.getAttribute("arkLook") as InstancedBufferAttribute | undefined;
        if (!this.enabled) return;
        const row = ROWS[animal.slug];
        const flags = row?.[1] ?? 0;
        let wet = this.wetness;
        if (animal.inWater || flags & LOOK_FLAG.aquatic) wet = 1;
        else if (flags & LOOK_FLAG.semiAquatic && near) wet = Math.max(wet, swimWetness(animal.id, this.islandNow));
        let dust = 0;
        if (flags & LOOK_FLAG.dusty && !animal.onSurface && wet < 0.6 && near) dust = this.dustAt(animal.x, animal.z) * (1 - wet);
        attribute?.setXY(index, wet, dust);
        if (!near) return;
        const settings = this.settings();
        if (settings.closeUp && animal.distance < settings.closeUp.within * 1.6) this.closeUps.want(animal.slug, animal.distance);
        if (settings.shells && row && LOOK_CLASSES[row[0]] === "fur" && animal.distance < 9 && animal.pixels > 120) this.shells.offer(mesh, index, animal.distance);
    }

    /** A herd's far figure: the weather's wetness only. */
    figure(mesh: InstancedMesh, index: number) {
        if (!this.enabled) return;
        (mesh.geometry.getAttribute("arkLook") as InstancedBufferAttribute | undefined)?.setXY(index, this.wetness, 0);
    }

    /** After the animals: the shells and the close-up skins for this frame. */
    end(now: number, shellMaterial: (source: InstancedMesh) => MeshStandardMaterial | null) {
        if (!this.enabled) return;
        const settings = this.settings();
        if (settings.shells) this.shells.end(shellMaterial);
        this.closeUps.update(now, settings.closeUp);
    }

    /** Mark every look attribute of this mesh changed (after a frame's writes). */
    static touch(mesh: InstancedMesh) {
        const attribute = mesh.geometry.getAttribute("arkLook") as InstancedBufferAttribute | undefined;
        if (attribute) attribute.needsUpdate = true;
    }

    private dustAt(x: number, z: number): number {
        const key = (Math.round(x / 2) + 4096) * 8192 + Math.round(z / 2) + 4096;
        let dry = this.dryness.get(key);
        if (dry === undefined) {
            dry = groundDryness(surfaceAt(Math.round(x / 2) * 2, Math.round(z / 2) * 2).weights, 0);
            this.dryness.set(key, dry);
        }
        return dry;
    }

    /** The ground's normal under an animal (cached on a 1 m grid): its contact shadow lies on the slope. */
    groundNormal(x: number, z: number): Vec3 {
        const key = (Math.round(x) + 8192) * 16384 + Math.round(z) + 8192;
        let normal = this.normals.get(key);
        if (!normal) {
            normal = groundNormal(Math.round(x), Math.round(z));
            this.normals.set(key, normal);
        }
        return normal;
    }

    /** How dark the contact shadow's core is: the pass's own grounding, under the sun's shadow or without it. */
    contactStrength(sunShadows: boolean): number {
        return this.enabled ? (sunShadows ? 0.34 : 0.44) : sunShadows ? 0.14 : 0.3;
    }

    dispose() {
        this.shells.dispose();
        this.closeUps.dispose();
        this.bySlug.clear();
    }
}
