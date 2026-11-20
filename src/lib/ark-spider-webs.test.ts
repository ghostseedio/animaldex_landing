import assert from "node:assert/strict";
import test from "node:test";
import {atHub, silkTrip, webHabit, webStage} from "@/ark-scene/spider-webs";
import {fitWeb, spiderOnWeb, triangleCaster, type Caster} from "@/ark-scene/spider-webs-draw";

// The spiders aboard the live Ark (2026-11-21, read only) and their stored scientific names.
const ABOARD: Array<[string, string, string | null]> = [
    ["black-and-yellow-garden-spider", "Argiope aurantia", "orb"],
    ["signature-spider", "Argiope anasuja", "orb"],
    ["giant-golden-orb-weaver", "Nephila pilipes", "orb"],
    ["walnut-orb-weaver", "Nuctenea umbratica", "orb"],
    ["trashline-orb-weaver", "Cyclosa insulana", "orb"],
    ["orb-weaver-spider", "Araneidae", "orb"],
    ["daddy-long-legs-spider", "Pholcus phalangioides", "tangle"],
    ["common-house-spider", "Parasteatoda tepidariorum", "tangle"],
    ["false-widow-spider", "Steatoda grossa", "tangle"],
    ["brown-widow-spider", "Latrodectus geometricus", "tangle"],
    ["giant-house-spider", "Eratigena atrica", "sheet"],
    // Hunters and harvestmen: no capture web.
    ["carolina-wolf-spider", "Hogna carolinensis", null],
    ["tiger-wolf-spider", "Tigrosa helluo", null],
    ["jumping-spider", "Platycryptus undatus", null],
    ["pantropical-jumping-spider", "Plexippus paykulli", null],
    ["peterss-jumping-spider", "Plexippus petersi", null],
    ["brazilian-wandering-spider", "Phoneutria nigriventer", null],
    ["dark-fishing-spider", "Dolomedes tenebrosus", null],
    ["agrarian-sac-spider", "Cheiracanthium inclusum", null],
    ["yellow-sac-spider", "Cheiracanthium punctorium", null],
    ["woodlouse-hunter-spider", "Dysdera crocata", null],
    ["chaco-golden-knee-tarantula", "Grammostola pulchripes", null],
    ["red-kneed-tarantula", "Brachypelma hamorii", null],
    ["harvestman", "Opiliones", null],
    ["common-european-harvestman", "Phalangium opilio", null]
];

test("each spider aboard has its family's web: orbs, tangles, a sheet, and none for the hunters and harvestmen", () => {
    for (const [slug, name, kind] of ABOARD) assert.equal(webHabit(slug, name)?.kind ?? null, kind, slug);
    assert.equal(webHabit("black-and-yellow-garden-spider", "Argiope aurantia")?.band, "zigzag");
    assert.equal(webHabit("signature-spider", "Argiope anasuja")?.band, "cross");
    assert.equal(webHabit("trashline-orb-weaver", "Cyclosa insulana")?.band, "debris");
    assert.equal(webHabit("daddy-long-legs-spider", "Pholcus phalangioides")?.hangs, true);
    // No stored name: the slug's words.
    assert.equal(webHabit("cobweb-spider", null)?.kind, "tangle");
    assert.equal(webHabit("monkey-spider-crab", null), null);
});

test("an orb is taken down and spun again once a day at its kind's hour; a lasting web never is", () => {
    const argiope = webHabit("x", "Argiope aurantia")!;
    let lowest = 1;
    let spinning = 0;
    for (let h = 0; h < 24; h += 0.01) {
        const stage = webStage(argiope, "a1", h);
        lowest = Math.min(lowest, stage.built);
        if (stage.spinning) spinning += 0.01;
    }
    assert.ok(lowest < 0.1, "down to its frame");
    assert.ok(Math.abs(spinning - 0.5) < 0.03, "half an hour's spinning a day");
    // At night (about 2:30, each its own moment).
    assert.ok(webStage(argiope, "a1", 13).built === 1);
    const nephila = webHabit("x", "Nephila pilipes")!;
    for (let h = 0; h < 24; h += 0.25) assert.equal(webStage(nephila, "n1", h).built, 1);
    const pholcus = webHabit("x", "Pholcus phalangioides")!;
    assert.equal(webStage(pholcus, "p1", 3).built, 1);
});

test("the walnut orb weaver is at its hub by night, in its retreat by day", () => {
    const nuctenea = webHabit("walnut-orb-weaver", "Nuctenea umbratica")!;
    assert.equal(atHub(nuctenea, "w1", 23), true);
    assert.equal(atHub(nuctenea, "w1", 2), true);
    assert.equal(atHub(nuctenea, "w1", 12), false);
});

test("its trips along the silk: out and back now and then, the same for every viewer", () => {
    let out = 0;
    for (let s = 0; s < 3600; s += 1) out += silkTrip("s1", s).out > 0 ? 1 : 0;
    assert.ok(out > 60 && out < 600);
    assert.deepEqual(silkTrip("s1", 1234), silkTrip("s1", 1234));
});

/** A box drawn as triangles (two a face). */
function box(min: [number, number, number], max: [number, number, number]): number[] {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const p = (x: number, y: number, z: number) => [x, y, z];
    const quad = (a: number[], b: number[], c: number[], d: number[]) => [...a, ...b, ...c, ...a, ...c, ...d];
    return [
        ...quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0), p(x0, y1, z0)),
        ...quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)),
        ...quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0)),
        ...quad(p(x1, y0, z0), p(x1, y0, z1), p(x1, y1, z1), p(x1, y1, z0)),
        ...quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1)),
        ...quad(p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1))
    ];
}

/** Every anchor thread's far end lies on a drawn surface (a triangle's, or the ground's). */
function anchoredOn(cast: Caster, point: {x: number; y: number; z: number}, ground: number): boolean {
    if (Math.abs(point.y - ground) < 1e-3) return true;
    // A short ray each way through the point meets a surface within a millimetre.
    for (const dir of [{x: 1, y: 0, z: 0}, {x: -1, y: 0, z: 0}, {x: 0, y: 1, z: 0}, {x: 0, y: -1, z: 0}, {x: 0, y: 0, z: 1}, {x: 0, y: 0, z: -1}]) {
        const hit = cast({x: point.x - dir.x * 0.002, y: point.y - dir.y * 0.002, z: point.z - dir.z * 0.002}, dir, 0.004);
        if (hit) return true;
    }
    return false;
}

test("an orb between two shrubs hangs on them and the ground; on an open lawn there is none", () => {
    // Two shrubs 0.9 m apart either side of the spider's home, 0.8 m tall, on flat ground at 0.
    const tris = new Float32Array([...box([-0.75, 0, -0.3], [-0.45, 0.8, 0.3]), ...box([0.45, 0, -0.3], [0.75, 0.8, 0.3])]);
    const cast = triangleCaster(tris);
    const habit = webHabit("black-and-yellow-garden-spider", "Argiope aurantia")!;
    const web = fitWeb("g1", habit, {x: 0, y: 0, z: 0}, () => 0, cast);
    assert.ok(web, "fitted");
    assert.ok(web!.radius > 0.1 && web!.radius <= habit.radius);
    // Its face across the gap between them (its normal along z, its plane through both shrubs).
    assert.ok(Math.abs(web!.normal.z) > 0.9, `normal ${JSON.stringify(web!.normal)}`);
    const anchors = web!.threads.filter((t) => t.order < 0.08 && Math.hypot(t.b.x - t.a.x, t.b.y - t.a.y, t.b.z - t.a.z) > 0.01);
    assert.ok(anchors.length >= 3);
    // (The frame's own polygon runs rim to rim; the anchor threads end on a shrub or the ground.)
    const ends = anchors.map((t) => t.b).filter((b) => Math.hypot(b.x - web!.hub.x, b.y - web!.hub.y, b.z - web!.hub.z) > web!.radius * 1.01);
    assert.ok(ends.length >= 3);
    for (const end of ends) assert.ok(anchoredOn(cast, end, 0), `anchor ${JSON.stringify(end)} on nothing`);
    // The spider at its hub, head down, on the web's face, by day.
    const at = spiderOnWeb(web!, 13, 0, 1);
    assert.ok(Math.hypot(at.x - web!.hub.x, at.y - web!.hub.y, at.z - web!.hub.z) < web!.radius);
    assert.equal(at.ty, -1);
    assert.equal(fitWeb("g2", habit, {x: 0, y: 0, z: 0}, () => 0, triangleCaster(new Float32Array(0))), null, "no web in the open");
});

test("a daddy long-legs' tangle in a wall's corner under an eave; a funnel web at a wall's foot", () => {
    // A wall (x = 0.2 face) and an eave over it at 2.4 m, the ground at 0.
    const tris = new Float32Array([...box([0.2, 0, -2], [0.5, 2.6, 2]), ...box([-0.6, 2.4, -2], [0.5, 2.6, 2])]);
    const cast = triangleCaster(tris);
    const pholcus = webHabit("daddy-long-legs-spider", "Pholcus phalangioides")!;
    const tangle = fitWeb("p1", pholcus, {x: 0, y: 0, z: 0}, () => 0, cast);
    assert.ok(tangle, "fitted");
    assert.ok(tangle!.hub.y > 1.5, "up under the eave");
    const spider = spiderOnWeb(tangle!, 12, 0, 1);
    assert.equal(spider.ny, -1, "hanging upside down");
    const eratigena = webHabit("giant-house-spider", "Eratigena atrica")!;
    const sheet = fitWeb("e1", eratigena, {x: 0, y: 0, z: 0}, () => 0, cast);
    assert.ok(sheet, "fitted");
    assert.ok(sheet!.hub.y < 0.2 && sheet!.hub.x > -0.1 && sheet!.hub.x < 0.2, `mouth by the wall's foot ${JSON.stringify(sheet!.hub)}`);
    // Its sheet spreads away from the wall.
    assert.ok(sheet!.ends.every((e) => e.x < sheet!.hub.x + 0.01));
});
