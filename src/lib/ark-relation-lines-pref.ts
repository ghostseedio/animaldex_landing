/**
 * The "Around it" lines' switch (lane ark-relation-lines): the viewer's choice, kept in this browser, on by default. Its
 * own small module (lane ARK-SIMPLE) because the switch now sits over the world beside the sound button (`ark-world-tools.tsx`,
 * in the page's first JavaScript) while the lines and the card's relations load lazily: a change is told to the card
 * with a window event.
 */
export const ARK_RELATION_LINES_KEY = "ark.relationLines";
export const ARK_RELATION_LINES_EVENT = "ark:relation-lines";

export function arkRelationLinesOn(): boolean {
    try {
        return window.localStorage.getItem(ARK_RELATION_LINES_KEY) !== "0";
    } catch {
        return true;
    }
}

export function arkSetRelationLinesOn(on: boolean): void {
    try {
        window.localStorage.setItem(ARK_RELATION_LINES_KEY, on ? "1" : "0");
    } catch {
        // (Private window or storage blocked: the choice lasts this visit only.)
    }
    try {
        window.dispatchEvent(new CustomEvent(ARK_RELATION_LINES_EVENT, {detail: on}));
    } catch {
        // (No CustomEvent: the card reads the stored choice when it opens next.)
    }
}
