/**
 * p5 (humans): the Ark's people (the owner, 2026-11-17; decision 378). One generic figure per human the record has
 * aboard, its look from the animal's id only (privacy: never the capture's photo, a face or a name), its day pure in
 * the shared island clock: the same people in the same places for every viewer.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {HumanFigures, humanGeometry, humanLook, posePerson, sitRootY, HUMAN_MAX, SLEEP_SINK, type HumanPoseKind} from "@/ark-scene/humans/figures";
import {assignOut, carSeat, chosenHuman, helmSeat, humanDay, isHumanAnimal, nightOuting, rhythm, SUN_CLEAR, TownHumans, townHumanSites, type HumanRoomHost} from "@/ark-scene/humans/town-humans";
import {apartmentHumanRoom, humanRoomHost, sofaOffset} from "@/ark-scene/humans/home-rooms-host";
import {apartmentLayout, towerApartments} from "@/ark-scene/islands/town/home-rooms";
const room = (flat: Parameters<typeof apartmentHumanRoom>[0]) => apartmentHumanRoom(flat)!;
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
    // Humans visible (2026-11-18): asleep at 3 but the night's people (the owls up late, Friday's late shift at work).
    const night = count(SATURDAY, 3);
    assert.ok(night.sleep >= ROSTER.length * 0.75 && night.sleep < ROSTER.length, `asleep at 3: ${night.sleep}`);
    for (const {id} of ROSTER) if (humanDay(id, {hours: 3, day: SATURDAY}) !== "sleep") assert.ok(["owl", "late"].includes(rhythm(id).kind), id);
    const evening = count(SATURDAY, 20.5);
    assert.equal(evening.home, ROSTER.length, "everyone home at 20:30 on a Saturday");
    // A weekday evening: the late shift at work.
    const weekdayEvening = count(MONDAY, 20.5);
    assert.ok(weekdayEvening.work > 0 && weekdayEvening.work < ROSTER.length * 0.15 && weekdayEvening.home + weekdayEvening.work === ROSTER.length, JSON.stringify(weekdayEvening));
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
    // (Humans visible: an early riser may be in bed by nine; everyone else is home.)
    // (Humans visible: and the night's few out, `nightRota`: 2.5% of them.)
    const outside = list.filter((h) => h.what !== "home" && h.what !== "sleep");
    assert.ok(outside.length >= 2 && outside.length <= 4, `${outside.length} out`);
    assert.equal(home.length + list.filter((h) => h.what === "sleep").length + outside.length, ROSTER.length, "everyone home at 21:00 but the few out, two a flat at most");
    assert.ok(home.length > ROSTER.length * 0.9);
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
    // Humans visible: asleep in the flat's bed (`apartmentLayout`), lying from its foot toward its head, and seen by the
    // bedside lamp; those still up at 3 at home on the sofa or out.
    const late = humans.frame(at(SATURDAY, 3), null, 0);
    const sleepers = late.filter((h) => h.what === "sleep");
    assert.ok(sleepers.length >= ROSTER.length * 0.75, `${sleepers.length} asleep in bed`);
    for (const h of sleepers) {
        assert.equal(h.pose, "sleep");
        const flat = flats.find((f) => inBox(f.shell, h.x, h.z))!;
        assert.ok(flat, "in a flat");
        const bed = apartmentLayout(flat).bed;
        const p = toLocal(flat.shell, h.x, h.z);
        assert.ok(Math.abs(p.x - bed.x) <= bed.length / 2 && Math.abs(p.z - bed.z) <= bed.width / 2, "on the bed");
        assert.ok(Math.abs(h.y - (flat.floor + bed.top - SLEEP_SINK)) < 1e-6, "in the mattress's top (humans polish: lying in the bed, not on its covers)");
        assert.ok((h.light ?? 0) > 0.3, "seen by the bedside lamp");
        assert.equal(h.face, room(flat).front, "seen through the flat's open front");
    }
    assert.ok(late.some((h) => h.what === "home"), "someone still up at 3");
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

// Live bug 2026-11-18: "Human" chosen from the species list (or search, `?focus=`) did nothing: humans are not scene
// entries, so `select` found none and the card closed again. `chosenHuman` is the human's card and where to look.
test("a human chosen by id: the card's animal and the drawn person's spot, or null where not drawn", () => {
    const aboard = [{id: "h1", model_slug: "human"}, {id: "h2", model_slug: "human"}];
    const out = [{id: "h2", x: 4, y: 2, z: -3}];
    assert.equal(chosenHuman("cat-1", aboard, out), null);
    assert.equal(chosenHuman(null, aboard, out), null);
    // Humans visible: one not drawn now gives way to one who is (never the whole town's view while anyone is drawn).
    assert.deepEqual(chosenHuman("h1", aboard, out), {human: aboard[1], at: {x: 4, y: 3, z: -3}});
    assert.deepEqual(chosenHuman("h1", aboard, []), {human: aboard[0], at: null});
    assert.deepEqual(chosenHuman("h1", aboard, [{id: "h2", x: 1, y: 20, z: 2, face: 0.5}]), {human: aboard[1], at: {x: 1, y: 20.6, z: 2, face: 0.5}});
    assert.deepEqual(chosenHuman("h2", aboard, out), {human: aboard[1], at: {x: 4, y: 3, z: -3}});
});

test("the scene's select and arrive look for a chosen human before its own entries", async () => {
    const {readFile} = await import("node:fs/promises");
    const source = await readFile(new URL("../ark-scene/index.ts", import.meta.url), "utf8");
    for (const head of ["const select = (id: string | null, flyTo: boolean, close = false) => {", "const arrive = (id: string | null, close: boolean) => {"]) {
        const at = source.indexOf(head);
        assert.ok(at > 0, head);
        const body = source.slice(at, at + 600);
        assert.ok(body.indexOf("chosenHuman(id, humansAboard, townHumans.out") > 0 && body.indexOf("chosenHuman(") < (body.indexOf("findEntry(") < 0 ? Infinity : body.indexOf("findEntry(")), head);
    }
});

// Humans visible (2026-11-18): the live Ark showed no one between 18:00 and 08:00 UTC (people at home and asleep were
// never drawn: no room host on the live page), and by day only those outside.
test("humans visible: people are seen at every hour (indoors in the towers' flats, a few out at night)", () => {
    const flats = towerApartments();
    const humans = town(humanRoomHost(flats, ROSTER.length));
    const lived = humans.homeRooms();
    assert.ok(lived.length >= ROSTER.length / 2 && lived.length <= ROSTER.length / 2 + 4, `${lived.length} flats lived in`);
    const outside = (list: ReturnType<TownHumans["frame"]>) => list.filter((h) => h.what !== "home" && h.what !== "sleep");
    for (const day of [MONDAY, MONDAY + 2, SATURDAY]) {
        for (const hours of [0, 3, 8, 13, 20]) {
            const list = humans.frame(at(day, hours), null, 6);
            // (A weekday at one: the workers are at work, unseen; everyone else is.)
            assert.ok(list.length >= ROSTER.length * 0.22, `${day} ${hours}:00 drawn ${list.length}`);
            for (const h of list.filter((x) => x.what === "home" || x.what === "sleep")) assert.ok(flats.some((f) => inBox(f.shell, h.x, h.z)), "indoors in a flat");
        }
    }
    // A believable few out in the small hours, over a week of nights (never a crowd): walking under the lamps or on a
    // lamp-lit bench, lit a little by the street lamps.
    let out3 = 0;
    for (let d = 0; d < 7; d++) {
        const list = outside(humans.frame(at(MONDAY + d, 3), null, 6));
        out3 += list.length;
        assert.ok(list.length <= ROSTER.length * 0.1, `${list.length} out at 3`);
        for (const h of list) {
            assert.ok(h.what === "pavement" || h.what === "bench", h.what);
            assert.ok((h.light ?? 0) > 0.3, "lamp-lit");
        }
    }
    assert.ok(out3 / 7 >= 1.5, `${(out3 / 7).toFixed(1)} out at 3 a night`);
    // Owner, 2026-11-18: "a few people outside at night, just not as many": at every night hour, fewer than by day.
    const day = outside(humans.frame(at(SATURDAY, 13), null, 6)).length;
    for (const hours of [18.5, 19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6, 7]) {
        for (const d of [MONDAY, SATURDAY]) {
            const n = outside(humans.frame(at(d + (hours < 12 ? 1 : 0), hours), null, 6)).length;
            assert.ok(n >= 2 && n < day, `${hours}:00 ${n} out (day ${day})`);
        }
    }
    // A Human chosen at night is one of them.
    const night = humans.frame(at(MONDAY + 1, 3), null, 6);
    const chosen = chosenHuman(ROSTER[0].id, ROSTER, night, true)!;
    assert.ok(chosen.at && chosen.at.face === undefined && outside(night).some((h) => h.id === chosen.human.id));
});

test("humans visible: a night person's outing is theirs alone, before their bed, and the same every time", () => {
    for (const {id} of ROSTER) {
        const r = rhythm(id);
        for (let h = 18; h < 30; h += 0.25) {
            const clock = {hours: h % 24, day: MONDAY + (h >= 24 ? 1 : 0)};
            const o = nightOuting(id, clock);
            if (!o) continue;
            assert.ok(r.kind === "owl" || r.kind === "late", r.kind);
            assert.notEqual(humanDay(id, clock), "sleep", "out while asleep");
            assert.deepEqual(nightOuting(id, clock), o);
        }
    }
});

test("humans visible: a flat's furniture (the bed, the sofa, the shelf) stands apart, inside the room, the bed behind the pets' floor", () => {
    for (const flat of towerApartments()) {
        const L = apartmentLayout(flat);
        const w = flat.shell.w;
        const d = flat.shell.d;
        // The sofa where the pets' rooms always had it (`render/pet-homes.ts`: its second draw).
        assert.equal(sofaOffset({...flat, kind: "apartment"}).su, L.su);
        const sofa = {x0: L.su - L.sw / 2, x1: L.su + L.sw / 2};
        const bed = {x0: L.bed.x - L.bed.length / 2, x1: L.bed.x + L.bed.length / 2, z0: L.bed.z - L.bed.width / 2, z1: L.bed.z + L.bed.width / 2};
        const shelf = {x0: L.shelfX - 0.25, x1: L.shelfX + 0.25};
        assert.ok(bed.x0 >= -w / 2 && bed.x1 <= w / 2 && bed.z0 >= -d / 2 && bed.z1 <= d / 2, `${flat.id}: the bed in the room`);
        assert.ok(sofa.x1 <= bed.x0 || sofa.x0 >= bed.x1, `${flat.id}: the sofa clear of the bed`);
        assert.ok(shelf.x1 <= bed.x0 || shelf.x0 >= bed.x1, `${flat.id}: the shelf clear of the bed`);
        assert.ok(shelf.x1 <= sofa.x0 || shelf.x0 >= sofa.x1, `${flat.id}: the shelf clear of the sofa`);
        // The pets' free floor starts in front of the bed's foot side (a pet's body never in the bed).
        const free = toLocal(flat.shell, flat.free.x, flat.free.z).z - flat.free.d / 2;
        assert.ok(bed.z1 <= free + 0.05, `${flat.id}: the bed ${bed.z1.toFixed(2)} into the pets' floor ${free.toFixed(2)}`);
        if (L.basket) assert.ok(Math.abs(L.basket.x - L.su) >= L.sw / 2 + 0.3 && (L.basket.x - bed.x0) * (L.basket.x - bed.x1) > 0, `${flat.id}: the basket clear`);
        // Two sleepers each side of the bed's middle, on it.
        const r = room({...flat, kind: "apartment"});
        assert.equal(r.beds.length, 2);
        for (const b of r.beds) {
            const p = toLocal(flat.shell, b.x, b.z);
            assert.ok(p.x >= bed.x0 && p.x <= bed.x1 && p.z >= bed.z0 && p.z <= bed.z1);
        }
    }
});

test("humans visible: the flats offered to people: those with pets first, two to a flat, as many as needed", () => {
    const flats = towerApartments();
    const pets = new Set([flats[40].id, flats[90].id]);
    const host = humanRoomHost(flats, 20, pets);
    const rooms = host.rooms();
    assert.equal(rooms.length, 14);
    assert.deepEqual(new Set(rooms.slice(0, 2).map((r) => r.id)), pets);
    const humans = new TownHumans({origin: {x: 0, z: 0}});
    humans.setRoster(ROSTER.slice(0, 20));
    humans.setRoomHost(host);
    assert.ok(humans.homeRooms().length >= 10 && humans.homeRooms().length <= 14);
});
