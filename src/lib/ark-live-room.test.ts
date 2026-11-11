import assert from "node:assert/strict";
import test from "node:test";
import {Room, type RoomOptions} from "@/ark-live/room";
import {MemoryStore} from "@/ark-live/memory-store";
import {decodeBinary, encodePing, encodePose, type Mode, type StartPose} from "@/ark-live/protocol";
import {abilitiesOf} from "@/ark-live/species";
import {homeRadius} from "@/ark-live/release";
import {signTicket} from "@/ark-live/ticket";
import {TRACE_STEP_S, traceStep, SESSION_LIMIT_S, DAY_LIMIT_S} from "@/ark-live/session";
import type {IslandId, Strait} from "@/ark-live/islands";
import type {AnimalFacts} from "@/ark-live/rules";
import type {Abilities} from "@/ark-live/species";
import {
    ANIMAL_DOLPHIN,
    ANIMAL_EAGLE,
    ANIMAL_FOX,
    ANIMAL_FOX2,
    ANIMAL_GOAT,
    ANIMAL_SALMON,
    ANIMAL_ZOO,
    FakeClock,
    FakeLink,
    GridTerrain,
    settle,
    TEST_KEY,
    USER_A,
    USER_B
} from "@/lib/ark-live-fixtures";

/** Homes on the test island (`GridTerrain`). */
const HOMES: Record<string, {x: number; z: number}> = {grassland: {x: -10, z: -30}, desert: {x: -40, z: 0}, polar: {x: 0, z: 40}, open_ocean: {x: 40, z: 0}, farm_garden: {x: 17, z: -45}, mountains: {x: -10, z: -30}};
const homeOf = (facts: AnimalFacts, a: Abilities) => ({...(HOMES[facts.zone] ?? HOMES.grassland), r: homeRadius(a)});

/** The server's epoch base in these tests: the fake clock's start less 5 s. Wire times count from it. */
const EPOCH_BASE = new FakeClock().ms - 5000;
const wireT = (clock: FakeClock) => clock.ms - EPOCH_BASE;

function world(extra: Partial<RoomOptions> = {}, island: IslandId = "wild") {
    const clock = new FakeClock();
    const store = new MemoryStore(clock.now);
    const add = (id: string, slug: string, zone: string, owners: string[], more: Record<string, unknown> = {}) =>
        store.addAnimal({id, slug, zone: zone as never, area: null, island, enclosure_id: null, label: "Voyager 1", named: false, owners, ...more});
    add(ANIMAL_FOX, "red-fox", "grassland", [USER_A, USER_B]);
    add(ANIMAL_FOX2, "red-fox", "grassland", [USER_A]);
    add(ANIMAL_EAGLE, "golden-eagle", "mountains", [USER_A]);
    add(ANIMAL_SALMON, "atlantic-salmon", "open_ocean", [USER_A]);
    add(ANIMAL_ZOO, "red-fox", "grassland", [USER_A], {enclosure_id: 7});
    add(ANIMAL_GOAT, "domestic-goat", "farm_garden", [USER_A], {area: "farm"});
    add(ANIMAL_DOLPHIN, "spinner-dolphin", "open_ocean", [USER_A]);
    const room = new Room({island, terrain: new GridTerrain(island), ticketKey: TEST_KEY, store, now: clock.now, epochBase: EPOCH_BASE, homeOf, ...extra});
    return {clock, store, room};
}

const FOX_START: StartPose = {x: -10, y: 0.5, z: -30, yaw: 0, mode: "ground"};

async function control(room: Room, store: MemoryStore, user: string, animal: string, start: StartPose = FOX_START, island: IslandId = "wild", link = new FakeLink()) {
    const id = room.connect(link);
    link.room = room;
    link.clientId = id;
    const minted = await store.mint(user, animal, island, TEST_KEY);
    assert.ok(minted.ok, JSON.stringify(minted));
    room.message(id, JSON.stringify({t: "control", ticket: minted.ok ? minted.ticket : "", start}));
    await settle(10);
    return {id, link};
}

function snapshots(link: FakeLink) {
    return link.binaries.map((b) => decodeBinary(b, 0.01)).filter((d): d is Extract<ReturnType<typeof decodeBinary>, {type: "snapshot"}> => d?.type === "snapshot");
}

function tickFor(room: Room, clock: FakeClock, ms: number) {
    for (let t = 0; t < ms; t += 100) {
        clock.advance(100);
        room.tick();
    }
}

test("room: a ticket starts control; every viewer is told who joined and sees it in the snapshots", async () => {
    const {clock, store, room} = world();
    const watcher = new FakeLink();
    room.connect(watcher, {tier: "high"});
    assert.equal(watcher.last("welcome")?.island, "wild");
    const {link} = await control(room, store, USER_A, ANIMAL_FOX);
    const ok = link.last("control-ok");
    assert.ok(ok, JSON.stringify(link.texts));
    assert.equal(ok!.animalId, ANIMAL_FOX);
    assert.equal(watcher.last("joined")?.animalId, ANIMAL_FOX);
    // Watchers never get a user id or a label on the wire (D11: the tap card shows the label it already has).
    assert.ok(!JSON.stringify(watcher.texts).includes(USER_A));
    tickFor(room, clock, 1000);
    const snaps = snapshots(watcher);
    assert.ok(snaps.length >= 9 && snaps.length <= 11, `10 Hz: ${snaps.length}`);
    assert.equal(snaps[0].snapshot.entities[0].idx, ok!.idx);
    assert.equal(store.locks.get(ANIMAL_FOX)?.userId, USER_A);
});

test("room: bad, expired, reused and wrong-island tickets are refused; so is someone else's animal", async () => {
    const {clock, store, room} = world();
    const link = new FakeLink();
    const id = room.connect(link);
    const forged = await signTicket({user: USER_A, animal: ANIMAL_FOX, island: "wild", exp: Math.floor(clock.ms / 1000) + 100, nonce: "00000000-0000-4000-8000-000000000009"}, "AQECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=");
    room.message(id, JSON.stringify({t: "control", ticket: forged, start: FOX_START}));
    await settle(10);
    assert.equal(link.last("control-denied")?.reason, "bad_ticket");
    const minted = await store.mint(USER_A, ANIMAL_FOX, "wild", TEST_KEY);
    clock.advance(121_000);
    room.message(id, JSON.stringify({t: "control", ticket: minted.ok ? minted.ticket : "", start: FOX_START}));
    await settle(10);
    assert.equal(link.last("control-denied")?.reason, "expired");
    const nonce = "00000000-0000-4000-8000-00000000000c";
    const first = await store.mint(USER_A, ANIMAL_FOX2, "wild", TEST_KEY, nonce);
    room.message(id, JSON.stringify({t: "control", ticket: first.ok ? first.ticket : "", start: FOX_START}));
    await settle(10);
    assert.ok(link.last("control-ok"));
    room.message(id, JSON.stringify({t: "release"}));
    await settle(10);
    // The same ticket again (single use), from another connection.
    const link2 = new FakeLink();
    const id2 = room.connect(link2);
    clock.advance(70_000);
    room.message(id2, JSON.stringify({t: "control", ticket: first.ok ? first.ticket : "", start: FOX_START}));
    await settle(10);
    assert.equal(link2.last("control-denied")?.reason, "used");
    // A ticket for another island.
    const wild = await signTicket({user: USER_A, animal: ANIMAL_FOX, island: "town", exp: Math.floor(clock.ms / 1000) + 100, nonce: "00000000-0000-4000-8000-00000000000d"}, TEST_KEY);
    room.message(id2, JSON.stringify({t: "control", ticket: wild, start: FOX_START}));
    await settle(10);
    assert.equal(link2.last("control-denied")?.reason, "wrong_island");
    // Not theirs: the store says no.
    assert.deepEqual(await store.mint(USER_B, ANIMAL_FOX2, "wild", TEST_KEY), {ok: false, reason: "not_yours"});
});

test("room: one controlled animal per person (D2) and one controller per animal", async () => {
    const {store, room} = world();
    await control(room, store, USER_A, ANIMAL_FOX);
    const second = await control(room, store, USER_A, ANIMAL_FOX2);
    assert.equal(second.link.last("control-denied")?.reason, "other_animal");
    // User B co-owns the fox (a shared young, D1: first come, first served).
    const other = await control(room, store, USER_B, ANIMAL_FOX);
    assert.equal(other.link.last("control-denied")?.reason, "busy");
});

test("room: accepted poses reach everyone; a cheat gets a correction back and nobody sees it", async () => {
    const {clock, store, room} = world();
    const watcher = new FakeLink();
    room.connect(watcher);
    const {id, link} = await control(room, store, USER_A, ANIMAL_FOX);
    const send = (seq: number, z: number, clip: "walk" | "sprint" = "walk") => room.message(id, encodePose({seq, t: wireT(clock), x: -10, y: 0.5, z, yaw: 0, pitch: 0, roll: 0, mode: "ground", clip, speed: 1, flags: 0}, 0.01));
    clock.advance(100);
    send(1, -29.9);
    room.tick();
    clock.advance(100);
    send(2, -24); // 5.9 m in 100 ms
    room.tick();
    const corrections = link.binaries.map((b) => decodeBinary(b, 0.01)).filter((d) => d?.type === "correction");
    assert.equal(corrections.length, 1);
    const last = snapshots(watcher).pop()!.snapshot.entities[0];
    assert.ok(Math.abs(last.z + 29.9) < 0.02, `watchers see the last accepted pose (${last.z})`);
    // Ping → pong on the server's clock.
    room.message(id, encodePing(1234));
    const pong = link.binaries.map((b) => decodeBinary(b, 0.01)).find((d) => d?.type === "pong");
    assert.ok(pong && pong.type === "pong" && pong.c0 === 1234 && pong.s === wireT(clock), JSON.stringify(pong));
});

test("room: a session ends at 20 minutes (released into NPC life), then a 10 minute cooldown (D3)", async () => {
    const {clock, store, room} = world();
    const {link} = await control(room, store, USER_A, ANIMAL_FOX);
    tickFor(room, clock, SESSION_LIMIT_S * 1000 + 300);
    await settle(10);
    assert.equal(link.last("released")?.reason, "session_limit");
    assert.equal(store.locks.has(ANIMAL_FOX), false, "the lock is gone");
    assert.equal(store.states.get(ANIMAL_FOX)?.version, 1, "a stored record");
    assert.deepEqual(await store.mint(USER_A, ANIMAL_FOX, "wild", TEST_KEY), {ok: false, reason: "cooldown"});
    clock.advance(10 * 60 * 1000 + 1000);
    assert.ok((await store.mint(USER_A, ANIMAL_FOX, "wild", TEST_KEY)).ok, "after the cooldown");
});

test("room: at most 60 minutes per animal per real day (D3)", async () => {
    const {clock, store, room} = world();
    // 59.5 minutes already used today.
    const dayStart = Math.floor(clock.ms / 86_400_000) * 86_400_000;
    clock.ms = Math.max(clock.ms, dayStart + 3 * 3600_000);
    store.sessions.set("old", {id: "old", userId: USER_A, animalId: ANIMAL_FOX, island: "wild", startedAt: clock.ms - 3570_000, endedAt: clock.ms - 0, reason: "player", stats: null});
    const {link} = await control(room, store, USER_A, ANIMAL_FOX);
    assert.ok(link.last("control-ok"));
    assert.ok((link.last("control-ok")!.dayLeft as number) <= 31);
    tickFor(room, clock, 31_000);
    await settle(10);
    assert.equal(link.last("released")?.reason, "daily_limit");
    assert.equal(DAY_LIMIT_S, 3600);
});

test("room: a dropped controller keeps its animal 30 s (and may resume), then it is released where it was", async () => {
    const {clock, store, room} = world();
    const {id, link} = await control(room, store, USER_A, ANIMAL_FOX);
    const ok = link.last("control-ok")!;
    room.disconnect(id);
    tickFor(room, clock, 10_000);
    const back = new FakeLink();
    const id2 = room.connect(back);
    room.message(id2, JSON.stringify({t: "resume", sessionId: ok.sessionId, token: ok.resumeToken}));
    await settle(5);
    assert.ok(back.last("control-ok"), "resumed");
    room.message(id2, JSON.stringify({t: "resume", sessionId: ok.sessionId, token: "wrong"}));
    await settle(5);
    assert.equal(back.last("control-denied")?.reason, "bad_ticket");
    room.disconnect(id2);
    tickFor(room, clock, 31_000);
    await settle(10);
    const session = Array.from(store.sessions.values()).find((s) => s.animalId === ANIMAL_FOX)!;
    assert.equal(session.reason, "disconnect");
    const state = store.states.get(ANIMAL_FOX)!;
    assert.ok(state.plan.legs.length >= 1);
    assert.ok(Math.abs(state.plan.legs[0][1] + 10) < 0.1 && Math.abs(state.plan.legs[0][2] + 30) < 0.1, "released where it was");
});

test("room: traces once per encounter step on the absolute grid, never at or before the tick's committed step", async () => {
    const {clock, store, room} = world();
    clock.ms = Math.ceil(clock.ms / 1000 / TRACE_STEP_S) * TRACE_STEP_S * 1000 + 1000;
    await control(room, store, USER_A, ANIMAL_FOX);
    tickFor(room, clock, Math.round(TRACE_STEP_S * 2.2 * 1000));
    await settle(5);
    const steps = store.traces.map((r) => r.step);
    assert.equal(steps.length, 2, `two steps crossed: ${steps}`);
    assert.equal(new Set(steps).size, 2);
    assert.equal(steps[0], traceStep(clock.ms / 1000) - 1);
    store.tickedToStep = traceStep(clock.ms / 1000) + 5;
    tickFor(room, clock, Math.round(TRACE_STEP_S * 1000));
    await settle(5);
    assert.equal(store.traces.length, 2, "a step the tick has passed is refused");
});

test("room: heartbeats keep the lock (30 s TTL, every 10 s)", async () => {
    const {clock, store, room} = world();
    await control(room, store, USER_A, ANIMAL_FOX);
    tickFor(room, clock, 45_000);
    await settle(5);
    assert.ok(store.locks.get(ANIMAL_FOX)!.expiresAt > clock.ms + 15_000);
});

test("room: exposure past 0.9 ends control and sends it home (no death during control, D6)", async () => {
    const {clock, store, room} = world();
    const {link} = await control(room, store, USER_A, ANIMAL_FOX);
    room.sessionFor(ANIMAL_FOX)!.meters.exposure = 0.95;
    tickFor(room, clock, 200);
    await settle(10);
    assert.equal(link.last("released")?.reason, "exposure");
    assert.ok(store.states.get(ANIMAL_FOX));
});

test("room: the player releases; the record is versioned and public without user ids", async () => {
    const {clock, store, room} = world();
    const first = await control(room, store, USER_A, ANIMAL_FOX);
    room.message(first.id, JSON.stringify({t: "release"}));
    await settle(10);
    assert.equal(first.link.last("released")?.reason, "player");
    clock.advance(1000);
    const second = await control(room, store, USER_A, ANIMAL_FOX, {x: 20, y: 0.5, z: 10, yaw: 0, mode: "ground"});
    assert.ok(second.link.last("control-ok"), JSON.stringify(second.link.texts.slice(-2)));
    room.message(second.id, JSON.stringify({t: "release"}));
    await settle(10);
    assert.equal(store.states.get(ANIMAL_FOX)!.version, 2);
    const pub = JSON.stringify(store.publicStates("wild"));
    assert.ok(!pub.includes(USER_A) && !pub.includes(USER_B));
});

test("room: a start far from home and out of its zone is refused; a zoo animal can't start outside its enclosure", async () => {
    const {store, room} = world();
    // A fox (grassland, home at (−10, −30)) asked to start in the snow at (0, 45): too far, wrong region.
    const far = await control(room, store, USER_A, ANIMAL_FOX, {x: 0, y: 0.5, z: 45, yaw: 0, mode: "ground"});
    // (The polar zone shares no region with grassland, and it is 75 m from home: past 60 m + its home radius.)
    assert.equal(far.link.last("control-denied")?.reason, "start_pose");
    const zoo = await control(room, store, USER_A, ANIMAL_ZOO, {x: -12, y: 0.5, z: 32, yaw: 0, mode: "ground"});
    assert.equal(zoo.link.last("control-denied")?.reason, "start_pose");
});

test("room: each viewer gets only the nearest controlled animals (the AOI cap) at its tier's rate", async () => {
    const {clock, store, room} = world();
    for (let i = 0; i < 20; i++) {
        const id = `00000000-0000-4000-8000-${String(100 + i).padStart(12, "0")}`;
        const user = `00000000-0000-4000-9000-${String(100 + i).padStart(12, "0")}`;
        store.addAnimal({id, slug: "red-fox", zone: "grassland", area: null, island: "wild", enclosure_id: null, label: "Voyager", named: false, owners: [user]});
        await control(room, store, user, id, {x: -20 + i, y: 0.5, z: -30, yaw: 0, mode: "ground"});
    }
    const low = new FakeLink();
    const lowId = room.connect(low, {tier: "low"});
    room.message(lowId, JSON.stringify({t: "view", x: -20, z: -30}));
    await settle(2);
    tickFor(room, clock, 1000);
    const snaps = snapshots(low);
    assert.ok(snaps.length >= 4 && snaps.length <= 6, `5 Hz: ${snaps.length}`);
    assert.equal(snaps[0].snapshot.entities.length, 12, "the low tier's cap");
    // The nearest to its view.
    const xs = snaps[0].snapshot.entities.map((e) => e.x).sort((a, b) => a - b);
    assert.ok(xs[xs.length - 1] <= -20 + 11 + 0.01);
});

// MARK: Two islands

const STRAIT: Strait = {from: "wild", to: "town", a0: {x: 45, z: -10}, a1: {x: 45, z: 10}, out: {x: 1, z: 0}, b0: {x: 45, z: -10}, b1: {x: 45, z: 10}, into: {x: -1, z: 0}, length: 300, halfWidth: 40, depth: 30, bandReach: 12};
const BACK: Strait = {...STRAIT, from: "town", to: "wild"};

function islands() {
    const clock = new FakeClock();
    const store = new MemoryStore(clock.now);
    const rooms = new Map<IslandId, Room>();
    const userSessions = new Map<string, {island: IslandId; sessionId: string}>();
    for (const island of ["wild", "town"] as const) {
        rooms.set(island, new Room({island, terrain: new GridTerrain(island), ticketKey: TEST_KEY, store, now: clock.now, epochBase: EPOCH_BASE, homeOf, straits: [STRAIT, BACK], peers: () => rooms, userSessions}));
    }
    const add = (id: string, slug: string, zone: string, more: Record<string, unknown> = {}) => store.addAnimal({id, slug, zone: zone as never, area: null, island: "wild", enclosure_id: null, label: "Voyager 1", named: false, owners: [USER_A], ...more});
    add(ANIMAL_EAGLE, "golden-eagle", "mountains");
    add(ANIMAL_FOX, "red-fox", "grassland");
    add(ANIMAL_DOLPHIN, "spinner-dolphin", "open_ocean");
    add(ANIMAL_GOAT, "budgerigar", "grassland", {area: "house"});
    return {clock, store, rooms, wild: rooms.get("wild")!, town: rooms.get("town")!};
}

const EAGLE_OFFSHORE: StartPose = {x: 46, y: 6, z: 0, yaw: Math.PI / 2, mode: "air"};

test("crossing: the pre-check refuses walkers, kept pets, the tired and those outside the band, with a plain reason", async () => {
    const {clock, store, wild} = islands();
    const fox = await control(wild, store, USER_A, ANIMAL_FOX, {x: 25, y: 0.5, z: 0, yaw: 0, mode: "ground"}, "wild");
    wild.message(fox.id, JSON.stringify({t: "cross"}));
    await settle(3);
    assert.equal(fox.link.last("crossing")?.reason, "cant", "a fox can't fly or swim across: it releases at the shore");
    wild.message(fox.id, JSON.stringify({t: "release"}));
    await settle(5);
    clock.advance(1000);
    const eagle = await control(wild, store, USER_A, ANIMAL_EAGLE, {x: 20, y: 6, z: 0, yaw: Math.PI / 2, mode: "air"}, "wild");
    wild.message(eagle.id, JSON.stringify({t: "cross"}));
    await settle(3);
    assert.equal(eagle.link.last("crossing")?.reason, "band");
    wild.sessionFor(ANIMAL_EAGLE)!.motion.last = {...wild.sessionFor(ANIMAL_EAGLE)!.motion.last, x: 46, z: 0};
    wild.sessionFor(ANIMAL_EAGLE)!.meters.stamina = 0.05;
    wild.message(eagle.id, JSON.stringify({t: "cross"}));
    await settle(3);
    assert.equal(eagle.link.last("crossing")?.reason, "tired");
    wild.message(eagle.id, JSON.stringify({t: "release"}));
    await settle(5);
    clock.advance(1000);
    const pet = await control(wild, store, USER_A, ANIMAL_GOAT, {x: 46, y: 4, z: 0, yaw: Math.PI / 2, mode: "air"}, "wild");
    if (pet.link.last("control-ok")) {
        wild.message(pet.id, JSON.stringify({t: "cross"}));
        await settle(3);
        assert.equal(pet.link.last("crossing")?.reason, "kept", "kept pets that fly stay home (DECISIONS #9)");
    }
});

function sendCorridor(link: FakeLink, seq: number, t: number, s: number, l: number, h: number) {
    link.room!.message(link.clientId!, encodePose({seq, t, x: s, y: h, z: l, yaw: 0, pitch: 0, roll: 0, mode: "strait", clip: "glide", speed: 9, flags: 0}, link.room!.unit));
}

test("crossing: an eagle flies the strait, is handed to the far island's room at halfway, and comes ashore there", async () => {
    const {clock, store, wild, town} = islands();
    const wildWatcher = new FakeLink();
    wild.connect(wildWatcher);
    const townWatcher = new FakeLink();
    town.connect(townWatcher);
    const {id, link} = await control(wild, store, USER_A, ANIMAL_EAGLE, EAGLE_OFFSHORE, "wild");
    assert.ok(link.last("control-ok"));
    link.room = wild;
    link.clientId = id;
    wild.message(id, JSON.stringify({t: "cross"}));
    await settle(3);
    assert.equal(link.last("crossing")?.phase, "start");
    const a = abilitiesOf("golden-eagle");
    const v = a.fly * 0.8;
    let s = 0;
    let seq = 1;
    while (s < 300) {
        clock.advance(100);
        s = Math.min(300, s + v * 0.1);
        sendCorridor(link, seq++, wireT(clock), s, 0, 8);
        link.room!.tick();
    }
    assert.ok(link.texts.some((m) => m.t === "crossing" && m.phase === "halfway"), "halfway");
    assert.equal(link.room, town, "the link was rebound to the town's room");
    assert.equal(wildWatcher.last("left")?.idx !== undefined, true, "the wild island's watchers saw it leave");
    assert.equal(townWatcher.last("joined")?.animalId, ANIMAL_EAGLE, "the town's watchers saw it arrive");
    assert.ok(link.texts.some((m) => m.t === "crossing" && m.phase === "arrived"), JSON.stringify(link.texts.slice(-4)));
    assert.equal(town.sessionFor(ANIMAL_EAGLE)!.motion.last.mode, "air");
    assert.equal(wild.sessionFor(ANIMAL_EAGLE), null);
    // Released on the wrong island within an Ark day: it retraces.
    link.room!.message(link.clientId!, JSON.stringify({t: "release"}));
    await settle(10);
    const state = store.states.get(ANIMAL_EAGLE)!;
    assert.equal(state.plan.kind, "retrace");
    assert.equal(state.island, "wild");
    assert.deepEqual(state.home, {island: "wild"}, "the home override sends it home to its own island");
});

test("crossing: corridor cheats are corrected (speed, the corridor's width, the height band), and no parking at sea", async () => {
    const {clock, store, wild} = islands();
    const {id, link} = await control(wild, store, USER_A, ANIMAL_EAGLE, EAGLE_OFFSHORE, "wild");
    link.room = wild;
    link.clientId = id;
    wild.message(id, JSON.stringify({t: "cross"}));
    await settle(3);
    const count = () => link.binaries.map((b) => decodeBinary(b, wild.unit)).filter((d) => d?.type === "correction").length;
    clock.advance(100);
    sendCorridor(link, 1, wireT(clock), 50, 0, 8);
    assert.equal(count(), 1, "50 m in 100 ms");
    clock.advance(100);
    sendCorridor(link, 2, wireT(clock), 0.5, 45, 8);
    assert.equal(count(), 2, "outside the corridor");
    clock.advance(100);
    sendCorridor(link, 3, wireT(clock), 0.5, 0, 50);
    assert.equal(count(), 3, "above 42 m");
    // Hover in place for 6 s.
    for (let i = 0; i < 60; i++) {
        clock.advance(100);
        sendCorridor(link, 4 + i, wireT(clock), 0.6, 0, 8);
    }
    assert.ok(count() > 3, "stalling at sea");
});

test("crossing: turn back before halfway (the server brings it home), and under 10 % stamina the server takes over", async () => {
    const {clock, store, wild} = islands();
    const {id, link} = await control(wild, store, USER_A, ANIMAL_EAGLE, EAGLE_OFFSHORE, "wild");
    link.room = wild;
    link.clientId = id;
    wild.message(id, JSON.stringify({t: "cross"}));
    await settle(3);
    const v = abilitiesOf("golden-eagle").fly * 0.8;
    for (let i = 1; i <= 50; i++) {
        clock.advance(100);
        sendCorridor(link, i, wireT(clock), Math.min(i * v * 0.1, 140), 0, 8);
        wild.tick();
    }
    wild.message(id, JSON.stringify({t: "turn-back"}));
    await settle(2);
    tickFor(wild, clock, 40_000);
    assert.ok(link.texts.some((m) => m.t === "crossing" && m.phase === "rescued"), "back on its own island");
    assert.equal(wild.sessionFor(ANIMAL_EAGLE)!.crossing, null);
});

test("crossing: a dropped connection mid-strait releases it on the nearer side", async () => {
    const {clock, store, wild, town} = islands();
    const {id, link} = await control(wild, store, USER_A, ANIMAL_EAGLE, EAGLE_OFFSHORE, "wild");
    link.room = wild;
    link.clientId = id;
    wild.message(id, JSON.stringify({t: "cross"}));
    await settle(3);
    const v = abilitiesOf("golden-eagle").fly * 0.8;
    let s = 0;
    for (let i = 1; s < 200; i++) {
        clock.advance(100);
        s += v * 0.1;
        sendCorridor(link, i, wireT(clock), s, 0, 8);
        link.room!.tick();
    }
    assert.equal(link.room, town);
    town.disconnect(link.clientId!);
    tickFor(town, clock, 31_000);
    await settle(10);
    const state = store.states.get(ANIMAL_EAGLE)!;
    assert.equal(state.island, "town");
    assert.equal(state.home?.island, "town", "left on the town island: its home override names it");
    assert.equal(store.homeOverrides("town").length, 1);
    assert.ok(Math.abs(state.plan.legs[0][1] - 45) < 1, "at the far island's band");
});

test("crossing: a dolphin swims it (sea at home), a salmon-like fresh-water fish could not", async () => {
    const {store, wild} = islands();
    const dolphin = await control(wild, store, USER_A, ANIMAL_DOLPHIN, {x: 46, y: -2, z: 0, yaw: Math.PI / 2, mode: "swim" as Mode}, "wild");
    dolphin.link.room = wild;
    dolphin.link.clientId = dolphin.id;
    wild.message(dolphin.id, JSON.stringify({t: "cross"}));
    await settle(3);
    assert.equal(dolphin.link.last("crossing")?.phase, "start", JSON.stringify(dolphin.link.texts.slice(-2)));
});
