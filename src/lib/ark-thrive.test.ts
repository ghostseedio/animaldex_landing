import assert from "node:assert/strict";
import test from "node:test";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkThriveOf, arkThriveRank} from "@/ark-scene/thrive";
import {decodeArkEvents, decodeArkLife} from "./ark-life";
import {
    arkCaptureBandView,
    arkLineageHasAny,
    arkLineageLine,
    arkStepResultLines,
    arkThriveWords,
    decodeArkCaptureState,
    decodeArkLineage,
    decodeArkStepResult,
    decodeArkThriveField
} from "./ark-thrive";
import {withArkThriveFixture, withArkThriveFixtureLives} from "./ark-thrive-fixture";
import {ARK_COPY} from "./companion-bond";
import en from "../data/locales/en.json";

const ANIMAL = "00000000-0000-4000-8000-000000000001";
const life = en.ark.life;
const plural = (name: string) => `${name}s`;

test("the band in plain words, the tap card's and the chat's the same, and the scene's hook", () => {
    assert.equal(arkThriveWords("prime", life), "In prime condition");
    assert.equal(arkThriveWords("good", life), "In good condition");
    assert.equal(arkThriveWords("ordinary", life), "Ordinary");
    assert.equal(arkThriveWords("good", ARK_COPY), life.thriveGood);
    // The contract sends the band bare; an earlier draft as {band, since}: either reads.
    assert.equal(decodeArkThriveField("prime"), "prime");
    assert.equal(decodeArkThriveField({band: "good", since: 12}), "good");
    assert.equal(decodeArkThriveField(72.5), null);
    assert.equal(decodeArkThriveField("glowing"), null);
    // The scene acts on ordinary when the server sends none; a claim on a place goes prime, good, ordinary.
    assert.equal(arkThriveOf({thrive: null}), "ordinary");
    assert.equal(arkThriveOf({}), "ordinary");
    assert.equal(arkThriveOf({thrive: "prime"}), "prime");
    assert.deepEqual(["ordinary", "prime", "good"].map((band) => arkThriveRank(band as "ordinary")), [0, 2, 1]);
});

test("voyage_public_v2's animals carry thrive, area and source when the server sends them, nothing otherwise", () => {
    const row = {id: ANIMAL, species_profile_id: "s", name: "Komodo Dragon", model_slug: "komodo-dragon", zone: "grassland", arrived_at: "2026-11-11T10:00:00Z", brought_by: {label: "Voyager 7", named: false}, mine: true, origin: "arrived"};
    const snapshot = (animal: Record<string, unknown>) => decodeArkSnapshot({voyage: {slug: "first"}, animals: [animal]})!.animals[0];
    const now = snapshot({...row, thrive: "good", area: "house", source: "capture"});
    assert.equal(now.thrive, "good");
    assert.equal(now.area, "house");
    assert.equal(now.source, "capture");
    const born = snapshot({...row, origin: "born", thrive: "prime", area: null, source: null});
    assert.equal(born.source, null);
    assert.equal(born.area, null);
    // An older server: the keys are absent, never guessed.
    const older = snapshot(row);
    assert.equal("thrive" in older, false);
    assert.equal("source" in older, false);
    // Nonsense reads as nothing.
    assert.equal(snapshot({...row, thrive: 88, area: "garage", source: "gift"}).thrive, null);
});

test("the life story's thrive (none once it died), area, source and family line", () => {
    const read = decodeArkLife({
        id: ANIMAL,
        status: "present",
        origin: {kind: "arrived", at: "2026-11-11T10:00:00Z", brought_by: {label: "Voyager 7", named: false}, source: "capture"},
        thrive: "prime",
        area: "farm",
        lineage: {young: 2, grandchildren: 1, later: 0, living: 2}
    })!;
    assert.equal(read.thrive, "prime");
    assert.equal(read.area, "farm");
    assert.deepEqual(read.origin, {kind: "arrived", at: "2026-11-11T10:00:00Z", brought_by: "Voyager 7", source: "capture"});
    assert.deepEqual(read.lineage, {young: 2, grandchildren: 1, later: 0, living: 2});
    const gone = decodeArkLife({id: ANIMAL, status: "eaten", died: {at: "2026-11-11T12:00:00Z", kind: "eaten"}, thrive: "good", origin: {kind: "arrived"}})!;
    assert.equal(gone.thrive, null);
    const older = decodeArkLife({id: ANIMAL, origin: {kind: "arrived"}})!;
    assert.equal(older.thrive, null);
    assert.equal(older.lineage, null);
    assert.equal(older.origin.kind === "arrived" ? older.origin.source : "x", null);
});

test("the event log: a milestone's band, an arrival's source, and every event animal's thrive and area", () => {
    const animal = {id: ANIMAL, species_profile_id: "s", name: "Komodo Dragon", model_slug: "komodo-dragon", zone: "grassland", thrive: "good", area: null};
    const events = decodeArkEvents({events: [
        {id: 1, kind: "arrival", at: "2026-11-11T10:00:00Z", animal, source: "capture"},
        {id: 2, kind: "milestone", at: "2026-11-11T11:00:00Z", animal, thrive: "good", source: "capture"},
        {id: 3, kind: "meal", at: "2026-11-11T12:00:00Z", animal, thrive: "prime"}
    ]}, null);
    assert.deepEqual(events.map((event) => [event.kind, event.source, event.thrive]), [["arrival", "capture", null], ["milestone", null, "good"], ["meal", null, null]]);
    assert.equal(events[0].animal?.thrive, "good");
    assert.equal(events[0].animal?.area, null);
});

test("the family line: \"2 young, 1 grandchild · 2 alive now\", by generation, in the reader's language", () => {
    const lineage = decodeArkLineage({young: 2, grandchildren: 1, later: 0, living: 2})!;
    assert.equal(arkLineageLine(lineage, life, "en"), "2 young, 1 grandchild · 2 alive now");
    assert.equal(arkLineageLine({young: 1, grandchildren: 0, later: 3, living: 0}, life, "en"), "1 young, 3 later descendants");
    assert.equal(arkLineageLine({young: 0, grandchildren: 0, later: 0, living: 0}, life, "en"), "None yet");
    assert.equal(arkLineageHasAny({young: 0, grandchildren: 0, later: 0, living: 0}), false);
    assert.equal(arkLineageHasAny(null), false);
    assert.equal(arkLineageHasAny(lineage), true);
    // Never more alive than were born; garbage is no line at all.
    assert.equal(decodeArkLineage({young: 1, living: 9})?.living, 1);
    assert.equal(decodeArkLineage({}), null);
    assert.equal(decodeArkLineage("nope"), null);
    // The reader's digits and the reader's way of joining a list (not English's comma).
    const arabic = arkLineageLine({young: 12, grandchildren: 3, later: 0, living: 0}, {...life, lineageYoungOther: "{count} أبناء", lineageGrandOther: "{count} أحفاد"}, "ar");
    assert.equal(arabic, `${(12).toLocaleString("ar")} أبناء و${(3).toLocaleString("ar")} أحفاد`);
});

test("voyage_capture_state_v1: every state, and what the capture band shows for it", () => {
    const state = (extra: Record<string, unknown>) => decodeArkCaptureState({state: "aboard", reason: null, species: "Komodo Dragon", kind_name: "Komodo Dragon", living_brought: 1, aboard: 3, thrive: "good", animal_id: ANIMAL, ...extra});
    assert.deepEqual(state({}), {state: "aboard", reason: null, species: "Komodo Dragon", kindName: "Komodo Dragon", livingBrought: 1, aboard: 3, thrive: "good", animalId: ANIMAL});
    const view = (extra: Record<string, unknown>) => arkCaptureBandView(state(extra)).kind;
    assert.equal(view({}), "aboard");
    assert.equal(view({state: "was_aboard"}), "was_aboard");
    assert.equal(view({state: "coming_aboard", animal_id: null}), "coming");
    assert.equal(view({state: "waiting_model"}), "waiting");
    assert.equal(view({state: "pair_full", living_brought: 2}), "pair_full");
    assert.equal(view({state: "not_on_ark", reason: "excluded"}), "not_on_ark");
    // The server's `excluded:<reason>` reads as excluded.
    assert.equal(state({state: "not_on_ark", reason: "excluded:extinct"})?.reason, "excluded");
    // A sighting saved to their card: theirs is aboard from the card, else nothing to say.
    assert.equal(view({state: "not_on_ark", reason: "merged", living_brought: 1}), "already");
    assert.equal(view({state: "not_on_ark", reason: "observation_only", living_brought: 0}), "hidden");
    // Still identifying, not identified, under 13: no band at all.
    for (const reason of ["not_ready", "analysis_failed", "unidentified", "under_13", "something_new"]) assert.equal(view({state: "not_on_ark", reason}), "hidden", reason);
    // Capture arrivals switched off, someone else's capture (null), a malformed answer: the species' band from the snapshot.
    assert.equal(view({state: "not_on_ark", reason: "switched_off"}), "species");
    assert.equal(arkCaptureBandView(null).kind, "species");
    assert.equal(decodeArkCaptureState(null), null);
    assert.equal(decodeArkCaptureState({state: "teleported"}), null);
    // Clamped and tolerant: the pair is at most 2; an unknown band is ordinary; a bad id is none.
    assert.equal(state({living_brought: 7})?.livingBrought, 2);
    assert.equal(state({thrive: 64})?.thrive, "ordinary");
    assert.equal(state({animal_id: "not-a-uuid"})?.animalId, null);
    // Never a place or a nickname, whatever the server sends beside.
    const leaky = decodeArkCaptureState({state: "aboard", species: "Komodo Dragon", location_lat: -8.5, title: "Rex"}) as Record<string, unknown>;
    assert.equal("location_lat" in leaky || "title" in leaky, false);
});

test("voyage_step_result_v1: the line under a step that worked, its band and its locked points", () => {
    const result = (extra: Record<string, unknown>) => decodeArkStepResult({status: "done", species: "Komodo Dragon", living_brought: 2, thrive_before: "good", thrive_after: "prime", points: 30, ...extra})!;
    assert.deepEqual(arkStepResultLines(result({}), ARK_COPY, "en", plural), {line: "Your Komodo Dragons are thriving", band: "In prime condition", points: "+30 Ark Score"});
    assert.deepEqual(arkStepResultLines(result({living_brought: 1, thrive_after: "good", points: 10}), ARK_COPY, "en", plural), {line: "Your Komodo Dragon is thriving", band: "In good condition", points: "+10 Ark Score"});
    // None aboard (not captured, died, no model yet): it will thrive once one is; the condition waits, so no band.
    assert.deepEqual(arkStepResultLines(result({living_brought: 0, thrive_after: "good"}), ARK_COPY, "en", plural), {line: "Your Komodo Dragon will thrive once one is aboard", band: null, points: "+30 Ark Score"});
    // Pending: nothing yet (and the pending answer carries no band or points).
    const pending = decodeArkStepResult({status: "pending", species: "Komodo Dragon", living_brought: 1, thrive_after: "prime", points: 30})!;
    assert.deepEqual([pending.thriveAfter, pending.points], [null, null]);
    assert.equal(arkStepResultLines(pending, ARK_COPY, "en", plural), null);
    assert.equal(decodeArkStepResult(null), null);
    assert.equal(decodeArkStepResult({status: "maybe"}), null);
    // Not English: the name as it is.
    assert.equal(arkStepResultLines(result({}), {...ARK_COPY, resultOther: "{species}-mu berkembang"}, "id", plural)?.line, "Komodo Dragon-mu berkembang");
});

test("development's thrive fixture: deterministic, the contract's shape, the born at most good", () => {
    const raw = {voyage: {slug: "first"}, animals: [
        {id: "a1", arrived_at: "2026-11-01T00:00:00Z", origin: "arrived", zone: "farm_garden", model_slug: "domestic-cat"},
        {id: "a2", arrived_at: "2026-11-02T00:00:00Z", origin: "arrived", zone: "farm_garden", model_slug: "domestic-goat"},
        {id: "a3", arrived_at: "2026-11-03T00:00:00Z", origin: "arrived", zone: "grassland", model_slug: "lion"},
        ...Array.from({length: 40}, (_, i) => ({id: `b${i}`, arrived_at: "2026-11-05T00:00:00Z", origin: "born", zone: "grassland", model_slug: "lion"}))
    ]};
    const once = withArkThriveFixture(raw);
    assert.deepEqual(withArkThriveFixture(raw), once);
    const animals = once.animals as Array<Record<string, unknown>>;
    assert.deepEqual(animals.slice(0, 3).map((animal) => [animal.source, animal.area]), [["step", "house"], ["step", "farm"], ["capture", null]]);
    assert.ok(animals.filter((animal) => animal.origin === "born").every((animal) => animal.thrive !== "prime" && animal.source === null));
    const lives = withArkThriveFixtureLives({
        a3: {id: "a3", status: "present", origin: {kind: "arrived"}},
        k1: {id: "k1", status: "present", origin: {kind: "born", parents: ["a3"]}},
        k2: {id: "k2", status: "eaten", died: {kind: "eaten"}, origin: {kind: "born", parents: ["a3"]}},
        g1: {id: "g1", status: "present", origin: {kind: "born", parents: ["k1"]}}
    }, once) as Record<string, Record<string, unknown>>;
    assert.deepEqual(lives.a3.lineage, {young: 2, grandchildren: 1, later: 0, living: 2});
    assert.equal(lives.k2.thrive, null);
    assert.deepEqual(lives.a3.origin, {kind: "arrived", source: "capture"});
});
