import assert from "node:assert/strict";
import test from "node:test";
import full from "../../data/ark/power-mechanisms.json";
import {ARK_POWER_MECHANISMS, arkPowerKinds, arkPowerOf, arkPowerOfKind, arkPowerStrength} from "@/ark-scene/power-table";
import {POWER_LOOK, armourPack, coatShare, createArkPowerShow, passPhase, PASS_PERIOD, type ArkPowerCandidate} from "@/ark-scene/power-show";
import {unpackDefence} from "@/ark-scene/defence-moves";
import type {ArkAnimal, ArkSnapshot, ArkThrive} from "@/ark-scene/types";

/**
 * Powers you can see (AnimalDex decision 420): the hand-sorted table, the band's strength (prime clearly, good partly,
 * ordinary not), and the hunt's pass-over drawn only from released states.
 */

type Row = {id: string; slug: string; mechanism: string; canonical?: string; reason: string};
const rows = (full as unknown as {species: Row[]}).species;

test("the table: every species' Power sorted, each with a reason quoting it; the scene's keys decode", () => {
    assert.equal(rows.length, 2701);
    for (const row of rows) {
        assert.ok(row.mechanism === "none" || (ARK_POWER_MECHANISMS as readonly string[]).includes(row.mechanism), row.slug);
        assert.ok(row.reason.includes("“"), `${row.slug}: the reason quotes its Power`);
    }
    const shown = rows.filter((row) => row.mechanism !== "none");
    for (const row of shown) assert.ok(arkPowerOfKind(row.id) || arkPowerOfKind(row.canonical), row.slug);
    for (const key of arkPowerKinds()) assert.match(key, /^[0-9a-f]{8}$/);
    // (A kind with none is never drawn as having one.)
    const none = rows.find((row) => row.mechanism === "none" && !rows.some((other) => other.mechanism !== "none" && (other.canonical === row.id || other.id === row.id)))!;
    assert.equal(arkPowerOfKind(none.id), null);
});

test("the band's strength: prime clearly, good partly, ordinary not", () => {
    assert.equal(arkPowerStrength("prime"), 1);
    assert.ok(arkPowerStrength("good") > 0 && arkPowerStrength("good") < 0.6);
    assert.equal(arkPowerStrength("ordinary"), 0);
    assert.equal(arkPowerStrength(null), 0);
    assert.equal(coatShare("camouflage", 0, 0), 0);
    assert.ok(coatShare("camouflage", 0, 1) > coatShare("camouflage", 0, 0.45));
    assert.equal(coatShare("speed", 1, 1), 0, "a mechanism of moves has no coat");
});

const kindOf = (slug: string) => rows.find((row) => row.slug === slug && row.mechanism !== "none")!;

function animal(id: string, slug: string, thrive: ArkThrive, zone = "grassland", state?: ArkAnimal["state"]): ArkAnimal {
    const row = rows.find((r) => r.slug === slug);
    return {id, species_profile_id: row?.id ?? `sp-${slug}`, kind_species_profile_id: row?.canonical ?? row?.id ?? null, name: slug, scientific_name: null, model_slug: slug, zone, arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "@x", named: true}, mine: false, thrive, ...(state ? {state} : {})} as ArkAnimal;
}

function candidate(a: ArkAnimal, x: number, z: number): ArkPowerCandidate {
    return {entry: {animal: a, length: 1.4, thrive: a.thrive ?? "ordinary", place: {}, state: {asleep: false}, sched: {profile: {size: 40}}}, distance: 10, pose: {x, z, base: 0, yaw: 0, pitch: 0, roll: 0, afloat: false}, modelHeight: 1.2, model: {behaviour: {plan: "quadruped"}}};
}

const snapshotOf = (animals: ArkAnimal[]): ArkSnapshot => ({voyage: {slug: "ark", name: "Ark", started_at: null}, counts: {animals: animals.length, species: 1, founders: 0}, zones: [], animals, as_of: null}) as ArkSnapshot;

test("a prime camouflaged kind wears the ground's colour; a good one partly; an ordinary one not at all", () => {
    assert.equal(kindOf("bay-duiker").mechanism, "camouflage");
    const show = createArkPowerShow();
    const list = (["prime", "good", "ordinary"] as const).map((band, i) => candidate(animal(`d${i}`, "bay-duiker", band, "rainforest"), i * 40, 0));
    show.step(list, 0.1, {now: 1_800_000_000, motion: true, shift: () => undefined});
    const [prime, good, ordinary] = list.map((c) => c.entry.power);
    assert.equal(prime?.look?.[3], POWER_LOOK.camouflage);
    assert.ok((prime?.q ?? 0) > (good?.q ?? 0) && (good?.q ?? 0) > 0);
    assert.equal(ordinary ?? null, null);
});

test("a predator beside a prime fast kind: it darts away from it; nothing beside it, it stays", () => {
    assert.equal(kindOf("blackbuck").mechanism, "speed");
    const show = createArkPowerShow();
    const prey = candidate(animal("b", "blackbuck", "prime"), 0, 0);
    const lion = candidate(animal("l", "african-lion", "ordinary"), 4, 0);
    const moves: Array<[number, number]> = [];
    for (let i = 0; i < 20; i++) show.step([prey, lion], 0.1, {now: 1_800_000_000 + i * 0.1, motion: true, shift: (c, dx, dz) => c === prey && moves.push([dx, dz])});
    assert.ok(moves.length > 0 && moves[moves.length - 1][0] < -0.5, `darts away from the lion (−x): ${JSON.stringify(moves.at(-1))}`);
    const alone = createArkPowerShow();
    const quiet: number[] = [];
    const solo = candidate(animal("b2", "blackbuck", "prime"), 0, 0);
    for (let i = 0; i < 10; i++) alone.step([solo], 0.1, {now: 1_800_000_000 + i * 0.1, motion: true, shift: () => quiet.push(1)});
    assert.equal(quiet.length, 0);
});

test("the hunt: a searching hunter (the released read) looks at a prime one and passes it over; never its own target; never a state dated ahead", () => {
    const now = 1_800_000_000;
    const lion = animal("l", "african-lion", "ordinary", "grassland", {kind: "searching", since: new Date((now - 60) * 1000).toISOString()});
    const prey = animal("p", "blackbuck", "prime");
    const show = createArkPowerShow();
    show.snapshot(snapshotOf([lion, prey]));
    const list = [candidate(lion, 0, 0), candidate(prey, 8, 0)];
    let looked = 0;
    let turned = 0;
    for (let t = 0; t < PASS_PERIOD; t += 0.25) {
        list[0].pose.yaw = 0;
        show.step(list, 0.25, {now: now + t, motion: true, shift: () => undefined});
        if ((list[0].entry.power?.head?.[2] ?? 0) > 0.3) looked++;
        if (list[0].pose.yaw !== 0) turned++;
    }
    assert.ok(looked > 4 && turned > 4, `looked ${looked}, turned away ${turned}`);
    assert.ok(show.report().hunters === 1);

    // Its own target (a stalk): not passed over.
    const stalker = animal("l", "african-lion", "ordinary", "grassland", {kind: "stalking", target: "p", since: new Date((now - 60) * 1000).toISOString()});
    const show2 = createArkPowerShow();
    show2.snapshot(snapshotOf([stalker, prey]));
    const list2 = [candidate(stalker, 0, 0), candidate(prey, 8, 0)];
    let passes = 0;
    for (let t = 0; t < PASS_PERIOD; t += 0.5) {
        show2.step(list2, 0.5, {now: now + t, motion: true, shift: () => undefined});
        passes += show2.report().passing;
    }
    assert.equal(passes, 0);

    // A state dated after now (no look-ahead, decision 389): nothing.
    const ahead = animal("l", "african-lion", "ordinary", "grassland", {kind: "searching", since: new Date((now + 3600) * 1000).toISOString()});
    const show3 = createArkPowerShow();
    show3.snapshot(snapshotOf([ahead, prey]));
    const list3 = [candidate(ahead, 0, 0), candidate(prey, 8, 0)];
    let passes3 = 0;
    for (let t = 0; t < PASS_PERIOD; t += 0.5) {
        show3.step(list3, 0.5, {now: now + t, motion: true, shift: () => undefined});
        passes3 += show3.report().passing;
    }
    assert.equal(passes3, 0);

    // An ordinary one near the hunter: no Power shown, no pass.
    const plain = animal("p", "blackbuck", "ordinary");
    const show4 = createArkPowerShow();
    show4.snapshot(snapshotOf([lion, plain]));
    const list4 = [candidate(lion, 0, 0), candidate(plain, 8, 0)];
    let passes4 = 0;
    for (let t = 0; t < PASS_PERIOD; t += 0.5) {
        show4.step(list4, 0.5, {now: now + t, motion: true, shift: () => undefined});
        passes4 += show4.report().passing;
    }
    assert.equal(passes4, 0);
    assert.equal(list4[1].entry.power ?? null, null);
});

test("the pass's phases: a look first, then turned away, then back to its search", () => {
    const [look1, away1] = passPhase(2.5);
    const [look2, away2] = passPhase(6);
    const [look3, away3] = passPhase(PASS_PERIOD - 1);
    assert.ok(look1 > 0.5 && away1 < 0.2);
    assert.ok(away2 > 0.5 && look2 < 0.2);
    assert.equal(look3 + away3, 0);
});

test("armour: the defence moves' own shapes (a shell for a turtle, a ball otherwise), none at rest", () => {
    assert.equal(armourPack("x-unknown", "turtle", 0), 0);
    const [kind, amount] = unpackDefence(armourPack("x-unknown", "turtle", 1));
    assert.equal(kind, 3);
    assert.ok(amount > 0.9);
    assert.equal(unpackDefence(armourPack("x-unknown", "quadruped", 0.5))[0], 1);
});

test("an animal's Power by its kind (the canonical id first)", () => {
    const row = kindOf("bay-duiker");
    assert.equal(arkPowerOf({species_profile_id: "00000000-x", kind_species_profile_id: row.id})?.mechanism, "camouflage");
    assert.equal(arkPowerOf({species_profile_id: row.id, kind_species_profile_id: null})?.mechanism, "camouflage");
});
