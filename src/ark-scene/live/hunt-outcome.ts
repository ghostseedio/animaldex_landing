/**
 * A hunt's outcome in the live log (handover §5: "some logs say 'hunting' but never later says whether it was
 * successful"). The "is hunting" line is a seen moment (encounter hunting's foray beginning); the record's meal for
 * that same predator, when it comes, is that hunt's outcome: said as "A Lion caught a Plains Zebra", and the hunting
 * line (if still up) gives way to it. A hunt with no meal in the record stays the seen line alone; an escape waits
 * for the record's own (behaviours plan P3).
 *
 * Here, with the scene, and not in `src/lib/ark-live-log.ts`: the Ark page's static JavaScript has a 200 KB budget
 * (`ark-page-weight.test.ts`) and this loads with the scene instead.
 */

import {arkWithArticle, type ArkLiveItem, type ArkLiveLine, type ArkLiveText} from "@/lib/ark-live-log";
import {fillArkWords} from "@/lib/ark-words";

/** A record meal within this long (ms) of its predator's hunting line is that hunt's outcome (a foray lasts up to ~70 min). */
export const HUNT_OUTCOME_WINDOW = 90 * 60_000;
const CAUGHT_ENGLISH = "{aPredator} caught {aPrey}";
const WEB_CAUGHT_ENGLISH = "{aPredator} caught {aPrey} in its web";

export class HuntOutcomes {
    /** Predators seen setting out to hunt: animal id -> when (ms). */
    private hunts = new Map<string, number>();

    /** The items as the log should take them: a meal that ends a seen hunt is marked; `ended`: hunters whose hunting line gives way. */
    note(items: readonly ArkLiveItem[], now: number): {items: ArkLiveItem[]; ended: string[]} {
        this.hunts.forEach((at, id) => {
            if (now - at > HUNT_OUTCOME_WINDOW) this.hunts.delete(id);
        });
        const ended: string[] = [];
        const out = items.map((item) => {
            const hunter = item.focus.animalId;
            if (!hunter) return item;
            if (item.source === "now" && item.kind === "hunting") this.hunts.set(hunter, now);
            else if (item.source === "server" && item.kind === "meal" && this.hunts.delete(hunter)) {
                ended.push(hunter);
                return {...item, hunted: true};
            }
            return item;
        });
        return {items: out, ended};
    }
}

/** The lines without the hunting lines of hunters whose hunt has ended (their outcome is coming). */
export function withoutEndedHunts(lines: ArkLiveLine[], ended: readonly string[]): ArkLiveLine[] {
    return ended.length ? lines.filter((l) => !(l.kind === "hunting" && l.focus.animalId !== null && ended.includes(l.focus.animalId))) : lines;
}

/**
 * "A Lion caught a Plains Zebra", or null when the line is not a single caught meal (hearts lines keep their own words).
 * ARK-WEBS: a meal the server says was caught in a web (`web`, from its `encounter.web`) is said so, hunted or not:
 * "A Common House Spider caught a House Fly in its web".
 */
export function caughtText(line: Pick<ArkLiveItem, "kind" | "animal" | "other" | "count"> & Partial<Pick<ArkLiveItem, "hunted" | "hearts" | "web">>, words: ArkLiveText): string | null {
    if (!(line.hunted || line.web) || line.kind !== "meal" || line.count > 1 || typeof line.hearts === "number" || !line.other) return null;
    const template = line.web ? words.live.webCaught ?? WEB_CAUGHT_ENGLISH : words.live.caught ?? CAUGHT_ENGLISH;
    const text = fillArkWords(template, {aPredator: arkWithArticle(line.animal, words), aPrey: arkWithArticle(line.other, words)});
    return text ? text[0].toLocaleUpperCase() + text.slice(1) : text;
}
