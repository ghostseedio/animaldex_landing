/**
 * Logging and replanting in the live scene (p5 humans; AnimalDex decision 379): the one object `index.ts` holds. It reads
 * the record's switch-on day (the snapshot's `forestry.fromDay`; absent = no forestry, nothing drawn or changed), and
 * each frame, from the shared Ark day: marks the stands' trees for `AssetTrees` (felling, felled, saplings), draws the
 * stumps and the bared earth (`forest-render.ts`), and hands the host the crews to draw (`forest-crews.ts`: humans the
 * record has aboard). The deaths are the server's (`deforested` events): the scene draws their bodies through
 * `live-deaths.ts` where the server judged them.
 */

import {Group, type Vector3} from "three";
import {HumanFigures, humanLook, type HumanInstance, type HumanLook} from "@/ark-scene/humans/figures";
import stands from "@/ark-scene/positions/forest-stands.json";
import {FORESTRY_VERSION, type StandTable} from "@/ark-scene/positions/forestry";
import {ForestTrees} from "@/ark-scene/forestry/forest-trees";
import {ForestGround, type GroundAt} from "@/ark-scene/forestry/forest-render";
import {awayInForest, crewAt, type CrewMember} from "@/ark-scene/forestry/forest-crews";
import type {TreeOverride} from "@/ark-scene/asset-trees";

/** The record's forestry, as the snapshot carries it (AnimalDex `voyage_config` forestry + forestry_from_day). */
export type ForestryRecord = {fromDay?: unknown; v?: unknown} | null | undefined;

/** The switch-on day, or null (off, or another version of the module than this one's). */
export function forestryFromDay(record: ForestryRecord): number | null {
    if (!record || typeof record !== "object") return null;
    const day = Number(record.fromDay);
    const v = record.v === undefined ? FORESTRY_VERSION : Number(record.v);
    return Number.isFinite(day) && day >= 0 && v === FORESTRY_VERSION ? day : null;
}

export type ForestHost = {
    /** `AssetTrees.setOverride` (null when the trees are not the asset library's). */
    setOverride: ((override: TreeOverride | null) => void) | null;
    ground: GroundAt;
    /** The humans aboard (ids), for the crews. */
    humans: () => readonly string[];
    /** Where the animals aboard live or sleep up in a tree (`ForestTrees`: those trees are left standing). */
    perches: () => ReadonlyArray<{x: number; z: number}>;
};

export class ForestScene {
    private trees: ForestTrees | null = null;
    private readonly earth: ForestGround;
    private fromDay: number | null = null;
    private crew: CrewMember[] = [];
    private day = -Infinity;
    private remark = false;
    /** The crews' figures (the town's people: the same look by id), drawn only while a crew is on site. */
    private readonly figures = new HumanFigures();
    private readonly drawn: HumanInstance[] = [];
    private readonly looks = new Map<string, HumanLook>();
    readonly group = new Group();

    constructor(private readonly host: ForestHost) {
        this.earth = new ForestGround(host.ground);
        this.group.add(this.earth.group, this.figures.group);
    }

    /** The record's forestry (each new snapshot). */
    setRecord(record: ForestryRecord) {
        const from = forestryFromDay(record);
        if (from === this.fromDay) return;
        this.fromDay = from;
        this.trees = from === null ? null : new ForestTrees(stands as unknown as StandTable, from, this.host.perches);
        this.host.setOverride?.(null);
        if (this.trees) this.day = -Infinity;
    }

    /** The roster changed (a new snapshot): the stands' trees are marked again (a newcomer's perch tree is kept). */
    rosterChanged() {
        this.remark = true;
    }

    /** A frame at the shared Ark day. */
    step(day: number | null) {
        if (!this.trees || day === null || !Number.isFinite(day)) {
            this.crew = [];
            return;
        }
        this.day = day;
        if (this.trees.setDay(day) || this.remark) {
            this.remark = false;
            this.trees.resetTrees();
            this.host.setOverride?.(this.trees.active.length ? this.trees.override() : null);
        }
        const loggings = this.trees.active;
        this.earth.update(loggings, this.trees.allTrees, day);
        const humans = this.host.humans();
        this.crew.length = 0;
        for (const g of loggings) for (const m of crewAt(g, this.trees.standTrees(g), humans, day)) this.crew.push(m);
    }

    /** Draw the crews (after `step`, with the camera): their figures at their places, posed by their work. */
    draw(camera: Vector3, seconds: number) {
        this.drawn.length = 0;
        for (const m of this.crew) {
            let look = this.looks.get(m.id);
            if (!look) {
                look = humanLook(m.id);
                this.looks.set(m.id, look);
            }
            this.drawn.push({x: m.x, y: this.host.ground(m.x, m.z), z: m.z, yaw: m.yaw, pose: m.pose, phase: m.phase, look});
        }
        if (this.drawn.length || this.figures.group.visible) this.figures.setFrame(this.drawn, camera, seconds);
        this.figures.group.visible = this.drawn.length > 0;
    }

    /** The crews now (to draw with the town's figures). */
    crews(): readonly CrewMember[] {
        return this.crew;
    }

    /** Whether a human is away in the forest now (the town leaves them out). */
    away(id: string): boolean {
        if (!this.trees) return false;
        return awayInForest(this.trees.active, this.host.humans(), id, this.day);
    }

    /** For the harness and tests: the stands in play and their state. */
    debug() {
        return {fromDay: this.fromDay, day: this.day, stands: this.trees?.active.map((g) => ({k: g.k, stand: g.stand.id, start: g.start, trees: this.trees!.standTrees(g).length})) ?? [], retained: this.trees?.retained ?? 0, crew: this.crew};
    }

    dispose() {
        this.host.setOverride?.(null);
        this.earth.dispose();
        this.figures.dispose();
    }
}
