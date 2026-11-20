/**
 * The engine's own sexes (`animal.sex` in the public read, while the server's `sexes` switch is on: the symbol on the card)
 * decide who is the mother and who is the father in every act the scene draws (a mating's roles, who lays, nurses, carries or
 * guards, antlers, size); the seeded look (`sexLook`) is only the fallback for an animal whose read has no sex. 2026-11-20:
 * on the 34 live matings with a sex for both partners, the seeded look agreed with the card on 11 (the zoo Scarlet Ibis pair:
 * the card said 3d2f3939 was female, the scene drew it male and showed the other one laying).
 */
import assert from "node:assert/strict";
import test from "node:test";
import {resetRecordedSexes, setRecordedSexes, sexLook} from "@/ark-scene/behaviour-recipes";
import {motherAmong} from "@/ark-scene/young-care";
import type {ActPose} from "@/ark-scene/acts";

const IBIS = "scarlet-ibis";
const IBIS_F = "3d2f3939-4bbf-466c-a92a-261b1c0dfff6"; // the read: "f"
const IBIS_M = "8b8b3a64-a806-4841-9f2a-df55406e4333"; // the read: "m"

const flat = () => 0;
const after = async (run: () => void | Promise<void>) => {
    resetRecordedSexes();
    try {
        await run();
    } finally {
        resetRecordedSexes();
    }
};
/** What the scene's hosts do with an animal: its look's sex as a boolean (`male`: true male, false female, null neither). */
const maleOf = (id: string, slug = IBIS) => {
    const sex = sexLook(id, slug).sex;
    return sex === "male" ? true : sex === "female" ? false : null;
};

test("the seeded look alone draws the zoo ibis pair the wrong way round (why the read's sex comes first)", () =>
    after(() => {
        assert.equal(sexLook(IBIS_F, IBIS).sex, "male");
        assert.equal(sexLook(IBIS_M, IBIS).sex, "female");
    }));

test("with the read's sexes, the ibis the card calls female is female and the other male", () =>
    after(() => {
        setRecordedSexes([{id: IBIS_F, sex: "f"}, {id: IBIS_M, sex: "m"}]);
        assert.equal(sexLook(IBIS_F, IBIS).sex, "female");
        assert.equal(sexLook(IBIS_M, IBIS).sex, "male");
    }));

test("the ibis female lays: the mother walks to the nest, the male does not (whatever order the record names them)", () =>
    after(async () => {
        const {LiveClutches, LAY_WALK} = await import("@/ark-scene/live-clutches");
        for (const parents of [[IBIS_M, IBIS_F], [IBIS_F, IBIS_M]]) {
            resetRecordedSexes();
            setRecordedSexes([{id: IBIS_F, sex: "f"}, {id: IBIS_M, sex: "m"}]);
            type E = {id: string; act: ActPose | null};
            const es: E[] = [{id: IBIS_M, act: null}, {id: IBIS_F, act: null}];
            const layer = new LiveClutches<E>({
                find: (id) => es.find((e) => e.id === id) ?? null,
                // (As `index.ts` hosts it: the look's sex.)
                female: (e) => (maleOf(e.id) === false ? true : maleOf(e.id) === true ? false : null),
                scheduleAt: () => ({x: 10, z: 0, yaw: 0}),
                ground: flat,
                length: () => 1,
                walk: () => 1,
                spawns: () => false,
                setAct: (e, pose) => {
                    e.act = pose;
                },
                busy: () => false,
                matingEnd: () => 100,
                clutchSpot: () => ({x: 5, z: 0}),
                lay: () => undefined,
                hatch: () => undefined,
                where: () => null,
                remove: () => undefined
            });
            layer.addLaid([{key: "laid:ibis", parents, eggs: 1, t0: 50, hatchAt: 5000}]);
            layer.step(100 + LAY_WALK / 2);
            assert.ok(es[1].act && es[1].act.state === "walk", `the female lays (record order ${parents.map((p) => p.slice(0, 4)).join(", ")})`);
            assert.equal(es[0].act, null, "the male never lays");
        }
    }));

test("the male never nurses or carries: the mother among recorded parents is the one the card calls female", () =>
    after(() => {
        setRecordedSexes([{id: IBIS_F, sex: "f"}, {id: IBIS_M, sex: "m"}]);
        assert.equal(motherAmong([IBIS_M, IBIS_F], (id) => maleOf(id)), IBIS_F);
        assert.equal(motherAmong([IBIS_F, IBIS_M], (id) => maleOf(id)), IBIS_F);
        // (Only the father aboard: the young's mother is not him by name, but the act still has a carer: the record's one left.)
        assert.equal(motherAmong([IBIS_M, IBIS_F], (id) => maleOf(id), (id) => id === IBIS_M), IBIS_M);
    }));

test("every pair: the card's sex and the drawn role agree, 100 %, whatever the seeded look would have said", () =>
    after(() => {
        let seed = 7;
        const next = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        const slugs = ["scarlet-ibis", "red-deer", "mallard", "domestic-cat", "chinese-mantis"];
        let pairs = 0;
        let seededWouldDisagree = 0;
        for (let i = 0; i < 400; i++) {
            const slug = slugs[i % slugs.length];
            const a = {id: `a-${i}`, sex: next() < 0.5 ? "m" : "f"};
            const b = {id: `b-${i}`, sex: a.sex === "m" ? "f" : "m"};
            resetRecordedSexes();
            if (sexLook(a.id, slug).sex !== (a.sex === "m" ? "male" : "female")) seededWouldDisagree++;
            setRecordedSexes([a, b]);
            for (const animal of [a, b]) assert.equal(sexLook(animal.id, slug).sex, animal.sex === "m" ? "male" : "female", `${animal.id} (${slug})`);
            const mother = motherAmong([a.id, b.id], (id) => maleOf(id, slug));
            assert.equal(mother, a.sex === "f" ? a.id : b.id, "the mother is the one the read says is female");
            pairs++;
        }
        assert.equal(pairs, 400);
        assert.ok(seededWouldDisagree > 100, "the seeded look alone would have been wrong often");
    }));

test("no sex in the read (null, or no key): the seeded look, the same every time, and a recorded sex that goes null is dropped", () =>
    after(() => {
        const ids = Array.from({length: 200}, (_, i) => `n-${i}`);
        const seeded = ids.map((id) => sexLook(id, "red-deer"));
        // (Null sex and no key at all: nothing recorded, nothing changes.)
        setRecordedSexes(ids.map((id, i) => (i % 2 ? {id, sex: null} : {id})));
        assert.deepEqual(ids.map((id) => sexLook(id, "red-deer")), seeded);
        assert.deepEqual(ids.map((id) => sexLook(id, "red-deer")), seeded, "stable");
        // A hermaphrodite with no recorded sex stays without one.
        assert.equal(sexLook("x", "acorn-barnacle").sex, null);
        // A recorded sex stays while later reads have no key (a stand-in for an animal the read dropped), and goes with a null.
        setRecordedSexes([{id: ids[0], sex: "m"}]);
        assert.equal(sexLook(ids[0], "red-deer").sex, "male");
        setRecordedSexes([{id: ids[0]}]);
        assert.equal(sexLook(ids[0], "red-deer").sex, "male", "no key: kept");
        setRecordedSexes([{id: ids[0], sex: null}]);
        assert.deepEqual(sexLook(ids[0], "red-deer"), seeded[0], "null: back to the seeded look");
        // The size and colour follow the recorded sex too (a stag bigger than a hind).
        const stag = ids.find((id) => sexLook(id, "red-deer").sex === "female")!;
        const hind = sexLook(stag, "red-deer").scale;
        setRecordedSexes([{id: stag, sex: "m"}]);
        assert.ok(sexLook(stag, "red-deer").scale > hind, "recorded male: the larger sex of a deer");
    }));
