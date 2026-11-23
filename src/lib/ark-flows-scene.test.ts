import assert from "node:assert/strict";
import test from "node:test";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {forgetSchedules, scheduleWorld, tripAt, SLOT_SECONDS, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {forgetFlows, flowStepAt} from "@/ark-scene/flows/flows";
import {flowStillShare, flowSubjectOf, FLOW_STILL_SHARE} from "@/ark-scene/flows/scene-adapter";
import {placeAnimals} from "@/ark-scene/placement";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {displayLength} from "@/ark-scene/sizes";
import {sceneSampler} from "@/ark-scene/world-sampler";

// The flows' scene adapter (docs/ark/behaviour-flows.md 8): with the switch on a pilot kind's stance plays its flow (a
// meal as bites and chews, head down, standing), but where it goes and where it ends up never change.
const snapshot = decodeArkSnapshot(fixtureV2)!;
const world = scheduleWorld(sceneSampler());
const places = placeAnimals(snapshot.animals);
const hoursAt = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;
const T0 = Date.UTC(2026, 10, 23, 16, 20) / 1000;

function deer(condition: "hungry" | null): ScheduleAnimal {
    const a = snapshot.animals.find((x) => x.zone === "grassland") ?? snapshot.animals[0];
    const p = places.get(a.id)!;
    return {id: `flow-deer-${condition ?? "fed"}`, zone: a.zone, home: {x: p.x, y: p.ground, z: p.z}, length: displayLength({...a, model_slug: "red-deer"}), sea: false, condition};
}

function trips(on: boolean, animal: ScheduleAnimal) {
    (globalThis as {__arkFlows?: boolean}).__arkFlows = on;
    forgetSchedules();
    forgetFlows();
    const profile = behaviourProfile("red-deer");
    const out = Array.from({length: 45}, (_, k) => tripAt(world, profile, animal, T0 + k * SLOT_SECONDS + 1, hoursAt, "crepuscular"));
    (globalThis as {__arkFlows?: boolean}).__arkFlows = false;
    return out;
}

test("flows in the scene: still flow slots stay put, the body never jumps, and every meal stance is the flow's", () => {
    const animal = deer(null);
    const on = trips(true, animal);
    (globalThis as {__arkFlows?: boolean}).__arkFlows = true;
    const subject = flowSubjectOf(animal, "red-deer", hoursAt)!;
    let eatingStances = 0;
    let stays = 0;
    for (let k = 0; k < on.length; k++) {
        // (Where one slot ends the next begins: no jump at a slot's edge.)
        if (k) assert.ok(Math.hypot(on[k].from.x - on[k - 1].finish.x, on[k].from.z - on[k - 1].finish.z) < 0.05, `slot ${k}: jumped ${Math.hypot(on[k].from.x - on[k - 1].finish.x, on[k].from.z - on[k - 1].finish.z).toFixed(2)} m`);
        if (flowStillShare(subject, on[k].start, on[k].end) >= FLOW_STILL_SHARE && on[k].doing !== "sleep") {
            stays++;
            assert.equal(on[k].mode, "stay", `slot ${k}: a still flow slot travels`);
        }
        for (const beat of on[k].stay) {
            const step = flowStepAt(subject, on[k].arrive + beat.at);
            if (beat.beat === "bite" || beat.beat === "chew") {
                assert.ok(step && (step.kind === "eat" || step.kind === "catch" || step.kind === "attempt"), `a bite with the flow ${step?.kind}`);
                eatingStances++;
            }
        }
    }
    (globalThis as {__arkFlows?: boolean}).__arkFlows = false;
    assert.ok(stays > 0, "no still slot");
    assert.ok(eatingStances > 0, "no meal played");
});

test("flows in the scene: a deer the server says is hungry never plays a meal", () => {
    const on = trips(true, deer("hungry"));
    for (const trip of on) assert.ok(!trip.stay.some((b) => b.beat === "bite" || b.beat === "chew" || b.beat === "peck"));
});
