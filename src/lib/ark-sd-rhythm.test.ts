import assert from "node:assert/strict";
import test from "node:test";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {rhythmChoice, speciesSdRhythm} from "@/ark-scene/sd-rhythm";
import table from "@/ark-scene/sd-rhythm.json";
import {arkDayOf, arkRhythmCauses, arkRhythmShift, intensityLine, intensityPath, readSdMode, sdAgreement, sdRhythmOf, SD_TEMPO} from "@/lib/ark-sd-rhythm";

// Lane ark-sd-align (docs/ark/sd-alignment-audit-2026-11.md): SD modes read by rule, an Ark day scored against them.

test("SD mode words map to the Ark's kinds by rule, tempo words passed over", () => {
    assert.deepEqual(readSdMode({label: "Browsing • Solitary • Deliberate", frequency: "LOW", conceptual_weight: 70}).mix, {feed: 1});
    assert.deepEqual(readSdMode({label: "Rhythmic • Grazing • Herd"}).mix, {feed: 1});
    assert.deepEqual(readSdMode({label: "Burrowed • Sealed"}).mix, {still: 1});
    assert.deepEqual(readSdMode({label: "Digging • Licking • Excavating again"}).mix, {dig: 1});
    assert.deepEqual(readSdMode({label: "Soaring • Scanning"}).mix, {move: 1});
    // An ambush: a still word where the mode speaks of prey is half feeding.
    assert.deepEqual(readSdMode({label: "Waiting • Still • Strike", role: "Lies motionless until prey passes"}).mix, {still: 0.5, feed: 0.5});
    assert.deepEqual(readSdMode({label: "Calling • Displaying"}).mix, {social: 1});
    // Nothing in the label: the role sentence.
    assert.equal(readSdMode({label: "Explosive • Brief", role: "Grooms the whole coat at dusk"}).from, "role");
});

test("a species' rhythm: weights become shares, frequencies a tempo", () => {
    const rhythm = sdRhythmOf([
        {label: "Grazing • Herd", frequency: "LOW", conceptual_weight: 75},
        {label: "Running • Escape", frequency: "HIGH", conceptual_weight: 25}
    ])!;
    assert.equal(rhythm.target.feed, 0.75);
    assert.equal(rhythm.target.move, 0.25);
    assert.equal(rhythm.tempo, "LOW");
    assert.equal(sdRhythmOf([{label: "Mysterious"}]), null);
});

test("an Ark day: shares of waking time, bouts and switches", () => {
    const day = arkDayOf(["sleeping", "grazing", "grazing", "grazing", "resting", "grazing", "sleeping"], 80);
    assert.equal(day.asleep, 2 / 7);
    assert.equal(day.awake.feed, 4 / 5);
    assert.equal(day.awake.still, 1 / 5);
    assert.equal(day.boutMinutes, (5 * 80) / 60 / 3);
    assert.equal(intensityLine(day.intensity, 7).length, 7);
    assert.match(intensityPath([0, 1]), /^M 0\.0 46\.0 L 100\.0 6\.0$/);
});

test("agreement: a grazer that grazes in long bouts is in rhythm; one that never does is out", () => {
    const rhythm = sdRhythmOf([{label: "Grazing", frequency: "LOW", conceptual_weight: 100}])!;
    const keys = Array.from({length: 60}, (_, i) => (Math.floor(i / 8) % 4 === 3 ? "resting" : "grazing"));
    const good = sdAgreement(rhythm, arkDayOf(keys, 80));
    assert.equal(good.state, "in");
    const bad = sdAgreement(rhythm, arkDayOf(Array.from({length: 60}, (_, i) => (i % 2 ? "resting" : "wandering")), 80));
    assert.equal(bad.state, "out");
    assert.equal(bad.worst, "cover");
    // Its tempo unknown (asleep through the bouts read): scored on cover and mix alone.
    assert.equal(sdAgreement(rhythm, {...arkDayOf(keys, 80), boutMinutes: NaN}).tempo, 1);
    assert.ok(SD_TEMPO.LOW.bout > SD_TEMPO.MID.bout && SD_TEMPO.MID.bout > SD_TEMPO.HIGH.bout);
});

test("its state moves it off rhythm by rule; old age is never fixable", () => {
    assert.ok(arkRhythmShift("prime", null).cover > arkRhythmShift("good", null).cover);
    assert.ok(arkRhythmShift("good", null).cover > arkRhythmShift("ordinary", null).cover);
    assert.ok(arkRhythmShift("prime", "hungry").feed > 1 && arkRhythmShift("prime", "hungry").bout < 1);
    assert.ok(arkRhythmShift("prime", "old").still > 1 && arkRhythmShift("prime", "old").bout > 1);
    assert.deepEqual(arkRhythmCauses("prime", "old", true), [{cause: "old", fixable: false}]);
    assert.deepEqual(arkRhythmCauses("ordinary", "hungry", false), [{cause: "hungry", fixable: false}, {cause: "unkept", fixable: true}]);
    assert.deepEqual(arkRhythmCauses("good", "hungry", true)[0], {cause: "hungry", fixable: true});
});

test("the schedule's choosing follows SD where a species has it, and is untouched where it has none", () => {
    const slugs = Object.keys((table as {species: Record<string, string>}).species);
    assert.ok(slugs.length > 2000);
    const walks = (s: string) => behaviourProfile(s).move !== "fly" && !behaviourProfile(s).moves.includes("fly");
    const slug = slugs.find((s) => speciesSdRhythm(s)!.target.feed === 1 && behaviourProfile(s).weights.forage && walks(s))!;
    const profile = behaviourProfile(slug);
    const prime = rhythmChoice(profile, "prime", null)!;
    const ordinary = rhythmChoice(profile, "ordinary", null)!;
    const share = (w: Record<string, number | undefined>) => (w.forage ?? 0) / Object.values(w).reduce((s: number, v) => s + (v ?? 0), 0);
    assert.ok(share(prime.weights) > share(ordinary.weights));
    assert.ok(share(prime.weights) >= share(profile.weights));
    assert.equal(rhythmChoice(behaviourProfile("no-such-species-xyz"), "prime", null), null);
    // Anything that flies keeps today's choosing (the flight lanes' guards).
    const flyer = slugs.find((s) => !walks(s))!;
    assert.equal(rhythmChoice(behaviourProfile(flyer), "prime", null), null);
});
