/**
 * The validator's grip check (the rig player's sloth shot): every hanger,
 * climber and percher on a branch, a trunk, a ledge or a wall, whose rig
 * plays there, has its grip bones (feet, hands, claws: `grip.ts`) on the
 * surface through the clip's frames. The scene puts the middle
 * of its supporting grips on the surface point (`index.ts`), so what can
 * still fail is a frame with fewer than half its grip bones (two at least)
 * down on the surface (within a sixteenth of the body of the lowest), or a rig with legs but no foot bones (a chain rig, a snake,
 * grips with its underside: the bounds stand in).
 *
 * Node only (it reads the published rig files from disk:
 * `~/animaldex-talking-models/rig/publish`, or `ARK_RIG_DIR`); where they
 * are not (CI), the check says it was skipped.
 */

import {existsSync, readFileSync} from "node:fs";
import {join} from "node:path";
import {Box3, type Bone, type SkinnedMesh} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {GRIP_TOLERANCE, gripBones, gripSupport, type BoneRows} from "@/ark-scene/map/grip";
import {decodeRigEntry, rigClip} from "@/ark-scene/rig-clips";
import {halfToFloat} from "@/ark-scene/rig-player";
import type {Placement} from "@/ark-scene/placement";

export type GripFailure = {slug: string; clip: string; detail: string};

const GRIPPING = new Set(["branch", "bark", "leaf", "rock_face", "house_wall"]);

/** The clip the scene plays for it there (`index.ts` rigFor): hang, climb or perch's idle. */
function clipFor(mode: string, has: (name: string) => boolean): string {
    if (mode === "hang" && has("hang")) return "hang";
    if (mode === "climb" && has("climb")) return "climb";
    return "idle";
}

export async function validateGrips(placed: Map<string, Placement>, slugOf: (id: string) => string, rigDir = process.env.ARK_RIG_DIR || join(process.env.HOME ?? "", "animaldex-talking-models/rig/publish")): Promise<{skipped: string | null; checked: number; failures: GripFailure[]}> {
    const manifestPath = join(rigDir, "manifest.json");
    if (!existsSync(manifestPath)) return {skipped: `no rig files at ${rigDir}`, checked: 0, failures: []};
    const manifest = (JSON.parse(readFileSync(manifestPath, "utf8")) as {species?: Record<string, string>}).species ?? {};
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const failures: GripFailure[] = [];
    const seen = new Set<string>();
    let checked = 0;
    for (const [id, place] of Array.from(placed.entries())) {
        const slug = slugOf(id);
        const gripping = place.canopy || (place.micro?.attach && GRIPPING.has(place.micro.attach.tag)) || (place.perch && GRIPPING.has(place.perch.tag));
        if (!gripping || seen.has(slug) || !manifest[slug]) continue;
        seen.add(slug);
        const file = join(rigDir, slug, `${manifest[slug]}.rig.glb`);
        if (!existsSync(file)) continue;
        const buffer = readFileSync(file);
        const gltf = await loader.parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), "");
        const extras = (gltf.parser.json as {extras?: {ark_rig?: {bufferView: number; bones: string[]; rig?: unknown}}}).extras?.ark_rig;
        const entry = extras ? decodeRigEntry(extras.rig) : null;
        if (!extras || !entry) continue;
        const own = {species: {[slug]: entry}};
        const mode = place.canopy?.mode ?? "perch";
        const clip = clipFor(mode, (name) => Boolean(rigClip(own, slug, name)));
        const playing = rigClip(own, slug, clip);
        if (!playing || typeof playing.row !== "number" || typeof playing.rows !== "number") continue;
        let mesh: SkinnedMesh | null = null;
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((object) => {
            if (!mesh && (object as SkinnedMesh).isSkinnedMesh) mesh = object as SkinnedMesh;
        });
        if (!mesh) continue;
        const skinned = mesh as SkinnedMesh;
        checked++;
        const grips = gripBones(skinned, extras.bones);
        if (!grips.length) {
            // A chain rig (a snake, a centipede) grips with its whole underside: the bounds stand in, as the scene does. Legs with no foot is a failure.
            const names = (skinned.skeleton.bones as Bone[]).map((b) => b.name);
            if (names.some((name) => /leg|arm/i.test(name))) failures.push({slug, clip, detail: `legs but no grip bones (${names.join(", ")})`});
            continue;
        }
        const data = new Uint16Array((await gltf.parser.getDependency("bufferView", extras.bufferView)) as ArrayBuffer);
        const rows: BoneRows = {bones: extras.bones.length, at: (row, bone, element) => halfToFloat(data[row * extras.bones.length * 12 + bone * 12 + element])};
        const box = new Box3().setFromObject(skinned);
        const body = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
        // At every sampled frame at least half its grip bones (two at least) are down on the surface the scene puts them on.
        const need = Math.min(grips.length, Math.max(2, Math.ceil(grips.length / 2)));
        let fewest = grips.length;
        for (let row = playing.row; row < playing.row + playing.rows; row += 4) fewest = Math.min(fewest, gripSupport(rows, row, grips, body * GRIP_TOLERANCE)?.count ?? 0);
        if (fewest < need) failures.push({slug, clip, detail: `only ${fewest} of ${grips.length} grip bones on the surface in a frame (needs ${need})`});
    }
    return {skipped: null, checked, failures};
}
