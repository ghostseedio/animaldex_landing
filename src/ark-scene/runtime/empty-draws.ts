/**
 * No draw call with nothing to draw (graphics and performance pass, 2026-11-14).
 *
 * three sets a mesh's program, uniforms and buffers up and then issues its draw call whatever the count: a geometry
 * whose draw range is empty (the recipes' sparks with none alive, the night glows by day, a dust or rain field with no
 * particle) still reaches `gl.drawArrays(…, 0)`. A desktop says nothing. The Android web view's validating decoder
 * prints `RENDER WARNING: Render count or primcount is 0.` for each, 54 to 255 times in the first minute, until
 * Chromium stops reporting WebGL errors for the context, which then hides the real ones. An instanced mesh with no
 * instance and a batched mesh with nothing visible are caught by three, but only after the same set-up (0.2 to 0.5 ms
 * a frame at 4× CPU, the perf lane's measure).
 *
 * So the renderer's own draw (`renderBufferDirect`, the one place every mesh, line and point set goes through, the
 * shadow pass too) is asked first whether there is anything to draw, and left out when there is not. The sets that
 * hide themselves while empty (`visible = count > 0`) never get this far; this is for all the others, and for the next
 * one written. Whoever wraps the same call (the runtime's shader hold) wraps this one or is wrapped by it: either
 * order works.
 */

type DrawGeometry = {
    index?: {count: number} | null;
    attributes?: {position?: {count: number}};
    drawRange?: {start: number; count: number};
    isInstancedBufferGeometry?: boolean;
    instanceCount?: number;
};
type DrawObject = {isInstancedMesh?: boolean; isBatchedMesh?: boolean; count?: number; _multiDrawCount?: number};
type DrawGroup = {start: number; count: number} | null | undefined;

/** Whether drawing this would be a draw call of nothing (three's own arithmetic for the range it would draw). */
export function emptyDraw(drawn: object | null | undefined, by: object | null | undefined, group?: DrawGroup): boolean {
    if (!drawn || !by) return false;
    const geometry = drawn as DrawGeometry;
    const object = by as DrawObject;
    if (object.isInstancedMesh && object.count === 0) return true;
    if (object.isBatchedMesh) return object._multiDrawCount === 0;
    if (geometry.isInstancedBufferGeometry && geometry.instanceCount === 0) return true;
    const total = geometry.index ? geometry.index.count : geometry.attributes?.position ? geometry.attributes.position.count : null;
    // (Neither an index nor positions: three's own early return.)
    if (total === null) return false;
    const range = geometry.drawRange ?? {start: 0, count: Infinity};
    let start = range.start;
    let end = Math.min(total, range.start + range.count);
    if (group) {
        start = Math.max(start, group.start);
        end = Math.min(end, group.start + group.count);
    }
    return end - start <= 0;
}

type DrawRenderer = {renderBufferDirect: (camera: never, scene: never, geometry: never, material: never, object: never, group: never) => void};

/** Leave every empty draw out of this renderer's frames from now on; returns how many it has left out so far. */
export function skipEmptyDraws(renderer: unknown): () => number {
    const target = renderer as DrawRenderer;
    const draw = target.renderBufferDirect;
    let skipped = 0;
    target.renderBufferDirect = function (this: unknown, camera: never, scene: never, geometry: never, material: never, object: never, group: never) {
        if (emptyDraw(geometry as object, object as object, group as DrawGroup)) {
            skipped++;
            return;
        }
        draw.call(this, camera, scene, geometry, material, object, group);
    };
    return () => skipped;
}
