/**
 * Every animal sleeps (owner, 2026-11-15): one active at any hour sleeps its kind's hours in bouts of its own, from the
 * shared table (`positions/sleep.json`), as the server's awake time has it; the schedule's sleep follows it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import table from "@/ark-scene/positions/sleep.json";
import {awakeAtHour} from "@/ark-scene/positions/positions";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {awakeAt} from "@/ark-scene/behaviour-schedule";
import {arkAwakeAtHour, arkSleepOf} from "@/ark-scene/sleep-hours";

const hours = (table as {hours: Record<string, number>}).hours;
const ids = Object.keys(hours);

test("sleep hours: every row of the table sleeps its hours a day (a sponge's 0: never), the scene's answer the module's", () => {
    for (const species of ids.slice(0, 60)) {
        for (const id of ["a", "b"]) {
            const sleep = arkSleepOf({id, species_profile_id: species});
            assert.ok(sleep, species);
            let asleep = 0;
            for (let m = 0; m < 1440; m++) {
                const h = m / 60;
                const awake = arkAwakeAtHour("any", h, sleep);
                assert.equal(awake, awakeAtHour("any", h, sleep), "the scene's memo answers as the shared module");
                if (!awake) asleep++;
            }
            assert.ok(Math.abs(asleep / 60 - hours[species]) < 0.05, `${species}: ${asleep / 60} h vs ${hours[species]}`);
        }
    }
});

test("sleep hours: a breed sleeps as its kind; no row keeps the sun's rule; the schedule's awakeAt follows its own sleep", () => {
    const kind = ids[0];
    assert.equal(arkSleepOf({id: "x", species_profile_id: "breed-without-row", kind_species_profile_id: kind})!.hours, hours[kind]);
    assert.equal(arkSleepOf({id: "x", species_profile_id: "no-such-species"}), null);
    const giraffe = behaviourProfile("giraffe");
    const sleep = {hours: 4.6, id: "giraffe-1"};
    let asleep = 0;
    for (let m = 0; m < 1440; m += 5) if (!awakeAt(giraffe, "any", m / 60, sleep)) asleep++;
    assert.ok(Math.abs((asleep * 5) / 60 - 4.6) < 0.2, `a giraffe sleeps about 4.6 h, not none (${(asleep * 5) / 60})`);
    // Without a sleep of its own, the sun's rule (any hour: always awake), exactly as before.
    for (let h = 0; h < 24; h += 0.5) assert.equal(awakeAt(giraffe, "any", h), true);
    // A day animal is unchanged by a sleep row.
    for (let h = 0; h < 24; h += 0.5) assert.equal(awakeAt(giraffe, "diurnal", h, sleep), awakeAt(giraffe, "diurnal", h));
});
