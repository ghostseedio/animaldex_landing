/**
 * "Estimated time left" in plain DOM, for Ark Lite (`ark-scene/lite/lite-view.ts`, which has no React): the same
 * estimate and the same words as the 3D Ark's card (`ark-time-left.tsx`), drawn into the slot a reader's own animal card
 * leaves for it. Imported lazily, only when an animal that could be at risk is shown; the slot stays empty otherwise.
 */

import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {arkTimeLeftText, arkTimeLeftWordsFrom, arkTimeLeftWorldOf} from "@/lib/ark-time-left";
import {arkTimeLeftFetch, arkTimeLeftFor, type ArkTimeLeftFetch} from "@/lib/ark-time-left-facts";

type Loose = Record<string, unknown> | null | undefined;

/** Fills `slot` with the estimate for `animal` once it is worked out; `isLive` says the slot is still on the page. */
export async function fillArkTimeLeft(slot: HTMLElement, animal: ArkAnimal, snapshot: ArkSnapshot | null, words: Loose, locale: string, isLive: () => boolean = () => true, fetchJson: ArkTimeLeftFetch = arkTimeLeftFetch): Promise<void> {
    const world = arkTimeLeftWorldOf(snapshot);
    if (!world) return;
    const result = await arkTimeLeftFor(animal, world, fetchJson).catch(() => null);
    if (!result || !isLive()) return;
    const {words: w, units} = arkTimeLeftWordsFrom(words?.timeLeft, words?.life);
    const text = arkTimeLeftText(result, w, units, locale);
    const box = document.createElement("section");
    box.className = "arkl-tl";
    box.dataset.testid = "ark-lite-time-left";
    box.setAttribute("aria-label", text.label);
    const head = document.createElement("p");
    head.className = "hd";
    const title = document.createElement("span");
    title.className = "tt";
    title.textContent = text.title;
    title.title = text.hint;
    const value = document.createElement("span");
    value.className = "vv";
    value.textContent = text.value;
    head.append(title, document.createTextNode(" "), value);
    box.appendChild(head);
    if (text.reasons.length) {
        const list = document.createElement("ul");
        for (const reason of text.reasons) {
            const item = document.createElement("li");
            item.textContent = reason;
            list.appendChild(item);
        }
        box.appendChild(list);
    }
    const hint = document.createElement("p");
    hint.className = "nn";
    hint.textContent = text.hint;
    box.appendChild(hint);
    slot.replaceChildren(box);
}
