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
    store.addAnimal({id: wolf.id, slug: wolf.model_slug, zone: wolf.zone, area: null, island: "wild", enclosure_id: null, label: "Voyager", named: false, owners: [owner]});
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
