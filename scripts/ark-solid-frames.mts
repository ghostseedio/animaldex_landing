/**
 * p3 (solid): before/after frames from above of three places (a farm's horse paddock, a zoo enclosure with rockwork, a
 * garden with a dog): the solid props (`islands/town/solids.ts`, the shrubs, buildings, fences) and where each walker was
 * drawn over 6 hours of the shared schedule (`lib/ark-collide/solid-audit.ts`), red where its body centre stood in a prop.
 * Writes PNGs to `--out` (Chrome via playwright-core).
 */
import {writeFileSync, mkdirSync} from "node:fs";
import path from "node:path";
import {chromium} from "playwright-core";
import base from "@/ark-scene/fixtures/snapshot-v2.json";
import {withArkIslandsFixture} from "@/ark-scene/fixtures/islands";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {townSolidAudit} from "@/lib/ark-collide/solid-audit";
import {townSolids, solidDistance, type TownSolid} from "@/ark-scene/islands/town/solids";
import {townObstacles} from "@/ark-scene/islands/town/obstacles";
import {townWorldOrigin} from "@/ark-scene/islands";
import {zooLayout} from "@/ark-scene/islands/town/areas";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";

const out = process.argv.find((a) => a.startsWith("--out="))?.slice(6) ?? "solid-frames";
mkdirSync(out, {recursive: true});
const origin = townWorldOrigin();
type Pt = {x: number; z: number; r: number; slug: string};
const run = (before: boolean) => {
    const traces = new Map<string, Pt[]>();
    townSolidAudit({hours: 6, step: 20, before, trace: (id, slug, x, z, r) => (traces.get(id) ?? traces.set(id, []).get(id)!).push({x: x - origin.x, z: z - origin.z, r, slug})});
    return traces;
};
const before = run(true);
const after = run(false);
const town = arkIslandSnapshot(decodeArkSnapshot(withArkIslandsFixture(base))!, "town");
const placed = placeTownAnimals(town.animals);
const solids = townSolids(placed.open);
const obstacles = townObstacles(undefined, placed.open);
const inside = (p: Pt) => solids.some((s) => !(s.gap > 0 && p.r * 2 < s.gap) && solidDistance(s, p.x, p.z) < 0) || obstacles.some((o) => o.kind === "tree" && o.soft && Math.hypot(p.x - o.x, p.z - o.z) < o.r);
// The places: a horse's farm, the bears' and wolves' enclosure, the dog whose garden had the most hits before.
const firstOf = (slug: string) => Array.from(before.entries()).find(([, list]) => list[0]?.slug === slug);
const centreOf = (list: Pt[]) => ({x: list.reduce((a, p) => a + p.x, 0) / list.length, z: list.reduce((a, p) => a + p.z, 0) / list.length});
const horse = firstOf("domestic-horse")!;
const dogs = Array.from(before.entries()).filter(([, l]) => l[0]?.slug === "domestic-dog").sort((a, b) => b[1].filter(inside).length - a[1].filter(inside).length);
const bears = zooLayout(placed.open).enclosures.find((e) => e.type === "bears_wolves" && !e.shared)!;
const views = [
    {name: "horse-paddock", c: centreOf(horse[1]), half: 22},
    {name: "zoo-rockwork", c: {x: bears.slot.at.x, z: bears.slot.at.z}, half: 15},
    {name: "garden-dog", c: centreOf(dogs[0][1]), half: 12}
];
const colour: Record<string, string> = {rock: "#8a8070", mound: "#a9763e", log: "#6f5236", stump: "#6f5236", post: "#5e4632", trunk: "#5e4632", shelter: "#9b7b5a", hay: "#c9b26a", trough: "#6a8a92", pond: "#4f7f9a", bush: "#3f7a34", bramble: "#5a6a2a", bed: "#c86a8a", garden_room: "#b0b8c0"};
const svg = (traces: Map<string, Pt[]>, v: (typeof views)[number], label: string) => {
    const S = 600 / (v.half * 2);
    const X = (x: number) => (x - v.c.x + v.half) * S;
    const Z = (z: number) => (z - v.c.z + v.half) * S;
    const parts: string[] = [`<rect width="600" height="600" fill="#cfe0b0"/>`];
    for (const o of obstacles) {
        if (o.kind === "building") parts.push(`<polygon points="${o.poly.map((p) => `${X(p.x)},${Z(p.z)}`).join(" ")}" fill="#d8c8b0" stroke="#806040"/>`);
        else if (o.kind === "barrier") parts.push(`<polyline points="${o.line.map((p) => `${X(p.x)},${Z(p.z)}`).join(" ")}" fill="none" stroke="#5a4030" stroke-width="${Math.max(o.thickness * S, 1.5)}"/>`);
        else if (o.kind === "water") parts.push(`<polygon points="${o.poly.map((p) => `${X(p.x)},${Z(p.z)}`).join(" ")}" fill="#7fb0d0"/>`);
        else if (o.kind === "tree") parts.push(`<circle cx="${X(o.x)}" cy="${Z(o.z)}" r="${o.r * S}" fill="${o.soft ? "#3f7a34" : "#5e4632"}" opacity="0.85"/>`);
        else if (o.kind === "prop") parts.push(`<polygon points="${o.poly.map((p) => `${X(p.x)},${Z(p.z)}`).join(" ")}" fill="#9b7b5a"/>`);
    }
    const shape = (s: TownSolid) => {
        const fill = colour[s.kind] ?? "#888";
        if (s.shape === "circle") return `<circle cx="${X(s.x)}" cy="${Z(s.z)}" r="${s.r * S}" fill="${fill}" opacity="0.85"/>`;
        if (s.shape === "segment") return `<line x1="${X(s.ax)}" y1="${Z(s.az)}" x2="${X(s.bx)}" y2="${Z(s.bz)}" stroke="${fill}" stroke-width="${s.r * 2 * S}" stroke-linecap="round" opacity="0.9"/>`;
        return `<rect x="${X(s.x) - s.hw * S}" y="${Z(s.z) - s.hd * S}" width="${s.hw * 2 * S}" height="${s.hd * 2 * S}" fill="${fill}" opacity="0.85" transform="rotate(${(s.rot * 180) / Math.PI} ${X(s.x)} ${Z(s.z)})"/>`;
    };
    for (const s of solids) parts.push(shape(s));
    let hits = 0;
    for (const list of traces.values()) {
        for (const p of list) {
            if (Math.abs(p.x - v.c.x) > v.half || Math.abs(p.z - v.c.z) > v.half) continue;
            const bad = inside(p);
            if (bad) hits++;
            parts.push(`<circle cx="${X(p.x)}" cy="${Z(p.z)}" r="${bad ? 3.2 : 1.6}" fill="${bad ? "#e01010" : "#1a3aa0"}" opacity="${bad ? 0.95 : 0.5}"/>`);
        }
    }
    parts.push(`<text x="10" y="24" font-family="sans-serif" font-size="18" fill="#000">${label}: ${hits} poses inside a prop</text>`);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">${parts.join("")}</svg>`;
};
const browser = await chromium.launch({channel: "chrome", headless: true});
const page = await browser.newPage({viewport: {width: 1220, height: 620}});
for (const v of views) {
    const html = `<html><body style="margin:0;display:flex;gap:20px;background:#fff">${svg(before, v, `${v.name} before`)}${svg(after, v, "after")}</body></html>`;
    await page.setContent(html);
    const file = path.join(out, `${v.name}.png`);
    await page.screenshot({path: file});
    writeFileSync(path.join(out, `${v.name}.html`), html);
    console.log(file);
}
await browser.close();
