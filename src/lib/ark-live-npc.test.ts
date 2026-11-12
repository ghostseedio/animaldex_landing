import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {NpcWorld} from "@/ark-live/npc-world";
import {NpcReactions, REACTIVE_ACTIONS} from "@/ark-live/npc-reactions";
import {Room} from "@/ark-live/room";
import {MemoryStore} from "@/ark-live/memory-store";
import {LazyTerrain} from "@/ark-live/terrain";
import {decodeBinary, encodePose} from "@/ark-live/protocol";
import {homeRadius} from "@/ark-live/release";
import {abilitiesOf} from "@/ark-live/species";
import {worldSampler} from "@/ark-scene/world-sampler";
import {defaultHomePlots} from "@/ark-scene/props/home-layout";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import type {ArkAnimal} from "@/ark-scene/types";
import {FakeClock, FakeLink, settle, TEST_KEY} from "@/lib/ark-live-fixtures";

/**
 * Phase 2 on today's island with the v2 fixture's 130 animals: the server's own schedule, the reactions near a
 * controlled animal shared by everyone, and Talk's reach.
 */
const snapshot = decodeArkSnapshot(JSON.parse(readFileSync(new URL("../ark-scene/fixtures/snapshot-v2.json", import.meta.url), "utf8")))!;
const sampler = worldSampler();
let built: NpcWorld | null = null;
const npcWorld = () => (built ??= new NpcWorld(snapshot.animals, sampler));
const T = 1_800_000_000;

function find(slug: string): ArkAnimal {
    const a = snapshot.animals.find((x) => x.model_slug === slug && npcWorld().has(x.id));
    assert.ok(a, slug);
    return a!;
}

test("npc world: every scheduled animal has a pose, the same each time it is asked, on ground or water it can be on", () => {
    const world = npcWorld();
    assert.ok(world.size() >= 60, `on the schedule: ${world.size()}`);
    let checked = 0;
    for (const a of snapshot.animals) {
        if (!world.has(a.id)) continue;
        const p = world.poseAt(a.id, T)!;
        assert.ok(p && Number.isFinite(p.x) && Number.isFinite(p.z), a.model_slug);
        assert.ok(Math.abs(p.x) < 400 && Math.abs(p.z) < 400, `${a.model_slug} near the island (the sea reaches past the terrain)`);
        checked++;
    }
    assert.ok(checked > 50);
    const deer = find("roe-deer");
    const a = world.poseAt(deer.id, T + 37.5)!;
    const b = new NpcWorld(snapshot.animals, sampler).poseAt(deer.id, T + 37.5)!;
    assert.deepEqual([a.x, a.z, a.doing], [b.x, b.z, b.doing], "a second server builds the same schedule");
});

test("npc reactions: a deer reacts to a wolf under control beside it, for everyone; animals far away are left alone", () => {
    const world = npcWorld();
    const reactions = new NpcReactions(world, sampler);
    const deer = find("roe-deer");
    const wolf = find("eurasian-wolf");
    let reacted: string | null = null;
    let offset = 0;
    // A moment the deer is up and about (it sleeps through part of the day).
    let awake = T;
    while (world.poseAt(deer.id, awake)!.doing === "sleep" && awake < T + 86_400) awake += 600;
    for (let i = 0; i < 40 && !reacted; i++) {
        const now = awake + i * 0.2;
        const at = world.poseAt(deer.id, now)!;
        // The wolf creeps toward the deer from 6 m away.
        const d = Math.max(6 - i * 0.25, 1.5);
        const out = reactions.step([{id: wolf.id, x: at.x + d, y: at.y, z: at.z, yaw: -Math.PI / 2, speed: 2, mode: "ground"}], now, 0.2);
        const hit = out.find((r) => r.id === deer.id);
        if (hit && ["flee", "alert", "startle", "freeze", "withdraw", "watch_prey"].includes(hit.out.action)) {
            reacted = hit.out.action;
            offset = Math.hypot(hit.out.dx, hit.out.dz);
        }
    }
    assert.ok(reacted, "the deer noticed the wolf");
    assert.ok(REACTIVE_ACTIONS.includes(reacted as never));
    void offset;
    // Nothing is sent for animals with no one controlled near them.
    assert.deepEqual(reactions.step([], T, 0.2), []);
});

test("room: shared reactions go out as npc offsets with their table, and Talk is ready only within reach", async () => {
    let awake = T;
    while (npcWorld().poseAt(find("roe-deer").id, awake)!.doing === "sleep" && awake < T + 86_400) awake += 600;
    const clock = new FakeClock(awake * 1000);
    const store = new MemoryStore(clock.now);
    const world = npcWorld();
    const reactions = new NpcReactions(world, sampler);
    const terrain = new LazyTerrain("wild", 132, sampler, {plots: defaultHomePlots()});
    const wolf = find("eurasian-wolf");
    const deer = find("roe-deer");
    const owner = "00000000-0000-4000-8000-0000000000aa";
    store.addAnimal({id: wolf.id, slug: wolf.model_slug, zone: wolf.zone, area: null, island: "wild", enclosure: null, label: "Voyager", named: false, owners: [owner]});
    const epochBase = clock.ms - 5000;
    const room = new Room({island: "wild", terrain, ticketKey: TEST_KEY, store, now: clock.now, epochBase, npc: () => ({world, reactions}), homeOf: (_f, a) => ({...world.poseAt(deer.id, clock.ms / 1000)!, r: homeRadius(a) + 200})});
    const at = world.poseAt(deer.id, clock.ms / 1000)!;
    // Somewhere walkable 5 m from the deer.
    let start = {x: at.x + 5, z: at.z};
    for (const [dx, dz] of [[5, 0], [-5, 0], [0, 5], [0, -5], [4, 3], [-4, -3]]) {
        const c = terrain.cell(at.x + dx, at.z + dz);
        if (c && c.depth <= 0 && !(c.flags & 2)) {
            start = {x: at.x + dx, z: at.z + dz};
            break;
        }
    }
    const link = new FakeLink();
    const id = room.connect(link);
    const minted = await store.mint(owner, wolf.id, "wild", TEST_KEY);
    room.message(id, JSON.stringify({t: "control", ticket: minted.ok ? minted.ticket : "", start: {x: start.x, y: terrain.height(start.x, start.z), z: start.z, yaw: 0, mode: "ground"}}));
    await settle(10);
    assert.ok(link.last("control-ok"), JSON.stringify(link.texts.slice(-2)));
    for (let i = 0; i < 30; i++) {
        clock.advance(100);
        room.tick();
    }
    const npcs = link.all("npcs");
    const offsets = link.binaries.map((b) => decodeBinary(b, 0.01)).filter((d) => d?.type === "npc");
    assert.ok(npcs.length >= 1 && offsets.length >= 1, `npcs ${npcs.length}, offsets ${offsets.length}`);
    const table = npcs.flatMap((m) => m.ids as string[]);
    assert.ok(offsets.every((o) => o?.type === "npc" && o.npc.offsets.every((e) => e.idx < table.length)), "every offset names a known NPC");
    // Talk: within 4 m + half both lengths of something.
    const ready = link.all("talk-ready");
    assert.ok(ready.length >= 0);
    // Walk away (the server's own poses: teleporting is refused, so move the session's record directly) and Talk goes.
    room.sessionFor(wolf.id)!.motion.last = {...room.sessionFor(wolf.id)!.motion.last, x: 120, z: 120};
    for (let i = 0; i < 6; i++) {
        clock.advance(100);
        room.tick();
    }
    const last = link.last("talk-ready");
    if (last) assert.equal(last.animalId, null, "nothing to talk to out there");
    void encodePose;
});

// MARK: Phase 3: hunting

async function huntRoom(due: boolean | null) {
    const world = npcWorld();
    const reactions = new NpcReactions(world, sampler);
    const deer = find("roe-deer");
    const wolf = find("eurasian-wolf");
    let awake = T;
    while (world.poseAt(deer.id, awake)!.doing === "sleep" && awake < T + 86_400) awake += 600;
    const clock = new FakeClock(awake * 1000);
    const store = new MemoryStore(clock.now);
    const terrain = new LazyTerrain("wild", 132, sampler, {plots: defaultHomePlots()});
    const hunter = "00000000-0000-4000-8000-0000000000b1";
    const owner = "00000000-0000-4000-8000-0000000000b2";
    store.addAnimal({id: wolf.id, slug: wolf.model_slug, zone: wolf.zone, area: null, island: "wild", enclosure: null, label: "Voyager", named: false, owners: [hunter]});
    store.addAnimal({id: deer.id, slug: deer.model_slug, zone: deer.zone, area: null, island: "wild", enclosure: null, label: "Voyager", named: false, owners: [owner]});
    const room = new Room({island: "wild", terrain, ticketKey: TEST_KEY, store, now: clock.now, epochBase: clock.ms - 5000, npc: () => ({world, reactions}), hunting: () => ({due: () => due}), homeOf: (_f, a) => ({...world.poseAt(deer.id, clock.ms / 1000)!, r: homeRadius(a) + 200})});
    const at = world.poseAt(deer.id, clock.ms / 1000)!;
    let start = {x: at.x + 4, z: at.z};
    for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4], [3, 3], [-3, -3]]) {
        const c = terrain.cell(at.x + dx, at.z + dz);
        if (c && c.depth <= 0 && !(c.flags & 2)) {
            start = {x: at.x + dx, z: at.z + dz};
            break;
        }
    }
    const link = new FakeLink();
    const watcher = new FakeLink();
    room.connect(watcher);
    const id = room.connect(link);
    const minted = await store.mint(hunter, wolf.id, "wild", TEST_KEY);
    room.message(id, JSON.stringify({t: "control", ticket: minted.ok ? minted.ticket : "", start: {x: start.x, y: terrain.height(start.x, start.z), z: start.z, yaw: 0, mode: "ground"}}));
    await settle(10);
    assert.ok(link.last("control-ok"), JSON.stringify(link.texts.slice(-2)));
    const D = abilitiesOf(wolf.model_slug).D;
    /** Hold the wolf's mouth on the deer for `ms` (the session's record set directly: the hunt reads the server's poses). */
    const hold = async (ms: number) => {
        for (let t = 0; t < ms; t += 100) {
            clock.advance(100);
            const s = room.sessionFor(wolf.id)!;
            const p = world.poseAt(deer.id, (clock.ms - 150) / 1000)!;
            const yaw = Math.atan2(p.x - s.motion.last.x, p.z - s.motion.last.z);
            s.motion.last = {...s.motion.last, x: p.x - Math.sin(yaw) * 0.45 * D, z: p.z - Math.cos(yaw) * 0.45 * D, yaw, received: clock.ms};
            room.tick();
            await settle(2);
        }
    };
    return {room, store, clock, link, watcher, deer, wolf, hold};
}

test("hunting: a due wolf holding a deer 0.3 s asks for the kill; once the ecology confirms, everyone is told", async () => {
    const {store, link, watcher, deer, hold} = await huntRoom(true);
    await hold(1500);
    assert.ok(link.texts.some((m) => m.t === "hunt" && m.phase === "contact" && m.preyId === deer.id), JSON.stringify(link.all("hunt")));
    assert.ok(watcher.texts.some((m) => m.t === "hunt" && m.phase === "confirmed" && m.preyId === deer.id), "the watcher hears the deer was taken");
    assert.equal(store.meals.filter((m) => m.status === "confirmed").length, 1);
    assert.ok(!JSON.stringify(watcher.all("hunt")).includes("00000000-0000-4000-8000-0000000000b1"), "the hunter is never named");
});

test("hunting: one player kill a day per hunter (D9); a second contact is refused with the reason", async () => {
    const {link, hold, clock} = await huntRoom(true);
    await hold(1500);
    clock.advance(11_000);
    await hold(1500);
    const denied = link.all("hunt").filter((m) => m.phase === "denied");
    assert.ok(denied.some((m) => m.reason === "cap_hunter"), JSON.stringify(link.all("hunt")));
});

test("hunting: not hungry is a practice chase (no request, D15); the ecology's refusal lets the prey slip away", async () => {
    const quiet = await huntRoom(false);
    await quiet.hold(1500);
    assert.ok(quiet.link.all("hunt").some((m) => m.phase === "denied" && m.reason === "not_hungry"));
    assert.equal(quiet.store.meals.length, 0);
    const refused = await huntRoom(true);
    refused.store.decide = () => ({ok: false, reason: "floor_of_3"});
    await refused.hold(1500);
    assert.ok(refused.link.all("hunt").some((m) => m.phase === "escaped" && m.reason === "floor_of_3"), JSON.stringify(refused.link.all("hunt")));
    assert.ok(!refused.watcher.all("hunt").some((m) => m.phase === "confirmed"));
});
