/**
 * Web spinning (handover §5, owner 2026-11-15: "spiders spin webs"): a web is not always there whole. Many orb
 * weavers take their web down and spin a new one every day; here each web is respun once an Ark day, at its own
 * moment (so the webs of a hedge never fill in together), thread by thread in the order a spider lays them:
 * the frame and anchor threads, the spokes one after another, then the sticky spiral from the rim in to the hub.
 * A function of the web's seed and the shared clock: every viewer sees the same web at the same stage. Acting only.
 */

/** A web's cycle (s): one Ark day (`ARK_DAY_MS`). */
export const WEB_CYCLE_SECONDS = (86_400 * 14) / 365;
/** How long the spinning takes (s): a real orb web takes half an hour to an hour; an Ark day is 55 minutes. */
export const WEB_BUILD_SECONDS = 240;

/** How much of a web is spun (0–1) at `epoch` (s). */
export function webBuilt(seed: number, epoch: number): number {
    const phase = (((epoch + seed * WEB_CYCLE_SECONDS) % WEB_CYCLE_SECONDS) + WEB_CYCLE_SECONDS) % WEB_CYCLE_SECONDS;
    return Math.min(phase / WEB_BUILD_SECONDS, 1);
}

const ANCHORS = 0.08;
const SPOKES = 0.35;

/** When a thread is laid (0–1 of the spinning): `i` of `n` of its kind. */
export function threadOrder(kind: "anchor" | "spoke" | "spiral", i: number, n: number): number {
    const u = n > 1 ? i / (n - 1) : 0;
    if (kind === "anchor") return ANCHORS * u * 0.9;
    if (kind === "spoke") return ANCHORS + (SPOKES - ANCHORS) * u * 0.98;
    // The spiral is laid from the rim inward: the outermost turn first.
    return SPOKES + (1 - SPOKES) * (1 - u);
}
