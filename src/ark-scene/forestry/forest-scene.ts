/**
 * Logging and replanting in the live scene (p5 humans; AnimalDex decision 379): the one object `index.ts` holds. It reads
 * the record's switch-on day (the snapshot's `forestry.fromDay`; absent = no forestry, nothing drawn or changed), and
 * each frame, from the shared Ark day: marks the stands' trees for `AssetTrees` (felling, felled, saplings), draws the
 * stumps and the bared earth (`forest-render.ts`), and hands the host the crews to draw (`forest-crews.ts`: humans the
 * record has aboard). The deaths are the server's (`deforested` events): the scene draws their bodies through
 * `live-deaths.ts` where the server judged them.
 */

import type {Group} from "three";
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
};

export class ForestScene {
    private trees: ForestTrees | null = null;
    private readonly earth: ForestGround;
    private fromDay: number | null = null;
    private crew: CrewMember[] = [];
    private day = -Infinity;

    constructor(private readonly host: ForestHost) {
        this.earth = new ForestGround(host.ground);
    }

    get group(): Group {
        return this.earth.group;
    }

    /** The record's forestry (each new snapshot). */
    setRecord(record: ForestryRecord) {
        const from = forestryFromDay(record);
        if (from === this.fromDay) return;
        this.fromDay = from;
        this.trees = from === null ? null : new ForestTrees(stands as unknown as StandTable, from);
        this.host.setOverride?.(null);
        if (this.trees) this.day = -Infinity;
    }

    /** A frame at the shared Ark day. */
    step(day: number | null) {
        if (!this.trees || day === null || !Number.isFinite(day)) {
            this.crew = [];
            return;
        }
        this.day = day;
        if (this.trees.setDay(day)) {
            this.trees.resetTrees();
            this.host.setOverride?.(this.trees.active.length ? this.trees.override() : null);
        }
        const loggings = this.trees.active;
        const all = loggings.flatMap((g) => this.trees!.standTrees(g));
        this.earth.update(loggings, all, day);
        const humans = this.host.humans();
        this.crew = loggings.flatMap((g) => crewAt(g, this.trees!.standTrees(g), humans, day));
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
        return {fromDay: this.fromDay, day: this.day, stands: this.trees?.active.map((g) => ({k: g.k, stand: g.stand.id, start: g.start, trees: this.trees!.standTrees(g).length})) ?? [], crew: this.crew};
    }

    dispose() {
        this.host.setOverride?.(null);
        this.earth.dispose();
    }
}
