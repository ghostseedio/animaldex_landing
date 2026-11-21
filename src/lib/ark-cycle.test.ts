/** Toggle through a species (lane ARK-CYCLE, owner 2026-11-21): the card's ‹ 1 of 2 › over the focused animal's kind. */

import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {arkCycleKey, arkCycleOf, arkCycleStep} from "@/lib/ark-cycle";
import {ARK_CARD_ENGLISH} from "@/lib/ark-animal-status";

function animal(id: string, over: Partial<ArkAnimal> = {}): ArkAnimal {
    return {id, species_profile_id: "komodo", model_slug: "komodo-dragon", name: "Komodo Dragon", arrived_at: "2026-11-01T00:00:00Z", mine: false, island: "wild", ...over} as unknown as ArkAnimal;
}
function ark(animals: ArkAnimal[]): Pick<ArkSnapshot, "animals" | "islands" | "island"> {
    return {animals} as Pick<ArkSnapshot, "animals" | "islands" | "island">;
}

test("cycle order: by arrival, then id, and the same whichever one is focused", () => {
    const snapshot = ark([animal("c", {arrived_at: "2026-11-03T00:00:00Z"}), animal("a", {arrived_at: "2026-11-02T00:00:00Z"}), animal("b", {arrived_at: "2026-11-02T00:00:00Z"}), animal("z", {species_profile_id: "zebra", model_slug: "zebra"})]);
    const fromA = arkCycleOf(snapshot, "a");
    const fromC = arkCycleOf(snapshot, "c");
    assert.deepEqual(fromA?.ids, ["a", "b", "c"]);
    assert.deepEqual(fromC?.ids, fromA?.ids);
    assert.equal(fromA?.index, 0);
    assert.equal(fromC?.index, 2);
    assert.equal(fromC?.count, 3);
});

test("wraps round at both ends", () => {
    const snapshot = ark([animal("a", {arrived_at: "2026-11-01T00:00:00Z"}), animal("b", {arrived_at: "2026-11-02T00:00:00Z"})]);
    const first = arkCycleOf(snapshot, "a")!;
    assert.equal(arkCycleStep(first, 1), "b");
    assert.equal(arkCycleStep(first, -1), "b");
    const last = arkCycleOf(snapshot, "b")!;
    assert.equal(arkCycleStep(last, 1), "a");
    assert.equal(arkCycleStep(last, -1), "a");
});

test("no chevrons for the only one of its kind, an unknown id or no snapshot", () => {
    const snapshot = ark([animal("a"), animal("z", {species_profile_id: "zebra", model_slug: "zebra"})]);
    assert.equal(arkCycleOf(snapshot, "a"), null);
    assert.equal(arkCycleOf(snapshot, "gone"), null);
    assert.equal(arkCycleOf(null, "a"), null);
    assert.equal(arkCycleOf(snapshot, null), null);
});

test("both islands: the wild island's first, then the town's; a breed counts as its kind", () => {
    const dog = {species_profile_id: "lab", model_slug: "labrador", kind_species_profile_id: "dog"};
    const snapshot = ark([
        animal("town-old", {...dog, island: "town", area: "house", arrived_at: "2026-10-01T00:00:00Z"}),
        animal("wild-new", {species_profile_id: "dingo", model_slug: "dingo", kind_species_profile_id: "dog", island: "wild", arrived_at: "2026-11-05T00:00:00Z"}),
        animal("town-new", {...dog, species_profile_id: "beagle", island: "town", area: "farm", arrived_at: "2026-11-06T00:00:00Z"})
    ]);
    const cycle = arkCycleOf(snapshot, "town-new")!;
    assert.deepEqual(cycle.ids, ["wild-new", "town-old", "town-new"]);
    assert.equal(cycle.index, 2);
    assert.equal(arkCycleStep(cycle, 1), "wild-new");
});

test("one island (the switch off): arrival order alone", () => {
    const snapshot = ark([animal("b", {island: undefined, area: "house", arrived_at: "2026-11-01T00:00:00Z"}), animal("a", {island: undefined, arrived_at: "2026-11-02T00:00:00Z"})]);
    assert.deepEqual(arkCycleOf(snapshot, "a")?.ids, ["b", "a"]);
});

test("My animals on: only the reader's own (and the focused one)", () => {
    const snapshot = ark([animal("a", {mine: true}), animal("b"), animal("c", {mine: true, arrived_at: "2026-11-09T00:00:00Z"})]);
    assert.deepEqual(arkCycleOf(snapshot, "a", {mineOnly: true})?.ids, ["a", "c"]);
    assert.equal(arkCycleOf(ark([animal("a", {mine: true}), animal("b")]), "a", {mineOnly: true}), null);
});

test("arrow keys: ← back, → on (flipped right to left); never while typing or with a modifier", () => {
    const key = (k: string, over: Record<string, unknown> = {}) => ({key: k, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, defaultPrevented: false, target: {tagName: "DIV"}, ...over}) as unknown as KeyboardEvent;
    assert.equal(arkCycleKey(key("ArrowRight")), 1);
    assert.equal(arkCycleKey(key("ArrowLeft")), -1);
    assert.equal(arkCycleKey(key("ArrowRight"), true), -1);
    assert.equal(arkCycleKey(key("ArrowUp")), null);
    assert.equal(arkCycleKey(key("ArrowRight", {target: {tagName: "INPUT"}})), null);
    assert.equal(arkCycleKey(key("ArrowRight", {target: {tagName: "TEXTAREA"}})), null);
    assert.equal(arkCycleKey(key("ArrowRight", {target: {tagName: "DIV", isContentEditable: true}})), null);
    assert.equal(arkCycleKey(key("ArrowRight", {metaKey: true})), null);
    assert.equal(arkCycleKey(key("ArrowRight", {defaultPrevented: true})), null);
});

test("the chevrons' words in every Ark locale", () => {
    const dir = path.join(__dirname, "..", "data", "locales");
    const files = ["en.json", "id.json", ...readdirSync(path.join(dir, "ark")).filter((f) => f.endsWith(".json")).map((f) => path.join("ark", f))];
    for (const file of files) {
        const card = JSON.parse(readFileSync(path.join(dir, file), "utf8")).ark.card;
        for (const k of ["cyclePrev", "cycleNext", "cycleCount"] as const) assert.ok(typeof card[k] === "string" && card[k].trim(), `${file} ark.card.${k}`);
        assert.ok(card.cycleCount.includes("{n}") && card.cycleCount.includes("{total}"), `${file} cycleCount placeholders`);
        if (file !== "en.json") assert.notEqual(card.cycleNext, ARK_CARD_ENGLISH.cycleNext, `${file} translated`);
    }
    assert.ok(files.length >= 45, `${files.length} locales`);
});
