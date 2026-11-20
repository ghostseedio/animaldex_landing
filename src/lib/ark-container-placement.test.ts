/**
 * Container breeding on the web (decision 416: pets breed only within one tank, farm animals within one pen, and what you see
 * must match; AnimalDex docs/ark/container-breeding.md section 8): the town draws a kept animal in the container the server
 * stores for it (`ArkAnimal.container`, only while the server's `container_breeding` switch is on), and a young one born in a
 * tank, room, garden, pen or field beside its parents; with no container stored (the switch off) nothing moves.
 *
 * The saved real read is production's, 2026-11-20 ~09:50 UTC (Ark day 292): 2,901 present town animals, and for the 1,461 house
 * and farm ones the container the owner loads (the web's own drawing of that day). `src/ark-scene/fixtures/town-containers.json.gz`.
 *
 * - With the loaded containers laid on the real read, every kept animal is drawn in its stored container, and EVERY animal of the
 *   town stands exactly where it stood without them (zero animals move on the day the switch goes on).
 * - Containers worked out from the drawing itself change nothing either (the same, whatever the read: it holds as the plan changes).
 * - A young one with its parents' container is drawn in it: in the same tank, cage, vivarium or pond, room, garden, farm plot or
 *   countryside field; nobody else moves for it (but the cells of a room it joins).
 * - What the server cannot know: its first guess for an arrival (its home's garden) never puts a cow on a lawn or a fish on the grass;
 *   an id the plan does not know is as no container at all.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import test from "node:test";
import type {ArkAnimal} from "@/ark-scene/types";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {forgetTownPlacements, keptGap, placeTownAnimals, type TownPlace, type TownPlacements} from "@/ark-scene/islands/town/placement";
import {arkBody} from "@/ark-scene/stats";
import {inTownSolid} from "@/ark-scene/islands/town/tanks";
import {toLocal, type Box} from "@/ark-scene/islands/town/geom";
import {drawnContainer, resolveContainer} from "@/ark-scene/islands/town/containers";
import {townHouseholds} from "@/ark-scene/islands/town/areas";

type Fixture = {columns: string[]; containers: string[]; animals: Array<Array<string | number | null>>};
const fixture = JSON.parse(gunzipSync(readFileSync("src/ark-scene/fixtures/town-containers.json.gz")).toString()) as Fixture;

/** The saved read as the scene's animals, and each one's loaded container (house and farm animals only). */
function load(): {animals: ArkAnimal[]; loaded: Map<string, string>} {
    const col = new Map(fixture.columns.map((c, i) => [c, i] as [string, number]));
    const animals: ArkAnimal[] = [];
    const loaded = new Map<string, string>();
    for (const row of fixture.animals) {
        const get = (c: string) => row[col.get(c)!];
        const id = get("id") as string;
        const slug = get("model_slug") as string | null;
        animals.push({
            id, species_profile_id: get("species_profile_id") as string, kind_species_profile_id: get("kind_species_profile_id") as string | null, name: get("name") as string,
            scientific_name: get("scientific_name") as string | null, model_slug: slug ?? `placeholder--${get("species_profile_id")}`, placeholder: !slug, zone: get("zone") as ArkAnimal["zone"],
            area: get("area") as ArkAnimal["area"], island: get("island") as ArkAnimal["island"], enclosure: get("enclosure") as string | null, slot: get("slot") as number | null,
            slot_rank: get("slot_rank") as number | null, arrived_at: get("arrived_at") as string, origin: get("origin") as ArkAnimal["origin"], brought_by: {label: "", named: false}, mine: false
        } as ArkAnimal);
        const c = get("container");
        if (c !== null) loaded.set(id, fixture.containers[c as number]);
    }
    return {animals, loaded};
}

function place(animals: readonly ArkAnimal[]): TownPlacements {
    forgetTownPlacements();
    return placeTownAnimals(animals);
}

function withContainers(animals: readonly ArkAnimal[], containers: ReadonlyMap<string, string>): ArkAnimal[] {
    return animals.map((a) => (containers.has(a.id) ? {...a, container: containers.get(a.id)!} : a));
}

/** Everything the scene is told about where an animal stands (a room's cell as its id and place in it). */
function where(res: TownPlacements, id: string): string {
    const p = res.places.get(id)!;
    const t = res.town.get(id)!;
    return JSON.stringify([p.x, p.z, p.ground, p.yaw, p.leader ?? null, p.rank ?? null, t.area, t.where, t.place, t.display?.id ?? null, t.room ? [t.room.room.id, t.room.cell, t.room.cells] : null, t.still, t.range, t.keeping ?? null, t.pen ? [t.pen.x, t.pen.z, t.pen.w, t.pen.d] : null]);
}

const kept = (a: ArkAnimal) => a.area === "house" || a.area === "farm";

test("the saved real read: 2,901 animals, 1,461 loaded containers (697 distinct ones, all known to the plan)", () => {
    const {animals, loaded} = load();
    assert.equal(animals.length, 2901);
    assert.equal(loaded.size, 1461);
    assert.equal(animals.filter(kept).length, 1461, "a container for every house and farm animal, and no other");
    const unknown = Array.from(new Set(loaded.values())).filter((c) => !resolveContainer(c));
    assert.deepEqual(unknown, [], "every loaded container names something in today's plan");
});

test("with the loaded containers on the real read every kept animal is drawn in its stored container, and nobody in the town moves", () => {
    const {animals, loaded} = load();
    const without = place(animals);
    const withThem = place(withContainers(animals, loaded));
    const wrong: string[] = [];
    for (const a of animals) {
        if (!kept(a)) continue;
        const drawn = drawnContainer(withThem.town.get(a.id)!);
        if (drawn !== loaded.get(a.id)) wrong.push(`${a.model_slug} ${a.id}: stored ${loaded.get(a.id)}, drawn ${drawn}`);
    }
    assert.deepEqual(wrong.slice(0, 20), [], `${wrong.length} kept animals drawn outside their stored container`);
    // (And the drawing without them is what was loaded: the owner's file is today's drawing.)
    const unloaded = animals.filter(kept).filter((a) => drawnContainer(without.town.get(a.id)!) !== loaded.get(a.id));
    assert.deepEqual(unloaded.map((a) => a.id).slice(0, 20), [], `${unloaded.length} animals are drawn today where the loaded file does not say`);
    const moved: string[] = [];
    for (const a of animals) if (where(without, a.id) !== where(withThem, a.id)) moved.push(`${a.model_slug} ${a.id}`);
    assert.deepEqual(moved.slice(0, 20), [], `${moved.length} of ${animals.length} animals stand elsewhere with their stored containers`);
});

test("containers worked out from the drawing itself change nothing, whatever the read", () => {
    const {animals} = load();
    const without = place(animals);
    const own = new Map<string, string>();
    for (const a of animals) if (kept(a)) own.set(a.id, drawnContainer(without.town.get(a.id)!));
    const withThem = place(withContainers(animals, own));
    const moved = animals.filter((a) => where(without, a.id) !== where(withThem, a.id));
    assert.deepEqual(moved.map((a) => `${a.model_slug} ${a.id}`).slice(0, 20), [], `${moved.length} animals moved`);
});

test("the kept animals stand the same in any order of the town's animals, with containers", () => {
    const {animals, loaded} = load();
    const shuffled = animals.slice().sort((a, b) => (a.id < b.id ? 1 : -1));
    const one = place(withContainers(animals, loaded));
    const two = place(withContainers(shuffled, loaded));
    const moved = animals.filter((a) => kept(a) && where(one, a.id) !== where(two, a.id));
    assert.deepEqual(moved.map((a) => a.id).slice(0, 10), [], `${moved.length} kept animals depend on the order`);
});

/** A few kept animals of each kind of container, and a young one for each (its parents' container, a new id, the latest arrival). */
function youngOf(parents: ArkAnimal[], loaded: ReadonlyMap<string, string>): ArkAnimal[] {
    return parents.map((p, i) => ({...p, id: `young-${String(i).padStart(3, "0")}-${p.id}`, origin: "born", generation: 1, arrived_at: "2026-11-21T00:00:00Z", slot: null, slot_rank: null, container: loaded.get(p.id)!}) as ArkAnimal);
}

function category(info: TownPlace): string {
    if (info.display) return `display:${info.display.form}`;
    if (info.room) return `room:${info.room.room.kind}`;
    if (info.place.startsWith("rural-")) return "field";
    if (info.area === "farm") return "farm plot";
    return "garden";
}

test("a young one born in its parents' container is drawn in it: tank, cage, vivarium, pond, room, garden, farm plot, field", () => {
    const {animals, loaded} = load();
    const base = withContainers(animals, loaded);
    const before = place(base);
    const bySort = new Map<string, ArkAnimal[]>();
    for (const a of base) {
        if (!kept(a)) continue;
        const c = category(before.town.get(a.id)!);
        let list = bySort.get(c);
        if (!list) bySort.set(c, (list = []));
        if (list.length < 4) list.push(a);
    }
    for (const want of ["display:tank", "display:cage", "display:vivarium", "display:pond", "room:garden_room", "room:apartment", "garden", "farm plot", "field"]) assert.ok((bySort.get(want) ?? []).length > 0, `the real town has a ${want}`);
    const parents = Array.from(bySort.values()).flat();
    const young = youngOf(parents, loaded);
    const after = place([...base, ...young]);
    const rows: string[] = [];
    for (let i = 0; i < young.length; i++) {
        const mum = before.town.get(parents[i].id)!;
        const child = after.town.get(young[i].id)!;
        const ok = drawnContainer(child) === loaded.get(parents[i].id) && child.place === mum.place && (child.display?.id ?? null) === (mum.display?.id ?? null) && (child.room?.room.id ?? null) === (mum.room?.room.id ?? null);
        if (!ok) rows.push(`${category(mum)} ${parents[i].model_slug}: parent ${drawnContainer(mum)}, young ${drawnContainer(child)}`);
    }
    assert.deepEqual(rows, [], "every young one is where its parents are");
    // Nobody else moves for them (but the cells of a room a young one joined, drawn in more cells).
    const roomsJoined = new Set(young.map((y) => after.town.get(y.id)!.room?.room.id).filter(Boolean));
    const moved = animals.filter((a) => !roomsJoined.has(before.town.get(a.id)!.room?.room.id) && where(before, a.id) !== where(after, a.id));
    assert.deepEqual(moved.map((a) => `${a.model_slug} ${a.id}`).slice(0, 10), [], `${moved.length} others moved`);
    console.log(`young beside parents: ${young.length} (${Array.from(bySort.keys()).join(", ")})`);
});

test("a young one in a tank is in that tank, in that home: two pets of one kind in one tank and their young", () => {
    const {animals, loaded} = load();
    const base = withContainers(animals, loaded);
    const before = place(base);
    // Two pets of one kind the real town keeps in two tanks: the server puts the father in the mother's tank, and three young are born there.
    const bySpecies = new Map<string, ArkAnimal[]>();
    for (const a of base) if (a.area === "house" && before.town.get(a.id)?.display?.form === "tank") bySpecies.set(a.species_profile_id, [...(bySpecies.get(a.species_profile_id) ?? []), a]);
    const list = Array.from(bySpecies.values()).find((l) => new Set(l.map((a) => loaded.get(a.id))).size >= 2)!;
    const mum = list[0];
    const dad = list.find((a) => loaded.get(a.id) !== loaded.get(mum.id))!;
    const tank = loaded.get(mum.id)!;
    assert.notEqual(before.town.get(dad.id)!.display!.id, tank, "in the real town the pair lives in two tanks");
    const together: ArkAnimal[] = base.map((a) => (a.id === dad.id ? {...a, container: tank} : a));
    const kids = [0, 1, 2].map((i) => ({...mum, id: `kid-${i}-${mum.id}`, origin: "born" as const, generation: 1, arrived_at: "2026-11-21T00:00:00Z", slot: null, slot_rank: null, container: tank}));
    const res = place([...together, ...kids]);
    const mumAt = res.town.get(mum.id)!;
    const dadAt = res.town.get(dad.id)!;
    assert.equal(drawnContainer(dadAt), tank, "the father is drawn in the mother's tank");
    assert.equal(dadAt.display?.id, mumAt.display?.id);
    assert.equal(dadAt.place, mumAt.place, "in the mother's home");
    const m = res.places.get(mum.id)!;
    for (const k of kids) {
        const at = res.town.get(k.id)!;
        assert.equal(at.display?.id, tank, "a young one in the tank");
        assert.equal(at.place, mumAt.place, "in the same home");
        assert.ok(at.tank && mumAt.tank && at.tank.id === mumAt.tank.id, "swimming in the same tank");
        const p = res.places.get(k.id)!;
        assert.ok(Math.hypot(p.x - m.x, p.z - m.z) < 1e-6, "on the tank's own swim point, with its parents");
    }
});

test("a young one in a farm pen and in a field stands in that pen", () => {
    const {animals, loaded} = load();
    const base = withContainers(animals, loaded);
    const before = place(base);
    const plot = base.find((a) => a.area === "farm" && category(before.town.get(a.id)!) === "farm plot")!;
    const field = base.find((a) => category(before.town.get(a.id) ?? ({place: "", area: "house"} as TownPlace)) === "field" && a.area === "farm")!;
    const young = youngOf([plot, field], loaded);
    const res = place([...base, ...young]);
    const [yp, yf] = young.map((y) => res.town.get(y.id)!);
    assert.equal(yp.place, before.town.get(plot.id)!.place);
    assert.equal(yf.place, before.town.get(field.id)!.place);
    assert.ok(yp.pen && yf.pen, "each in a fenced pen");
});

test("the server's first guess for an arrival (its home's garden) never puts a cow on a lawn, a horse in a garden or a fish on the grass", () => {
    const {animals, loaded} = load();
    const base = withContainers(animals, loaded);
    const before = place(base);
    const home = townHouseholds().find((h) => h.kind === "house")!;
    const pick = (slug: RegExp) => base.find((a) => a.area === "house" && slug.test(a.model_slug) && category(before.town.get(a.id)!) !== "garden")!;
    const cow = pick(/cow|cattle|sheep|goat/);
    const fish = pick(/goldfish|tetra|guppy|danio|platy/);
    const arrivals = [cow, fish].map((a, i) => ({...a, id: `arrival-${i}-${a.id}`, origin: "arrived" as const, arrived_at: "2026-11-21T00:00:00Z", slot: null, slot_rank: null, container: home.id}));
    const res = place([...base, ...arrivals]);
    const cowAt = res.town.get(arrivals[0].id)!;
    const fishAt = res.town.get(arrivals[1].id)!;
    assert.notEqual(cowAt.place, home.id, "a house cow is not put in a garden");
    assert.ok(cowAt.place.startsWith("rural-") || cowAt.area === "farm", `the cow is where its kind lives (${cowAt.place})`);
    assert.equal(fishAt.place, home.id, "the fish is at the home the server names");
    assert.ok(fishAt.display || fishAt.where === "lawn" || fishAt.where === "yard" || fishAt.where === "balcony", "in the home's tank when it holds it, else the garden");
});

test("an id the plan does not know is as no container at all: nothing moves", () => {
    const {animals} = load();
    const clean = place(animals);
    const odd = place(animals.map((a) => (kept(a) ? {...a, container: "no-such-place#9"} : a)));
    const moved = animals.filter((a) => where(clean, a.id) !== where(odd, a.id));
    assert.deepEqual(moved.map((a) => a.id).slice(0, 10), [], `${moved.length} animals moved`);
    assert.equal(resolveContainer("no-such-place#9"), null);
    assert.equal(resolveContainer(""), null);
    assert.equal(resolveContainer(null), null);
});

test("a young one born in a full room joins its parents there: the room holds more than its usual capacity, one cell each", () => {
    const {animals, loaded} = load();
    const base = withContainers(animals, loaded);
    const before = place(base);
    const parent = base.find((a) => before.town.get(a.id)?.room?.room.kind === "garden_room")!;
    const room = before.town.get(parent.id)!.room!.room;
    const kids = [0, 1, 2, 3].map((i) => ({...parent, id: `kit-${i}-${parent.id}`, origin: "born" as const, arrived_at: "2026-11-21T00:00:00Z", slot: null, slot_rank: null, container: loaded.get(parent.id)!}));
    const res = place([...base, ...kids]);
    const inRoom = [parent, ...kids].map((a) => res.town.get(a.id)!.room!);
    assert.ok(inRoom.every((r) => r.room.id === room.id), "all in the parent's room");
    const cells = new Set(inRoom.map((r) => r.cell));
    assert.equal(cells.size, inRoom.length, "one cell each");
    assert.ok(inRoom.every((r) => r.cells >= inRoom.length), "the room's floor divided among them all");
});

test("the read's container reaches the scene: a string is kept, anything else dropped; an id the plan does not know is no container", () => {
    const row = (container: unknown) => ({id: "a1", species_profile_id: "s1", name: "Goldfish", scientific_name: null, model_slug: "goldfish", zone: "farm_garden", arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "", named: false}, mine: false, area: "house", island: "town", container});
    const snap = (container: unknown) => decodeArkSnapshot({voyage: {slug: "first", name: "Ark", started_at: null}, counts: {animals: 1, species: 1, founders: 0}, zones: [], animals: [row(container)], as_of: null});
    const got = (container: unknown) => snap(container)?.animals[0]?.container;
    assert.equal(got("house-3#0:tank"), "house-3#0:tank");
    assert.equal(got("house-40#0~room"), "house-40#0~room");
    assert.equal(got("tower-3~f10l"), "tower-3~f10l");
    assert.equal(got("rural-sheep-fold"), "rural-sheep-fold");
    assert.equal(got("smallholding-2"), "smallholding-2");
    for (const bad of [undefined, null, 5, {a: 1}]) assert.equal(got(bad), undefined, `dropped: ${String(bad)}`);
    // (A string is kept as sent and checked where it is read: an id the plan does not know, an empty or an over-long one is no container.)
    assert.equal(resolveContainer("has space"), null);
    assert.equal(resolveContainer("x".repeat(81)), null);
    assert.equal(resolveContainer("<script>"), null);
});

/** How far inside a box a point is (m; negative: outside). */
function inset(b: Box, x: number, z: number): number {
    const l = toLocal(b, x, z);
    return Math.min(b.w / 2 - Math.abs(l.x), b.d / 2 - Math.abs(l.z));
}

/**
 * Every kept animal inside its container's interior, with clearance for its body (the coordinator, 2026-11-20: "the far horse stands
 * through the pen's fence rail with its head into the barn wall"): in a pen, its middle at least `penMargin` from the rails (half its body,
 * an eighth again for a head put down, 0.3 m clear), its whole body (both ends, whatever way it faces) inside the rails and out of every wall
 * and garden room, and no two bodies one on another; in a display (cage, vivarium, tank, pond), inside its glass; in a room, inside its floor.
 */
function footprintProblems(animals: readonly ArkAnimal[], res: TownPlacements): string[] {
    const out: string[] = [];
    const byPlace = new Map<string, Array<{x: number; z: number; len: number}>>();
    for (const a of animals) {
        if (!kept(a)) continue;
        const t = res.town.get(a.id)!;
        const p = res.places.get(a.id)!;
        const body = arkBody(a);
        const half = Math.max(body.metres, body.display) / 2;
        const label = `${a.model_slug} ${a.id.slice(-8)} in ${drawnContainer(t)}`;
        const ends: Array<[number, number]> = [[p.x, p.z], [p.x + Math.sin(p.yaw) * half, p.z + Math.cos(p.yaw) * half], [p.x - Math.sin(p.yaw) * half, p.z - Math.cos(p.yaw) * half]];
        if (t.pen) {
            const margin = t.penMargin ?? 0;
            if (inset(t.pen, p.x, p.z) < margin - 1e-6) out.push(`${label}: its middle ${inset(t.pen, p.x, p.z).toFixed(2)} m from the rails, margin ${margin.toFixed(2)}`);
            // (A pen too small for the body keeps it in its middle: the body cannot be in it whatever is done.)
            if (Math.min(t.pen.w, t.pen.d) / 2 >= half + 0.05) for (const [x, z] of ends) if (inset(t.pen, x, z) < -0.02) out.push(`${label}: a body end ${inset(t.pen, x, z).toFixed(2)} m past the rails`);
            for (const [x, z] of ends) if (inTownSolid(x, z, -0.05)) out.push(`${label}: in a wall or a garden room`);
            const here = byPlace.get(t.place) ?? [];
            for (const o of here) if (Math.hypot(o.x - p.x, o.z - p.z) < keptGap(body.metres, o.len) - 1e-6) out.push(`${label}: on another animal of its pen`);
            here.push({x: p.x, z: p.z, len: body.metres});
            byPlace.set(t.place, here);
        } else if (t.display) {
            const d = t.display;
            if (inset(d, p.x, p.z) < -0.02) out.push(`${label}: out of its ${d.form}`);
            if ((d.form === "tank" || d.form === "pond") && body.metres + 0.1 > Math.max(d.w, d.d) + 1e-6) out.push(`${label}: longer than its ${d.form}`);
            if (d.form === "cage" || d.form === "vivarium") for (const [x, z] of ends) if (inset(d, x, z) < -0.02 && body.metres <= Math.min(d.w, d.d)) out.push(`${label}: a body end through the ${d.form}'s glass`);
        } else if (t.room) {
            const room = t.room.room;
            if (inset(room.free, p.x, p.z) < -0.02) out.push(`${label}: out of its room's floor`);
        }
    }
    return out;
}

test("no kept animal's body crosses the boundary of its container: the real read with its loaded containers, and a family in every kind", () => {
    const {animals, loaded} = load();
    const base = withContainers(animals, loaded);
    const real = footprintProblems(base, place(base));
    assert.deepEqual(real.slice(0, 20), [], `${real.length} kept animals cross their container's boundary on the real read`);
    // (And with the young one in every kind of container the family in a small pen, a full tank or a crowded room must stay inside it.)
    const before = place(base);
    const bySort = new Map<string, ArkAnimal[]>();
    for (const a of base) {
        if (!kept(a)) continue;
        const c = category(before.town.get(a.id)!);
        const list = bySort.get(c) ?? [];
        if (list.length < 4) list.push(a);
        bySort.set(c, list);
    }
    const parents = Array.from(bySort.values()).flat();
    // three young of each, so a pen holds the whole family
    const family = [0, 1, 2].flatMap((k) => youngOf(parents, loaded).map((y) => ({...y, id: `${y.id}-k${k}`})));
    const crowded = [...base, ...family];
    const problems = footprintProblems(crowded, place(crowded));
    assert.deepEqual(problems.slice(0, 20), [], `${problems.length} kept animals cross their container's boundary with a family in each`);
});

test("a pen too small for a whole family spreads them inside it, never out of it", () => {
    const {animals, loaded} = load();
    const base = withContainers(animals, loaded);
    const before = place(base);
    const horse = base.find((a) => a.area === "farm" && /horse/.test(a.model_slug) && before.town.get(a.id)?.pen && category(before.town.get(a.id)!) === "farm plot")!;
    const herd = Array.from({length: 14}, (_, i) => ({...horse, id: `herd-${i}-${horse.id}`, origin: "born" as const, arrived_at: "2026-11-21T00:00:00Z", slot: null, slot_rank: null, container: loaded.get(horse.id)!}));
    const all = [...base, ...herd];
    const res = place(all);
    const pen = res.town.get(horse.id)!;
    const inside = herd.filter((h) => res.town.get(h.id)!.place === pen.place && res.town.get(h.id)!.pen);
    assert.equal(inside.length, herd.length, "every one in its parents' pen");
    const problems = footprintProblems(all, res).filter((m) => m.includes("herd-"));
    // (Fourteen more horses cannot all stand apart in one paddock: none of them is out of it, in a wall, or past the rails.)
    assert.deepEqual(problems.filter((m) => !m.includes("on another animal")).slice(0, 10), [], "none out of its pen");
});
