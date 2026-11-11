/**
 * The scenery's numbers (scenery lane, the motion 100x pass): trees that grow inside each other, and (with the props
 * check) props that float or stand in something. Prints a table and, with --json <file>, writes them.
 *
 *   npx tsx scripts/ark-scenery-metrics.mts [--json out.json] [--list 20]
 */

import {writeFileSync} from "node:fs";
import {forestFill, worldDecor} from "@/ark-scene/decor";
import {treeBody, TreeSpacing, type TreeBody} from "@/ark-scene/tree-spacing";

const arg = (name: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 ? process.argv[at + 1] : undefined;
};

export function treeOverlaps() {
    const decor = worldDecor();
    const fill = forestFill();
    const bodies: Array<{host: string; body: TreeBody}> = [];
    decor.forEach((item, i) => {
        const body = treeBody(item);
        if (body) bodies.push({host: `decor${i}`, body});
    });
    fill.forEach((item, i) => {
        const body = treeBody(item);
        if (body) bodies.push({host: `fill${i}`, body});
    });
    const index = new TreeSpacing();
    const hostOf = new Map<TreeBody, string>();
    const pairs: Array<{a: string; b: string; kind: string; depth: number; kinds: string}> = [];
    for (const {host, body} of bodies) {
        for (const {other, clash} of index.clashes(body)) pairs.push({a: hostOf.get(other)!, b: host, kind: clash.kind, depth: clash.depth, kinds: `${other.asset ?? other.kind}+${body.asset ?? body.kind}`});
        index.add(body);
        hostOf.set(body, host);
    }
    const byKind: Record<string, number> = {};
    for (const p of pairs) byKind[p.kind] = (byKind[p.kind] ?? 0) + 1;
    const involved = new Set(pairs.flatMap((p) => [p.a, p.b]));
    const trees = bodies.filter((b) => !b.body.low).length;
    const shrubs = bodies.length - trees;
    return {trees, shrubs, decorTrees: bodies.filter((b) => b.host.startsWith("decor") && !b.body.low).length, fillTrees: bodies.filter((b) => b.host.startsWith("fill") && !b.body.low).length, pairs: pairs.length, byKind, treesInvolved: involved.size, worst: pairs.sort((x, y) => y.depth - x.depth)};
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const t = treeOverlaps();
    const list = Number(arg("list") ?? 0);
    console.log(`trees drawn: ${t.trees} (decor ${t.decorTrees}, fill ${t.fillTrees}), shrubs ${t.shrubs}`);
    console.log(`overlapping pairs: ${t.pairs}  ${JSON.stringify(t.byKind)}  trees involved: ${t.treesInvolved}`);
    for (const p of t.worst.slice(0, list)) console.log(`  ${p.a} ${p.b} ${p.kind} ${p.depth.toFixed(2)} m ${p.kinds}`);
    const out = arg("json");
    if (out) writeFileSync(out, JSON.stringify({trees: {...t, worst: t.worst.slice(0, 50)}}, null, 2));
}
