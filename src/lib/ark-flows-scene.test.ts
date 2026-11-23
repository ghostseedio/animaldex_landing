import assert from "node:assert/strict";
import test from "node:test";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {forgetSchedules, scheduleWorld, tripAt, SLOT_SECONDS, type ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
import {forgetFlows, flowStepAt} from "@/ark-scene/flows/flows";
import {flowSubjectOf} from "@/ark-scene/flows/scene-adapter";
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

test("flows in the scene: the route and where it ends are the schedule's; the stance is the flow's", () => {
    const animal = deer(null);
    const off = trips(false, animal);
    const on = trips(true, animal);
    let eatingStances = 0;
    const subject = flowSubjectOf(animal, "red-deer", hoursAt)!;
    for (let k = 0; k < off.length; k++) {
        assert.equal(JSON.stringify(on[k].legs), JSON.stringify(off[k].legs), `slot ${k}: legs changed`);
        assert.deepEqual(on[k].finish, off[k].finish, `slot ${k}: finish changed`);
        assert.equal(on[k].arrive, off[k].arrive);
        // (Its walked beats, at their places, are the schedule's own.)
        const walked = (t: typeof on[number]) => t.stay.filter((b) => b.beat === "step" || b.beat === "stalk" || b.beat === "play").map((b) => `${b.at},${b.x},${b.z}`);
        assert.deepEqual(walked(on[k]), walked(off[k]));
        for (const beat of on[k].stay) {
            const step = flowStepAt(subject, on[k].arrive + beat.at);
            if (beat.beat === "bite" || beat.beat === "chew") {
                assert.ok(step && (step.kind === "eat" || step.kind === "catch" || step.kind === "attempt"), `a bite with the flow ${step?.kind}`);
                eatingStances++;
            }
        }
    }
    assert.ok(eatingStances > 0, "no meal played");
});

test("flows in the scene: a deer the server says is hungry never plays a meal", () => {
    const on = trips(true, deer("hungry"));
    for (const trip of on) assert.ok(!trip.stay.some((b) => b.beat === "bite" || b.beat === "chew" || b.beat === "peck"));
});
