import assert from "node:assert/strict";
import test from "node:test";
import base from "@/ark-scene/fixtures/snapshot-v2.json";
import {withArkIslandsFixture} from "@/ark-scene/fixtures/islands";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkRepresentatives} from "@/ark-scene/herds";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {selectionPins, selectionSurvives} from "@/ark-scene/selection";

/**
 * The selection through the town's join and a snapshot laid out again (U1, desktop: a row tapped in the first ~20 s lost
 * its card as the town's animals joined). The selected animal stays chosen while aboard and is pinned to the live set.
 */

test("a selection survives every partial snapshot of the town's join, and goes only when its animal leaves the Ark", () => {
    const whole = decodeArkSnapshot(withArkIslandsFixture(base))!;
    const wild = arkIslandSnapshot(whole, "wild").animals;
    const town = arkIslandSnapshot(whole, "town").animals;
    const chosen = wild[Math.floor(wild.length / 2)].id;
    // The join's batches (index.ts attachIsland: the wild island's animals and the town's a few at a time), then the whole.
    for (let joined = 0; joined <= town.length; joined += Math.max(1, Math.floor(town.length / 4))) {
        const aboard = new Set([...wild, ...town.slice(0, joined)].map((animal) => animal.id));
        assert.ok(selectionSurvives(chosen, aboard, null), `kept with ${joined} of the town's ${town.length} joined`);
        assert.ok(selectionPins(aboard, {selected: chosen, promoted: null, followed: null, replay: []}).has(chosen), "pinned");
    }
    // Gone from the Ark (a newer read without it): deselected, and no longer pinned.
    const gone = new Set(whole.animals.filter((animal) => animal.id !== chosen).map((animal) => animal.id));
    assert.equal(selectionSurvives(chosen, gone, null), false);
    assert.equal(selectionPins(gone, {selected: chosen, promoted: null, followed: null, replay: []}).has(chosen), false);
    // A visitor (not in the snapshot) stays selected while it is the visitor; nothing selected survives trivially.
    assert.ok(selectionSurvives("visitor-1", gone, "visitor-1"));
    assert.ok(selectionSurvives(null, gone, null));
});

test("pinned, the selected animal is drawn one by one whoever else the herds now draw", () => {
    const whole = decodeArkSnapshot(withArkIslandsFixture(base))!;
    const aboard = new Set(whole.animals.map((animal) => animal.id));
    // A herd's member that is not one of its representatives (the case a busy layout drops), when there is one.
    // (Herds from 2 of a kind and one representative each: the fixture is small.)
    const unpinned = arkRepresentatives(whole.animals, {pinned: new Set(), live: 1, from: 2});
    const member = whole.animals.find((animal) => !unpinned.live.has(animal.id));
    assert.ok(member, "the fixture has an animal outside the live set at a tight budget");
    const pins = selectionPins(aboard, {selected: member!.id, promoted: null, followed: "f", replay: ["r"]});
    assert.deepEqual([...pins].sort(), ["f", member!.id, "r"].sort());
    const pinned = arkRepresentatives(whole.animals, {pinned: pins, live: 1, from: 2});
    assert.ok(pinned.live.has(member!.id), "the selected animal is in the live set once pinned");
});
