/**
 * The life block (age, life stage, a life bar and "Estimated time left") in plain DOM, for Ark Lite
 * (`ark-scene/lite/lite-view.ts`, which has no React): the same outlook and the same words as the 3D Ark's card
 * (`ark-time-left.tsx`), drawn into the slot a reader's own animal card leaves for it, for any of their animals. Imported
 * lazily, when an animal is shown; the slot stays empty when nothing is known of it.
 */

import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {arkLifeText, arkTimeLeftWordsFrom, arkTimeLeftWorldOf} from "@/lib/ark-time-left";
import {arkLifeOutlookFor, arkTimeLeftFetch, type ArkTimeLeftFetch} from "@/lib/ark-time-left-facts";

type Loose = Record<string, unknown> | null | undefined;

const el = (tag: string, className?: string, text?: string): HTMLElement => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
};

/** Fills `slot` with the block for `animal` once it is worked out; `isLive` says the slot is still on the page. */
export async function fillArkTimeLeft(slot: HTMLElement, animal: ArkAnimal, snapshot: ArkSnapshot | null, words: Loose, locale: string, isLive: () => boolean = () => true, fetchJson: ArkTimeLeftFetch = arkTimeLeftFetch): Promise<void> {
    const world = arkTimeLeftWorldOf(snapshot);
    if (!world) return;
    const outlook = await arkLifeOutlookFor(animal, world, fetchJson).catch(() => null);
    if (!outlook || !isLive()) return;
    const {words: w, units} = arkTimeLeftWordsFrom(words?.timeLeft, words?.life);
    const text = arkLifeText(outlook, w, units, locale);
    const box = el("section", "arkl-tl");
    box.dataset.testid = "ark-lite-time-left";
    box.dataset.tone = outlook.tone;
    box.setAttribute("aria-label", text.label);
    if (text.age) {
        const line = el("p", "ag");
        line.append(el("i", "sw"), document.createTextNode(text.age));
        box.appendChild(line);
    }
    if (outlook.bar) {
        // Drawn only (the section's label says it in words). A flex row, so a right-to-left page mirrors it.
        const bar = el("div", "bar");
        bar.setAttribute("aria-hidden", "true");
        const done = el("span", "done");
        done.style.width = `${(outlook.bar.now * 100).toFixed(2)}%`;
        const end = el("span", "end");
        end.style.width = `${((1 - outlook.bar.from) * 100).toFixed(2)}%`;
        bar.append(done, el("span", "tick"), el("span", "gap"), end);
        box.appendChild(bar);
    }
    const left = text.left;
    if (left) {
        // Open when the reasons say more than "its kind's lifespan" (it could be hunted or hungry, or it is old); a healthy animal with only old age ahead folds them away.
        const more = el("details") as HTMLDetailsElement;
        more.open = outlook.tone === "risk" || Boolean(outlook.left?.reasons.some((reason) => reason.kind !== "age"));
        const head = el("summary", "hd");
        const title = el("span", "tt");
        title.append(el("i", "sw end"), document.createTextNode(left.title));
        title.title = left.hint;
        head.append(title, document.createTextNode(" "), el("span", "vv", left.value));
        more.appendChild(head);
        const chance = text.chance;
        if (chance) {
            // The chance to live another Ark year and how it moved in a day, always shown beside the estimate (the summary); its reason and how it is worked out unfold.
            const row = el("div", "ch");
            row.dataset.testid = "ark-lite-chance";
            const label = el("span", "tt", chance.title);
            label.title = chance.how;
            row.append(label, document.createTextNode(" "), el("span", "vv", chance.value));
            head.appendChild(row);
            if (chance.trend) {
                const trend = el("div", `tr ${chance.trend.direction}`);
                trend.dataset.direction = chance.trend.direction;
                trend.append(el("i", "ar", chance.trend.direction === "up" ? "▲" : chance.trend.direction === "down" ? "▼" : "▬"), document.createTextNode(chance.trend.text));
                head.appendChild(trend);
            }
            if (chance.main) more.appendChild(el("p", "mn", chance.main));
        }
        if (text.power) more.appendChild(el("p", "mn pw", text.power.text));
        if (text.thrive) more.appendChild(el("p", "nn", text.thrive));
        const reasons = left.reasons.filter((reason) => reason !== chance?.mainReason && reason !== chance?.trend?.cause);
        if (reasons.length) {
            const list = el("ul");
            for (const reason of reasons) list.appendChild(el("li", undefined, reason));
            more.appendChild(list);
        }
        if (chance) more.appendChild(el("p", "nn", chance.how));
        more.appendChild(el("p", "nn", left.hint));
        box.appendChild(more);
    }
    slot.replaceChildren(box);
}
