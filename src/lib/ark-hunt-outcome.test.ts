import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {HUNT_OUTCOME_WINDOW, HuntOutcomes, caughtText, withoutEndedHunts} from "@/ark-scene/live/hunt-outcome";
import {ArkLiveLog, arkLiveLineText, type ArkLiveItem, type ArkLiveText} from "./ark-live-log";

const english = JSON.parse(readFileSync(path.join(__dirname, "..", "data", "locales", "en.json"), "utf8")).ark as ArkLiveText;
const item = (partial: Partial<ArkLiveItem> & Pick<ArkLiveItem, "id" | "key">): ArkLiveItem => ({kind: "arrival", source: "server", animal: "African Lion", other: null, count: 1, eggs: null, focus: {animalId: null, speciesId: null, zone: null}, ...partial});
const focus = (animalId: string) => ({animalId, speciesId: "lion", zone: null});
const hunting = (id: string) => item({id: `now:hunt:${id}`, key: "now:hunting:hunting:lion", kind: "hunting", source: "now", activity: "hunting", focus: focus(id)});
const meal = (id: string, hunter: string, other = "Plains Zebra") => item({id, key: `meal:lion:${other}`, kind: "meal", other, focus: focus(hunter)});

test("a hunt's outcome: the record's meal for a predator seen setting out says it caught its prey, and the hunting line gives way", () => {
    const outcomes = new HuntOutcomes();
    const log = new ArkLiveLog({gap: 0, seenGap: 0});
    log.push(outcomes.note([hunting("L1")], 0).items, 0);
    log.step(0);
    assert.equal(log.lines[0].kind, "hunting");
    // 40 minutes on, the record: L1 caught a zebra.
    const noted = outcomes.note([meal("m1", "L1")], 40 * 60_000);
    assert.deepEqual(noted.ended, ["L1"]);
    log.lines = withoutEndedHunts(log.lines, noted.ended);
    log.push(noted.items, 40 * 60_000);
    log.step(40 * 60_000);
    assert.equal(log.lines.some((l) => l.kind === "hunting"), false);
    const line = log.lines.find((l) => l.kind === "meal")!;
    assert.equal(caughtText(line, english), "An African Lion caught a Plains Zebra");
    // Another lion's meal, never seen hunting: the plain meal line.
    const plain = outcomes.note([meal("m2", "L2", "Blue Wildebeest")], 41 * 60_000).items[0];
    assert.equal(plain.hunted, undefined);
    assert.equal(caughtText(plain, english), null);
    assert.ok(arkLiveLineText(plain, english, "en").length > 0);
});

test("a hunt's outcome: past the window a meal is a plain meal; one hunt, one outcome; hearts lines keep their own words", () => {
    const outcomes = new HuntOutcomes();
    outcomes.note([hunting("L1")], 0);
    assert.equal(outcomes.note([meal("m1", "L1")], HUNT_OUTCOME_WINDOW + 1).items[0].hunted, undefined);
    outcomes.note([hunting("L1")], 0);
    assert.equal(outcomes.note([meal("m2", "L1")], 1000).items[0].hunted, true);
    assert.equal(outcomes.note([meal("m3", "L1")], 2000).items[0].hunted, undefined, "its next meal is another hunt's");
    assert.equal(caughtText({...meal("m4", "L1"), hunted: true, hearts: 2}, english), null);
});
