/**
 * Dung (handover §5, owner 2026-11-15: "there's currently no pooping in the game, and sometimes animals will sniff
 * their poop after"). Acting only, never a record: a land mammal leaves a small dark mark where its day has it, at
 * moments that are a function of its id and the shared clock (so every viewer sees the same marks in the same places),
 * and the mark fades. Kept tasteful: a few small dark pellets or a pat, lit like the ground, nothing more.
 *
 * How often is real, by what it eats (droppings a day; an Ark day stands for a day):
 *   plant eaters   ~12   (cattle 10–15, horses 8–12, deer ~13 pellet groups, elephants 15–20: husbandry and
 *                         pellet-count field figures)
 *   mixed feeders   ~5
 *   meat and fish   ~2   (dogs and cats 1–3)
 * An animal that is standing still when its moment comes pauses for it (a carnivore squats), and sometimes turns and
 * sniffs it after; one on the move leaves it as it walks, as cattle and horses do.
 */

import type {ActPose} from "@/ark-scene/acts";

export type DungDiet = "plants" | "mixed" | "meat";

/** Droppings per Ark day. */
export const DUNG_PER_DAY: Record<DungDiet, number> = {plants: 12, mixed: 5, meat: 2};
/** A mark's life (s): fresh, then fading over its last third (beetles, rain and the sun take it). */
export const DUNG_LIFE_SECONDS = 20 * 60;
export const DUNG_PAUSE_SECONDS = 5;
export const DUNG_SNIFF_SECONDS = 4;
/** How often one that paused turns and sniffs it after (owner: "sometimes"). */
const SNIFF_SHARE = 0.35;

/** Who leaves dung the viewer can see: land mammals big enough (their rig's plan, their drawn length in m). */
export function leavesDung(plan: string | null, length: number, inWater: boolean): boolean {
    return !inWater && (plan === "quadruped" || plan === "primate") && length >= 0.25;
}

/** Its diet's group from its behaviour profile's diet (`behaviours.json`). */
export function dungDiet(diet: string | null | undefined): DungDiet {
    if (diet === "grazer" || diet === "browser" || diet === "fruit" || diet === "seeds" || diet === "algae" || diet === "nectar") return "plants";
    if (diet === "meat" || diet === "fish" || diet === "carrion" || diet === "blood") return "meat";
    return "mixed";
}

function unit(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    return ((h >>> 0) % 100000) / 100000;
}

export type DungDrop = {key: string; slot: number; at: number};

/** Its droppings still on the ground at `epoch` (s): when each fell. `daySeconds`: an Ark day in real seconds. */
export function dungDrops(id: string, diet: DungDiet, epoch: number, daySeconds: number): DungDrop[] {
    const period = daySeconds / DUNG_PER_DAY[diet];
    const offset = unit(`dung:${id}`) * period;
    const last = Math.floor((epoch - offset) / period);
    const out: DungDrop[] = [];
    for (let slot = last; slot >= 0; slot--) {
        // (Each a little early or late, so a herd's never fall in step.)
        const at = slot * period + offset + (unit(`dung:${id}:${slot}`) - 0.5) * period * 0.5;
        if (at > epoch) continue;
        if (epoch - at > DUNG_LIFE_SECONDS) break;
        out.push({key: `dung:${id}:${slot}`, slot, at});
    }
    return out;
}

/** A mark's strength from its age (s): full, then fading over the last third. */
export function dungAlpha(age: number): number {
    if (age < 0 || age >= DUNG_LIFE_SECONDS) return 0;
    const fade = DUNG_LIFE_SECONDS / 3;
    return age < DUNG_LIFE_SECONDS - fade ? 1 : (DUNG_LIFE_SECONDS - age) / fade;
}

/** Whether it turns and sniffs this one after. */
export function sniffsAfter(key: string): boolean {
    return unit(`${key}:sniff`) < SNIFF_SHARE;
}

/**
 * Its pose while it pauses for one (`s` seconds since it fell, at the mark `p`, facing `yaw`), or null when over.
 * A meat eater squats (its rear lowered); a plant eater just stands. Then, sometimes, it turns and sniffs.
 */
export function dungPose(p: {x: number; z: number}, yaw: number, base: number, diet: DungDiet, length: number, key: string, s: number): ActPose | null {
    const sniff = sniffsAfter(key);
    const end = DUNG_PAUSE_SECONDS + (sniff ? DUNG_SNIFF_SECONDS + 1.5 : 0);
    if (s < 0 || s >= end) return null;
    // (It stands a little ahead of the mark: the mark is under its tail.)
    const ahead = {x: p.x + Math.sin(yaw) * length * 0.5, z: p.z + Math.cos(yaw) * length * 0.5};
    const mk = (yawNow: number, state: string, pitch: number): ActPose => ({x: ahead.x, z: ahead.z, base, yaw: yawNow, pitch, roll: 0, scale: 1, dim: 0, hidden: false, state, speed: 0});
    if (s < DUNG_PAUSE_SECONDS) {
        const k = Math.min(s / 0.8, 1, (DUNG_PAUSE_SECONDS - s) / 0.8);
        return mk(yaw, "scan", diet === "plants" ? 0 : -0.16 * Math.max(k, 0));
    }
    const t = s - DUNG_PAUSE_SECONDS;
    const turn = Math.min(t / 1.5, 1);
    const e = turn * turn * (3 - 2 * turn);
    return {...mk(yaw + Math.PI * e, turn < 1 ? "walk" : "eat", turn < 1 ? 0 : 0.12), x: ahead.x - Math.sin(yaw) * length * 0.25 * e, z: ahead.z - Math.cos(yaw) * length * 0.25 * e, meal: undefined};
}
