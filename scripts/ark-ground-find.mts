// Finds bug-scale views on both islands (lane GROUND, pass 2): a flat spot well inside each surface.
import {setArkWorld, sampleGround, zoneAt} from "@/ark-scene/world";
import {setNoHamlet} from "@/ark-scene/no-hamlet";
import {townWorldOrigin} from "@/ark-scene/islands/index";
import {sampleTownGround, streetEdgeDistance} from "@/ark-scene/islands/town/ground";
setArkWorld("v2");
setNoHamlet(true);
const views: Record<string, unknown> = {};
const view = (x: number, y: number, z: number) => ({target: {x, y, z}, distance: 1.6, polar: 1.0, azimuth: 0.7});
const want: Record<string, (x: number, z: number) => boolean> = {
    wild_meadow: (x, z) => { const s = sampleGround(x, z); return zoneAt(s) === "grassland" && s.land > 0.99 && (s.weights as Record<string, number>).grassland > 0.95; },
    wild_woods: (x, z) => { const s = sampleGround(x, z); return zoneAt(s) === "woodland" && s.land > 0.99 && (s.weights as Record<string, number>).woodland > 0.95; },
    wild_beach: (x, z) => { const s = sampleGround(x, z); return s.height > 0.5 && s.height < 2.5 && s.cliff < 0.2 && zoneAt(s) === "seashore"; }
};
for (const [name, ok] of Object.entries(want)) {
    let found = false;
    for (let r = 10; r < 200 && !found; r += 3) for (let a = 0; a < 6.28 && !found; a += 0.21) {
        const x = Math.round(Math.cos(a) * r * 10) / 10, z = Math.round(Math.sin(a) * r * 10) / 10;
        const h = (dx: number, dz: number) => sampleGround(x + dx, z + dz).height;
        if (!ok(x, z)) continue;
        if (Math.abs(h(1, 0) - h(-1, 0)) > 0.3 || Math.abs(h(0, 1) - h(0, -1)) > 0.3) continue;
        views[name] = view(x, sampleGround(x, z).height, z); found = true;
    }
}
const o = townWorldOrigin();
for (const surf of ["lawn", "park", "meadow", "farmyard", "paddock", "sand", "allotment"]) {
    let found = false;
    for (let r = 5; r < 200 && !found; r += 2.5) for (let a = 0; a < 6.28 && !found; a += 0.17) {
        const x = Math.round(Math.cos(a) * r * 10) / 10, z = Math.round(Math.sin(a) * r * 10) / 10;
        const s = sampleTownGround(x, z);
        if (s.surface !== surf || streetEdgeDistance(x, z) < 4) continue;
        if (![[2, 0], [-2, 0], [0, 2], [0, -2]].every(([dx, dz]) => sampleTownGround(x + dx, z + dz).surface === surf)) continue;
        views[`town_${surf}`] = {...view(x + o.x, s.height, z + o.z), local: [x, z]}; found = true;
    }
}
// A pavement edge (the kerb and the verge) close up.
for (let i = 0; i < 4000 && !views.town_kerb; i++) {
    const x = ((i * 37) % 160) - 80, z = (Math.floor(i / 4.3) % 160) - 80;
    const d = streetEdgeDistance(x, z);
    const g = sampleTownGround(x, z).surface; if (d > 0.4 && d < 1.0 && (g === "lawn" || g === "grass" || g === "park")) views.town_kerb = {...view(x + o.x, sampleTownGround(x, z).height, z + o.z), local: [x, z]};
}
console.log(JSON.stringify(views, null, 1));
