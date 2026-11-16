import assert from "node:assert/strict";
import test from "node:test";
import {DEATH_BODY_SECONDS, DEATH_FADE_SECONDS, DEATH_FALL_SECONDS, deathBodyPose, deathBodyShowing, LiveDeaths, type DeathRecord, type DeathSpot} from "@/ark-scene/live-deaths";
import type {ActPose} from "@/ark-scene/acts";
import type {ArkEventAnimal} from "@/lib/ark-life";

const SPOT: DeathSpot = {x: 12, z: -4, base: 0.3, yaw: 1.1};
const T0 = 1_700_000_000;
const animal = (id: string): ArkEventAnimal => ({id, species_profile_id: "s", name: "Roadside Hawk", model_slug: "roadside-hawk", zone: "woodland", arrived_at: null, origin: "arrived", generation: 0, slot: 3, slot_rank: 0, activity: "diurnal", sociality: null, status: null});

test("its body: only from the death's time, on its side where it died, still, then fading and gone", () => {
    assert.equal(deathBodyPose(SPOT, "death:1", T0, T0 - 1), null, "not before the death");
    assert.equal(deathBodyPose(SPOT, "death:1", T0, T0 + DEATH_BODY_SECONDS), null, "gone after its while");
    const falling = deathBodyPose(SPOT, "death:1", T0, T0 + DEATH_FALL_SECONDS / 2)!;
    const down = deathBodyPose(SPOT, "death:1", T0, T0 + 60)!;
    assert.ok(Math.abs(falling.lying!) > 0 && Math.abs(falling.lying!) < 1, "falling onto its side");
    assert.equal(Math.abs(down.lying!), 1, "on its side");
    assert.equal(down.state, "lie");
    assert.equal(down.speed, 0);
    assert.deepEqual([down.x, down.z, down.base, down.yaw], [SPOT.x, SPOT.z, SPOT.base, SPOT.yaw], "where it died");
    assert.equal(down.dim, 0);
    assert.equal(down.hidden, false);
    const fading = deathBodyPose(SPOT, "death:1", T0, T0 + DEATH_BODY_SECONDS - DEATH_FADE_SECONDS / 2)!;
    assert.ok(fading.dim > 0 && fading.dim < 1);
    assert.ok(deathBodyShowing(T0, T0 + 10) && !deathBodyShowing(T0, T0 - 10) && !deathBodyShowing(T0, T0 + DEATH_BODY_SECONDS + 1));
});

test("the same for every viewer: a pure function of the event and the clock (its side seeded by the event)", () => {
    for (const t of [T0 + 0.3, T0 + 100, T0 + DEATH_BODY_SECONDS - 10]) assert.deepEqual(deathBodyPose(SPOT, "death:42", T0, t), deathBodyPose(SPOT, "death:42", T0, t));
    const sides = new Set(Array.from({length: 40}, (_, i) => Math.sign(deathBodyPose(SPOT, `death:${i}`, T0, T0 + 30)!.lying!)));
    assert.deepEqual(Array.from(sides).sort(), [-1, 1], "both sides over many deaths");
});

test("the host's stand-in: made while its body lies, posed each frame, dropped once faded; its place asked once", () => {
    const made: string[] = [];
    const dropped: string[] = [];
    const acts = new Map<string, ActPose | null>();
    let asked = 0;
    const deaths = new LiveDeaths<string>({
        spotOf: (d: DeathRecord) => {
            asked++;
            return d.animal.id === "nowhere" ? null : SPOT;
        },
        ghost: (d) => {
            made.push(d.key);
            return d.key;
        },
        drop: (g) => dropped.push(g),
        setAct: (g, pose) => acts.set(g, pose)
    });
    deaths.add([{key: "death:1", animal: animal("a"), t0: T0}, {key: "death:2", animal: animal("nowhere"), t0: T0}]);
    deaths.add([{key: "death:1", animal: animal("a"), t0: T0}]);
    assert.equal(deaths.size, 2, "a key already known is not added twice");
    deaths.step(T0 - 5);
    assert.equal(made.length, 0, "nothing before its time");
    deaths.step(T0 + 30);
    deaths.step(T0 + 31);
    assert.deepEqual(made, ["death:1"], "one stand-in, only where its place is known");
    assert.equal(Math.abs(acts.get("death:1")!.lying!), 1);
    assert.equal(asked, 2, "each place worked out once");
    // The tap: where it died, even with no body to draw (an old death), and null when unknown.
    assert.deepEqual(deaths.spot("death:1"), SPOT);
    assert.equal(deaths.spot("death:2"), null);
    assert.equal(deaths.spot("death:9"), null);
    deaths.step(T0 + DEATH_BODY_SECONDS + 1);
    assert.deepEqual(dropped, ["death:1"], "dropped once its while is over");
    assert.deepEqual(deaths.spot("death:1"), SPOT, "still known for its line's tap");
});

test("an old death read later: no body, but its line still goes to where it died", () => {
    let made = 0;
    const deaths = new LiveDeaths<string>({spotOf: () => SPOT, ghost: () => (made++, "g"), drop: () => {}, setAct: () => {}});
    deaths.add([{key: "death:7", animal: animal("b"), t0: T0}]);
    deaths.step(T0 + DEATH_BODY_SECONDS * 3);
    assert.equal(made, 0);
    assert.deepEqual(deaths.spot("death:7"), SPOT);
});
