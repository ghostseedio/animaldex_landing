/**
 * The line of sight from the camera to an animal (graphics pass 2026-11-14, the close-up follow-up): whether anything
 * that is drawn solid stands between two points. It asks the scene's own meshes (three's ray test, each mesh as it is
 * drawn: a wall seen from behind is not there, exactly as in the picture), so walls, roofs, house shells, fences,
 * rocks, trunks, crowns and hillsides all count without a second description of the world.
 *
 * Left out: what is see-through (glass, water, nets, bars: an animal behind them is in view), the animals themselves,
 * the weather and the sky, and the big instanced sets of small things (grass, litter: thousands of instances a ray,
 * and none of them hides an animal). The first solid thing found ends the test.
 */

import {Raycaster, type InstancedMesh, type Intersection, type Material, type Mesh, type Object3D, type Vector3} from "three";

/** Things that never hide an animal, by their mesh's (or their group's) name or kind. */
const NEVER = /grass|speck|dot|ring|shadow|sky|cloud|rain|snow|mist|halo|label|dust|trace|mark|icon|bar/i;
/** An instanced set this big is ground cover (grass, litter, flowers), not an obstacle. */
const COVER_INSTANCES = 2500;

export class Sight {
    private readonly rays = new Raycaster();
    private readonly hits: Intersection[] = [];
    /** Ray tests made (the page's profiler and the tests read it). */
    tests = 0;

    constructor(private readonly root: Object3D) {}

    /** Whether something solid stands between `from` and `to`, short of the last `slack` metres (the animal's own body). */
    blocked(from: Vector3, to: Vector3, slack: number): boolean {
        const far = from.distanceTo(to) - slack;
        if (!(far > 0.02)) return false;
        this.rays.ray.origin.copy(from);
        this.rays.ray.direction.copy(to).sub(from).normalize();
        this.rays.near = 0;
        this.rays.far = far;
        this.tests++;
        return this.walk(this.root);
    }

    private walk(object: Object3D): boolean {
        if (!object.visible) return false;
        if ((object as Mesh).isMesh && solid(object as Mesh)) {
            this.hits.length = 0;
            object.raycast(this.rays, this.hits);
            if (this.hits.length > 0) return true;
        }
        const children = object.children;
        for (let i = 0; i < children.length; i++) if (this.walk(children[i])) return true;
        return false;
    }
}

/** Whether a mesh hides what is behind it: drawn opaque, not an animal, not the weather, not ground cover. */
export function solid(mesh: Mesh): boolean {
    if ((mesh as unknown as {isSkinnedMesh?: boolean}).isSkinnedMesh) return false;
    if (mesh.userData.arkAnimal) return false;
    const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as Material | undefined;
    if (!material || !material.visible || material.transparent || material.opacity < 1 || !material.depthWrite || !material.colorWrite) return false;
    const name = mesh.name || (mesh.userData.kind as string | undefined) || mesh.parent?.name || (mesh.parent?.userData.kind as string | undefined) || "";
    if (name && NEVER.test(name)) return false;
    const instanced = mesh as unknown as InstancedMesh;
    if (instanced.isInstancedMesh && instanced.count > COVER_INSTANCES) return false;
    return true;
}
