/**
 * p5 (humans): the Ark's people (the owner, 2026-11-17; decision 378). One generic figure per human the record has
 * aboard, its look from the animal's id only (privacy: never the capture's photo, a face or a name), its day pure in
 * the shared island clock: the same people in the same places for every viewer.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {HumanFigures, humanGeometry, humanLook, posePerson, sitRootY, HUMAN_MAX, type HumanPoseKind} from "@/ark-scene/humans/figures";
import {assignOut, carSeat, helmSeat, humanDay, isHumanAnimal, SUN_CLEAR, TownHumans, townHumanSites, type HumanRoomHost} from "@/ark-scene/humans/town-humans";
import {apartmentHumanRoom, humanRoomHost, sofaOffset} from "@/ark-scene/humans/home-rooms-host";
import {screenColour} from "@/ark-scene/humans/tvs";
import {bridgeAt} from "@/ark-scene/islands/town/canal-bridges";
import {inBox, segmentDistance, toLocal} from "@/ark-scene/islands/town/geom";
import {sampleTownGround} from "@/ark-scene/islands/town/ground";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {solidDistance, townSolids} from "@/ark-scene/islands/town/solids";
import {roadHeight, townTraffic, TrafficSim} from "@/ark-scene/islands/town/render/vehicles";
import {Color} from "three";

const ROSTER = Array.from({length: 112}, (_, i) => ({id: `fixture-human-${String(i).padStart(3, "0")}`}));
/** The island clock's epoch (ms) for a town day and hour (`townClockAt`: day = floor(hours since epoch / 24) + 4). */
const at = (day: number, hours: number) => ((day - 4) * 24 + hours) * 3600 * 1000;
const SATURDAY = 20411;
const MONDAY = 20413;

function town(host?: HumanRoomHost) {
    const humans = new TownHumans({origin: {x: 0, z: 0}, roadHeight});
    humans.setRoster(ROSTER);
    if (host) humans.setRoomHost(host);
    return humans;
}
function cars(ms: number) {
    return new TrafficSim(townTraffic(), () => []).at_(ms / 1000);
}
const snap = (list: ReadonlyArray<{id: string; what: string; x: number; y: number; z: number; yaw: number; pose: string}>) => list.map((h) => `${h.id}:${h.what}:${h.pose}:${h.x.toFixed(3)}:${h.y.toFixed(3)}:${h.z.toFixed(3)}:${h.yaw.toFixed(3)}`).sort();

test("a person's look is the id's alone: the same every time, and varied across people", () => {
    for (const {id} of ROSTER.slice(0, 20)) assert.deepEqual(humanLook(id), humanLook(id));
    const looks = ROSTER.map(({id}) => humanLook(id));
    const distinct = (pick: (l: ReturnType<typeof humanLook>) => string) => new Set(looks.map(pick)).size;
    assert.ok(distinct((l) => l.skin.join()) >= 8, "skin tones");
    assert.ok(distinct((l) => l.hair.join()) >= 7, "hair colours");
    assert.ok(distinct((l) => l.top.join()) >= 10, "tops");
    assert.ok(distinct((l) => l.bottom.join()) >= 7, "bottoms");
    assert.ok(distinct((l) => JSON.stringify(l)) === looks.length, "no two people alike");
    const heights = looks.map((l) => l.height);
    assert.ok(Math.min(...heights) >= 1.5 && Math.max(...heights) <= 1.96 && Math.max(...heights) - Math.min(...heights) > 0.3, "adult heights spread");
    assert.ok(looks.some((l) => l.longHair) && looks.some((l) => !l.longHair) && looks.some((l) => l.trousers) && looks.some((l) => !l.trousers));
    const child = humanLook("fixture-human-000", true);
    assert.ok(child.child && child.height < 1.45);
});

test("privacy: a look holds nothing but body and clothes (no photo, face or name fields)", () => {
    assert.deepEqual(Object.keys(humanLook("x")).sort(), ["bald", "bottom", "build", "child", "hair", "height", "longHair", "skin", "sleeves", "top", "trousers"]);
});

test("the body's budget (quality pass: a smooth lofted body): 1,500–3,000 triangles near, a far one under a third of it, no textures", () => {
    const near = humanGeometry(false);
    const far = humanGeometry(true);
    const tris = (g: typeof near) => (g.index ? g.index.count : g.getAttribute("position").count) / 3;
    assert.ok(tris(near) >= 1500 && tris(near) <= 3000, `near ${tris(near)}`);
    assert.ok(tris(far) <= 700 && tris(far) <= tris(near) * 0.3, `far ${tris(far)} of ${tris(near)}`);
    assert.equal(near.getAttribute("uv"), undefined);
    assert.deepEqual(HumanFigures.triangles(), {near: tris(near), far: tris(far)});
});

test("every pose gives finite joints, and a sitter's hips are on the seat", () => {
    const out: Parameters<typeof posePerson>[2] = {legs: [0, 0, 0, 0], arms: [0, 0, 0, 0], body: [0, 0, 0, 0]};
    for (const pose of ["stand", "walk", "sit", "lie", "drive", "chop", "plant", "sleep", "carry"] as HumanPoseKind[]) {
        for (const phase of [0, 0.3, 1.7]) {
            posePerson(pose, phase, out);
            for (const v of [...out.legs, ...out.arms, ...out.body]) assert.ok(Number.isFinite(v), `${pose} ${phase}`);
        }
    }
    posePerson("sit", 0, out);
    assert.ok(Math.abs(out.legs[0] - Math.PI / 2) < 0.2 && Math.abs(out.legs[1] - Math.PI / 2) < 0.2, "thighs level, shins down");
    assert.ok(Math.abs(sitRootY(0.44, 1) + 0.86 - 0.44) < 1e-9);
});

test("only the record's humans are people", () => {
    assert.ok(isHumanAnimal({model_slug: "human"}));
    assert.ok(isHumanAnimal({scientific_name: "Homo sapiens"}));
    assert.ok(!isHumanAnimal({model_slug: "chimpanzee", scientific_name: "Pan troglodytes"}));
    assert.ok(!isHumanAnimal({}));
});

test("the day: asleep at night, home in the evening, out or at work by day, the same answer every time", () => {
    const count = (day: number, hours: number) => {
        const by = {sleep: 0, home: 0, work: 0, out: 0};
        for (const {id} of ROSTER) by[humanDay(id, {hours, day})]++;
        return by;
    };
    assert.equal(count(SATURDAY, 3).sleep, ROSTER.length, "everyone asleep at 3");
    const evening = count(SATURDAY, 20.5);
    assert.equal(evening.home, ROSTER.length, "everyone home at 20:30");
    const workday = count(MONDAY, 11);
    assert.ok(workday.work > ROSTER.length * 0.4 && workday.work < ROSTER.length * 0.8, `at work ${workday.work}`);
    const weekend = count(SATURDAY, 14);
    assert.equal(weekend.work, 0, "no one at work on Saturday");
    assert.ok(weekend.out > ROSTER.length / 2, `out ${weekend.out}`);
    for (const {id} of ROSTER.slice(0, 30)) assert.equal(humanDay(id, {hours: 14, day: SATURDAY}), humanDay(id, {hours: 14, day: SATURDAY}));
});

test("no invented crowds: never more figures than the record has humans, each person once", () => {
    for (const [day, hours] of [[SATURDAY, 14], [MONDAY, 11], [SATURDAY, 21], [SATURDAY, 3], [MONDAY, 17.6]] as const) {
        const ms = at(day, hours);
        const list = town().frame(ms, cars(ms), townTraffic().cars.length);
        assert.ok(list.length <= ROSTER.length);
        assert.equal(new Set(list.map((h) => h.id)).size, list.length, "each person once");
        for (const h of list) assert.ok(ROSTER.some((r) => r.id === h.id));
    }
    const none = new TownHumans({origin: {x: 0, z: 0}});
    assert.equal(none.frame(at(SATURDAY, 14), cars(at(SATURDAY, 14)), 6).length, 0, "no humans aboard: no one drawn");
    const one = new TownHumans({origin: {x: 0, z: 0}});
    one.setRoster([{id: "only"}]);
    for (let h = 0; h < 24; h += 0.5) assert.ok(one.frame(at(SATURDAY, h), cars(at(SATURDAY, h)), 6).length <= 1);
});

test("the same people in the same places for every viewer (pure in the clock and the ids)", () => {
    const ms = at(SATURDAY, 14.2);
    const a = snap(town().frame(ms, cars(ms), townTraffic().cars.length));
    const shuffled = new TownHumans({origin: {x: 0, z: 0}, roadHeight});
    shuffled.setRoster([...ROSTER].reverse());
    const b = snap(shuffled.frame(ms, cars(ms), townTraffic().cars.length));
    assert.deepEqual(a, b);
    assert.ok(a.length > 30, `a Saturday afternoon has people out (${a.length})`);
});

test("a Saturday afternoon: benches, the beach, the cars' wheels and the boats' helms are taken", () => {
    const ms = at(SATURDAY, 14);
    const moving = cars(ms);
    const list = town().frame(ms, moving, townTraffic().cars.length);
    const by = (what: string) => list.filter((h) => h.what === what);
    assert.ok(by("bench").length >= 4 && by("bench").every((h) => h.pose === "sit"));
    // (Quality pass: on a towel, on the back or a side or sitting up reading; a towel under each, a parasol for some.)
    assert.ok(by("sun").length >= 5 && by("sun").every((h) => h.pose === "sunback" || h.pose === "sunside" || h.pose === "sunsit"));
    const props = town();
    props.frame(ms, moving, townTraffic().cars.length);
    assert.equal(props.beach.filter((p) => p.kind === "towel").length, by("sun").length - list.filter((h) => h.what === "sun" && h.scale !== undefined && h.scale < 1).length);
    assert.ok(by("paddle").every((h) => h.pose === "paddle"));
    assert.ok(by("walk").length >= 2 && by("walk").every((h) => h.pose === "walk"));
    assert.equal(by("boat").length, 3);
    assert.ok(by("boat").every((h) => h.pose === "drive"));
    // Every moving car has exactly one driver (no car drives itself), at most one passenger.
    const active = (moving ?? []).filter((c) => c.active);
    const drivers = by("car").filter((h) => h.pose === "drive");
    assert.equal(drivers.length, active.length);
    assert.ok(by("car").length <= active.length * 2);
    for (const d of drivers) assert.ok(active.some((c) => Math.hypot(c.x - d.x, c.z - d.z) < 0.6), "a driver is in a car");
});

test("no one in a wall or in the water (but the boats' drivers): benches, the beach, the walks", () => {
    const plan = townPlan();
    const solids = townSolids([]);
    const sites = townHumanSites();
    assert.equal(sites.seats.length, 14);
    for (const hours of [10.2, 12, 14, 16.4, 17.9]) {
        for (const day of [SATURDAY, SATURDAY + 1, MONDAY]) {
            const ms = at(day, hours);
            for (const h of town().frame(ms, cars(ms), townTraffic().cars.length)) {
                if (h.what === "boat" || h.what === "car") continue;
                for (const b of plan.buildings) assert.ok(!inBox(b.at, h.x, h.z), `${h.what} in ${b.id}`);
                const ground = sampleTownGround(h.x, h.z);
                // (Quality pass: a paddler stands on the sand under the shallows, never deeper than the knees.)
                if (h.what === "paddle") {
                    assert.ok(ground.surface === "sand" || ground.surface === "sea", ground.surface);
                    const depth = 0 - ground.height;
                    assert.ok(depth > 0 && depth <= 0.6, `paddling ${depth.toFixed(2)} m deep`);
                    for (const s of solids) assert.ok(solidDistance(s, h.x, h.z) > 0.2, "paddling in a solid");
                    continue;
                }
                // (A walker crossing the canal is on a bridge's deck: `ark-human-walks.test.ts`.)
                assert.ok(ground.height > 0.5 || (h.what === "pavement" && bridgeAt(h.x, h.z)), `${h.what} over water at ${h.x.toFixed(1)}, ${h.z.toFixed(1)}`);
                if (h.what === "sun" || h.what === "walk") {
                    assert.equal(ground.surface, "sand");
                    for (const s of solids) assert.ok(solidDistance(s, h.x, h.z) > 0.2, `${h.what} in a solid`);
                    // On the sand, not under or over it (a walker's feet, a sunbather's back a hand over it).
                    assert.ok(Math.abs(h.y - ground.height) < 0.35, `${h.what} at the ground`);
                }
            }
        }
    }
    // No one walks over a sunbather: every spot (the body lying from its feet inland) clear of every walk's line.
    for (const p of sites.beach) for (const [a, b] of sites.walks) for (const up of [0, 0.85, 1.7]) assert.ok(segmentDistance(p.x, p.z - up, a.x, a.z, b.x, b.z) >= SUN_CLEAR);
    assert.ok(sites.walks.length >= 2 && sites.beach.length >= 30, `${sites.walks.length} walks, ${sites.beach.length} spots`);
    for (let t = 0; t < 600; t += 7) {
        const list = town().frame(at(SATURDAY, 14) + t * 1000, null, 0);
        const lying = list.filter((h) => h.what === "sun");
        for (const w of list.filter((h) => h.what === "walk")) for (const l of lying) for (const up of [0, 0.85, 1.7]) assert.ok(Math.hypot(w.x - l.x, w.z - (l.z - up)) > 1.2, "a walker over a sunbather");
    }
    // Sunbathers keep apart.
    const sun = town().frame(at(SATURDAY, 14), null, 0).filter((h) => h.what === "sun");
    for (let i = 0; i < sun.length; i++) for (let j = i + 1; j < sun.length; j++) assert.ok(Math.hypot(sun[i].x - sun[j].x, sun[i].z - sun[j].z) >= 2.4);
});

test("a driver sits inside the car, on the right, facing the way it goes; a helm's driver behind the wheel", () => {
    const car = {x: 10, z: 20, dx: 0, dz: 1};
    const driver = carSeat(car, 0, 2, 1);
    const passenger = carSeat(car, 1, 2, 1);
    assert.ok(Math.abs(driver.yaw) < 1e-9);
    assert.ok(Math.abs(driver.x - passenger.x) > 0.6 && Math.abs(driver.x - 10) < 0.5 && Math.abs(driver.z - 20) < 0.3);
    // The hips over the road and under the roof (a saloon's is ~1.25 m).
    const hips = driver.y + 0.86;
    assert.ok(hips > 2.15 && hips < 2.45, `hips ${hips}`);
    const helm = helmSeat({x: 0, z: 0, yaw: 0}, 0, 0, 1);
    assert.ok(Math.hypot(helm.x, helm.z) < 0.8 && helm.y + 0.86 > 1.1 && helm.y + 0.86 < 1.6);
});

test("at home only in a room the homes give: with none no one is drawn indoors; with rooms, on the sofa before the TV", () => {
    const night = at(SATURDAY, 21);
    assert.equal(town().frame(night, null, 0).filter((h) => h.what === "home" || h.what === "sleep").length, 0);
    // (The homes lane's apartments as it makes them: a glazed bay 6.6 × 2.8 m, local +z the glass.)
    const flats = Array.from({length: 60}, (_, i) => ({id: `tower-9~f${i}`, kind: "apartment", shell: {x: 300 + i * 9, z: 40, w: 6.6, d: 2.8, rot: (i % 4) * 0.7}, floor: 12 + i}));
    const host = humanRoomHost(flats);
    const humans = town(host);
    const list = humans.frame(night, null, 0);
    const home = list.filter((h) => h.what === "home");
    assert.equal(home.length, ROSTER.length, "everyone home at 21:00, two a flat at most");
    assert.ok(humans.tvs.length > 10 && humans.tvs.length <= flats.length);
    const seen = new Map<string, number>();
    for (const h of home) {
        assert.equal(h.pose, "sit");
        const flat = flats.find((f) => inBox(f.shell, h.x, h.z));
        assert.ok(flat, "inside a flat's walls, not through them");
        seen.set(flat.id, (seen.get(flat.id) ?? 0) + 1);
        // On the sofa (pet-homes.ts apartment(): along the tower's wall), hips at its seat.
        const p = toLocal(flat.shell, h.x, h.z);
        const {su, sw} = sofaOffset(flat);
        assert.ok(Math.abs(p.x - su) < sw / 2 && p.z < -flat.shell.d / 2 + 0.9, "on the sofa");
        assert.ok(Math.abs(h.y + 0.86 * (h.look.height / 1.75) - (flat.floor + 0.42)) < 1e-6);
        assert.ok((h.light ?? 0) > 0.5, "lit by the room's lamp at night");
    }
    for (const n of Array.from(seen.values())) assert.ok(n <= 2);
    for (const tv of humans.tvs) {
        const flat = flats.find((f) => f.id === tv.room)!;
        assert.ok(inBox(flat.shell, tv.x, tv.z, -0.3), "the TV inside the room");
        // The screen faces the sofa.
        const room = apartmentHumanRoom(flat)!;
        const to = {x: (room.seats[0].x + room.seats[1].x) / 2 - tv.x, z: (room.seats[0].z + room.seats[1].z) / 2 - tv.z};
        assert.ok((Math.sin(tv.yaw) * to.x + Math.cos(tv.yaw) * to.z) / Math.hypot(to.x, to.z) > 0.95);
    }
    assert.equal(humans.frame(at(SATURDAY, 3), null, 0).length, 0, "asleep: no beds in the apartments yet, no one drawn");
    assert.equal(apartmentHumanRoom({...flats[0], kind: "garden_room"}), null);
});

test("someone away (the forest's crews) is not drawn in town", () => {
    const ms = at(SATURDAY, 14);
    const all = town().frame(ms, null, 0).map((h) => h.id);
    const gone = new Set(all.slice(0, 5));
    const humans = new TownHumans({origin: {x: 0, z: 0}, away: (id) => gone.has(id)});
    humans.setRoster(ROSTER);
    const list = humans.frame(ms, null, 0);
    for (const h of list) assert.ok(!gone.has(h.id));
});

test("out in a block: everyone has one place, no seat or spot twice", () => {
    const sites = townHumanSites();
    const out = ROSTER.map((r) => r.id);
    const got = assignOut(out, {hours: 14, day: SATURDAY}, sites, 6);
    assert.equal(got.size, out.length);
    const keys = Array.from(got.values()).filter((w) => w.kind !== "about" && w.kind !== "walk").map((w) => JSON.stringify(w));
    assert.equal(new Set(keys).size, keys.length);
});

test("the town's figures are drawn in the world's frame, capped, and reuse their list", () => {
    const humans = new TownHumans({origin: {x: 600, z: -250}});
    humans.setRoster(ROSTER);
    const ms = at(SATURDAY, 14);
    const a = humans.frame(ms, null, 0);
    const local = town().frame(ms, null, 0).filter((h) => h.what !== "boat");
    const first = a.filter((h) => h.what !== "boat")[0];
    const same = local.find((h) => h.id === first.id)!;
    assert.ok(Math.abs(first.x - same.x - 600) < 1e-6 && Math.abs(first.z - same.z + 250) < 1e-6);
    assert.equal(humans.frame(ms + 16, null, 0), a, "the same array each frame (no per-frame allocation)");
    assert.ok(HUMAN_MAX >= 112 && HUMAN_MAX <= 600);
});

test("a TV's picture is the shared clock's and the room's (the same flicker for every viewer)", () => {
    const a = screenColour("tower-2~f6r", 1234.5, new Color());
    const b = screenColour("tower-2~f6r", 1234.5, new Color());
    assert.deepEqual(a.toArray(), b.toArray());
    assert.notDeepEqual(a.toArray(), screenColour("tower-2~f6l", 1234.5, new Color()).toArray());
});
