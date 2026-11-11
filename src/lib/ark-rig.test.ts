import assert from "node:assert/strict";
import test from "node:test";
import {
    ARK_RIG_FALLBACK,
    ARK_RIG_VERSION,
    FLIGHT_CLIPS,
    decodeRigLook,
    decodeRigSet,
    flightApproved,
    rigBasesFrom,
    rigClip,
    rigLookLimits,
    rigPlayable,
    rigSetVersion,
    type RigManifest
} from "@/ark-scene/rig-clips";
import {rigChoices, rigLookChain, type RigSet} from "@/ark-scene/rig-player";

// The contract: AnimalDex docs/ark/rig-v2-manifest.md (branch ark-rigging).

const clip = (extra: Record<string, unknown> = {}) => ({frames: 24, loop: true, seconds: 2, pass: true, ...extra});

test("rig flight: a flight clip plays only when the set's manifest AND the species' entry approve it", () => {
    const flyer = {
        version: 2,
        state: "passed",
        plan: "flying_bird",
        flight_approved: true,
        clips: {walk: clip({ground_speed: 0.2}), flap: clip({frames: 12, seconds: 0.25, flap_hz: 4}), glide: clip(), soar: clip(), bank_l: clip(), bank_r: clip(), hover: clip({frames: 12}), takeoff: clip({loop: false, seconds: 1, rise_h: 1.2}), land: clip({loop: false, seconds: 1, rise_h: 1.2})}
    };
    const held = {...flyer, flight_approved: false};
    const approvedSet: RigManifest = {flight: true, species: {mallard: flyer, "house-sparrow": held}};
    const groundSet: RigManifest = {flight: false, species: {mallard: flyer}};
    const noSwitch: RigManifest = {species: {mallard: flyer}};

    for (const name of Array.from(FLIGHT_CLIPS)) {
        assert.ok(rigClip(approvedSet, "mallard", name), `${name}: set and species approve`);
        assert.equal(rigClip(approvedSet, "house-sparrow", name), null, `${name}: the species is held`);
        assert.equal(rigClip(groundSet, "mallard", name), null, `${name}: the set's switch is off`);
        assert.equal(rigClip(noSwitch, "mallard", name), null, `${name}: no switch (a v1 set) is off`);
    }
    assert.deepEqual(Array.from(FLIGHT_CLIPS).sort(), ["bank_l", "bank_r", "flap", "glide", "hover", "land", "soar", "takeoff"]);
    // Ground clips never depend on the switch.
    assert.ok(rigClip(groundSet, "mallard", "walk"));
    assert.ok(rigClip(approvedSet, "house-sparrow", "walk"));
    assert.equal(flightApproved(approvedSet, "mallard"), true);
    assert.equal(flightApproved(approvedSet, "house-sparrow"), false);
    assert.equal(flightApproved(groundSet, "mallard"), false);
    // A flight clip that failed its own checks never plays, approved or not.
    const failed: RigManifest = {flight: true, species: {owl: {...flyer, clips: {walk: clip({ground_speed: 0.2}), flap: clip({pass: false})}}}};
    assert.equal(rigClip(failed, "owl", "flap"), null);
    // Nothing but held flight: no rig worth loading; approved, it is.
    const onlyFlight = {...flyer, clips: {glide: clip(), land: clip({loop: false})}};
    assert.equal(rigPlayable({flight: false, species: {kite: onlyFlight}}, "kite"), false);
    assert.equal(rigPlayable({flight: true, species: {kite: onlyFlight}}, "kite"), true);
});

test("rig clips: a sitting rest pose holds every moving clip, flight and water included; graze, scan and shake_off play", () => {
    const sitting: RigManifest = {flight: true, species: {"agile-wallaby": {
        version: 2,
        state: "passed",
        pose: "sitting",
        flight_approved: true,
        clips: {idle: clip(), graze: clip({frames: 72, seconds: 3}), scan: clip({frames: 96, seconds: 4}), shake_off: clip({loop: false}), enter_water: clip({loop: false}), exit_water: clip({loop: false}), walk: clip(), flap: clip()}
    }}};
    for (const name of ["idle", "graze", "scan", "shake_off"]) assert.ok(rigClip(sitting, "agile-wallaby", name), name);
    for (const name of ["enter_water", "exit_water", "walk", "flap"]) assert.equal(rigClip(sitting, "agile-wallaby", name), null, name);
});

test("rig sets: v2 first, v1 for every species v2 does not list; a v2 folder's manifest counts only at version 2", () => {
    assert.equal(ARK_RIG_VERSION, "v2");
    assert.equal(ARK_RIG_FALLBACK, "v1");
    const models = "https://x.supabase.co/storage/v1/object/public/talking-models/v1/ark";
    const rigRoot = "https://x.supabase.co/storage/v1/object/public/talking-models/ark-rig";
    assert.deepEqual(rigBasesFrom(models), [`${rigRoot}/v2`, `${rigRoot}/v1`], "the release's set, then the fallback");
    assert.deepEqual(rigBasesFrom(models, null), [], "rigs off (?rig=0, reduced motion pages)");
    assert.deepEqual(rigBasesFrom(models, `${rigRoot}/v1`), [`${rigRoot}/v1`], "?rigv=v1: the v1 set alone");
    assert.deepEqual(rigBasesFrom(models, `${rigRoot}/v3/`), [`${rigRoot}/v3`, `${rigRoot}/v1`], "?rigv=v3: v3 then v1");
    assert.deepEqual(rigBasesFrom("/api/dev/ark-models/v1/ark", "/elsewhere/rigs"), ["/elsewhere/rigs", "/api/dev/ark-models/ark-rig/v1"]);
    assert.deepEqual(rigBasesFrom("/somewhere/else"), [], "a model folder of another shape: no rigs");
    assert.equal(rigSetVersion(`${rigRoot}/v2`), 2);
    assert.equal(rigSetVersion(`${rigRoot}/v1/`), 1);
    assert.equal(rigSetVersion("/elsewhere/rigs"), null);

    // The contract's v2 manifest: version 2, the flight switch, slug -> 12 hex.
    const v2 = decodeRigSet({flight: true, kind: "ark-rig", species: {mallard: "aaaaaaaaaaaa", "red-deer": "bbbbbbbbbbbb", "Bad Slug": "cccccccccccc"}, version: 2}, 2);
    assert.deepEqual(v2, {version: 2, flight: true, index: {mallard: "aaaaaaaaaaaa", "red-deer": "bbbbbbbbbbbb"}});
    assert.equal(decodeRigSet({kind: "ark-rig", species: {mallard: "aaaaaaaaaaaa"}, version: 2}, 2)?.flight, false, "no switch: no flight");
    assert.equal(decodeRigSet({kind: "ark-rig", species: {mallard: "aaaaaaaaaaaa"}, version: 1}, 2), null, "a v2 folder holding a v1 manifest: fall back");
    assert.equal(decodeRigSet({kind: "ark-rig", species: {}, version: 3}, 2), null);
    assert.equal(decodeRigSet({kind: "something-else", species: {}, version: 2}, 2), null);
    assert.equal(decodeRigSet("<html>404</html>", 2), null, "malformed: fall back");
    // v1 (live): version 1, never flight, whatever it says.
    assert.deepEqual(decodeRigSet({kind: "ark-rig", species: {mallard: "dddddddddddd"}, version: 1, flight: true}, 1), {version: 1, flight: false, index: {mallard: "dddddddddddd"}});
    // A development folder with no version in its name takes the manifest's own.
    assert.equal(decodeRigSet({species: {mallard: "dddddddddddd"}, version: 2, flight: true}, null)?.flight, true);

    // Per species: v2 where v2 lists it, v1 otherwise; a failed v2 file falls back to v1's.
    const sets: RigSet[] = [
        {base: `${rigRoot}/v2`, version: 2, flight: true, index: {mallard: "aaaaaaaaaaaa", "red-deer": "bbbbbbbbbbbb"}},
        {base: `${rigRoot}/v1`, version: 1, flight: false, index: {mallard: "dddddddddddd", "red-fox": "eeeeeeeeeeee"}}
    ];
    const choices = rigChoices(sets);
    assert.deepEqual(choices.get("mallard")?.map((s) => s.version), [2, 1]);
    assert.deepEqual(choices.get("red-deer")?.map((s) => s.version), [2]);
    assert.deepEqual(choices.get("red-fox")?.map((s) => s.version), [1], "v2 does not list it: v1");
    assert.equal(choices.get("nobody"), undefined);
    // No v2 manifest (not uploaded): everything from v1.
    const v1Only = rigChoices([null, sets[1]]);
    assert.deepEqual(Array.from(v1Only.keys()).sort(), ["mallard", "red-fox"]);
    assert.deepEqual(v1Only.get("mallard")?.map((s) => s.version), [1]);
});

test("rig look: a v2 entry's chain (bones, pivots, limits, share); a v1 file's neck and head within its plan's limits", () => {
    const deer = {
        bones: ["neck", "head"],
        rest: {neck: {head: [0.00467, 0.13971, 0.08997], axis: [0, 0.55827, 0.82966], up: [0, -0.82966, 0.55827]}, head: {head: [0.00467, 0.29486, 0.32054], axis: [0, 0, 1], up: [0, 1, 0]}},
        limits_deg: {yaw: 70, pitch_up: 30, pitch_down: 45},
        share: {neck: 0.45, head: 0.55}
    };
    assert.ok(decodeRigLook(deer));
    assert.equal(decodeRigLook({...deer, bones: []}), null);
    assert.equal(decodeRigLook({...deer, rest: {neck: deer.rest.neck}}), null, "a bone without its pivot");
    assert.equal(decodeRigLook({...deer, limits_deg: {yaw: "far", pitch_up: 1, pitch_down: 1}}), null);
    const bones = ["hips", "chest", "neck", "head", "leg0L_upper"];
    const noPivot = () => null;
    const chain = rigLookChain({version: 2, state: "passed", plan: "quadruped", clips: {}, look: deer as never}, "red-deer", bones, noPivot);
    assert.ok(chain);
    assert.equal(chain!.neck, 2);
    assert.equal(chain!.head, 3);
    assert.deepEqual(chain!.neckPivot, [0.00467, 0.13971, 0.08997]);
    assert.deepEqual(chain!.headPivot, [0.00467, 0.29486, 0.32054]);
    assert.ok(Math.abs(chain!.yaw - (70 * Math.PI) / 180) < 1e-9);
    assert.ok(Math.abs(chain!.up - (30 * Math.PI) / 180) < 1e-9);
    assert.ok(Math.abs(chain!.down - (45 * Math.PI) / 180) < 1e-9);
    assert.equal(chain!.neckShare, 0.45);
    // A chain rig (a snake): the head alone.
    const snake = rigLookChain({version: 2, state: "passed", plan: "legless", clips: {}, look: {bones: ["head"], rest: {head: {head: [0, 0, 0.4]}}, limits_deg: {yaw: 45, pitch_up: 30, pitch_down: 30}, share: {head: 1}} as never}, "boomslang", ["chain0", "chain1", "head"], noPivot);
    assert.equal(snake?.neck, -1);
    assert.equal(snake?.head, 2);
    assert.equal(snake?.neckShare, 0);
    // A v2 entry with `look: null` (no head bone): no look.
    assert.equal(rigLookChain({version: 2, state: "passed", clips: {}, look: null}, "x", bones, () => [0, 0, 0]), null);
    // A v1 file: no `look`; its own neck and head at their rest joints, the plan's limits (owls furthest).
    const pivots: Record<string, [number, number, number]> = {neck: [0, 0.1, 0.1], head: [0, 0.2, 0.3]};
    const v1 = rigLookChain({state: "passed", plan: "quadruped", clips: {}}, "red-fox", bones, (name) => pivots[name] ?? null);
    assert.equal(v1?.neck, 2);
    assert.deepEqual(v1?.headPivot, [0, 0.2, 0.3]);
    assert.equal(v1?.neckShare, 0.45);
    assert.ok(Math.abs(v1!.yaw - (70 * Math.PI) / 180) < 1e-9);
    const owl = rigLookChain({state: "passed", plan: "flying_bird", clips: {}}, "barn-owl", bones, (name) => pivots[name] ?? null);
    assert.ok(Math.abs(owl!.yaw - (170 * Math.PI) / 180) < 1e-9, "an owl turns its head furthest");
    assert.equal(rigLookLimits("flying_bird", "owlet-nightjar").limits_deg.yaw, 110, "an owlet-nightjar is not an owl");
    assert.equal(rigLookLimits("flying_bird", "jungle-owlet").limits_deg.yaw, 170);
    assert.equal(rigLookChain({state: "passed", plan: "quadruped", clips: {}}, "x", ["hips", "chest"], () => [0, 0, 0]), null, "no head bone: no look");
});

test("rig flight clips: flap to climb, glide down, bank into a turn, soar, hover; open wings held when the flap does not play", async () => {
    const {flightClip} = await import("@/ark-scene/rig-player");
    const all = new Set(["flap", "glide", "bank_l", "bank_r", "takeoff", "land"]);
    const has = (name: string) => all.has(name);
    const base = {has, climb: 0, turn: 0, speed: 3, clock: 0, seed: 0.5, glideShare: 0.3};
    assert.equal(flightClip({...base, climb: 0.3}), "flap", "climbing: wing beats");
    assert.equal(flightClip({...base, climb: -0.3}), "glide", "coming down: a glide");
    assert.equal(flightClip({...base, climb: -0.3, turn: 0.4}), "bank_l", "a left turn (yaw growing toward +x)");
    assert.equal(flightClip({...base, climb: -0.3, turn: -0.4}), "bank_r");
    assert.equal(flightClip({...base, beat: "glide"}), "glide", "the schedule's glide leg");
    // Level flight: flap and glide by turns in the species' share, the same for every viewer at the same moment.
    let glides = 0;
    let flaps = 0;
    for (let t = 0; t < 70; t += 0.1) {
        const name = flightClip({...base, clock: t});
        if (name === "glide") glides++;
        else if (name === "flap") flaps++;
    }
    assert.ok(Math.abs(glides / (glides + flaps) - 0.3) < 0.03, `glide share ${glides / (glides + flaps)}`);
    assert.equal(flightClip({...base, clock: 12.3}), flightClip({...base, clock: 12.3}), "deterministic");
    // Hysteresis: a level path with a small climb keeps flapping, a small turn keeps banking.
    assert.equal(flightClip({...base, climb: 0.05, current: "flap"}), "flap");
    assert.equal(flightClip({...base, climb: -0.3, turn: 0.1, current: "bank_l"}), "bank_l");
    assert.equal(flightClip({...base, climb: -0.3, turn: 0.1, current: "glide"}), "glide");
    // Soarers soar (and bank in a tight turn); hoverers hover when they hang still.
    const raptor = new Set(["flap", "glide", "soar", "bank_l", "bank_r", "hover"]);
    assert.equal(flightClip({...base, has: (n) => raptor.has(n), soaring: true}), "soar");
    assert.equal(flightClip({...base, has: (n) => raptor.has(n), soaring: true, turn: 0.7}), "bank_l");
    assert.equal(flightClip({...base, has: (n) => raptor.has(n), speed: 0.1}), "hover");
    // flight_fallback_open: no playable flap; an open-wing clip is held, never a closed pose.
    const noFlap = new Set(["glide", "bank_l", "bank_r"]);
    assert.equal(flightClip({...base, has: (n) => noFlap.has(n), climb: 0.3, open: true}), "glide");
    assert.equal(flightClip({...base, has: (n) => n === "bank_r", open: true}), "bank_r");
    assert.equal(flightClip({...base, has: (n) => n === "takeoff" || n === "land", open: true}), "takeoff", "no open-wing loop: the take-off's last frame held");
    assert.equal(flightClip({...base, has: () => false, open: true}), null, "no flight clip at all: the procedural flight");
});

test("rig beat clips: grazing beats head down, a browser's head up, scan, shake_off, into and out of the water", async () => {
    const {beatClip} = await import("@/ark-scene/rig-player");
    const deer = new Set(["idle", "walk", "graze", "browse", "scan"]);
    const has = (name: string) => deer.has(name);
    assert.equal(beatClip("bite", "graze", has), "graze");
    assert.equal(beatClip("chew", "graze", has), "graze");
    assert.equal(beatClip("bite", "browse", has), "browse");
    assert.equal(beatClip("bite", "browse", (n) => n === "graze"), null, "a grazer's head down never stands in for browsing");
    assert.equal(beatClip("bite", "graze", (n) => n === "browse"), null, "nor a browser's head up for grazing");
    assert.equal(beatClip("peck", "forage", has), "graze");
    assert.equal(beatClip("drink", "drink", has), "graze");
    assert.equal(beatClip("scan", "watch", has), "scan");
    const duck = new Set(["idle", "walk", "graze", "scan", "enter_water", "exit_water", "shake_off"]);
    assert.equal(beatClip("shake", "rest", (n) => duck.has(n)), "shake_off", "the clip is shake_off");
    assert.equal(beatClip("enter_water", "swim", (n) => duck.has(n)), "enter_water");
    assert.equal(beatClip("exit_water", "rest", (n) => duck.has(n)), "exit_water");
    assert.equal(beatClip("shake", "rest", has), null, "no clip: the scene's own");
    assert.equal(beatClip("walk", "wander", has), null);
    assert.equal(beatClip(null, null, has), null);
});
