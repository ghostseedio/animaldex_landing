import assert from "node:assert/strict";
import test from "node:test";
import {
    angleDelta,
    CLIPS,
    decodeBinary,
    encodeCorrection,
    encodeMeter,
    encodeNpc,
    encodePing,
    encodePong,
    encodePose,
    encodeSnapshot,
    MODES,
    POSE_BYTES,
    SNAPSHOT_ENTITY_BYTES,
    SNAPSHOT_HEADER_BYTES,
    unwrapMs,
    wrapAngle
} from "@/ark-live/protocol";
import {base64ToBytes, bytesToBase64Url, signTicket, verifyTicket} from "@/ark-live/ticket";
import {ClockSync} from "@/ark-live/clock";
import {RemoteTrack, type Sample} from "@/ark-live/interp";
import {TEST_KEY} from "@/lib/ark-live-fixtures";

const near = (a: number, b: number, eps: number, what = "") => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} vs ${b} (±${eps})`);

test("protocol: a pose survives the wire to a centimetre and a fraction of a degree", () => {
    const pose = {seq: 65535, t: 4_000_000_123, x: -131.23, y: 12.34, z: 87.65, yaw: 5.9, pitch: -0.4, roll: 0.3, mode: "air" as const, clip: "bank_l" as const, speed: 12.3, flags: 5};
    const buffer = encodePose(pose, 0.01);
    assert.equal(buffer.byteLength, POSE_BYTES);
    const decoded = decodeBinary(buffer, 0.01);
    assert.equal(decoded?.type, "pose");
    if (decoded?.type !== "pose") return;
    const p = decoded.pose;
    assert.equal(p.seq, 65535);
    assert.equal(p.t, 4_000_000_123);
    near(p.x, pose.x, 0.006, "x");
    near(p.z, pose.z, 0.006, "z");
    near(p.y, pose.y, 0.006, "y");
    near(Math.abs(angleDelta(p.yaw, pose.yaw)), 0, 0.0002, "yaw");
    near(p.pitch, pose.pitch, 0.007, "pitch");
    assert.equal(p.mode, "air");
    assert.equal(p.clip, "bank_l");
    near(p.speed, 12.3, 0.051, "speed");
    assert.equal(p.flags, 5);
});

test("protocol: a 2 cm island unit carries ±655 m", () => {
    const decoded = decodeBinary(encodePose({seq: 1, t: 1, x: 640, y: 0, z: -640, yaw: 0, pitch: 0, roll: 0, mode: "ground", clip: "walk", speed: 1, flags: 0}, 0.02), 0.02);
    assert.ok(decoded?.type === "pose");
    if (decoded?.type === "pose") {
        near(decoded.pose.x, 640, 0.011);
        near(decoded.pose.z, -640, 0.011);
    }
});

test("protocol: a snapshot is 9 B plus 14 B an animal, and round-trips every mode and clip", () => {
    const entities = MODES.map((mode, i) => ({idx: 1000 + i, x: i * 3.21 - 10, y: -i * 0.5, z: 50 - i, yaw: i * 0.7, roll: 0.1 * i - 0.3, mode, clip: CLIPS[(i * 5) % CLIPS.length], phase: i / 10, speed: i * 1.5, flags: i}));
    const buffer = encodeSnapshot({tick: 123456, ack: 42, flags: 3, entities}, 0.01);
    assert.equal(buffer.byteLength, SNAPSHOT_HEADER_BYTES + entities.length * SNAPSHOT_ENTITY_BYTES);
    const decoded = decodeBinary(buffer, 0.01);
    assert.ok(decoded?.type === "snapshot");
    if (decoded?.type !== "snapshot") return;
    assert.equal(decoded.snapshot.tick, 123456);
    assert.equal(decoded.snapshot.ack, 42);
    assert.equal(decoded.snapshot.entities.length, entities.length);
    decoded.snapshot.entities.forEach((e, i) => {
        assert.equal(e.idx, entities[i].idx);
        assert.equal(e.mode, entities[i].mode);
        assert.equal(e.clip, entities[i].clip);
        near(e.x, entities[i].x, 0.006);
        near(Math.abs(angleDelta(e.yaw, wrapAngle(entities[i].yaw))), 0, 0.025);
        assert.equal(e.flags, entities[i].flags);
    });
});

test("protocol: corrections, meters, npc offsets, ping and pong round-trip", () => {
    const c = decodeBinary(encodeCorrection({seq: 9, reason: "teleport", x: 1.5, y: 2, z: -3, yaw: 1, mode: "swim", clip: "swim"}, 0.01), 0.01);
    assert.ok(c?.type === "correction" && c.correction.reason === "teleport" && c.correction.mode === "swim" && c.correction.seq === 9);
    const m = decodeBinary(encodeMeter({stamina: 0.5, exposure: 0.25, habitat: 0.3, cause: "cold", flags: 9, sessionLeft: 1199, dayLeft: 3000}), 0.01);
    assert.ok(m?.type === "meter");
    if (m?.type === "meter") {
        near(m.meter.stamina, 0.5, 0.003);
        assert.equal(m.meter.cause, "cold");
        assert.equal(m.meter.sessionLeft, 1199);
    }
    const n = decodeBinary(encodeNpc({tick: 77, offsets: [{idx: 5, dx: 1.2, dz: -0.8, dyaw: 0.5, doing: 3, alarm: 0.5, look: 2}]}), 0.01);
    assert.ok(n?.type === "npc" && n.npc.offsets.length === 1 && n.npc.offsets[0].idx === 5);
    const ping = decodeBinary(encodePing(2 ** 32 + 5), 0.01);
    assert.ok(ping?.type === "ping" && ping.c0 === 5);
    const pong = decodeBinary(encodePong(7, 99), 0.01);
    assert.ok(pong?.type === "pong" && pong.c0 === 7 && pong.s === 99);
});

test("protocol: malformed frames are refused, never guessed", () => {
    assert.equal(decodeBinary(new ArrayBuffer(0), 0.01), null);
    assert.equal(decodeBinary(new Uint8Array([99, 0, 0]), 0.01), null);
    const pose = new Uint8Array(encodePose({seq: 1, t: 1, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0, mode: "ground", clip: "idle", speed: 0, flags: 0}, 0.01));
    assert.equal(decodeBinary(pose.slice(0, POSE_BYTES - 1), 0.01), null, "short pose");
    pose[17] = 99;
    assert.equal(decodeBinary(pose, 0.01), null, "unknown mode");
    const snap = new Uint8Array(encodeSnapshot({tick: 1, ack: 0, flags: 0, entities: [{idx: 1, x: 0, y: 0, z: 0, yaw: 0, roll: 0, mode: "ground", clip: "idle", phase: 0, speed: 0, flags: 0}]}, 0.01));
    snap[7] = 3;
    assert.equal(decodeBinary(snap, 0.01), null, "count past the end");
});

test("protocol: u32 stamps unwrap to the nearest full time", () => {
    const now = 2 ** 32 * 3 + 1000;
    assert.equal(unwrapMs(900, now), 2 ** 32 * 3 + 900);
    assert.equal(unwrapMs(2 ** 32 - 100, now), 2 ** 32 * 3 - 100);
});

test("ticket: the contract's test vector signs to the same text the database must produce", async () => {
    const ticket = await signTicket({user: "00000000-0000-0000-0000-000000000001", animal: "00000000-0000-0000-0000-000000000002", island: "wild", exp: 1800000000, nonce: "00000000-0000-0000-0000-000000000003"}, TEST_KEY);
    assert.equal(ticket.split(".").pop(), "jXStsh-WFMHRRmi4rtOn3kG8pCmT4rzO-YSBQhivgoY");
    assert.deepEqual(Array.from(base64ToBytes(TEST_KEY)), Array.from({length: 32}, (_, i) => i));
    assert.equal(bytesToBase64Url(new Uint8Array([251, 255])), "-_8");
});

test("ticket: verified only with the key, before it expires, and only in its exact form", async () => {
    const fields = {user: "00000000-0000-4000-8000-00000000000a", animal: "00000000-0000-4000-8000-0000000000f0", island: "wild" as const, exp: 2000, nonce: "00000000-0000-4000-8000-000000000001"};
    const ticket = await signTicket(fields, TEST_KEY);
    const good = await verifyTicket(ticket, TEST_KEY, 1900);
    assert.ok(good.ok && good.ticket.animal === fields.animal && good.ticket.island === "wild");
    assert.deepEqual(await verifyTicket(ticket, TEST_KEY, 2001), {ok: false, reason: "expired"});
    const otherKey = "AQECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
    assert.deepEqual(await verifyTicket(ticket, otherKey, 1900), {ok: false, reason: "bad_ticket"});
    // Another animal under the same signature: refused.
    const swapped = ticket.replace(fields.animal, "00000000-0000-4000-8000-0000000000f1");
    assert.deepEqual(await verifyTicket(swapped, TEST_KEY, 1900), {ok: false, reason: "bad_ticket"});
    // A later expiry under the same signature: refused.
    assert.deepEqual(await verifyTicket(ticket.replace(".2000.", ".9999."), TEST_KEY, 1900), {ok: false, reason: "bad_ticket"});
    for (const bad of ["", "v1", "v2." + ticket.slice(3), ticket + ".x", ticket.replace(".wild.", ".mars.")]) assert.equal((await verifyTicket(bad, TEST_KEY, 1900)).ok, false, bad);
});

test("clock: the smallest-RTT sample wins, and later changes are slewed at 50 ms a second", () => {
    const clock = new ClockSync();
    // True offset +5000 ms; one slow, asymmetric sample and one quick one.
    clock.add(1000, 6000 + 150, 1400);
    clock.add(2000, 7000 + 20, 2040);
    const best = clock.best()!;
    assert.equal(best.rtt, 40);
    near(best.offset, 5000, 20);
    near(clock.offset(2040)!, 5000, 20, "first applied at once");
    // A new best 300 ms away moves at most 50 ms a second.
    clock.add(3000, 3000 + 5300 + 5, 3010);
    const a = clock.offset(3010)!;
    const b = clock.offset(4010)!;
    near(b - a, 50, 0.5, "slew per second");
    assert.ok(!clock.tooSlow(4010));
});

test("clock: too slow to control only after 10 s over 600 ms", () => {
    const clock = new ClockSync();
    for (let t = 0; t <= 11_000; t += 1000) clock.add(t, t + 300, t + 700);
    assert.ok(clock.tooSlow(11_000));
    clock.add(12_000, 12_050, 12_100);
    assert.ok(!clock.tooSlow(12_100));
});

const sample = (t: number, x: number, z: number, yaw: number, speed: number): Sample => ({t, x, y: 0, z, yaw, roll: 0, speed, mode: "ground", clip: "walk", phase: 0, flags: 0});

test("interpolation: between samples on the path, extrapolated at most 200 ms, then held and marked stale", () => {
    const track = new RemoteTrack();
    // Walking along +z at 2 m/s, a sample every 100 ms.
    for (let i = 0; i <= 5; i++) track.push(sample(i * 100, 0, i * 0.2, 0, 2));
    const mid = track.at(250)!;
    near(mid.z, 0.5, 0.01, "between");
    near(mid.x, 0, 1e-9);
    const ahead = track.at(600)!;
    assert.ok(ahead.extrapolated && !ahead.stale);
    near(ahead.z, 1.2, 0.01, "100 ms ahead");
    const far = track.at(2000)!;
    assert.ok(far.stale);
    near(far.z, 1.4, 0.01, "held at 200 ms past the last");
    // An old or repeated sample changes nothing.
    track.push(sample(300, 9, 9, 0, 0));
    near(track.at(250)!.z, 0.5, 0.01);
});

test("interpolation: a sudden stop never overshoots the stop", () => {
    const track = new RemoteTrack();
    track.push(sample(0, 0, 0, 0, 8));
    track.push(sample(100, 0, 0.1, 0, 0));
    for (let t = 0; t <= 100; t += 10) assert.ok(track.at(t)!.z <= 0.1 + 0.05, `z at ${t}`);
});
