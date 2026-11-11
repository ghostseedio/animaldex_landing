/**
 * Fur shells (the animal-look pass, high tier only): the nearest few furred
 * mammals get their body drawn again in a few layers pushed out along its
 * normal, each cut to strands (`ARK_SHELL` in `animal-look-shader.ts`), so the
 * edge of the coat goes soft and fuzzy against the light. Short shells, close
 * to the camera, a capped number of animals: never a shell explosion.
 *
 * One instanced draw per species in shells: its near (or rigged) mesh's
 * geometry shared, each chosen animal's instance (matrix, motion, rig clip,
 * wet) copied once per layer with the layer's height in `arkShellLayer`. The
 * shells follow the walk, the idle and the breathing exactly because they run
 * the same vertex shader.
 */

import {BufferGeometry, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, type MeshStandardMaterial, type Scene} from "three";

/** Layers per animal (right up close; fewer further out, `shellLevel` in animal-look.ts), and how many animals at once. */
export const SHELL_LAYERS = 6;
export const SHELL_ANIMALS = 4;

type Offer = {source: InstancedMesh; index: number; distance: number; layers: number; reach: number};

type Shell = {mesh: InstancedMesh; geometry: BufferGeometry; capacity: number; source: InstancedMesh; usedAt: number};

export class FurShells {
    private readonly shells = new Map<InstancedMesh, Shell>();
    private offers: Offer[] = [];
    private frame = 0;
    /** Animals in shells this frame, and their layers (stats). */
    drawn = 0;
    layersDrawn = 0;

    constructor(private readonly scene: Scene, private readonly layers = SHELL_LAYERS, private readonly animals = SHELL_ANIMALS) {}

    begin() {
        this.offers = [];
        this.frame++;
    }

    /** An animal that may be shelled this frame: `layers` (1–SHELL_LAYERS) and `reach` (0–1 of the coat's length). */
    offer(source: InstancedMesh, index: number, distance: number, layers = this.layers, reach = 1) {
        this.offers.push({source, index, distance, layers: Math.max(1, Math.min(this.layers, Math.round(layers))), reach});
    }

    /** The nearest `animals` offers are drawn in shells; `drawn` counts the animals really drawn. */
    end(materialFor: (source: InstancedMesh) => MeshStandardMaterial | null, animals = this.animals) {
        this.offers.sort((a, b) => a.distance - b.distance);
        const chosen = this.offers.slice(0, animals);
        const bySource = new Map<InstancedMesh, Offer[]>();
        for (const offer of chosen) bySource.set(offer.source, [...(bySource.get(offer.source) ?? []), offer]);
        this.drawn = 0;
        this.layersDrawn = 0;
        bySource.forEach((offers, source) => {
            const needed = offers.reduce((sum, offer) => sum + offer.layers, 0);
            const shell = this.shellFor(source, needed, materialFor);
            if (!shell) return;
            this.fill(shell, offers);
            shell.usedAt = this.frame;
            this.drawn += offers.length;
            this.layersDrawn += needed;
        });
        this.shells.forEach((shell, source) => {
            if (shell.usedAt !== this.frame) shell.mesh.visible = false;
            // Its source mesh was replaced (grown) or removed: let the shell go.
            if (!source.parent) this.release(source);
        });
    }

    hide() {
        this.drawn = 0;
        this.layersDrawn = 0;
        this.shells.forEach((shell) => (shell.mesh.visible = false));
    }

    private shellFor(source: InstancedMesh, needed: number, materialFor: (source: InstancedMesh) => MeshStandardMaterial | null): Shell | null {
        let shell = this.shells.get(source);
        if (shell && shell.capacity >= needed) return shell;
        const material = shell ? (shell.mesh.material as MeshStandardMaterial) : materialFor(source);
        if (!material) return null;
        if (shell) this.release(source, false);
        const capacity = Math.max(needed, this.layers * 2);
        const geometry = new BufferGeometry();
        // The body's own buffers, shared (uploaded once); the instances are the shell's.
        for (const [name, attribute] of Object.entries(source.geometry.attributes)) {
            if (!(attribute as InstancedBufferAttribute).isInstancedBufferAttribute) geometry.setAttribute(name, attribute);
        }
        geometry.setIndex(source.geometry.getIndex());
        geometry.boundingSphere = source.geometry.boundingSphere;
        geometry.boundingBox = source.geometry.boundingBox;
        // Per layer: (its height, 0–1 out from the skin; the coat's reach for that animal, 0–1).
        const layer = new InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
        layer.setUsage(DynamicDrawUsage);
        geometry.setAttribute("arkShellLayer", layer);
        const mesh = new InstancedMesh(geometry, material, capacity);
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.count = 0;
        this.scene.add(mesh);
        shell = {mesh, geometry, capacity, source, usedAt: 0};
        this.shells.set(source, shell);
        return shell;
    }

    private fill(shell: Shell, offers: Offer[]) {
        const {mesh, geometry, source} = shell;
        const from = source.instanceMatrix.array as Float32Array;
        const to = mesh.instanceMatrix.array as Float32Array;
        const layer = geometry.getAttribute("arkShellLayer") as InstancedBufferAttribute;
        // Every per-animal attribute of the source (motion, rig clips, wet and dust), copied per layer.
        const instanced = Object.entries(source.geometry.attributes).filter(([, attribute]) => (attribute as InstancedBufferAttribute).isInstancedBufferAttribute) as Array<[string, InstancedBufferAttribute]>;
        for (const [name, attribute] of instanced) {
            const own = geometry.getAttribute(name) as InstancedBufferAttribute | undefined;
            if (!own || own.itemSize !== attribute.itemSize || own.count < shell.capacity) {
                const copy = new InstancedBufferAttribute(new Float32Array(shell.capacity * attribute.itemSize), attribute.itemSize);
                copy.setUsage(DynamicDrawUsage);
                geometry.setAttribute(name, copy);
            }
        }
        let n = 0;
        for (const {index, layers, reach} of offers) {
            for (let k = 0; k < layers; k++) {
                to.set(from.subarray(index * 16, index * 16 + 16), n * 16);
                layer.setXY(n, (k + 1) / layers, reach);
                for (const [name, attribute] of instanced) {
                    const own = geometry.getAttribute(name) as InstancedBufferAttribute;
                    const size = attribute.itemSize;
                    (own.array as Float32Array).set((attribute.array as Float32Array).subarray(index * size, index * size + size), n * size);
                }
                n++;
            }
        }
        for (const [name] of instanced) (geometry.getAttribute(name) as InstancedBufferAttribute).needsUpdate = true;
        layer.needsUpdate = true;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.count = n;
        mesh.visible = n > 0;
    }

    private release(source: InstancedMesh, disposeMaterial = true) {
        const shell = this.shells.get(source);
        if (!shell) return;
        this.scene.remove(shell.mesh);
        // The body's buffers belong to the source: take them off before the shell's geometry goes.
        for (const [name, attribute] of Object.entries(shell.geometry.attributes)) {
            if (!(attribute as InstancedBufferAttribute).isInstancedBufferAttribute) shell.geometry.deleteAttribute(name);
        }
        shell.geometry.setIndex(null);
        shell.geometry.dispose();
        if (disposeMaterial) (shell.mesh.material as MeshStandardMaterial).dispose();
        shell.mesh.dispose();
        this.shells.delete(source);
    }

    dispose() {
        for (const source of Array.from(this.shells.keys())) this.release(source);
    }
}
