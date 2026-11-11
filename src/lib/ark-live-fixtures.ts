/**
 * Test fixtures for the player-control tests (`ark-live-*.test.ts`): a small made-up island whose every cell is known,
 * a fake clock and fake links. Not used outside tests.
 *
 * The test island ("wild", 100 m square, x and z in [−50, 50]):
 * - land at height 0.5, grassland; desert for x < −30; polar for z > 20 (land only);
 * - the sea for x > 30, salt, getting deeper by 0.5 m a metre (to 10 m);
 * - a fresh lake round (−20, −20), radius 8, 2 m deep;
 * - a wall at x ∈ [0, 1), z ∈ [−10, 10): blocked;
 * - a cliff: for x ∈ [10, 14), z ∈ [−40, −30) the ground rises 2.25 m a metre (too steep to walk up);
 * - a tree at (5.5, −19.5): its trunk cell blocked, the cells round it climbable to 8 m;
 * - a zoo enclosure (pen 7) at x ∈ [−10, −5), z ∈ [30, 35); a smallholding's paddock (pen 100) at x ∈ [15, 20), z ∈ [−48, −43);
 * - soil on all grassland and desert land.
 */

import {CELL, WATER_KIND, type Terrain, type TerrainCell, type WaterKindCode} from "@/ark-live/terrain";
import type {IslandId} from "@/ark-live/islands";
import type {ArkZone} from "@/ark-scene/types";
import type {ClientLink, Room} from "@/ark-live/room";

export class GridTerrain implements Terrain {
    readonly half = 50;
    constructor(readonly island: IslandId = "wild") {}

    ground(x: number, z: number): number {
        if (x > 30) return 0 - Math.min((x - 30) * 0.5, 10);
        if (Math.hypot(x + 20, z + 20) < 8) return -2;
        if (x >= 10 && x < 14 && z >= -40 && z < -30) return 0.5 + (x - 10) * 2.25;
        if (x >= 14 && x < 20 && z >= -40 && z < -30) return 9.5;
        return 0.5;
    }

    cell(x: number, z: number): TerrainCell | null {
        if (Math.abs(x) >= this.half || Math.abs(z) >= this.half) return null;
        const cx = Math.floor(x) + 0.5;
        const cz = Math.floor(z) + 0.5;
        const height = this.ground(cx, cz);
        let water: WaterKindCode = WATER_KIND.NONE;
        let depth = 0;
        if (cx > 30) {
            water = WATER_KIND.SALT;
            depth = -height;
        } else if (Math.hypot(cx + 20, cz + 20) < 8) {
            water = WATER_KIND.FRESH;
            depth = 2;
        }
        const zone: ArkZone = depth > 0 ? (water === WATER_KIND.SALT ? "open_ocean" : "river_lake") : cz > 20 ? "polar" : cx < -30 ? "desert" : "grassland";
        const wall = cx >= 0 && cx < 1 && cz >= -10 && cz < 10;
        const trunk = Math.floor(x) === 5 && Math.floor(z) === -20;
        const nearTree = Math.hypot(cx - 5.5, cz + 19.5) < 1.6 && !trunk;
        let flags = 0;
        if (depth > 0) flags |= CELL.WATER;
        if (wall || trunk) flags |= CELL.BLOCKED;
        if (!wall && !trunk && depth <= 0) flags |= CELL.WALK;
        if (!wall && !trunk && depth <= 0 && (zone === "grassland" || zone === "desert")) flags |= CELL.SOIL;
        if (nearTree) flags |= CELL.CLIMB;
        if ((depth > 0 && depth < 0.6) || (depth <= 0 && height < 0.6)) flags |= CELL.SHORE;
        const pen = cx >= -10 && cx < -5 && cz >= 30 && cz < 35 ? 7 : cx >= 15 && cx < 20 && cz >= -48 && cz < -43 ? 100 : 0;
        const slope = cx >= 10 && cx < 14 && cz >= -40 && cz < -30 ? 2.25 : 0;
        return {height, flags, zone, depth, water, slope, pen, climbTop: nearTree ? 8 : 0};
    }

    height(x: number, z: number): number {
        return this.ground(x, z);
    }
}

export class FakeClock {
    constructor(public ms = 1_800_000_000_000) {}
    now = (): number => this.ms;
    advance(ms: number): void {
        this.ms += ms;
    }
}

export class FakeLink implements ClientLink {
    readonly texts: Array<Record<string, unknown>> = [];
    readonly binaries: ArrayBuffer[] = [];
    closed = false;
    room: Room | null = null;
    clientId: number | null = null;
    send(data: ArrayBuffer | string): void {
        if (typeof data === "string") this.texts.push(JSON.parse(data) as Record<string, unknown>);
        else this.binaries.push(data);
    }
    close(): void {
        this.closed = true;
    }
    rebind(room: Room, clientId: number): void {
        this.room = room;
        this.clientId = clientId;
    }
    last(t: string): Record<string, unknown> | undefined {
        for (let i = this.texts.length - 1; i >= 0; i--) if (this.texts[i].t === t) return this.texts[i];
        return undefined;
    }
    all(t: string): Array<Record<string, unknown>> {
        return this.texts.filter((m) => m.t === t);
    }
}

/** A key for tests only (32 bytes 0..31, base64): the contract's test vector key. */
export const TEST_KEY = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
export const USER_A = "00000000-0000-4000-8000-00000000000a";
export const USER_B = "00000000-0000-4000-8000-00000000000b";
export const ANIMAL_FOX = "00000000-0000-4000-8000-0000000000f0";
export const ANIMAL_FOX2 = "00000000-0000-4000-8000-0000000000f1";
export const ANIMAL_EAGLE = "00000000-0000-4000-8000-0000000000e0";
export const ANIMAL_SALMON = "00000000-0000-4000-8000-0000000000a0";
export const ANIMAL_ZOO = "00000000-0000-4000-8000-0000000000c0";
export const ANIMAL_GOAT = "00000000-0000-4000-8000-0000000000b0";
export const ANIMAL_DOLPHIN = "00000000-0000-4000-8000-0000000000d0";

/** Let pending promises (the store's) settle. */
export async function settle(times = 5): Promise<void> {
    for (let i = 0; i < times; i++) await new Promise((resolve) => setImmediate(resolve));
}
