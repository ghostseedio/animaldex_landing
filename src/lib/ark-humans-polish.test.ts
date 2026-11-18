/**
 * Humans polish (2026-11-18): the sleepers lie straight along their bed, the head on the pillow, in the covers (not at
 * an angle on top of them), and the people out of doors are drawn as small figures beyond `HUMAN_FAR`, so the
 * whole-island overview shows them (`humans/people-dots.ts`), with a few still out at night.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {DataUtils, Matrix4, Vector3} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {BASE_HEIGHT, COVER_PAST_FEET, COVER_REACH, HUMAN_FAR, HUMAN_NEAR, humanLook, SLEEP_HEIGHT_MAX, SLEEP_REACH, SLEEP_SINK, type HumanInstance} from "@/ark-scene/humans/figures";
import {apartmentHumanRoom, humanRoomHost, SLEEP_HEAD_SHORT} from "@/ark-scene/humans/home-rooms-host";
import {DOT_FAR, dotGeometry, dotGrowth, dotHeight, dotted, PeopleDots} from "@/ark-scene/humans/people-dots";
import {BAREFOOT, PeopleFigures, peopleLightWord} from "@/ark-scene/humans/people-figures";
import {COVER_HALF_WIDTH, coverGeometry, coverHeightAt, COVER_HEIGHT} from "@/ark-scene/humans/sleep-covers";
import {bakePeople, CLIP_MIX, PEOPLE_BASE, PEOPLE_BONES, PEOPLE_FILES, peopleMatrix, peoplePose, PERSON_IDS, type BakedPeople, type PeoplePose} from "@/ark-scene/humans/people-rig";
import {humanDay, sleeperRoot, TownHumans} from "@/ark-scene/humans/town-humans";
import {apartmentLayout, towerApartments} from "@/ark-scene/islands/town/home-rooms";
import {inBox, toLocal} from "@/ark-scene/islands/town/geom";
import {roadHeight, townTraffic, TrafficSim} from "@/ark-scene/islands/town/render/vehicles";

const DIR = path.join(process.cwd(), "public", PEOPLE_BASE);
const ROSTER = Array.from({length: 112}, (_, i) => ({id: `fixture-human-${String(i).padStart(3, "0")}`}));
const at = (day: number, hours: number) => ((day - 4) * 24 + hours) * 3600 * 1000;
const SATURDAY = 20411;
const MONDAY = 20413;
const fresh = (): PeoplePose => ({person: null!, clip: null!, rowA: 0, rowB: 0, frac: 0, scale: 1});

let baked: BakedPeople | null = null;
async function bake(): Promise<BakedPeople> {
    if (baked) return baked;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const load = (file: string) => {
        const b = readFileSync(path.join(DIR, file));
        return loader.parseAsync(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer, "");
    };
    const [near, far, clips] = await Promise.all([load(PEOPLE_FILES.near), load(PEOPLE_FILES.far), load(PEOPLE_FILES.clips)]);
    baked = bakePeople(near, far, clips);
    return baked;
}

/** A person's posed body as the page draws it: every near vertex skinned from the bone texture's row, then the instance matrix (world). */
function posed(b: BakedPeople, h: HumanInstance, seconds: number): {points: Vector3[]; head: Vector3; headTop: number} {
    const pp = peoplePose(b, h, seconds, false, fresh());
    const m = new Matrix4();
    peopleMatrix(h, pp, m);
    const g = pp.person.near;
    const P = g.getAttribute("position").array as Float32Array;
    const J = g.getAttribute("arkJoints").array as Uint8Array;
    const W = g.getAttribute("arkWeights").array as Uint8Array;
    const bones: Matrix4[] = PEOPLE_BONES.map((_, j) => {
        const base = (pp.rowA * b.width + pp.person.column + j * 3) * 4;
        const f = (t: number, c: number) => DataUtils.fromHalfFloat(b.bones[base + t * 4 + c]);
        return new Matrix4().set(f(0, 0), f(1, 0), f(2, 0), 0, f(0, 1), f(1, 1), f(2, 1), 0, f(0, 2), f(1, 2), f(2, 2), 0, f(0, 3), f(1, 3), f(2, 3), 1).transpose();
    });
    const headBone = PEOPLE_BONES.indexOf("head");
    const points: Vector3[] = [];
    const head = new Vector3();
    let heads = 0;
    const v = new Vector3();
    const acc = new Vector3();
    for (let i = 0; i < P.length / 3; i++) {
        acc.set(0, 0, 0);
        for (let k = 0; k < 4; k++) {
            const w = W[i * 4 + k] / 255;
            if (w <= 0) continue;
            acc.addScaledVector(v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).applyMatrix4(bones[J[i * 4 + k]]), w);
        }
        const world = acc.clone().applyMatrix4(m);
        points.push(world);
        if (J[i * 4] === headBone && W[i * 4] > 200) {
            head.add(world);
            heads++;
        }
    }
    head.multiplyScalar(1 / Math.max(heads, 1));
    return {points, head, headTop: Math.max(...points.map((p) => p.y))};
}

const LOOKS = ROSTER.slice(0, 48).map((r) => humanLook(r.id)).concat(ROSTER.slice(0, 16).map((r) => humanLook(r.id, true)));

test("a sleeper lies straight along the bed: the body's long axis within 4° of it, the limbs and head in line, in every body and at every moment", async () => {
    const b = await bake();
    assert.deepEqual(CLIP_MIX.sleep, {body: "sunback", limbs: "stand"});
    const seen = new Set<string>();
    for (const look of LOOKS) {
        for (const seconds of [0, 1.7, 3.9]) {
            const h: HumanInstance = {x: 0, y: 0, z: 0, yaw: 0, pose: "sleep", phase: 0, look};
            const {points, head} = posed(b, h, seconds);
            seen.add(peoplePose(b, h, 0, false, fresh()).person.id);
            // The body lies along −z (its feet at the root, its head toward −z): the long axis from the principal direction of its points.
            const c = new Vector3();
            for (const p of points) c.add(p);
            c.multiplyScalar(1 / points.length);
            let sxx = 0, szz = 0, sxz = 0;
            for (const p of points) {
                sxx += (p.x - c.x) ** 2;
                szz += (p.z - c.z) ** 2;
                sxz += (p.x - c.x) * (p.z - c.z);
            }
            const angle = (0.5 * Math.atan2(2 * sxz, szz - sxx) * 180) / Math.PI; // the principal axis from +z, degrees
            assert.ok(Math.abs(angle) < 4, `the body ${angle.toFixed(1)}° off its axis (${look.height.toFixed(2)} m, t ${seconds})`);
            // (The head over the line from the middle of the body to its feet: no curl to one side.)
            assert.ok(Math.abs(head.x - c.x) < 0.1, `head ${head.x.toFixed(2)} off the line`);
        }
    }
    assert.ok(seen.size >= 6, `adults and children of several bodies: ${Array.from(seen).join(", ")}`);
});

test("the sleep clip's head lies SLEEP_REACH of the height from the feet, on every body", async () => {
    const b = await bake();
    for (const look of LOOKS) {
        const h: HumanInstance = {x: 0, y: 0, z: 0, yaw: 0, pose: "sleep", phase: 0, look};
        const {head} = posed(b, h, 0);
        assert.ok(Math.abs(-head.z / look.height - SLEEP_REACH) < 0.03, `${look.height.toFixed(2)} m: ${(-head.z / look.height).toFixed(3)} of its height`);
    }
});

test("sleepers in the flats' beds: the whole body inside the bed's box (across it too), the head on its pillow, the back in the mattress", async () => {
    const b = await bake();
    const flats = towerApartments();
    let checked = 0;
    for (const flat of flats.slice(0, 60)) {
        const L = apartmentLayout(flat);
        const r = apartmentHumanRoom({...flat, kind: "apartment"})!;
        for (const bedSpot of r.beds) {
            // Any look, tall, average and short, children too.
            for (const look of [humanLook(`${flat.id}#tall`), {...humanLook(`${flat.id}#tall`), height: 1.94}, {...humanLook(`${flat.id}#short`), height: 1.52}, humanLook(`${flat.id}#kid`, true)]) {
                const root = sleeperRoot(bedSpot, look);
                const h: HumanInstance = {x: root.x, y: root.y, z: root.z, yaw: bedSpot.yaw, pose: "sleep", phase: 0, look, scale: root.scale};
                const {points, head, headTop} = posed(b, h, 0);
                // In the room's frame: x along the bed (the head at bedSide), z across it.
                let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
                for (const p of points) {
                    const l = toLocal(flat.shell, p.x, p.z);
                    x0 = Math.min(x0, l.x);
                    x1 = Math.max(x1, l.x);
                    z0 = Math.min(z0, l.z);
                    z1 = Math.max(z1, l.z);
                    y0 = Math.min(y0, p.y - flat.floor);
                    y1 = Math.max(y1, p.y - flat.floor);
                }
                const bx0 = L.bed.x - L.bed.length / 2, bx1 = L.bed.x + L.bed.length / 2;
                const bz0 = L.bed.z - L.bed.width / 2, bz1 = L.bed.z + L.bed.width / 2;
                const tag = `${flat.id} ${look.height.toFixed(2)} m`;
                assert.ok(x0 >= bx0 - 0.02 && x1 <= bx1 + 0.02, `${tag}: along the bed ${x0.toFixed(2)}…${x1.toFixed(2)} in ${bx0.toFixed(2)}…${bx1.toFixed(2)}`);
                assert.ok(z0 >= bz0 && z1 <= bz1, `${tag}: across the bed ${z0.toFixed(2)}…${z1.toFixed(2)} in ${bz0.toFixed(2)}…${bz1.toFixed(2)}`);
                // The back in the mattress, not above its covers; no higher than a person lying on their back is thick.
                assert.ok(Math.abs(y0 - (L.bed.top - SLEEP_SINK)) < 0.1, `${tag}: lowest point ${y0.toFixed(2)} at the mattress's top ${L.bed.top}`);
                assert.ok(y1 - y0 < 0.45 && headTop - flat.floor < L.bed.top + 0.6, `${tag}: lying flat, ${y1.toFixed(2)} high`);
                // The head's middle on the pillow (its footprint: 0.36 along, 0.42 of the bed's width across).
                const hl = toLocal(flat.shell, head.x, head.z);
                const pillowX = L.bed.x + L.bedSide * (L.bed.length / 2 - 0.26);
                const k = r.beds.indexOf(bedSpot) === 0 ? -1 : 1;
                assert.ok(Math.abs(hl.x - pillowX) <= (look.height > 1.7 ? 0.3 : 0.5) && Math.abs(hl.z - (L.bed.z + k * L.bed.width * 0.25)) <= 0.12, `${tag}: head (${hl.x.toFixed(2)}, ${hl.z.toFixed(2)}) on the pillow at x ${pillowX.toFixed(2)}`);
                checked++;
            }
        }
    }
    assert.ok(checked >= 60 * 8, `${checked} sleepers checked`);
});

test("two sleepers of one bed lie side by side with a gap between them, the broadest bodies too: at least 5 cm across the bed", async () => {
    const b = await bake();
    let narrowest = Infinity;
    for (const flat of towerApartments().slice(0, 40)) {
        const r = apartmentHumanRoom({...flat, kind: "apartment"})!;
        for (const build of [0.86, 1.2]) {
            const looks = [{...humanLook(`${flat.id}#a`), build}, {...humanLook(`${flat.id}#b`), build}];
            const spans = r.beds.map((spot, i) => {
                const root = sleeperRoot(spot, looks[i]);
                const {points} = posed(b, {x: root.x, y: root.y, z: root.z, yaw: spot.yaw, pose: "sleep", phase: 0, look: looks[i], scale: root.scale}, 0);
                const zs = points.map((p) => toLocal(flat.shell, p.x, p.z).z);
                return {lo: Math.min(...zs), hi: Math.max(...zs)};
            });
            const [a, c] = spans.sort((p, q) => p.lo - q.lo);
            narrowest = Math.min(narrowest, c.lo - a.hi);
            assert.ok(c.lo - a.hi >= 0.05, `${flat.id} build ${build}: one sleeper to ${a.hi.toFixed(3)}, the other from ${c.lo.toFixed(3)}`);
        }
    }
    assert.ok(narrowest < 0.3, "(the beds are 1.15 m wide: the gap is what is left)");
});

test("each sleeper lies under their cover from past their feet to their chest: the body below the mound, the two covers apart, inside the bed, in the bed's own duvet colour", async () => {
    const b = await bake();
    const flats = towerApartments();
    // (All of the record's people; and three of those asleep at 3 alone in the town, one to a flat.)
    const asleep = ROSTER.filter((r) => humanDay(r.id, {hours: 3, day: SATURDAY}) === "sleep");
    for (const people of [ROSTER.length, 3]) {
        const humans = new TownHumans({origin: {x: 0, z: 0}, roadHeight});
        humans.setRoster(people === 3 ? asleep.slice(0, 3) : ROSTER);
        humans.setRoomHost(humanRoomHost(flats, people));
        const list = humans.frame(at(SATURDAY, 3), null, 0);
        const sleepers = list.filter((h) => h.what === "sleep");
        assert.equal(humans.covers.length, sleepers.length, "one cover each");
        assert.ok(sleepers.length >= (people === 3 ? 1 : Math.floor(people * 0.7)), `${sleepers.length} asleep of ${people}`);
        const byFlat = new Map<string, Array<{h: (typeof sleepers)[number]; cover: (typeof humans.covers)[number]}>>();
        sleepers.forEach((h, k) => {
            const flat = flats.find((f) => inBox(f.shell, h.x, h.z) && Math.abs(f.floor - (h.y + SLEEP_SINK - apartmentLayout(f).bed.top)) < 1e-6)!;
            assert.ok(flat);
            (byFlat.get(flat.id) ?? byFlat.set(flat.id, []).get(flat.id)!).push({h, cover: humans.covers[k]});
        });
        byFlat.forEach((people2, id) => {
            const flat = flats.find((f) => f.id === id)!;
            const L = apartmentLayout(flat);
            const room = apartmentHumanRoom({...flat, kind: "apartment"})!;
            const lateral = people2.map(({h}) => toLocal(flat.shell, h.x, h.z).z - L.bed.z);
            for (const {h, cover} of people2) {
                const tag = `${id} ${h.look.height.toFixed(2)} m`;
                // The cover's colour is the bed's duvet, its base the mattress, its length the feet to the chest.
                assert.deepEqual(cover.colour, room.duvet, tag);
                assert.ok(Math.abs(cover.y - (flat.floor + L.bed.top - 0.02)) < 1e-9, `${tag}: on the mattress`);
                const drawn = h.look.height * (h.scale ?? 1);
                assert.ok(Math.abs(cover.length - (COVER_REACH * drawn + COVER_PAST_FEET)) < 1e-9, `${tag}: to the chest`);
                // From the sleeper's body: every point from their feet to their chest below the mound, and inside its width.
                const {points} = posed(b, {...h, x: h.x, y: h.y, z: h.z}, 0);
                const fx = Math.sin(cover.yaw), fz = Math.cos(cover.yaw);
                let tested = 0;
                for (const p of points) {
                    const dx = p.x - cover.x, dz = p.z - cover.z;
                    const lat = dx * fz - dz * fx;
                    const along = dx * fx + dz * fz; // toward the feet
                    const t = -along / cover.length;
                    if (t < 0.04 || t > 0.96 || p.y - cover.y < 0.02) continue;
                    tested++;
                    const mound = coverHeightAt(lat, t);
                    assert.ok(p.y - cover.y <= mound + 0.012, `${tag}: a point ${(p.y - cover.y).toFixed(3)} above the mattress at ${lat.toFixed(2)} across, ${t.toFixed(2)} along, the cover ${mound.toFixed(3)}`);
                }
                assert.ok(tested > 100, `${tag}: ${tested} points under the cover`);
                // The cover's own corners inside the bed (across it: half-width each side).
                const centre = toLocal(flat.shell, cover.x, cover.z);
                assert.ok(centre.z - COVER_HALF_WIDTH >= L.bed.z - L.bed.width / 2 - 1e-9 && centre.z + COVER_HALF_WIDTH <= L.bed.z + L.bed.width / 2 + 1e-9, `${tag}: the mound within the bed's width`);
                const bx0 = L.bed.x - L.bed.length / 2, bx1 = L.bed.x + L.bed.length / 2;
                const end = toLocal(flat.shell, cover.x + fx * -0 + Math.sin(cover.yaw + Math.PI) * cover.length, cover.z + Math.cos(cover.yaw + Math.PI) * cover.length);
                assert.ok(centre.x >= bx0 && centre.x <= bx1 && end.x >= bx0 && end.x <= bx1, `${tag}: the mound's ends on the bed`);
            }
            // One alone in the flat lies in the bed's middle; two, each on their own side with the covers apart.
            // (One asleep in the bed, whether they live alone or their partner is up, lies in the middle.)
            if (people2.length === 1) assert.ok(Math.abs(lateral[0]) < 1e-6, `${id}: alone in the bed, in the middle (${lateral[0].toFixed(3)})`);
            else if (people2.length === 2) {
                const a = Math.min(...lateral), c = Math.max(...lateral);
                assert.ok(c - a - 2 * COVER_HALF_WIDTH >= 0.05, `${id}: covers ${(c - a - 2 * COVER_HALF_WIDTH).toFixed(3)} m apart`);
            }
        });
        if (people === 3) assert.ok(Array.from(byFlat.values()).some((v) => v.length === 1), "someone alone in a flat");
        else assert.ok(Array.from(byFlat.values()).some((v) => v.length === 2), "two in a flat");
    }
});

test("the cover's mesh: about a hundred triangles, all facing out, within its half-width and height, feet at z 0 to the chest at z −1", () => {
    const g = coverGeometry();
    const P = g.getAttribute("position").array as Float32Array;
    const tris = P.length / 9;
    assert.ok(tris >= 80 && tris <= 160, `${tris} triangles`);
    let out = 0;
    const centre = new Vector3(0, COVER_HEIGHT / 3, -0.5);
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), n = new Vector3(), m = new Vector3();
    for (let t = 0; t < tris; t++) {
        a.fromArray(P, t * 9);
        b.fromArray(P, t * 9 + 3);
        c.fromArray(P, t * 9 + 6);
        for (const v of [a, b, c]) assert.ok(Math.abs(v.x) <= COVER_HALF_WIDTH + 1e-6 && v.y >= -1e-6 && v.y <= COVER_HEIGHT + 1e-6 && v.z <= 1e-6 && v.z >= -1 - 1e-6);
        n.copy(b).sub(a).cross(m.copy(c).sub(a));
        m.copy(a).add(b).add(c).multiplyScalar(1 / 3).sub(centre);
        if (n.dot(m) > 0) out++;
    }
    assert.ok(out >= tris - 2, `${out} of ${tris} facing out`);
    assert.ok(coverHeightAt(0, 0.5) === COVER_HEIGHT && coverHeightAt(COVER_HALF_WIDTH * 1.2, 0.5) === 0 && coverHeightAt(0, 1.2) === 0 && coverHeightAt(0, 0.02) < COVER_HEIGHT * 0.7);
});

test("the town puts each sleeper where `sleeperRoot` says, no taller than the bed allows, and the pillow's spot is the head's", () => {
    const humans = new TownHumans({origin: {x: 0, z: 0}, roadHeight});
    humans.setRoster(ROSTER);
    humans.setRoomHost(humanRoomHost(towerApartments(), ROSTER.length));
    const list = humans.frame(at(SATURDAY, 3), null, 0);
    const sleepers = list.filter((h) => h.what === "sleep");
    assert.ok(sleepers.length >= 80);
    const flats = towerApartments();
    for (const h of sleepers) {
        const flat = flats.find((f) => inBox(f.shell, h.x, h.z) && Math.abs(f.floor - (h.y + SLEEP_SINK - apartmentLayout(f).bed.top)) < 1e-6);
        assert.ok(flat, "in a flat's bed");
        assert.ok((h.scale ?? 1) <= 1 && h.look.height * (h.scale ?? 1) <= SLEEP_HEIGHT_MAX + 1e-9, `drawn ${h.look.height * (h.scale ?? 1)} m`);
        assert.equal(h.pose, "sleep");
    }
    // The pillow's spot: SLEEP_HEAD_SHORT toward the foot of the pillow's middle.
    const flat = flats[3];
    const L = apartmentLayout(flat);
    const spot = apartmentHumanRoom({...flat, kind: "apartment"})!.beds[0];
    const l = toLocal(flat.shell, spot.x, spot.z);
    assert.ok(Math.abs(l.x - (L.bed.x + L.bedSide * (L.bed.length / 2 - 0.26 - SLEEP_HEAD_SHORT))) < 1e-9);
    assert.ok(Math.abs(spot.y - (flat.floor + L.bed.top)) < 1e-9, "at the mattress's top");
});

// MARK: - The far level

const person = (x: number, y: number, z: number, extra: Partial<HumanInstance> & {what?: string; face?: number} = {}, look = humanLook("fixture-human-005")): HumanInstance => ({x, y, z, yaw: 0, pose: "walk", phase: 0, look, ...extra});
const camera = {x: 0, y: 0, z: 0};

test("far figures: only people out of doors, beyond HUMAN_FAR and within DOT_FAR; not at home, in bed, in a car or a boat", () => {
    const dots = new PeopleDots();
    const list: HumanInstance[] = [
        person(100, 0, 0), // near: the bodies' own
        person(HUMAN_FAR - 1, 0, 0), // still the coarse body
        person(HUMAN_FAR + 1, 0, 0), // a figure
        person(600, 0, 0), // a figure
        person(900, 0, 100, {what: "bench", pose: "sit"}), // a figure
        person(DOT_FAR + 50, 0, 0), // out of reach
        person(500, 0, 0, {what: "home", face: 0.3, pose: "sit"}), // in a flat
        person(500, 0, 5, {what: "sleep", face: 0.3, pose: "sleep"}),
        person(500, 0, 10, {what: "car", pose: "drive"}),
        person(500, 0, 15, {what: "boat", pose: "drive"}),
        person(500, 0, 20, {what: "sun", pose: "sunback"}) // a sunbather: lower
    ];
    assert.equal(list.filter(dotted).length, 7);
    assert.equal(dots.setFrame(list, camera), 4);
    assert.equal(dots.drawn, 4);
    assert.equal(dots.instances.count, 4);
    assert.equal(dots.instances.visible, true);
    assert.equal(dots.setFrame([], camera), 0);
    assert.equal(dots.instances.visible, false);
    assert.equal(dots.setFrame([person(10, 0, 0)], camera), 0);
});

test("far figures: the true size where the coarse body leaves off, growing with the distance so it stays a few pixels, never past the cap", () => {
    assert.equal(dotHeight(1.75, HUMAN_FAR), 1.75);
    assert.equal(dotHeight(1.75, 100), 1.75);
    let last = 0;
    for (let d = HUMAN_FAR; d <= DOT_FAR; d += 50) {
        const hgt = dotHeight(1.75, d);
        assert.ok(hgt >= last && hgt <= 1.75 * 8 + 1e-9, `${d} m: ${hgt}`);
        last = hgt;
    }
    // Just past HUMAN_FAR no pop: the coarse body's size, growing from it (under 10% at 10 m).
    assert.ok(dotHeight(1.75, HUMAN_FAR + 10) < 1.75 * 1.1);
    // On the overview's range (400–900 m, a 38° view over 750 px of canvas: 0.89 mrad a pixel) a figure is 11 to 20 pixels tall.
    for (const d of [400, 600, 900]) {
        const px = dotHeight(1.75, d) / d / 0.00089;
        assert.ok(px >= 11 && px <= 20, `${d} m: ${px.toFixed(1)} px`);
    }
    // The instance matrix carries it: scale and position, a child smaller, a sunbather lower and wider.
    const dots = new PeopleDots();
    const adult = humanLook("fixture-human-005");
    dots.setFrame([person(0, 3, 600, {}, adult), person(0, 3, 600, {scale: 0.5}, adult), person(0, 3, 600, {pose: "sunback", what: "sun"}, adult)], camera);
    const m = dots.instances.instanceMatrix.array as Float32Array;
    const s = dotGrowth(600);
    assert.ok(Math.abs(m[5] - (adult.height / BASE_HEIGHT) * s) < 1e-4 && m[12] === 0 && m[13] === 3 && m[14] === 600);
    assert.ok(Math.abs(m[16 + 5] - m[5] * 0.5) < 1e-4, "a child's growth");
    assert.ok(m[32 + 5] < m[5] * 0.5 && m[32] > m[0], "lying: lower, wider");
});

test("far figures: one draw call, a few dozen triangles each, written in place (no allocation), grown only when the roster outgrows it", () => {
    const g = dotGeometry();
    const tris = g.getIndex()!.count / 3;
    assert.ok(tris <= 40, `${tris} triangles a figure`);
    assert.equal(g.getAttribute("position").count, 72);
    const dots = new PeopleDots();
    const list = ROSTER.map((_, i) => person(300 + (i % 20) * 30, 2, (i % 10) * 20 - 100, {}, humanLook(`fixture-human-${i}`)));
    dots.setFrame(list, camera);
    assert.equal(dots.drawn, 112);
    assert.ok(112 * tris <= 4500, "the whole roster's far triangles");
    const mesh = dots.instances;
    const matrices = mesh.instanceMatrix.array;
    for (let f = 0; f < 5; f++) dots.setFrame(list, {x: f, y: 0, z: 0});
    assert.equal(dots.instances, mesh, "the same mesh");
    assert.equal(mesh.instanceMatrix.array, matrices, "the same arrays");
    assert.equal(dots.group.children.filter((c) => (c as {isInstancedMesh?: boolean}).isInstancedMesh).length, 1, "one draw call");
    // A larger roster grows it once and keeps what was written.
    const more = [...list, ...list, ...list];
    dots.setFrame(more, camera);
    assert.equal(dots.drawn, 336);
    assert.equal(dots.group.children.length, 1, "the old mesh is let go");
    assert.ok(dots.instances.instanceMatrix.array.length >= 336 * 16);
});

test("far figures cost well under half a millisecond a frame for the whole roster", () => {
    const dots = new PeopleDots();
    const list = ROSTER.map((_, i) => person(300 + (i % 20) * 30, 2, (i % 10) * 20 - 100, {}, humanLook(`fixture-human-${i}`)));
    for (let i = 0; i < 100; i++) dots.setFrame(list, {x: i, y: 5, z: 0});
    const times: number[] = [];
    for (let i = 0; i < 400; i++) {
        const t0 = performance.now();
        dots.setFrame(list, {x: i * 0.1, y: 5, z: 0});
        times.push(performance.now() - t0);
    }
    times.sort((a, b) => a - b);
    // (Node on a shared machine, no JIT warm-up in a phone's 4× slower core: the median of 400 frames, ×4 for the phone.)
    assert.ok(times[200] * 4 < 0.5, `median ${times[200].toFixed(4)} ms (phone ×4 ${(times[200] * 4).toFixed(3)})`);
});

test("PeopleFigures draws the far figures in both its states (loading or procedural, and the rigged bodies), and clears them", () => {
    (globalThis as {__arkPeople?: string}).__arkPeople = "procedural";
    try {
        const figures = new PeopleFigures();
        const list = [person(30, 0, 0), person(600, 0, 0), person(800, 0, 0, {what: "pavement"}), person(700, 0, 0, {what: "home", face: 0})];
        figures.setFrame(list, new Vector3(0, 0, 0), 0);
        assert.equal(figures.drawn.dots, 2);
        assert.equal(figures.drawn.near, 1);
        assert.ok(figures.group.children.some((c) => c.name === "humans:dots"));
        figures.setFrame([], new Vector3(0, 0, 0), 0);
        assert.equal(figures.drawn.dots, 0);
        figures.dispose();
    } finally {
        delete (globalThis as {__arkPeople?: string}).__arkPeople;
    }
});

test("a few out at night, fewer than by day: the far figures show them on the overview", () => {
    const count = (day: number, hours: number) => {
        const humans = new TownHumans({origin: {x: 0, z: 0}, roadHeight});
        humans.setRoster(ROSTER);
        humans.setRoomHost(humanRoomHost(towerApartments(), ROSTER.length));
        const ms = at(day, hours);
        return humans.frame(ms, new TrafficSim(townTraffic(), () => []).at_(ms / 1000), 0).filter(dotted).length;
    };
    for (const day of [SATURDAY, MONDAY]) {
        const night = [1, 3, 5].map((hours) => count(day, hours));
        const noon = count(day, 13);
        for (const n of night) assert.ok(n >= 2 && n <= 12, `${n} out at night`);
        assert.ok(noon >= 3 * Math.max(...night), `${noon} by day against ${night.join(", ")} at night`);
    }
});

test("the figures carry only the seeded look: no identity, no photo, nothing from a capture", () => {
    const g = dotGeometry();
    assert.deepEqual(Object.keys(g.attributes).sort(), ["dotPart", "normal", "position"]);
    const dots = new PeopleDots();
    const keys = Object.keys(dots.instances.geometry.attributes).sort();
    assert.deepEqual(keys, ["dotPart", "iBottom", "iSkin", "iTop", "normal", "position"]);
    assert.ok(HUMAN_NEAR < HUMAN_FAR && PERSON_IDS.length === 12);
});

test("asleep, barefoot: the light word carries BAREFOOT more for a sleeper only, above the shader's threshold and apart from the light's 0–1", () => {
    const look = humanLook("fixture-human-005");
    assert.equal(peopleLightWord({pose: "sleep", light: 0.3}), 0.3 + BAREFOOT);
    assert.equal(peopleLightWord({pose: "sleep"}), BAREFOOT);
    for (const pose of ["stand", "walk", "sit", "lie", "sunback", "sunside", "sunsit", "drive", "paddle", "chop", "saw", "plant", "carry"] as const) assert.equal(peopleLightWord({pose, light: 0.45}), 0.45, pose);
    assert.ok(BAREFOOT >= 4 + 1 && 1 < 4, "the light (at most 1) never reaches the threshold of 4; a sleeper's always does");
    assert.ok(look.height > 0);
});
