/**
 * The fellers' tools (p5 humans quality pass): a chainsaw held at the trunk in both hands, or an axe swung over the
 * shoulder. Each is a small instanced mesh placed at the person's hands from a JS mirror of the figures' rig
 * (`humans/figures.ts`: the same joints, pivots and order as its vertex shader), so the tool moves with the arms.
 * No allocation per frame.
 */

import {BoxGeometry, BufferAttribute, BufferGeometry, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3} from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {BASE_HEIGHT, JOINTS, posePerson, type HumanInstance, type HumanJoints} from "@/ark-scene/humans/figures";
import {type ForestTool} from "@/ark-scene/forestry/forest-crews";

/** Tools drawn at most (a felling crew is two people; a few stands at once at most). */
const MAX_TOOLS = 16;
/** Beyond this (m) a tool is too small to see. */
const TOOL_FAR = 90;

function painted(g: BufferGeometry, colour: string): BufferGeometry {
    const geometry = g.index ? g.toNonIndexed() : g;
    const c = new Color(colour);
    const n = geometry.getAttribute("position").count;
    const colours = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) colours.set([c.r, c.g, c.b], i * 3);
    geometry.setAttribute("color", new BufferAttribute(colours, 3));
    geometry.deleteAttribute("uv");
    return geometry;
}

/** A chainsaw, its rear handle at the origin, the bar pointing +z (m). */
function sawGeometry(): BufferGeometry {
    const parts = [
        // The engine housing (orange) with its dark top, the rear handle, the wrap-round front handle, the bar and chain.
        painted(new BoxGeometry(0.13, 0.17, 0.3).translate(0, 0.02, 0.12), "#e5631c"),
        painted(new BoxGeometry(0.11, 0.035, 0.2).translate(0, 0.12, 0.1), "#2a2a2a"),
        painted(new BoxGeometry(0.035, 0.05, 0.16).translate(0, 0.04, -0.06), "#1c1c1c"),
        painted(new BoxGeometry(0.16, 0.03, 0.03).translate(0, 0.17, 0.2), "#1c1c1c"),
        painted(new BoxGeometry(0.03, 0.15, 0.03).translate(-0.075, 0.1, 0.2), "#1c1c1c"),
        painted(new BoxGeometry(0.014, 0.07, 0.5).translate(0, -0.02, 0.5), "#a9adb2"),
        // (The chain round the bar's edges, dark.)
        painted(new BoxGeometry(0.018, 0.012, 0.5).translate(0, 0.016, 0.5), "#2e3033"),
        painted(new BoxGeometry(0.018, 0.012, 0.5).translate(0, -0.056, 0.5), "#2e3033")
    ];
    return mergeGeometries(parts, false)!;
}

/** An axe, its grip at the origin, the haft along +z to the head (m). */
function axeGeometry(): BufferGeometry {
    const haft = new CylinderGeometry(0.018, 0.022, 0.82, 6).rotateX(Math.PI / 2).translate(0, 0, 0.36);
    const parts = [
        painted(haft, "#a97c4a"),
        painted(new BoxGeometry(0.03, 0.08, 0.1).translate(0, 0.02, 0.76), "#3a3c40"),
        // The blade, flaring forward of the haft, its edge bright.
        painted(new BoxGeometry(0.02, 0.14, 0.05).translate(0, 0.1, 0.76), "#55585e"),
        painted(new BoxGeometry(0.022, 0.03, 0.055).translate(0, 0.17, 0.76), "#d4d7dc")
    ];
    return mergeGeometries(parts, false)!;
}

// The rig's mirror (figures.ts `humanPose`): the same pivots, the same order.
const J = JOINTS;
function swing(p: Vector3, py: number, pz: number, a: number) {
    const dy = p.y - py, dz = p.z - pz;
    const c = Math.cos(a), s = Math.sin(a);
    p.y = py + dy * c - dz * s;
    p.z = pz + dy * s + dz * c;
}
function out(p: Vector3, px: number, py: number, a: number) {
    const dx = p.x - px, dy = p.y - py;
    const c = Math.cos(a), s = Math.sin(a);
    p.x = px + dx * c - dy * s;
    p.y = py + dx * s + dy * c;
}

/** A point of an arm on the rest body (forearm when below the elbow), posed as the shader poses it (body space). */
export function posedArmPoint(p: Vector3, left: boolean, j: HumanJoints, forearm: boolean): Vector3 {
    const sh = left ? j.arms[0] : j.arms[2];
    const el = left ? j.arms[1] : j.arms[3];
    const ax = left ? -J.shoulderX : J.shoulderX;
    if (forearm) swing(p, J.elbowY, 0, -el);
    swing(p, J.shoulderY, 0, -sh);
    out(p, ax, J.shoulderY, (left ? -1 : 1) * j.body[2] * (sh < 1.2 ? 1 : 0.2));
    swing(p, J.waistY, 0, j.body[0]);
    return p;
}

const joints: HumanJoints = {legs: [0, 0, 0, 0], arms: [0, 0, 0, 0], body: [0, 0, 0, 0]};
const basisR = new Vector3();
const basisF = new Vector3();
const edge = new Vector3();
const ax = new Vector3();
const ay = new Vector3();

/** A tool's matrix: its +z along `z`, its +y as near `up` as can be, its origin at `at`. */
function frameTo(z: Vector3, up: Vector3, out: Matrix4, at: Vector3): Matrix4 {
    ax.crossVectors(up, z);
    if (ax.lengthSq() < 1e-6) ax.set(1, 0, 0);
    ax.normalize();
    ay.crossVectors(z, ax).normalize();
    out.makeBasis(ax, ay, z).setPosition(at);
    return out;
}
const handL = new Vector3();
const handR = new Vector3();
const elbowR = new Vector3();
const grip = new Vector3();
const dir = new Vector3();
const fwd = new Vector3(0, 0, 1);
const bodyM = new Matrix4();
const toolM = new Matrix4();
const q = new Quaternion();
const q2 = new Quaternion();
const yAxis = new Vector3(0, 1, 0);
const pos = new Vector3();
const scl = new Vector3();
const one = new Vector3(1, 1, 1);

export type ToolUser = {human: HumanInstance; tool: ForestTool};

export class ForestTools {
    readonly group = new Group();
    private readonly material = new MeshStandardMaterial({vertexColors: true, roughness: 0.55, metalness: 0.15});
    private readonly saws: InstancedMesh;
    private readonly axes: InstancedMesh;

    constructor() {
        this.group.name = "forest-tools";
        this.saws = new InstancedMesh(sawGeometry(), this.material, MAX_TOOLS);
        this.axes = new InstancedMesh(axeGeometry(), this.material, MAX_TOOLS);
        for (const m of [this.saws, this.axes]) {
            m.count = 0;
            m.frustumCulled = false;
            m.castShadow = true;
            this.group.add(m);
        }
    }

    /**
     * This frame's tool users (their drawn instances: the same pose and phase as the figures). p6 (people): `grips`,
     * the rigged bodies' grip points (left, right; world) when they draw: the tools are placed in those hands as the
     * clips hold them (`people/scripts/tools.py`: the axe's haft from the left hand up through the right, the saw's rear
     * handle in the right with the bar ahead and a little down); without it, the procedural figures' mirror below.
     */
    update(users: readonly ToolUser[], camera: Vector3, seconds: number, grips?: (h: HumanInstance, seconds: number, left: Vector3, right: Vector3) => boolean) {
        let saws = 0, axes = 0;
        for (const {human: h, tool} of users) {
            if ((h.x - camera.x) ** 2 + (h.y - camera.y) ** 2 + (h.z - camera.z) ** 2 > TOOL_FAR * TOOL_FAR) continue;
            if (grips && grips(h, seconds, handL, handR)) {
                // p6 (people): the body's own hands.
                const right = basisR.set(Math.cos(h.yaw), 0, -Math.sin(h.yaw)).negate();
                const forward = basisF.set(Math.sin(h.yaw), 0, Math.cos(h.yaw));
                if (tool === "saw" && saws < MAX_TOOLS) {
                    if (h.pose === "saw") {
                        // The rear handle in the right hand, the bar the clip's way: ahead, a little left and down.
                        dir.copy(forward).addScaledVector(right, -0.12).addScaledVector(yAxis, -0.38).normalize();
                        frameTo(dir, yAxis, toolM, handR);
                    } else if (h.pose !== "carry") {
                        // Carried by its top handle in the right hand, the bar pointing back.
                        grip.copy(handR);
                        grip.y -= 0.18;
                        toolM.compose(grip, q.setFromAxisAngle(yAxis, h.yaw + Math.PI), one);
                    } else continue;
                    this.saws.setMatrixAt(saws++, toolM);
                } else if (tool === "axe" && axes < MAX_TOOLS && (h.pose === "chop" || h.pose === "walk" || h.pose === "stand")) {
                    if (h.pose === "chop") {
                        // The haft from the left (lower) hand up through the right; the blade's edge leads the swing
                        // (the swing turns about the body's left-right line).
                        dir.copy(handR).sub(handL);
                        if (dir.lengthSq() < 1e-4) dir.copy(forward);
                        dir.normalize();
                        edge.crossVectors(right, dir).negate();
                        frameTo(dir, edge, toolM, handL);
                    } else {
                        // Carried in the right hand, head down by the leg.
                        dir.set(Math.sin(h.yaw) * 0.25, -1, Math.cos(h.yaw) * 0.25).normalize();
                        toolM.compose(handR, q.setFromUnitVectors(fwd, dir), one);
                    }
                    this.axes.setMatrixAt(axes++, toolM);
                }
                continue;
            }
            posePerson(h.pose, h.phase + seconds, joints);
            joints.body[0] += h.lean ?? 0;
            // The hands (the fist's middle on the rest body) and the right forearm's line.
            posedArmPoint(handL.set(-J.shoulderX, 0.84, 0.01), true, joints, true);
            posedArmPoint(handR.set(J.shoulderX, 0.84, 0.01), false, joints, true);
            posedArmPoint(elbowR.set(J.shoulderX, J.elbowY, 0), false, joints, false);
            const look = h.look;
            const s = (h.scale ?? 1) * (look.height / BASE_HEIGHT);
            bodyM.compose(pos.set(h.x, h.y, h.z), q.setFromAxisAngle(yAxis, h.yaw), scl.set(s * look.build, s, s * (0.9 + 0.1 * look.build)));
            handL.applyMatrix4(bodyM);
            handR.applyMatrix4(bodyM);
            elbowR.applyMatrix4(bodyM);
            if (tool === "saw" && h.pose !== "saw" && saws < MAX_TOOLS && h.pose !== "carry") {
                // Carried in the right hand by its top handle, the bar pointing back.
                grip.copy(handR);
                grip.y -= 0.18;
                q.setFromAxisAngle(yAxis, h.yaw + Math.PI);
                toolM.compose(grip, q, one);
                this.saws.setMatrixAt(saws++, toolM);
            } else if (tool === "saw" && h.pose === "saw" && saws < MAX_TOOLS) {
                // Held between the hands, the bar level and pointing the way the feller faces (into the trunk).
                grip.copy(handL).add(handR).multiplyScalar(0.5);
                grip.y -= 0.05;
                q.setFromAxisAngle(yAxis, h.yaw);
                toolM.compose(grip, q, one);
                this.saws.setMatrixAt(saws++, toolM);
            } else if (tool === "axe" && axes < MAX_TOOLS && (h.pose === "chop" || h.pose === "walk" || h.pose === "stand")) {
                if (h.pose === "chop") {
                    // Both hands at the haft's end, the haft carrying on the forearm's line, the edge leading.
                    grip.copy(handL).add(handR).multiplyScalar(0.5);
                    dir.copy(handR).sub(elbowR).normalize();
                    q.setFromUnitVectors(fwd, dir);
                    // (Roll so the blade's edge faces the way of the swing: up the body's own vertical.)
                    q2.setFromAxisAngle(fwd, Math.PI);
                    q.multiply(q2);
                } else {
                    // Carried in the right hand, head down by the leg.
                    grip.copy(handR);
                    dir.set(Math.sin(h.yaw) * 0.25, -1, Math.cos(h.yaw) * 0.25).normalize();
                    q.setFromUnitVectors(fwd, dir);
                }
                toolM.compose(grip, q, one);
                this.axes.setMatrixAt(axes++, toolM);
            }
        }
        this.saws.count = saws;
        this.axes.count = axes;
        this.saws.visible = saws > 0;
        this.axes.visible = axes > 0;
        this.saws.instanceMatrix.needsUpdate = true;
        this.axes.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        this.saws.geometry.dispose();
        this.axes.geometry.dispose();
        this.material.dispose();
        this.group.removeFromParent();
    }
}
