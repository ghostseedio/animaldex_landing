/**
 * The free-flight dome (p5 (zoospace); the owner, 2026-11-17: "add more land area to the town island and add a giant
 * dome for big aviary and we can move some birds from the smaller aviaries to the big aviaries").
 *
 * - The land: a lobe west of the zoo, the dome and its lobby wholly on dry ground, the sea still all round, clear of
 *   the countryside's side of the island.
 * - The building: a geodesic lattice on the cap's sphere, every tube joined to others, every netted cell framed.
 * - Inside: every tree and perch under the shell where it stands, off the water and the paths.
 * - The birds: by the homes rule (the waterbirds, the big flyers and ground birds; no hunter, no carrion eater), each in
 *   its zone; the small aviaries under their cap after the move.
 * - Flight: every dome bird's body inside the dome's volume through an Ark day (a 3D bound), and the flyers use its height.
 */
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import type {ArkAnimal} from "@/ark-scene/types";
import {domeFloor, keepInDome, keepInPen, maskBox, placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {townWorldSampler} from "@/ark-scene/islands/town/sampler";
import {poseOnTrip, scheduleWorld, tripAt, withLazyRoost, type Trip} from "@/ark-scene/behaviour-schedule";
import {behaviourProfile} from "@/ark-scene/behaviour-profile";
import {modelBase} from "@/ark-scene/grounding/base";
import {arkBody} from "@/ark-scene/stats";
import {townDayEpochs, validateTownAnimals} from "@/ark-scene/islands/town/validate-animals";
import {setTownWalkSurfaces} from "@/ark-scene/islands/town/drawn-ground";
import {islandHours} from "@/lib/ark-clock";
import {safariWaterLevel, sampleTownGround, townHeight} from "@/ark-scene/islands/town/ground";
import {coastNorm, TOWN_HALF, townPlan} from "@/ark-scene/islands/town/plan";
import {enclosuresIn, zooLayout} from "@/ark-scene/islands/town/areas";
import {townZooTrees} from "@/ark-scene/islands/town/trees";
import {DOME, DOME_BOARDWALK, DOME_FEEDERS, DOME_ID, DOME_LAGOON, DOME_LOBBY, DOME_LOBE, DOME_PATHS, DOME_SNAGS, DOME_TREES, domePerches, domeShell, domeSpots, domeZoneAt, lagoonNorm, onCliff, onDomeWay} from "@/ark-scene/islands/town/dome";
import {DOME_RINGS, domeLattice} from "@/ark-scene/islands/town/render/dome";
import {domeZoneOf, zooHomeOf} from "@/ark-scene/islands/town/zoo-homes";
import {validateTown} from "@/ark-scene/islands/town/validate";

type Profile = {slug: string; zone: string; plan: string; diet: string; size: number; activity: string; water: string | null; social: string};
const PROFILES = (JSON.parse(readFileSync(path.join(process.cwd(), "data/ark/behaviour-profiles.json"), "utf8")) as {profiles: Profile[]}).profiles;
const BY_SLUG = new Map(PROFILES.map((p) => [p.slug, p]));
const LINKS = (JSON.parse(readFileSync(path.join(process.cwd(), "data/ark/audit-predator-prey.json"), "utf8")) as {prey: Record<string, string>}).prey;
const PREY = new Map<string, Profile[]>(Object.entries(LINKS).map(([k, v]) => [k, v.split(".").map((i) => PROFILES[parseInt(i, 36)])]));

test("the dome's land: a lobe west of the zoo, the dome and its lobby on dry ground, sea round it, clear of the east side", () => {
    // Every point of the dome's circle (and 3 m beyond the drum) and of the lobby is land at the town's level or its lagoon.
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
        for (const rho of [8, 16, 24, DOME.r, DOME.r + 3]) {
            const x = DOME.x + Math.cos(a) * rho;
            const z = DOME.z + Math.sin(a) * rho;
            const g = sampleTownGround(x, z);
            assert.notEqual(g.surface, "sea", `sea inside the dome at ${x.toFixed(0)}, ${z.toFixed(0)}`);
            if (lagoonNorm(x, z) > 1.5) assert.ok(g.height > 1.6, `low ground ${g.height.toFixed(2)} m at ${x.toFixed(0)}, ${z.toFixed(0)}`);
        }
    }
    assert.ok(townHeight(DOME_LOBBY.x, DOME_LOBBY.z) > 2);
    // The sea beyond the lobe to the west, north and south; deep water at the square's edge.
    assert.ok(coastNorm(DOME_LOBE.x - DOME_LOBE.a - 6, DOME_LOBE.z) > 1);
    assert.ok(townHeight(-TOWN_HALF + 4, DOME_LOBE.z) < -6, `${townHeight(-TOWN_HALF + 4, DOME_LOBE.z).toFixed(1)} m at the square's west edge`);
    // West of the island's middle: nowhere near the countryside's lobe on the east side.
    assert.ok(DOME_LOBE.x + DOME_LOBE.a < -150);
    // The plan stays valid (nothing overlaps, every slot on its path, the land within its bounds).
    const check = validateTown();
    assert.deepEqual(check.errors, []);
    const slot = townPlan().zoo.slots.find((s) => s.id === DOME_ID);
    assert.ok(slot && slot.annex === "dome" && slot.type === "aviaries");
});

test("the dome's lattice: on the cap's sphere, every tube joined at both ends, every cell framed by three tubes", () => {
    const floor = 2.6;
    const lattice = domeLattice(floor);
    assert.equal(lattice.nodes.length, DOME_RINGS.reduce((t, n) => t + n, 0) + 1);
    for (const p of lattice.nodes) {
        const rho = Math.hypot(p[0] - DOME.x, p[2] - DOME.z);
        assert.ok(rho <= DOME.r + 1e-6);
        assert.ok(Math.abs(p[1] - (floor + domeShell(rho))) < 1e-6, "a node on the shell");
    }
    // The shell: 3.2 m at the rim, 27.2 m at the crown; 66 m across.
    assert.ok(Math.abs(domeShell(DOME.r) - DOME.drum) < 1e-6);
    assert.ok(Math.abs(domeShell(0) - (DOME.drum + DOME.rise)) < 1e-6);
    assert.ok(DOME.r * 2 >= 60 && DOME.r * 2 <= 80 && domeShell(0) >= 25 && domeShell(0) <= 30);
    const key = (i: number, j: number) => (i < j ? `${i}-${j}` : `${j}-${i}`);
    const edges = new Set<string>();
    const degree = new Array(lattice.nodes.length).fill(0);
    for (const [i, j] of lattice.edges) {
        assert.notEqual(i, j);
        assert.ok(!edges.has(key(i, j)), `tube ${key(i, j)} drawn twice`);
        edges.add(key(i, j));
        degree[i]++;
        degree[j]++;
        const a = lattice.nodes[i];
        const b = lattice.nodes[j];
        const length = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        assert.ok(length > 1.5 && length < 9, `a tube ${length.toFixed(1)} m long`);
    }
    for (const d of degree) assert.ok(d >= 4, `a node with ${d} tubes`);
    for (const [i, j, k] of lattice.cells) for (const [a, b] of [[i, j], [j, k], [k, i]]) assert.ok(edges.has(key(a, b)), `a cell's side ${key(a, b)} with no tube`);
    // Every tube bounds a cell or two (none loose in the air); the rim's tubes one (the drum's netting below them).
    const sides = new Map<string, number>();
    for (const [i, j, k] of lattice.cells) for (const [a, b] of [[i, j], [j, k], [k, i]]) sides.set(key(a, b), (sides.get(key(a, b)) ?? 0) + 1);
    for (const e of Array.from(edges)) assert.ok((sides.get(e) ?? 0) >= 1 && (sides.get(e) ?? 0) <= 2, `tube ${e} bounds ${sides.get(e) ?? 0} cells`);
    assert.ok(lattice.edges.length < 700 && lattice.cells.length < 500, `${lattice.edges.length} tubes, ${lattice.cells.length} cells`);
});

test("inside the dome: every tree, snag and perch under the shell where it stands, off the water, the paths and the cliff", () => {
    for (const t of DOME_TREES) {
        const rho = Math.hypot(t.x - DOME.x, t.z - DOME.z);
        assert.ok(t.height + 1 < domeShell(rho), `${t.kind} ${t.height} m under the shell (${domeShell(rho).toFixed(1)} m) at its trunk`);
        // (Its crown's shoulder, three quarters up and 4 m out, under the shell too.)
        assert.ok(t.height * 0.75 < domeShell(Math.min(rho + 4, DOME.r)), `${t.kind} at ${rho.toFixed(0)} m: its crown under the shell`);
        assert.ok(lagoonNorm(t.x, t.z) > 1.2 && !onDomeWay(t.x, t.z, 0.6) && !onCliff(t.x, t.z, 1), `${t.kind} at ${rho.toFixed(0)} m on clear ground`);
    }
    for (const s of DOME_SNAGS) assert.ok(lagoonNorm(s.x, s.z) > 1.1 && !onDomeWay(s.x, s.z, 0.5) && !onCliff(s.x, s.z, 1), "a snag on clear ground");
    for (const f of DOME_FEEDERS) assert.ok(lagoonNorm(f.x, f.z) > 1.1 && !onDomeWay(f.x, f.z, 0.3) && !onCliff(f.x, f.z, 1), "a feeding station on clear ground");
    const perches = domePerches();
    assert.ok(perches.length >= 30, `${perches.length} perches`);
    for (const p of perches) {
        const rho = Math.hypot(p.x - DOME.x, p.z - DOME.z);
        assert.ok(p.y + 1.2 < domeShell(rho), `perch ${p.id} at ${p.y.toFixed(1)} m under the shell (${domeShell(rho).toFixed(1)} m)`);
        if (p.kind === "ledge") assert.ok(onCliff(p.x, p.z), `ledge ${p.id} on the cliff`);
    }
    // At many heights: low, middle and high in the dome.
    const heights = perches.map((p) => p.y);
    assert.ok(heights.some((y) => y < 2) && heights.some((y) => y > 5 && y < 8) && heights.some((y) => y > 11), "perches low, middle and high");
    // The paths and the boardwalk inside the drum; the residents' spots inside it too, in every zone.
    for (const line of [...DOME_PATHS, DOME_BOARDWALK]) for (const p of line) assert.ok(Math.hypot(p.x - DOME.x, p.z - DOME.z) < DOME.r);
    const spots = domeSpots(7);
    const zones = new Map<string, number>();
    for (const s of spots) {
        assert.ok(Math.hypot(s.x - DOME.x, s.z - DOME.z) <= DOME.r - 3.2 + 1e-6);
        zones.set(domeZoneAt(s.x, s.z), (zones.get(domeZoneAt(s.x, s.z)) ?? 0) + 1);
    }
    for (const zone of ["pool", "lagoon", "cliff", "canopy", "floor"]) assert.ok((zones.get(zone) ?? 0) >= 8, `${zone}: ${zones.get(zone) ?? 0} spots`);
    // The dome's own trees are drawn (the asset library's, settled) where the list puts them.
    const layout = zooLayout([DOME_ID]);
    const trees = townZooTrees(layout).filter((t) => Math.hypot(t.x - DOME.x, t.z - DOME.z) < DOME.r);
    assert.ok(trees.length >= DOME_TREES.length - 2, `${trees.length} of ${DOME_TREES.length} trees stand`);
});

/** A zoo resident in a server enclosure (the fields placement reads). */
function resident(i: number, slug: string, enclosure: string): ArkAnimal {
    const p = BY_SLUG.get(slug)!;
    return {id: `zd-${String(i).padStart(4, "0")}-${slug}`, species_profile_id: `sp-${slug}`, name: slug, scientific_name: null, model_slug: slug, zone: p.zone as ArkAnimal["zone"], arrived_at: `2026-11-${String(1 + (i % 9)).padStart(2, "0")}T10:00:00Z`, brought_by: {label: "x", named: false}, mine: false, area: "zoo", island: "town", enclosure} as ArkAnimal;
}

/** The live record's aviary kinds (scratchpad snapshot, 2026-11-17), as the server held them: three of each. */
const KINDS: Array<[string, "lagoon" | "canopy" | "floor" | "cliff" | null]> = [
    ["greater-flamingo", "lagoon"], ["scarlet-ibis", "lagoon"], ["great-white-pelican", "lagoon"], ["mute-swan", "lagoon"], ["mallard", "lagoon"], ["grey-crowned-crane", "lagoon"],
    ["scarlet-macaw", "canopy"], ["blue-and-yellow-macaw", "canopy"], ["great-hornbill", "canopy"], ["toco-toucan", "canopy"], ["sulphur-crested-cockatoo", "canopy"],
    ["green-peafowl", "floor"], ["great-curassow", "floor"], ["victoria-crowned-pigeon", "floor"], ["golden-pheasant", "floor"], ["himalayan-monal", "cliff"],
    // Not the dome's: the small kinds, the geese, the hunters and the carrion eaters.
    ["budgerigar", null], ["cockatiel", null], ["baya-weaver", null], ["barnacle-goose", null], ["harriss-hawk", null], ["barn-owl", null], ["lappet-faced-vulture", null], ["marabou-stork", null], ["buffy-fish-owl", null]
];

function animals(): ArkAnimal[] {
    const out: ArkAnimal[] = [];
    let i = 0;
    for (const [slug] of KINDS) for (let k = 0; k < 3; k++) out.push(resident(i++, slug, `aviaries-${1 + (i % 4)}`));
    return out;
}

test("the dome's birds by the rule: the waterbirds, the big flyers and ground birds, each in its zone; no hunter, no carrion eater", () => {
    for (const [slug, zone] of KINDS) {
        assert.ok(BY_SLUG.has(slug), slug);
        assert.equal(domeZoneOf(slug), zone, slug);
        assert.equal(zooHomeOf({model_slug: slug, area: "zoo", enclosure: "aviaries-2"}) === DOME_ID, zone !== null, slug);
    }
    // Over the whole catalogue: nobody in the dome hunts a bird or eats carrion, meat or fish unless it is a waterbird.
    for (const p of PROFILES) {
        const zone = domeZoneOf(p.slug);
        if (!zone) continue;
        assert.ok(!(PREY.get(p.slug) ?? []).some((q) => ["flying_bird", "walking_bird", "flightless_bird"].includes(q.plan)), `${p.slug} hunts birds`);
        assert.ok(p.diet !== "carrion" || p.water, `${p.slug} eats carrion`);
        if (zone !== "lagoon") assert.ok(p.size >= 20 && p.diet !== "meat" && p.diet !== "fish", `${p.slug} in the ${zone}`);
    }
    const list = animals();
    const placed = placeTownAnimals(list);
    assert.ok(enclosuresIn(list).includes(DOME_ID));
    const level = safariWaterLevel(DOME_LAGOON);
    let afloat = 0;
    for (const a of list) {
        const zone = domeZoneOf(a.model_slug);
        const info = placed.town.get(a.id)!;
        const place = placed.places.get(a.id)!;
        if (!zone) {
            assert.notEqual(info.enclosure?.id, DOME_ID, `${a.model_slug} out of the dome`);
            continue;
        }
        assert.equal(info.enclosure?.id, DOME_ID, a.model_slug);
        const rho = Math.hypot(place.x - DOME.x, place.z - DOME.z);
        assert.ok(rho + arkBody(a).metres / 2 < DOME.r - 1, `${a.model_slug} inside the drum (${rho.toFixed(1)} m out)`);
        const here = domeZoneAt(place.x, place.z);
        if (info.where === "pool") {
            // A swimmer: on the lagoon's open water, at its level.
            afloat++;
            assert.ok(lagoonNorm(place.x, place.z) < 0.85, `${a.model_slug} on the open water`);
            assert.ok(Math.abs(place.ground - level) < 1e-6, `${a.model_slug} at the lagoon's level`);
            assert.ok(["dabbler", "diver", "coot", "grebe", "swan"].includes(behaviourProfile(a.model_slug).water ?? ""), `${a.model_slug} lives on the water`);
        } else {
            assert.ok(lagoonNorm(place.x, place.z) > 1, `${a.model_slug} (${zone}) on dry ground, not in the lagoon`);
            // (Its zone's spot, or a step from it where it kept clear of a neighbour.)
            if (zone === "lagoon") assert.ok(lagoonNorm(place.x, place.z) < 2.3, `${a.model_slug} by the lagoon (${here})`);
        }
    }
    assert.ok(afloat >= 5, `${afloat} afloat on the lagoon`);
});

test("every dome bird's body stays inside the dome's volume through an Ark day, and the flyers use its height", () => {
    const list = animals();
    const placed = placeTownAnimals(list);
    const colliders = townColliderSet(placed.open, {x: 0, z: 0});
    const world = scheduleWorld(townWorldSampler(placed.open, {x: 0, z: 0}, colliders));
    const epochs = [...townDayEpochs(24), ...townDayEpochs(24, Date.UTC(2026, 10, 12, 12) / 1000)];
    const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
    const floor = domeFloor();
    const out: string[] = [];
    let poses = 0;
    let aloft = 0;
    let highest = 0;
    let pulled = 0;
    const flew = new Set<string>();
    for (const a of list) {
        const info = placed.town.get(a.id)!;
        if (info.enclosure?.id !== DOME_ID) continue;
        const place = placed.places.get(a.id)!;
        const plan = modelBase(a.model_slug)?.plan ?? null;
        const length = arkBody(a, plan).display;
        const profile = behaviourProfile(a.model_slug, plan);
        const own = withLazyRoost({id: a.id, zone: a.zone, home: {x: place.x, y: place.ground, z: place.z}, length, sea: false, range: Math.max(info.range, 0.6) * 1.5}, () => null);
        let trip: Trip | null = null;
        for (const epoch of epochs) {
            if (!trip || epoch < trip.start || epoch >= trip.end) trip = tripAt(world, profile, own, epoch, hoursAt, a.activity ?? null, trip);
            const at = poseOnTrip(world, trip, epoch);
            poses++;
            // The scene's bound (`islands/scene.ts`): its fence's box, then the dome's volume.
            const pose = {x: at.x, z: at.z, base: at.y};
            keepInPen(maskBox(info.enclosure.mask), info.enclosureMargin!, pose);
            const before = {...pose};
            keepInDome(length, pose);
            if (Math.hypot(before.x - pose.x, before.z - pose.z) > 0.01 || Math.abs(before.base - pose.base) > 0.01) pulled++;
            if (at.aloft) {
                aloft++;
                flew.add(a.model_slug);
                highest = Math.max(highest, pose.base - floor);
            }
            // Inside the volume: its far end inside the drum, its top under the shell where its far end is.
            const rho = Math.hypot(pose.x - DOME.x, pose.z - DOME.z);
            const half = Math.min(length / 2, 3);
            if (rho + half > DOME.r - 1.2 + 1e-6) out.push(`${a.model_slug} ${trip.doing}: ${rho.toFixed(1)} m out`);
            if (pose.base - floor > 0.5 && pose.base - floor + length * 0.6 > domeShell(Math.min(rho + half, DOME.r)) - 0.3) out.push(`${a.model_slug} ${trip.doing}: ${(pose.base - floor).toFixed(1)} m up at ${rho.toFixed(1)} m out, through the shell`);
        }
    }
    console.log(`dome: ${poses} poses, ${aloft} on the wing (${flew.size} kinds: ${Array.from(flew).slice(0, 8).join(", ")}), highest ${highest.toFixed(1)} m over the floor, ${pulled} pulled in by the bound`);
    assert.ok(poses > 1500, `${poses} poses`);
    assert.deepEqual(out.slice(0, 8), []);
    // The flyers fly, and well over the heads of the visitors: the dome's height is used.
    assert.ok(aloft > 20, `${aloft} poses on the wing`);
    assert.ok(highest > 4, `the highest flight ${highest.toFixed(1)} m over the floor`);
    // On the drawn ground and water through the day (the scene's own check): none sinks, none floats.
    const dome = list.filter((a) => placed.town.get(a.id)!.enclosure?.id === DOME_ID);
    const check = validateTownAnimals(dome, {epochs: townDayEpochs(16)});
    setTownWalkSurfaces(null);
    console.log(`dome residents: ${dome.length}, ${check.samples} samples; sinks ${check.counts.sinks}, floats ${check.counts.floats}`);
    assert.equal(check.counts.sinks, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("sinks")).slice(0, 5)));
    assert.equal(check.counts.floats, 0, JSON.stringify(check.problems.filter((p) => p.problems.includes("floats")).slice(0, 5)));
});

test("the real record (when the local snapshot is here): the dome's birds moved, the small aviaries under their cap", {skip: !existsSync("public/ark-local/snap.json")}, () => {
    const snap = JSON.parse(readFileSync("public/ark-local/snap.json", "utf8")) as {snapshot: {animals: ArkAnimal[]}};
    const town = snap.snapshot.animals.filter((a) => (a.island ?? "town") === "town");
    const placed = placeTownAnimals(town);
    const by = new Map<string, ArkAnimal[]>();
    for (const a of town) {
        const e = placed.town.get(a.id)?.enclosure;
        if (a.area === "zoo" && e) (by.get(e.id) ?? by.set(e.id, []).get(e.id)!).push(a);
    }
    const dome = by.get(DOME_ID) ?? [];
    assert.ok(dome.length >= 60, `${dome.length} birds in the dome`);
    // Under the dome's own cap: 6 birds per 100 m² of its floor.
    assert.ok((dome.length / (Math.PI * DOME.r * DOME.r)) * 100 < 6);
    for (const a of dome) assert.ok(domeZoneOf(a.model_slug), a.model_slug);
    // No hunter with its prey in the dome (a food link to a bird under 0.8 of its size).
    const slugs = Array.from(new Set(dome.map((a) => a.model_slug)));
    for (const s of slugs) for (const q of PREY.get(s) ?? []) assert.ok(!slugs.includes(q.slug) || BY_SLUG.get(q.slug)!.size > BY_SLUG.get(s)!.size * 0.8, `${s} hunts ${q.slug} in the dome`);
    // The small aviaries after the move: each under 6 per 100 m² (they held 40 each: 15 per 100 m²).
    let small = 0;
    for (const [id, members] of Array.from(by)) {
        if (!/^aviaries-\d+$/.test(id)) continue;
        small++;
        const e = placed.town.get(members[0].id)!.enclosure!;
        const per100 = (members.length / (e.slot.at.w * e.slot.at.d)) * 100;
        console.log(`${id}: ${members.length} birds, ${per100.toFixed(1)} per 100 m²`);
        assert.ok(per100 <= 6, `${id}: ${members.length} birds (${per100.toFixed(1)} per 100 m²)`);
    }
    assert.ok(small >= 3, `${small} small aviaries open`);
    console.log(`the dome: ${dome.length} birds of ${slugs.length} kinds, ${((dome.length / (Math.PI * DOME.r * DOME.r)) * 100).toFixed(1)} per 100 m²`);
});
