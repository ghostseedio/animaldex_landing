/**
 * p5 (humans, dogs): the town's people walk the record's own dogs on a lead (the owner, 2026-11-17: "can we also see
 * them walking dogs (this should also help distribute dogs better)"). No dog twice; who walks whom is by home; walkers
 * keep to the pavements; a lead is short; every dog is home again when its walk ends.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {DogWalks, HEEL_AHEAD, HEEL_SIDE, LEADS, LEAD_MAX, NEIGHBOUR_REACH, dogWalkPlaces, heelPose, isHouseDog, leadLine, pairDogs, townWalkers, type WalkDog, type Walker} from "@/ark-scene/humans/dog-walks";
import {nearestNode, onWalkedGround, pavementGraph} from "@/ark-scene/humans/pavements";
import {TownHumans} from "@/ark-scene/humans/town-humans";
import {polylineWithin} from "@/ark-scene/islands/town/geom";
import {townHouseholds} from "@/ark-scene/islands/town/areas";
import {townPlan} from "@/ark-scene/islands/town/plan";

const plan = townPlan();
const graph = pavementGraph();
const ROADS = plan.streets.filter((s) => ["high", "road", "lane", "track"].includes(s.kind));
const roadsAt = (x: number, z: number) => ROADS.filter((s) => polylineWithin(s.line, x, z, s.width / 2));
const HUMANS = Array.from({length: 112}, (_, i) => `fixture-human-${String(i).padStart(3, "0")}`);
const at = (day: number, hours: number) => ((day - 4) * 24 + hours) * 3600 * 1000;
const SATURDAY = 20411;

/** A fixture of the record's 265 house dogs: each at a house or terrace home of the plan (its building's front). */
function fixtureDogs(n = 265): WalkDog[] {
    const homes = townHouseholds(plan).filter((h) => h.kind !== "flat");
    const at = new Map(plan.buildings.map((b) => [b.id, b.at]));
    return Array.from({length: n}, (_, i) => {
        const h = homes[(i * 37) % homes.length];
        const box = at.get(h.building)!;
        return {id: `fixture-dog-${String(i).padStart(3, "0")}`, household: h.id, x: box.x + ((i % 5) - 2) * 0.8, z: box.z + 3, length: 0.5 + (i % 6) * 0.1};
    });
}

test("which animals are walked: pet dogs of the town's houses, by their kind; nothing else", () => {
    const dog = {species_profile_id: "breed", kind_species_profile_id: "c54e5eca-48bc-4b31-bef6-7f69515e76f7", area: "house", island: "town"};
    assert.equal(isHouseDog(dog), true);
    assert.equal(isHouseDog({...dog, area: "zoo"}), false);
    assert.equal(isHouseDog({...dog, area: "farm"}), false);
    assert.equal(isHouseDog({...dog, kind_species_profile_id: "edf50852-5858-4be3-afa3-d0ab0fa62296"}), false, "a prairie dog is no dog");
    assert.equal(isHouseDog({species_profile_id: "cat", kind_name: "Domestic Cat", area: "house", island: "town"}), false);
    assert.equal(isHouseDog({species_profile_id: "x", kind_name: "Domestic Dog", area: "house", island: "town"}), true);
});

test("the pairing: no dog twice, two leads at most, its own household first, else a near neighbour, else home", () => {
    const dogs = fixtureDogs();
    const walkers = townWalkers(HUMANS, plan);
    const pairs = pairDogs(dogs, walkers);
    // Every dog once: walked by one person, or at home.
    const walked = Array.from(pairs.dogsOf.values()).flat().map((d) => d.id);
    assert.equal(new Set(walked).size, walked.length, "a dog on two leads");
    assert.equal(walked.length + pairs.home.length, dogs.length);
    assert.equal(new Set([...walked, ...pairs.home]).size, dogs.length);
    for (const [walker, mine] of pairs.dogsOf) {
        assert.ok(mine.length >= 1 && mine.length <= LEADS, `${walker} holds ${mine.length} leads`);
        for (const d of mine) assert.equal(pairs.walkerOf.get(d.id), walker);
    }
    const byId = new Map(walkers.map((w) => [w.id, w]));
    let own = 0;
    for (const d of dogs) {
        const w = byId.get(pairs.walkerOf.get(d.id) ?? "");
        const people = walkers.filter((x) => x.household === d.household);
        if (!w) {
            // Home: nobody of its household has a hand free, and no neighbour in reach has.
            for (const x of walkers) assert.ok((pairs.dogsOf.get(x.id)?.length ?? 0) >= LEADS || Math.hypot(x.x - d.x, x.z - d.z) >= NEIGHBOUR_REACH || x.household === d.household, `${d.id} stays home with ${x.id} free next door`);
            continue;
        }
        if (w.household === d.household) own++;
        else {
            assert.ok(Math.hypot(w.x - d.x, w.z - d.z) < NEIGHBOUR_REACH, "a walker from across the town");
            assert.ok(people.every((x) => (pairs.dogsOf.get(x.id)?.length ?? 0) >= LEADS), "a neighbour walks it while its own people have a hand free");
        }
    }
    assert.ok(walked.length > 60, `${walked.length} of 265 dogs walked`);
    assert.ok(own >= 1, "nobody walks a dog of their own household");
    // The same whatever order the record came in.
    const again = pairDogs(dogs.slice().reverse(), walkers.slice().reverse());
    assert.deepEqual(Array.from(again.walkerOf).sort(), Array.from(pairs.walkerOf).sort());
});

test("a walk: morning and evening, from the dog's door along the pavements and home again; at heel; a short lead", () => {
    const dogs = fixtureDogs();
    const walkers = townWalkers(HUMANS, plan);
    const walks = new DogWalks(() => graph, () => dogWalkPlaces([], plan));
    walks.setRoster(dogs, walkers);
    const heel = {x: 0, z: 0, yaw: 0, sniffing: false, speed: 0};
    const line = new Float32Array(7 * 3);
    let sampled = 0;
    let sniffs = 0;
    const some = Array.from(walks.pairing.dogsOf.keys()).sort().slice(0, 24);
    assert.ok(some.length >= 12);
    for (const walker of some) {
        const mine = walks.dogsOf(walker);
        for (const day of [SATURDAY, SATURDAY + 2]) {
            const hours = walks.hoursOf(walker, day, 6.9);
            assert.equal(hours.length, 2);
            assert.ok(hours[0][0] >= 6.9 + 0.25 - 1e-9 && hours[0][0] < 9.3, `morning walk at ${hours[0][0]}`);
            assert.ok(hours[1][0] >= 17.1 && hours[1][0] < 19.7, `evening walk at ${hours[1][0]}`);
            for (const [from, to] of hours) {
                const minutes = (to - from) * 60;
                assert.ok(minutes > 4 && minutes < 40, `a walk of ${minutes.toFixed(0)} minutes`);
                assert.equal(walks.at(walker, from - 0.01, day, 6.9), null, "out before the walk");
                assert.equal(walks.at(walker, to + 0.01, day, 6.9), null, "still out after the walk");
                const seenDogs = new Set<string>();
                for (let h = from + 1e-6; h < to; h += 15 / 3600) {
                    const fix = walks.at(walker, h, day, 6.9)!;
                    assert.ok(fix && !fix.done);
                    sampled++;
                    if (fix.paused) sniffs++;
                    assert.ok(onWalkedGround(plan, fix.x, fix.z) || roadsAt(fix.x, fix.z).length <= 1, "a dog walker off the pavements");
                    const hand = {x: fix.x, y: 0.85, z: fix.z};
                    for (const {dog, side} of walks.onLead) {
                        seenDogs.add(dog.id);
                        const p = heelPose(fix, side, heel);
                        const d = Math.hypot(p.x - fix.x, p.z - fix.z);
                        assert.ok(Math.abs(d - Math.hypot(HEEL_SIDE, HEEL_AHEAD)) < 1e-9, "the dog off its heel");
                        const length = leadLine(hand, {x: p.x, y: dog.length * 0.58, z: p.z}, 7, line, 0);
                        assert.ok(length > 0.3 && length <= LEAD_MAX, `a lead of ${length.toFixed(2)} m`);
                    }
                    assert.ok(walks.onLead.length >= 1 && walks.onLead.length <= LEADS);
                }
                assert.deepEqual(Array.from(seenDogs).sort(), mine.map((d) => d.id).sort(), "a dog of the walker's never came out");
                // Out from the first dog's door and back to it: each dog leaves and comes home at its own door.
                const first = walks.at(walker, from + 1e-6, day, 6.9)!;
                const door = graph.nodes[nearestNode(graph, mine[0].x, mine[0].z)];
                assert.ok(Math.hypot(first.x - door.x, first.z - door.z) < 1.5, "the walk begins away from the dog's door");
                const last = walks.at(walker, to - 1e-6, day, 6.9)!;
                assert.ok(Math.hypot(last.x - door.x, last.z - door.z) < 1.5, "the dog is not brought home");
            }
        }
    }
    assert.ok(sampled > 1500 && sniffs > 100, `${sampled} moments, ${sniffs} at a sniff stop`);
    // The same for every viewer.
    const other = new DogWalks(() => graph, () => dogWalkPlaces([], plan));
    other.setRoster(dogs.slice().reverse(), walkers.slice().reverse());
    const a = walks.at(some[0], walks.hoursOf(some[0], SATURDAY, 6.9)[0][0] + 0.05, SATURDAY, 6.9)!;
    const ax = a.x, az = a.z;
    const b = other.at(some[0], other.hoursOf(some[0], SATURDAY, 6.9)[0][0] + 0.05, SATURDAY, 6.9)!;
    assert.deepEqual([b.x, b.z], [ax, az]);
});

test("a second dog from another home joins at its own door and is taken back to it", () => {
    const walker: Walker = {id: "fixture-human-000", household: "h", x: 0, z: 0};
    const homes = townHouseholds(plan).filter((h) => h.kind === "house");
    const at2 = new Map(plan.buildings.map((b) => [b.id, b.at]));
    const a = at2.get(homes[0].building)!;
    // The second dog's home a few doors down the street: another pavement node, near enough for a neighbour.
    const far = homes.map((h) => at2.get(h.building)!).find((b) => Math.hypot(b.x - a.x, b.z - a.z) > 25 && Math.hypot(b.x - a.x, b.z - a.z) < 55 && nearestNode(graph, b.x, b.z) !== nearestNode(graph, a.x, a.z))!;
    assert.ok(far, "no second home in reach for the fixture");
    const dogs: WalkDog[] = [{id: "dog-a", household: "h", x: a.x, z: a.z, length: 0.6}, {id: "dog-b", household: "other", x: far.x, z: far.z, length: 0.5}];
    const walks = new DogWalks(() => graph);
    walks.setRoster(dogs, [{...walker, x: a.x, z: a.z}]);
    assert.deepEqual(walks.dogsOf(walker.id).map((d) => d.id), ["dog-a", "dog-b"]);
    const [from, to] = walks.hoursOf(walker.id, SATURDAY, 6.9)[0];
    const door = graph.nodes[nearestNode(graph, far.x, far.z)];
    let joined: {x: number; z: number} | null = null;
    let left: {x: number; z: number} | null = null;
    let out = false;
    for (let h = from + 1e-6; h < to; h += 2 / 3600) {
        const fix = walks.at(walker.id, h, SATURDAY, 6.9)!;
        const on = walks.onLead.some((l) => l.dog.id === "dog-b");
        assert.ok(walks.onLead.some((l) => l.dog.id === "dog-a"), "the walker's own dog off the lead");
        if (on && !out) joined = {x: fix.x, z: fix.z};
        if (!on && out) left ??= {x: fix.x, z: fix.z};
        if (left) assert.equal(on, false, "the second dog out again after going home");
        out = on;
    }
    assert.ok(joined && left, "the second dog never came out, or never went home");
    assert.ok(Math.hypot(joined!.x - door.x, joined!.z - door.z) < 3, "it joined away from its door");
    assert.ok(Math.hypot(left!.x - door.x, left!.z - door.z) < 3, "it left the lead away from its door");
});

test("in the town: a dog walker is drawn once, on the pavement, with the record's own dog beside them (a tap's id)", () => {
    const dogs = fixtureDogs();
    const town = new TownHumans({origin: {x: 500, z: -200}});
    town.setRoster(HUMANS.map((id) => ({id})));
    const walks = new DogWalks(() => town.walks!.graph, () => dogWalkPlaces(town.beachWalks, plan));
    walks.setRoster(dogs, townWalkers(town.grown, plan));
    town.setDogWalks(walks);
    const ids = new Set(dogs.map((d) => d.id));
    let seen = 0;
    const out = new Set<string>();
    for (let h = 6.5; h < 20.5; h += 0.05) {
        const list = town.frame(at(SATURDAY, h), null, 6);
        assert.equal(new Set(list.map((x) => x.id)).size, list.length, "a person drawn twice");
        assert.equal(new Set(town.dogs.map((d) => d.id)).size, town.dogs.length, "a dog on two walks at once");
        for (const d of town.dogs) {
            seen++;
            out.add(d.id);
            assert.ok(ids.has(d.id), "a dog that is not the record's");
            const walker = list.find((x) => x.id === d.walker)!;
            assert.equal(walker.what, "dogwalk");
            assert.ok(walker.pose === "walk" || walker.pose === "stand");
            assert.equal(d.sniffing, walker.pose === "stand");
            assert.ok(Math.hypot(d.x - walker.x, d.z - walker.z) < 0.7, "the dog away from its walker");
            assert.ok(Math.hypot(d.hand.x - walker.x, d.hand.z - walker.z) < 0.4 && d.hand.y > walker.y + 0.6, "the lead's hand end");
            assert.ok(onWalkedGround(plan, walker.x - 500, walker.z + 200) || roadsAt(walker.x - 500, walker.z + 200).length <= 1);
        }
        if (h > 10 && h < 16.5) assert.equal(town.dogs.length, 0, `a dog walk at ${h.toFixed(2)}`);
    }
    assert.ok(seen > 300 && out.size > 40, `${seen} dog moments, ${out.size} dogs out in the day`);
    // Without the walks nobody is a dog walker.
    town.setDogWalks(null);
    assert.equal(town.frame(at(SATURDAY, 7.8), null, 6).filter((x) => x.what === "dogwalk").length, 0);
});
