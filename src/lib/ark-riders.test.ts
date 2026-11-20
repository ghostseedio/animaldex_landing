import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {
    EXCURSION_SLOT,
    GRAVITY,
    HOP_MAX_BODIES,
    HOP_MIN_BODIES,
    HOP_PAUSE,
    RIDERS,
    chooseHost,
    excursionAt,
    groundHop,
    hopArc,
    hopFlight,
    hops,
    hostSurface,
    hostTier,
    nightNow,
    riderOf,
    spotOf,
    trunkOf,
    type HostFrame
} from "@/ark-scene/riders";
import {mapSlugs} from "@/ark-scene/map/species";

/** The owner's ask (2026-11-21): cat fleas hop like fleas and ride cats; every other rider likewise. */

const CAT_ID = "5c5fab8a-0426-4588-8024-a1d30bcbbca2";
const DOG_ID = "c54e5eca-48bc-4b31-bef6-7f69515e76f7";

test("every rider and hopper is a species of the catalogue's map", () => {
    const slugs = new Set(mapSlugs());
    for (const slug of Object.keys(RIDERS)) assert.ok(slugs.has(slug), slug);
    for (const slug of ["cat-flea", "globular-springtail"]) {
        assert.ok(slugs.has(slug), slug);
        assert.ok(hops(slug), slug);
    }
    // The water flea (Daphnia) swims; grasshoppers and the louse group are not riders.
    assert.equal(hops("common-water-flea"), false);
    assert.equal(riderOf("louse"), null);
    assert.equal(riderOf("head-louse"), null);
});

test("a cat flea's hosts: cats first (breeds as their kind), then dogs; nothing else", () => {
    const flea = riderOf("cat-flea")!;
    assert.equal(hostTier(flea, {slug: "domestic-cat", speciesId: CAT_ID}), 0);
    assert.equal(hostTier(flea, {slug: "domestic-cat-black", kindId: CAT_ID, speciesId: "x"}), 0);
    assert.equal(hostTier(flea, {slug: "domestic-dog", speciesId: DOG_ID}), 1);
    assert.equal(hostTier(flea, {slug: "beagle", kindId: DOG_ID, speciesId: "y"}), 1);
    assert.equal(hostTier(flea, {slug: "cow", speciesId: "z"}), -1);
    // A cat beyond a dog in range still wins; out of range it does not.
    const home = {x: 0, y: 0, z: 0};
    const cands = [
        {id: "dog", tier: 1, x: 1, y: 0, z: 0},
        {id: "cat", tier: 0, x: 10, y: 0, z: 0}
    ];
    assert.equal(chooseHost(home, 25, cands, null), "cat");
    assert.equal(chooseHost(home, 5, cands, null), "dog");
    assert.equal(chooseHost(home, 0.5, cands, null), null);
    // A cat ten storeys up is not in a garden flea's reach.
    assert.equal(chooseHost(home, 25, [{id: "flat-cat", tier: 0, x: 2, y: 30, z: 0}], null), null);
});

test("ticks ride mammals, the cayenne tick horses, tapirs and cattle, the chicken mite chickens at night", () => {
    const tick = riderOf("tick")!;
    assert.equal(hostTier(tick, {slug: "plains-zebra", speciesId: "a"}), 0);
    assert.ok(hostTier(tick, {slug: "domestic-dog", speciesId: DOG_ID}) >= 0);
    assert.equal(hostTier(tick, {slug: "domestic-chicken", speciesId: "b"}), -1);
    const cayenne = riderOf("cayenne-tick")!;
    for (const slug of ["domestic-horse", "bairds-tapir", "cow"]) assert.equal(hostTier(cayenne, {slug, speciesId: "c"}), 0, slug);
    assert.equal(hostTier(cayenne, {slug: "domestic-cat", speciesId: CAT_ID}), -1);
    const mite = riderOf("chicken-mite")!;
    assert.equal(mite.night, true);
    assert.equal(hostTier(mite, {slug: "domestic-chicken", speciesId: "d"}), 0);
    assert.ok(nightNow(23) && nightNow(3) && !nightNow(12));
    assert.equal(riderOf("red-billed-oxpecker")!.on, "back");
    assert.equal(riderOf("live-sharksucker")!.on, "belly");
});

const cat: HostFrame = {x: 3, y: 0.1, z: -2, nx: 0, ny: 1, nz: 0, tx: Math.sin(0.7), ty: 0, tz: Math.cos(0.7), length: 0.46, height: 0.3, radius: 0.07, body: "m", rest: 0};

test("a rider's spot is on the host's trunk surface, facing out, and moves with the host", () => {
    for (let i = 0; i < 40; i++) {
        const spot = spotOf(`flea-${i}`, "fur", 1000 + i * 7);
        const p = hostSurface(cat, spot);
        // On the ellipsoid: (f/a)² + (u/b)² + (s/c)² = 1 in the cat's frame.
        const {mid, a, b, c} = trunkOf(cat);
        const dx = p.x - cat.x, dy = p.y - cat.y - mid, dz = p.z - cat.z;
        const f = dx * cat.tx + dz * cat.tz;
        const s = dx * cat.tz - dz * cat.tx;
        assert.ok(Math.abs((f / a) ** 2 + (dy / b) ** 2 + (s / c) ** 2 - 1) < 1e-6);
        // On the back and upper flanks (fleas keep to the back), the normal pointing away from the trunk's middle.
        assert.ok(p.ny > 0.1, `ny ${p.ny}`);
        assert.ok(p.y > cat.y + mid, "above the trunk's middle");
        assert.ok(p.nx * dx + p.ny * dy + p.nz * dz > 0);
        assert.ok(Math.abs(Math.hypot(p.nx, p.ny, p.nz) - 1) < 1e-9);
        assert.ok(Math.abs(p.nx * p.tx + p.ny * p.ty + p.nz * p.tz) < 1e-9, "the heading lies on the fur");
        // The host walks on: the flea with it.
        const moved = hostSurface({...cat, x: cat.x + 1.5, z: cat.z - 0.4}, spot);
        assert.ok(Math.abs(moved.x - p.x - 1.5) < 1e-9 && Math.abs(moved.z - p.z + 0.4) < 1e-9 && Math.abs(moved.y - p.y) < 1e-9);
    }
    // The cat's back: at about 0.85 of its height standing; lying down the trunk is on the ground.
    const top = hostSurface(cat, {s: 0, phi: 0});
    assert.ok(Math.abs(top.y - cat.y - 0.84 * cat.height) < 0.01, `${top.y - cat.y}`);
    const lying = hostSurface({...cat, rest: 1}, {s: 0, phi: 0});
    assert.ok(lying.y - cat.y < 0.5 * cat.height);
    // An oxpecker on the spine, a remora's spot under the belly.
    assert.ok(Math.abs(spotOf("ox", "back", 0).phi) < 0.2);
    assert.ok(Math.abs(spotOf("rem", "belly", 0).phi - Math.PI) < 0.3);
});

test("a hop is a real ballistic arc: through both ends, its apex over the higher end, its time under g", () => {
    const a = {x: 0, y: 0.25, z: 0};
    const b = {x: 0.18, y: 0, z: 0.05};
    assert.deepEqual(hopArc(a, b, 0), {x: 0, y: 0.25, z: 0});
    const end = hopArc(a, b, 1);
    assert.ok(Math.abs(end.x - b.x) < 1e-12 && Math.abs(end.y - b.y) < 1e-12 && Math.abs(end.z - b.z) < 1e-12);
    let top = -Infinity;
    for (let i = 0; i <= 200; i++) top = Math.max(top, hopArc(a, b, i / 200).y);
    const across = Math.hypot(b.x - a.x, b.z - a.z);
    assert.ok(Math.abs(top - (0.25 + across * 0.66)) < 1e-3);
    // A flea's 20 cm jump on the flat: about a third of a second (up 13 cm and down under g).
    const t = hopFlight(0.2);
    assert.ok(Math.abs(t - 2 * Math.sqrt((2 * 0.2 * 0.66) / GRAVITY)) < 1e-12);
    assert.ok(t > 0.25 && t < 0.4, `${t}`);
});

test("on the ground a flea hops 50-100 body lengths, lands on the ground, pauses between hops", () => {
    const L = 0.0025;
    const ground = (x: number, z: number) => 0.02 * Math.sin(x * 3) + 0.01 * z;
    const mid = {x: 5, z: 7};
    let landed = 0;
    let lastN = -1;
    let lastPoint: {x: number; z: number} | null = null;
    let inAir = 0;
    let steps = 0;
    for (let t = 0; t < 300; t += 0.01) {
        const h = groundHop("flea-a", mid, L, t, ground);
        steps++;
        if (h.air < 0) {
            assert.ok(Math.abs(h.y - ground(h.x, h.z)) < 1e-9, "on the ground when not in the air");
            if (h.n !== lastN) {
                if (lastPoint) {
                    const d = Math.hypot(h.x - lastPoint.x, h.z - lastPoint.z);
                    // (The landing of hop n is the take-off of hop n+1.)
                    if (d > 0) {
                        assert.ok(d >= L * HOP_MIN_BODIES * 0.85 && d <= L * HOP_MAX_BODIES * 1.05, `hop of ${(d / L).toFixed(0)} bodies`);
                        landed++;
                    }
                }
                lastN = h.n;
                lastPoint = {x: h.x, z: h.z};
            }
        } else {
            inAir++;
            assert.ok(h.y >= Math.min(ground(h.x, h.z), 0.04) - 0.05);
        }
        // Never far from its middle.
        assert.ok(Math.hypot(h.x - mid.x, h.z - mid.z) < L * 120);
    }
    assert.ok(landed > 60, `${landed} hops in 300 s`);
    // Mostly on the ground: the pauses (0.9-3.2 s) dwarf the flights (~0.3 s).
    assert.ok(inAir / steps < 0.25 && inAir / steps > 0.03, `${inAir / steps}`);
    assert.ok(HOP_PAUSE[0] > 0.5);
    // Pure in its id and the time: the same for every viewer.
    assert.deepEqual(groundHop("flea-a", mid, L, 123.45, ground), groundHop("flea-a", mid, L, 123.45, ground));
});

test("a flea's time off its host: some slots, inside the slot, a quarter minute or so", () => {
    let off = 0;
    for (let slot = 0; slot < 400; slot++) {
        const at = excursionAt("flea-b", slot * EXCURSION_SLOT + 1);
        if (!at) continue;
        off++;
        assert.ok(at.start >= slot * EXCURSION_SLOT && at.end <= (slot + 1) * EXCURSION_SLOT);
        assert.ok(at.end - at.start >= 14 && at.end - at.start <= 40);
    }
    assert.ok(off > 100 && off < 220, `${off}`);
});

test("the scene asks the riders before its old partner placement, and a watched rider never jumps cut", () => {
    const scene = readFileSync("src/ark-scene/index.ts", "utf8");
    const ride = scene.indexOf("const ride = ridePose(entry, time);");
    assert.ok(ride > 0 && ride < scene.indexOf("// A partner on its host (map section 6)"));
    assert.match(scene, /if \(watched && memo\.seen\)/);
});
