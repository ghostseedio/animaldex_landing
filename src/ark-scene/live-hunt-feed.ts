/**
 * The live meals' feed and the hunt marker, shared by /ark and the apps' embed (lane ark-kills-real).
 *
 * - `arkSyncMeals`: after each hunting read, the meals the live world may still be acting (their step in the last
 *   two hours) joined to the event log's records of the two animals, handed to the scene (`setMeals`); the event log is
 *   read once per new set of meals.
 * - `mountArkHuntMarker`: the embed's marker, drawn inside the page (the scene's own overlay, top start, under the
 *   host's top inset like the sound button): one small chip for the newest real hunt or meal under way; tapped, the
 *   camera flies there. /ark draws its own chip in React (`ark-view.tsx`) from the same scene call.
 */

import type {ArkSceneHandle} from "@/ark-scene/types";
import type {ArkHunting} from "@/lib/ark-hunting";
import {decodeArkEvents} from "@/lib/ark-life";
import {arkHuntLine, arkLiveMealsFrom, ARK_LIVE_MEAL_SECONDS} from "@/lib/ark-live-hunt";
import type {ArkWords} from "@/lib/ark-words";

type Scene = Pick<ArkSceneHandle, "setMeals" | "liveHunt" | "select">;

const asked = new WeakMap<object, string>();

/** The read's live meals to the scene (one event-log read per new set). `snapshot` decodes the records' animals. */
export function arkSyncMeals(scene: Scene | null, read: ArkHunting | null, options: {eventsUrl?: string; snapshot?: Parameters<typeof decodeArkEvents>[1]; fetch?: typeof fetch} = {}): void {
    if (!scene?.setMeals) return;
    const now = Date.now() / 1000;
    const live = (read?.meals ?? []).filter((meal) => typeof meal.encounter.t === "number" && meal.encounter.t > now - ARK_LIVE_MEAL_SECONDS && meal.encounter.t <= now + 60);
    const key = live.map((meal) => meal.id).sort().join(",");
    if (asked.get(scene) === key) return;
    asked.set(scene, key);
    if (!live.length) {
        scene.setMeals([]);
        return;
    }
    const since = Math.min(...live.map((meal) => meal.encounter.t as number)) - 600;
    const get = options.fetch ?? fetch;
    void get(`${options.eventsUrl ?? "/api/ark/events"}?since=${encodeURIComponent(new Date(since * 1000).toISOString())}`, {cache: "no-store"})
        .then((response) => (response.ok ? response.json() : {events: []}))
        .then((body: {events?: unknown}) => scene.setMeals?.(arkLiveMealsFrom(live, decodeArkEvents(body.events ?? [], options.snapshot ?? null))))
        .catch(() => asked.delete(scene));
}

const STYLE = `#ark-hunt{position:fixed;inset-inline-start:calc(10px + env(safe-area-inset-left));top:calc(10px + env(safe-area-inset-top) + var(--ark-inset-top, 0px));max-width:calc(100vw - 72px);height:36px;display:flex;align-items:center;gap:8px;padding:0 12px;border:0;border-radius:18px;background:rgba(20,24,22,0.55);color:#fff;font:600 12.5px/1.2 system-ui,-apple-system,sans-serif;-webkit-tap-highlight-color:transparent;z-index:3}
#ark-hunt[hidden]{display:none}
[dir="rtl"] #ark-hunt{inset-inline-start:calc(10px + env(safe-area-inset-right))}
#ark-hunt .dot{width:8px;height:8px;border-radius:4px;background:#f2b25c;flex:none}
#ark-hunt .text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}`;

/** The embed's marker chip: polls the scene once a second; `words()` the Ark's words when read (English until then). */
export function mountArkHuntMarker(scene: () => Scene | null, words: () => Pick<ArkWords, "hunt"> | null): {dispose: () => void} {
    const style = document.createElement("style");
    style.textContent = STYLE;
    document.head.appendChild(style);
    const button = document.createElement("button");
    button.id = "ark-hunt";
    button.type = "button";
    button.hidden = true;
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.className = "text";
    button.append(dot, text);
    document.body.appendChild(button);
    let id: string | null = null;
    button.addEventListener("click", () => {
        if (id) scene()?.select(id);
    });
    const tick = () => {
        const hunt = scene()?.liveHunt?.() ?? null;
        id = hunt?.id ?? null;
        button.hidden = !hunt;
        if (!hunt) return;
        const w = words() ?? {};
        const line = arkHuntLine(w, hunt, "line");
        if (text.textContent !== line) text.textContent = line;
        button.setAttribute("aria-label", arkHuntLine(w, hunt, "label"));
    };
    const timer = setInterval(tick, 1000);
    return {
        dispose: () => {
            clearInterval(timer);
            button.remove();
            style.remove();
        }
    };
}
