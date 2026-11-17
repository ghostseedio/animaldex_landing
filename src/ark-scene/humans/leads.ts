/**
 * The dog walks' leads (p5 (humans, dogs)): one thin line from each walker's hand to their dog's collar, hanging a
 * little (`dog-walks.ts` leadLine). One draw for every lead in the town (a few at a time), no allocation per frame.
 */

import {BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments} from "three";
import {leadLine} from "@/ark-scene/humans/dog-walks";

/** Leads drawn at most, and the points along each. */
export const LEADS_MAX = 24;
const POINTS = 7;

export class DogLeads {
    readonly mesh: LineSegments;
    private readonly positions = new Float32Array(LEADS_MAX * (POINTS - 1) * 2 * 3);
    private readonly curve = new Float32Array(POINTS * 3);
    private count = 0;

    constructor() {
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(this.positions, 3));
        geometry.setDrawRange(0, 0);
        this.mesh = new LineSegments(geometry, new LineBasicMaterial({color: "#2a2622"}));
        this.mesh.frustumCulled = false;
        this.mesh.visible = false;
        this.mesh.name = "dog-leads";
    }

    /** A frame's leads begin. */
    begin() {
        this.count = 0;
    }

    /** A lead from a hand to a collar (ignored past `LEADS_MAX`). Returns its length (m). */
    add(hand: {x: number; y: number; z: number}, collar: {x: number; y: number; z: number}): number {
        if (this.count >= LEADS_MAX) return 0;
        const length = leadLine(hand, collar, POINTS, this.curve, 0);
        let o = this.count * (POINTS - 1) * 6;
        for (let i = 0; i + 1 < POINTS; i++) {
            for (let k = 0; k < 6; k++) this.positions[o++] = this.curve[i * 3 + k];
        }
        this.count++;
        return length;
    }

    /** The frame's leads drawn. */
    end() {
        const geometry = this.mesh.geometry;
        geometry.setDrawRange(0, this.count * (POINTS - 1) * 2);
        (geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
        this.mesh.visible = this.count > 0;
    }

    dispose() {
        this.mesh.geometry.dispose();
        (this.mesh.material as LineBasicMaterial).dispose();
    }
}
