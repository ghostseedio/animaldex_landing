/**
 * The world the measure page mounts (`measure-entry.ts` imports this first, so `world.ts` reads the answer before any
 * of the scene's modules sample the world). `?world=v1|v2` wins; otherwise `?islands=1` is islands mode as live has it
 * (`ARK_LIVE_WILD_ISLAND`, as `archipelago.ts` chooses it), and one island is today's world (`v1`, islands off).
 *
 * Before decision 287's fix the page called `mountArk` with `?islands=1` and no world, so the heap gate measured the
 * v1 wild island beside the town, not the live v2.
 */

import {ARK_LIVE_WILD_ISLAND} from "@/ark-scene/islands/wild-default";

export function arkMeasureWorld(search: string): "v1" | "v2" {
    const params = new URLSearchParams(search);
    const asked = params.get("world");
    if (asked === "v1" || asked === "v2") return asked;
    return params.get("islands") === "1" ? ARK_LIVE_WILD_ISLAND : "v1";
}

// (In the page only: `world.ts` takes `__ARK_WORLD__` first, as a test's `ark-world-v2-first.ts` sets it.)
if (typeof location !== "undefined") (globalThis as {__ARK_WORLD__?: string}).__ARK_WORLD__ = arkMeasureWorld(location.search);
