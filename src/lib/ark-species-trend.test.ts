import assert from "node:assert/strict";
import test from "node:test";
import {arkSpeciesTrendLine, arkSpeciesTrendOf, arkSpeciesTrends} from "@/lib/ark-species-trend";

const FOX = "00000000-0000-4000-8000-000000000001";
const LAB = "00000000-0000-4000-8000-0000000000aa";
const DOG = "00000000-0000-4000-8000-0000000000bb";
const animal = (id: string, species: string) => ({id, species_profile_id: species});

const WORDS = {line: "Since {date}: {changes}.", none: "None have come aboard or left since {date}.", arrived: "{count} came aboard", born: "{count} born", eaten: "{count} eaten", diedOld: "{count} died of old age", starved: "{count} starved", separator: ", "};

test("each animal counts once per change; a meal and its eaten row are one; breeds count as their kind", () => {
    const events = {events: [
        {kind: "arrival", animal: animal("a1", FOX)},
        {kind: "arrival", animal: animal("a2", FOX)},
        {kind: "arrival", animal: animal("a2", FOX)},
        {kind: "birth", animal: animal("a3", FOX)},
        {kind: "meal", animal: animal("wolf", "x"), other: animal("a1", FOX)},
        {kind: "eaten", animal: animal("a1", FOX)},
        {kind: "starved", animal: animal("a4", FOX)},
        {kind: "arrival", animal: animal("d1", LAB)},
        {kind: "mated", animal: animal("a2", FOX), other: animal("a3", FOX)},
        {kind: "laid", animal: animal("e1", FOX)},
        {kind: "arrival"},
        "junk"
    ]};
    const trends = arkSpeciesTrends(events, (look) => (look === LAB ? DOG : null));
    assert.deepEqual(trends.get(FOX), {arrived: 2, born: 1, eaten: 1, diedOld: 0, starved: 1, net: 1});
    assert.deepEqual(trends.get(DOG), {arrived: 1, born: 0, eaten: 0, diedOld: 0, starved: 0, net: 1});
    assert.equal(trends.has(LAB), false);
    // The meal's predator is never counted as eaten.
    assert.equal(trends.has("x"), false);
    assert.equal(arkSpeciesTrendOf(trends, [FOX.toUpperCase(), FOX]).arrived, 2);
});

test("the line says only what happened, in a fixed order", () => {
    const trend = {arrived: 2, born: 0, eaten: 1, diedOld: 0, starved: 0, net: 1};
    assert.equal(arkSpeciesTrendLine(trend, WORDS, "November 5", "en"), "Since November 5: 2 came aboard, 1 eaten.");
    assert.equal(arkSpeciesTrendLine({arrived: 0, born: 0, eaten: 0, diedOld: 0, starved: 0, net: 0}, WORDS, "November 5", "en"), "None have come aboard or left since November 5.");
    assert.equal(arkSpeciesTrendLine({...trend, arrived: 1200}, WORDS, "5 November", "en"), "Since 5 November: 1,200 came aboard, 1 eaten.");
});
