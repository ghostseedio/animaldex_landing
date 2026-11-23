/**
 * Picture strips of the behaviour flow pilot (docs/ark/behaviour-flows.md section 9): each scenario's steps over a
 * window as a timeline (coloured by step), the card's "Now:" lines at each change, and the live log's moments.
 * The server events given are SAMPLE inputs (labelled on each strip): in the scene they are the released events.
 *
 *   npx tsx scripts/ark-flow-strips.mts <outDir>
 */

import {mkdirSync} from "node:fs";
import path from "node:path";
import sharp from "sharp";
import table from "../src/ark-scene/flows/flow-params.json";
import {flowMoments, flowSteps, momentLine, stepLine, type FlowServer, type FlowStep} from "../src/ark-scene/flows/flows";
import type {FlowParams} from "../src/ark-scene/flows/params";
import {islandHours} from "../src/lib/ark-clock";

const P = (table as unknown as {species: Record<string, FlowParams>}).species;
const out = process.argv[2] ?? "strips";
mkdirSync(out, {recursive: true});
const at = (h: number, m = 0) => Date.UTC(2026, 10, 23, h, m) / 1000;

type Scenario = {file: string; slug: string; name: string; title: string; from: number; minutes: number; server: Partial<FlowServer>; note: string};
const S: Scenario[] = [
    {file: "01-red-fox", slug: "red-fox", name: "Red Fox", title: "Stalker + cacher: listening; the engine's escape (near miss), its kill, cached; background food insects/fruit", from: at(16, 5), minutes: 45, server: {escapes: [{at: at(16, 18), prey: "Wood Mouse"}], kills: [{at: at(16, 38), prey: "Bank Vole"}], caches: [{at: at(16, 39), recipe: "cache_food"}]}, note: "sample server events: escaped (Wood Mouse) 16:18, meal (Bank Vole) 16:38, SIG-EVENTS food_cache 16:39"},
    {file: "02-grey-heron", slug: "grey-heron", name: "Grey Heron", title: "Sit-and-wait: standing still for minutes, the server's kill; background food insects", from: at(10, 0), minutes: 45, server: {kills: [{at: at(10, 31), prey: "Common Frog"}]}, note: "sample server event: meal (Common Frog) 10:31"},
    {file: "03-house-sparrow", slug: "house-sparrow", name: "House Sparrow", title: "Seed eater, engine fed: foraging on its background food (seeds, insects)", from: at(10, 0), minutes: 30, server: {}, note: "engine: fed this Ark day (not hungry)"},
    {file: "04-house-sparrow-hungry", slug: "house-sparrow", name: "House Sparrow", title: "The same sparrow, engine hungry: searching, moving on, resting; never eating, no made-up misses", from: at(10, 0), minutes: 30, server: {fedOn: () => false}, note: "engine: hungry this Ark day"},
    {file: "05-red-deer", slug: "red-deer", name: "Red Deer", title: "Grazer: patches of grass and herbs (its engine background food), resting after", from: at(16, 20), minutes: 45, server: {}, note: "engine: fed"},
    {file: "06-honey-bee", slug: "western-honey-bee", name: "Western Honey Bee", title: "Nectar: flower to flower (engine background food: nectar), the waggle dance", from: at(10, 0), minutes: 20, server: {}, note: "engine: fed; dance from its stored text"},
    {file: "07-domestic-cat", slug: "domestic-cat", name: "Domestic Cat", title: "Kept: its keeper's feeding time; otherwise only watching (no background food stored, no kill)", from: at(16, 20), minutes: 45, server: {kept: {feedings: [at(16, 40)]}}, note: "sample keeper's feeding time 16:40"},
    {file: "08-eurasian-jay", slug: "eurasian-jay", name: "Eurasian Jay", title: "Seed eater + cacher: acorns, insects, fruit; the server's cache", from: at(10, 0), minutes: 30, server: {caches: [{at: at(10, 17), recipe: "cache_food"}]}, note: "sample SIG-EVENTS food_cache 10:17"},
    {file: "09-garden-spider", slug: "black-and-yellow-garden-spider", name: "Black-and-yellow Garden Spider", title: "Web: long waits on the web, background food, the server's catch", from: at(10, 0), minutes: 60, server: {kills: [{at: at(10, 44), prey: "Field Grasshopper"}]}, note: "sample server event: meal (Field Grasshopper) 10:44"},
    {file: "10-red-deer-rut", slug: "red-deer", name: "Red Deer", title: "Reproduction: the server's displays and mating only (no made-up rivals or refusals)", from: at(16, 15), minutes: 45, server: {repro: {inSeason: true, sex: "male", partner: true, displays: [at(16, 24)], mated: [at(16, 52)]}}, note: "sample: SIG-EVENTS display 16:24, mated 16:52"},
    {file: "11-sage-grouse-lek", slug: "greater-sage-grouse", name: "Greater Sage-Grouse", title: "Reproduction: the server's lek displays; no mating unless the server says", from: at(9, 0), minutes: 45, server: {repro: {inSeason: true, sex: "male", partner: true, displays: [at(9, 6), at(9, 27)]}}, note: "sample: SIG-EVENTS display 09:06, 09:27"},
    {file: "12-house-sparrow-nest", slug: "house-sparrow", name: "House Sparrow", title: "Reproduction: a pair's nest before the clutch the server laid (trips counted)", from: at(10, 0), minutes: 30, server: {repro: {inSeason: true, sex: "female", partner: true, laid: [at(14, 0)]}}, note: "sample: paired, server laid 14:00"}
];

const COLOUR: Record<string, string> = {
    sleep: "#5b6470", settle: "#5b6470", wake: "#8a94a3", search: "#5b8fd6", movePatch: "#7aa7e6", stalk: "#3d6fb8", attempt: "#f0b43c", nearMiss: "#f07c3c", nothing: "#b8c4d6", giveUp: "#d65b5b",
    catch: "#c0262d", carry: "#b07a3a", found: "#7ccf62", eat: "#2e9e44", cache: "#8a5a2b", dance: "#e8c23c", rest: "#a7adb5", digest: "#8fb89a", groom: "#c3b4d8", toWater: "#4cc3d9", wary: "#f0d43c", drink: "#2aa7c4",
    keptWait: "#b5a27a", keptEat: "#4f8f3a", call: "#9b6fd6", scentMark: "#b38fe0", display: "#7c4fc4", spar: "#c44f9b", court: "#e07cc0", rejected: "#a04060", mate: "#d02f8f", build: "#a0783c"
};

function esc(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
const clock = (t: number) => new Date(t * 1000).toISOString().slice(11, 16);

async function strip(s: Scenario): Promise<string> {
    const params = P[s.slug];
    const to = s.from + s.minutes * 60;
    const subject = {id: `pilot-${s.file}`, params, server: {fedOn: () => true, ...s.server, version: s.file} as FlowServer, hoursAt: (e: number) => islandHours(e * 1000)};
    const all = flowSteps(subject, s.from - 1800, to + 600);
    const steps = all.filter((x) => x.to > s.from && x.from < to);
    const W = 1600;
    const X0 = 40;
    const X1 = W - 40;
    const x = (t: number) => X0 + ((Math.min(Math.max(t, s.from), to) - s.from) / (to - s.from)) * (X1 - X0);
    // The card's lines at each change of what it says, and the live log's moments (the seeded draw, as the log would).
    const lines: Array<{t: number; text: string; step: FlowStep}> = [];
    for (const step of steps) {
        const text = stepLine(step);
        if (!lines.length || lines[lines.length - 1].text !== text) lines.push({t: Math.max(step.from, s.from), text, step});
    }
    const moments = flowMoments(subject.id, all, params).filter((m) => m.step.from >= s.from && m.step.from < to).map((m) => `${clock(m.step.from)}  ${momentLine(m.kind, s.name, m.step)}`);
    const rows = Math.ceil(lines.length / 2);
    const H = 230 + rows * 22 + 40 + moments.length * 22 + 30;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif"><rect width="100%" height="100%" fill="#ffffff"/>`;
    svg += `<text x="${X0}" y="36" font-size="24" font-weight="700" fill="#1d2430">${esc(s.name)}: ${esc(s.title)}</text>`;
    svg += `<text x="${X0}" y="62" font-size="15" fill="#5b6470">guild ${params.guild} · search ${params.mode} · ${esc(s.note)} · ${clock(s.from)}–${clock(to)} UTC</text>`;
    for (const step of steps) svg += `<rect x="${x(step.from).toFixed(1)}" y="80" width="${Math.max(x(step.to) - x(step.from), 1).toFixed(1)}" height="56" fill="${COLOUR[step.kind] ?? "#999"}"${step.server ? ` stroke="#000" stroke-width="2"` : ""}/>`;
    for (let m = 0; m <= s.minutes; m += 5) svg += `<line x1="${x(s.from + m * 60)}" x2="${x(s.from + m * 60)}" y1="136" y2="146" stroke="#333"/><text x="${x(s.from + m * 60)}" y="162" font-size="13" text-anchor="middle" fill="#333">${clock(s.from + m * 60)}</text>`;
    // Legend: the kinds in this strip.
    let lx = X0;
    for (const kind of Array.from(new Set(steps.map((st) => st.kind)))) {
        svg += `<rect x="${lx}" y="176" width="14" height="14" fill="${COLOUR[kind] ?? "#999"}"/><text x="${lx + 18}" y="188" font-size="13" fill="#333">${kind}</text>`;
        lx += 30 + kind.length * 7.5;
    }
    svg += `<text x="${X0}" y="222" font-size="16" font-weight="700" fill="#1d2430">The card ("Now:"), in order</text>`;
    lines.forEach((line, i) => {
        const col = i < rows ? 0 : 1;
        const row = i < rows ? i : i - rows;
        svg += `<text x="${X0 + col * 760}" y="${246 + row * 22}" font-size="15" fill="${line.step.server ? "#000" : "#333"}" font-weight="${line.step.server ? 700 : 400}">${clock(line.t)}  ${esc(line.text)}${line.step.server ? "  (server)" : ""}</text>`;
    });
    const my = 246 + rows * 22 + 22;
    svg += `<text x="${X0}" y="${my}" font-size="16" font-weight="700" fill="#1d2430">Live log moments</text>`;
    (moments.length ? moments : ["(none said in this window)"]).forEach((m, i) => (svg += `<text x="${X0}" y="${my + 24 + i * 22}" font-size="15" fill="#333">${esc(m)}</text>`));
    svg += `</svg>`;
    const file = path.join(out, `${s.file}.png`);
    await sharp(Buffer.from(svg)).png().toFile(file);
    return file;
}

void (async () => {
    for (const s of S) console.log(await strip(s));
})();
