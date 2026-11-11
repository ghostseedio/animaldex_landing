/**
 * Phase 2 (design §3.5): NPC reactions near players, worked out once on the server and shared by everyone.
 *
 * A hot area is everything within 40 m of a controlled animal. At 5 Hz, every NPC there is posed by the shared
 * schedule (`npc-world.ts`) and run through the scene's own reactive envelope (`reactive.ts`: perceive, notice delay,
 * flight distance × threat, the flee reach, flee speed, watch and alert) with the controlled animals among the
 * animals it can see. Only reactions that move or turn it, or alarm it, go out (the `npc` message): every viewer
 * applies the same offset to the same schedule pose, and turns off its own local reaction for that NPC.
 *
 * The camera is never a stimulus here (a viewer's curiosity stays local). Pure.
 */

import {ReactiveLayer, type ReactiveOut, type ReactiveWeather} from "@/ark-scene/reactive";
import {reactiveWorldQueries, type ReactiveWorldQueries} from "@/ark-scene/reactive-world";
import type {ArkWorldSampler} from "@/ark-scene/world-sampler";
import {islandHours} from "@/lib/ark-clock";
import {daylightAt} from "@/lib/ark-daylight";
import type {NpcWorld, NpcPose} from "@/ark-live/npc-world";
import type {Mode} from "@/ark-live/protocol";

export const HOT_RADIUS = 40;
export const NPC_HZ = 5;
/** The reactive actions, in wire order (`npc` message `doing`). */
export const REACTIVE_ACTIONS = ["off", "asleep", "aloft", "scan", "feed", "drink", "look_kin", "approach_kin", "groom", "doze", "watch_camera", "investigate_camera", "back_off_camera", "play", "shelter", "use_tool", "cache_bury", "cache_return", "follow_mixed", "wait_turn", "sentinel", "alert", "freeze", "flee", "threat_display", "play_dead", "shield_young", "hide_behind_parent", "stalk", "watch_prey", "recover", "startle", "withdraw"] as const;
/** Actions that matter to everyone (a reaction to someone, not an NPC's own quiet business). */
const SHARED = new Set<string>(["alert", "freeze", "flee", "threat_display", "play_dead", "shield_young", "hide_behind_parent", "stalk", "watch_prey", "recover", "startle", "withdraw", "sentinel"]);

export type ControlledActor = {id: string; x: number; y: number; z: number; yaw: number; speed: number; mode: Mode};
export type SharedReaction = {id: string; out: ReactiveOut; pose: NpcPose};

export class NpcReactions {
    private readonly layer = new ReactiveLayer({tier: "high"});
    private readonly queries: ReactiveWorldQueries;
    weather: ReactiveWeather = {rain: 0, wind: 0.3, windDirection: 0, fog: 0, storm: 0};
    lastMs = 0;
    lastCount = 0;

    constructor(private readonly world: NpcWorld, sampler: ArkWorldSampler) {
        this.queries = reactiveWorldQueries(sampler, this.layer.budget.sightSamples);
    }

    /** One step: the reactions of the NPCs in every hot area. */
    step(controlled: ControlledActor[], epochSeconds: number, dt: number): SharedReaction[] {
        const started = typeof performance !== "undefined" ? performance.now() : Date.now();
        if (!controlled.length) return [];
        const ids = new Set<string>();
        const poses = new Map<string, NpcPose>();
        const hot = new Set(controlled.map((c) => c.id));
        for (const c of controlled) {
            for (const id of this.world.candidates(c.x, c.z, HOT_RADIUS)) {
                if (hot.has(id) || ids.has(id)) continue;
                const pose = this.world.poseAt(id, epochSeconds);
                if (!pose) continue;
                if (controlled.some((k) => Math.hypot(k.x - pose.x, k.z - pose.z) <= HOT_RADIUS)) {
                    ids.add(id);
                    poses.set(id, pose);
                }
            }
        }
        const inputs = [];
        for (const id of Array.from(ids)) {
            const input = this.world.reactiveInput(id, poses.get(id)!);
            if (input) inputs.push(input);
        }
        // The controlled animals: seen as they are drawn now, moving as they move.
        for (const c of controlled) {
            const input = this.world.reactiveInput(c.id, {x: c.x, y: c.y, z: c.z, yaw: c.yaw, moving: c.speed > 0.05, aloft: c.mode === "air", doing: c.speed > 0.05 ? "wander" : "rest", spot: null});
            if (input) inputs.push({...input, acting: true});
        }
        const hours = islandHours(epochSeconds * 1000, 0);
        const out = this.layer.step(inputs, {now: epochSeconds, dt, hours, night: (daylightAt(hours) as unknown as {night?: number}).night ?? 0, weather: this.weather, camera: null, focus: controlled.map((c) => ({x: c.x, z: c.z})), sight: this.queries.sight, refuge: this.queries.refuge});
        const shared: SharedReaction[] = [];
        out.forEach((o, id) => {
            if (hot.has(id)) return;
            const pose = poses.get(id);
            if (!pose) return;
            if (SHARED.has(o.action) || Math.abs(o.dx) + Math.abs(o.dz) > 0.02 || Math.abs(o.bodyYaw) > 0.05) shared.push({id, out: o, pose});
        });
        this.lastCount = inputs.length;
        this.lastMs = (typeof performance !== "undefined" ? performance.now() : Date.now()) - started;
        return shared;
    }
}

export function actionCode(action: string): number {
    const i = (REACTIVE_ACTIONS as readonly string[]).indexOf(action);
    return i < 0 ? 0 : i;
}
