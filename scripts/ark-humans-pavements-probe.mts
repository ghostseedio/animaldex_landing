// p5 (humans): the pavement graph's numbers (nodes, edges, parts, lengths by kind). Prints JSON.
const {pavementGraph} = await import("../src/ark-scene/humans/pavements.ts");
const t0 = performance.now();
const g = pavementGraph();
const ms = performance.now() - t0;
const by: Record<string, {n: number; m: number}> = {};
for (const e of g.edges) {
    const b = (by[e.kind] ??= {n: 0, m: 0});
    b.n++;
    b.m += e.length;
}
const streets: Record<string, number> = {};
for (const e of g.edges) if (e.kind === "pavement" || e.kind === "path") streets[e.street] = Math.round((streets[e.street] ?? 0) + e.length);
const inMain = new Set(g.main);
const off = g.nodes.map((n, i) => (inMain.has(i) ? null : [+n.x.toFixed(0), +n.z.toFixed(0)])).filter(Boolean);
console.log(JSON.stringify({ms: Math.round(ms), nodes: g.nodes.length, edges: g.edges.length, main: g.main.length, by, streets, off: off.slice(0, 40)}));
