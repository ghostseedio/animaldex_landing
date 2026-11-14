/**
 * The line of sight from the camera to an animal (graphics pass 2026-11-14, the close-up follow-up): whether anything
 * that is drawn solid stands between two points. It asks the scene's own meshes, each as it is drawn (a wall seen from
 * behind is not there, exactly as in the picture), so walls, roofs, house shells, enclosure walls, fences, rocks,
 * trunks, crowns, furniture and props all count without a second description of the world.
 *
 * Left out: what is see-through (glass, water, nets, bars: an animal behind them is in view), the animals themselves,
 * the weather and the sky, the big instanced sets of small things (grass, litter: thousands of instances a ray, and
 * none of them hides an animal), and the ground (its heights are asked by the caller, `runtime/index.ts`
 * sightBlocked).
 *
 * Cost. three's own ray test walks every triangle of a mesh the ray comes near, and the town's biggest meshes are
 * island-wide: every pet home's shell in one mesh, a band of 27 chunks a batch (13 ms a ray on the low phone profile).
 * So before a search (`near`), the triangles of those big meshes that lie round the animal are gathered once into a
 * small list in the world's frame, and every line of the search is tested against that list (microseconds); only the
 * small meshes and the instanced trees and rocks go through three's test. The first solid thing found ends a line.
 */

import {Box3, Matrix4, Raycaster, Vector3, type BatchedMesh, type BufferAttribute, type BufferGeometry, type InstancedMesh, type Intersection, type Material, type Mesh, type Object3D} from "three";

/** Things that never hide an animal, by their mesh's (or their group's) name or kind. */
const NEVER = /grass|speck|dot|ring|shadow|sky|cloud|rain|snow|mist|halo|label|dust|trace|mark|icon|bar|floor|litter|light|glow/i;
/** The ground (asked by its heights) and what lies flat on it or in a wall's own plane. */
const GROUND = /^(ground|decal|panes|zoo:decal|ark-ground.*)$/;
/** An instanced set this big is ground cover (grass, litter, flowers), not an obstacle. */
const COVER_INSTANCES = 2500;
/** A plain mesh with more triangles than this is gathered (`near`), not walked a ray at a time. */
const BIG_TRIANGLES = 600;

export class Sight {
    private readonly rays = new Raycaster();
    private readonly hits: Intersection[] = [];
    /** The gathered triangles round `centre` (world frame, nine numbers each): seen from their front only, and from both sides. */
    private front = new Float32Array(0);
    private both = new Float32Array(0);
    private frontCount = 0;
    private bothCount = 0;
    private readonly centre = new Vector3();
    private reach = -1;
    /** Ray tests made, and gatherings (the page's profiler and the tests read them). */
    tests = 0;
    gathered = 0;

    constructor(private readonly root: Object3D) {}

    /**
     * Before lines that end near `centre` and start within `reach` of it: the big meshes' triangles there, gathered once
     * (again only when the animal has moved off or the reach has grown).
     */
    near(centre: Vector3, reach: number): void {
        if (this.reach >= 0 && this.centre.distanceTo(centre) + reach <= this.reach) return;
        this.centre.copy(centre);
        this.reach = reach + 3;
        this.frontCount = 0;
        this.bothCount = 0;
        this.gathered++;
        this.gather(this.root);
    }

    /** Forget what was gathered (the world changed: a chunk came in, a level was swapped). */
    reset(): void {
        this.reach = -1;
    }

    /** Whether something solid stands between `from` and `to`, short of the last `slack` metres (the animal's own body). */
    blocked(from: Vector3, to: Vector3, slack: number): boolean {
        const far = from.distanceTo(to) - slack;
        if (!(far > 0.02)) return false;
        const direction = this.rays.ray.direction.copy(to).sub(from).normalize();
        this.rays.ray.origin.copy(from);
        this.rays.near = 0;
        this.rays.far = far;
        this.tests++;
        const covered = this.reach >= 0 && from.distanceTo(this.centre) <= this.reach && to.distanceTo(this.centre) <= this.reach;
        if (covered && (hitsAny(this.front, this.frontCount, from, direction, far, true) || hitsAny(this.both, this.bothCount, from, direction, far, false))) return true;
        return this.walk(this.root, covered);
    }

    private walk(object: Object3D, covered: boolean): boolean {
        if (!object.visible) return false;
        const mesh = object as Mesh;
        if (mesh.isMesh && solid(mesh) && !(covered && big(mesh))) {
            this.hits.length = 0;
            object.raycast(this.rays, this.hits);
            if (this.hits.length > 0) return true;
        }
        const children = object.children;
        for (let i = 0; i < children.length; i++) if (this.walk(children[i], covered)) return true;
        return false;
    }

    private gather(object: Object3D): void {
        if (!object.visible) return;
        const mesh = object as Mesh;
        if (mesh.isMesh && solid(mesh) && big(mesh)) this.take(mesh);
        const children = object.children;
        for (let i = 0; i < children.length; i++) this.gather(children[i]);
    }

    /** One big mesh's triangles within reach of the centre, into the lists (by the side its material draws). */
    private take(mesh: Mesh): void {
        const geometry = mesh.geometry as BufferGeometry;
        const position = geometry.getAttribute("position") as BufferAttribute | undefined;
        if (!position) return;
        const index = geometry.index;
        const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as Material;
        // (three: FrontSide 0, BackSide 1, DoubleSide 2. A back-side material's triangles are kept turned round.)
        const twoSided = material.side === 2;
        const flipped = material.side === 1;
        // The reach as a box in the mesh's own frame (its matrix is a move and a turn, at most a uniform scale).
        TO_LOCAL.copy(mesh.matrixWorld).invert();
        const scale = mesh.matrixWorld.getMaxScaleOnAxis() || 1;
        LOCAL.copy(this.centre).applyMatrix4(TO_LOCAL);
        const r = this.reach / scale;
        REGION.min.set(LOCAL.x - r, LOCAL.y - r, LOCAL.z - r);
        REGION.max.set(LOCAL.x + r, LOCAL.y + r, LOCAL.z + r);
        const range = (start: number, count: number) => {
            for (let t = start; t + 2 < start + count; t += 3) {
                const a = index ? index.getX(t) : t;
                const b = index ? index.getX(t + 1) : t + 1;
                const c = index ? index.getX(t + 2) : t + 2;
                const ax = position.getX(a);
                const bx = position.getX(b);
                const cx = position.getX(c);
                if (Math.min(ax, bx, cx) > REGION.max.x || Math.max(ax, bx, cx) < REGION.min.x) continue;
                const az = position.getZ(a);
                const bz = position.getZ(b);
                const cz = position.getZ(c);
                if (Math.min(az, bz, cz) > REGION.max.z || Math.max(az, bz, cz) < REGION.min.z) continue;
                const ay = position.getY(a);
                const by = position.getY(b);
                const cy = position.getY(c);
                if (Math.min(ay, by, cy) > REGION.max.y || Math.max(ay, by, cy) < REGION.min.y) continue;
                A.set(ax, ay, az).applyMatrix4(mesh.matrixWorld);
                B.set(bx, by, bz).applyMatrix4(mesh.matrixWorld);
                C.set(cx, cy, cz).applyMatrix4(mesh.matrixWorld);
                if (flipped) this.push(twoSided, A, C, B);
                else this.push(twoSided, A, B, C);
            }
        };
        const batched = mesh as unknown as BatchedMesh;
        if (batched.isBatchedMesh) {
            // (A chunk an instance, each in the batch's own frame: `islands/town/render/batches.ts`.)
            for (let i = 0; i < batched.instanceCount; i++) {
                let geometryId = -1;
                try {
                    if (!batched.getVisibleAt(i)) continue;
                    geometryId = batched.getGeometryIdAt(i);
                } catch {
                    continue;
                }
                const bounds = batched.getBoundingBoxAt(geometryId, CHUNK);
                if (!bounds || !bounds.intersectsBox(REGION)) continue;
                const at = batched.getGeometryRangeAt(geometryId) as {indexStart: number; indexCount: number; vertexStart: number; vertexCount: number};
                if (index && at.indexCount > 0) range(at.indexStart, at.indexCount);
                else range(at.vertexStart, at.vertexCount);
            }
            return;
        }
        const draw = geometry.drawRange;
        const total = index ? index.count : position.count;
        const start = Math.max(draw.start, 0);
        range(start, Math.min(draw.count, total - start));
    }

    private push(twoSided: boolean, a: Vector3, b: Vector3, c: Vector3): void {
        const count = twoSided ? this.bothCount : this.frontCount;
        let list = twoSided ? this.both : this.front;
        if ((count + 1) * 9 > list.length) {
            const grown = new Float32Array(Math.max(list.length * 2, 9 * 512));
            grown.set(list);
            list = grown;
            if (twoSided) this.both = grown;
            else this.front = grown;
        }
        const at = count * 9;
        list[at] = a.x;
        list[at + 1] = a.y;
        list[at + 2] = a.z;
        list[at + 3] = b.x;
        list[at + 4] = b.y;
        list[at + 5] = b.z;
        list[at + 6] = c.x;
        list[at + 7] = c.y;
        list[at + 8] = c.z;
        if (twoSided) this.bothCount++;
        else this.frontCount++;
    }
}

const TO_LOCAL = new Matrix4();
const LOCAL = new Vector3();
const REGION = new Box3();
const CHUNK = new Box3();
const A = new Vector3();
const B = new Vector3();
const C = new Vector3();

/** Whether a ray meets any of the listed triangles within `far` (Möller and Trumbore's test; `frontOnly`: only those facing it). */
function hitsAny(list: Float32Array, count: number, origin: Vector3, direction: Vector3, far: number, frontOnly: boolean): boolean {
    const ox = origin.x;
    const oy = origin.y;
    const oz = origin.z;
    const dx = direction.x;
    const dy = direction.y;
    const dz = direction.z;
    for (let i = 0; i < count; i++) {
        const at = i * 9;
        const ax = list[at];
        const ay = list[at + 1];
        const az = list[at + 2];
        const e1x = list[at + 3] - ax;
        const e1y = list[at + 4] - ay;
        const e1z = list[at + 5] - az;
        const e2x = list[at + 6] - ax;
        const e2y = list[at + 7] - ay;
        const e2z = list[at + 8] - az;
        const px = dy * e2z - dz * e2y;
        const py = dz * e2x - dx * e2z;
        const pz = dx * e2y - dy * e2x;
        const det = e1x * px + e1y * py + e1z * pz;
        // (Facing the ray: its corners run anticlockwise seen from the ray's origin, the determinant positive.)
        if (frontOnly ? det < 1e-9 : Math.abs(det) < 1e-9) continue;
        const inv = 1 / det;
        const tx = ox - ax;
        const ty = oy - ay;
        const tz = oz - az;
        const u = (tx * px + ty * py + tz * pz) * inv;
        if (u < 0 || u > 1) continue;
        const qx = ty * e1z - tz * e1y;
        const qy = tz * e1x - tx * e1z;
        const qz = tx * e1y - ty * e1x;
        const v = (dx * qx + dy * qy + dz * qz) * inv;
        if (v < 0 || u + v > 1) continue;
        const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
        if (t > 1e-4 && t < far) return true;
    }
    return false;
}

/** A mesh gathered ahead of a search instead of walked a ray at a time: a batch, or a plain mesh of many triangles. */
function big(mesh: Mesh): boolean {
    if ((mesh as unknown as BatchedMesh).isBatchedMesh) return true;
    if ((mesh as unknown as InstancedMesh).isInstancedMesh) return false;
    const geometry = mesh.geometry as BufferGeometry;
    const count = geometry.index ? geometry.index.count : geometry.getAttribute("position")?.count ?? 0;
    return count > BIG_TRIANGLES * 3;
}

/** Whether a mesh hides what is behind it: drawn opaque, not an animal, not the weather, not ground cover, not the ground. */
export function solid(mesh: Mesh): boolean {
    if ((mesh as unknown as {isSkinnedMesh?: boolean}).isSkinnedMesh) return false;
    if (mesh.userData.arkAnimal) return false;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as Material | undefined;
    if (!material || !material.visible || material.transparent || material.opacity < 1 || !material.depthWrite || !material.colorWrite) return false;
    const name = mesh.name || (mesh.userData.kind as string | undefined) || mesh.parent?.name || (mesh.parent?.userData.kind as string | undefined) || "";
    if (name && (NEVER.test(name) || GROUND.test(name))) return false;
    const instanced = mesh as unknown as InstancedMesh;
    if (instanced.isInstancedMesh && instanced.count > COVER_INSTANCES) return false;
    return true;
}
