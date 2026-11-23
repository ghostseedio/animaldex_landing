#!/usr/bin/env -S npx tsx
/**
 * Lane SIG-OTHER's coverage report: every showable row of the signature catalogue (AnimalDex
 * docs/ark/signature-behaviours.json) in the themes other than defence tactic, group life, young care and hunt tactic
 * (those are other lanes'), and whether the scene shows it. A row is "shown" when its quote (an exact span of the species'
 * own stored text) is carried by one of the scene's committed tables: the lane's own (`look-states.json`,
 * `tail-postures.json`, `data/ark/signature-recipes-other.json`) or an earlier build's (the young coats and antlers, the
 * egg dips, the bird moves, wave 1's signature recipes, the water shake, the canopy moves). A lower bound: the generated
 * recipe table keeps its own phrases, which are not the catalogue's quotes. Writes `data/ark/signature-other-coverage.json`.
 *
 *   npx tsx scripts/ark-signature-other-coverage.mts --catalogue <AnimalDex>/docs/ark/signature-behaviours.json [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const arg = (name: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 ? process.argv[at + 1] : undefined;
};
const cataloguePath = arg("catalogue");
if (!cataloguePath) throw new Error("--catalogue <path to signature-behaviours.json>");
type Row = {id: string; name: string; behaviour: string; quote?: string; showable: boolean; how?: string; theme?: string; effort?: string};
const rows = (JSON.parse(fs.readFileSync(cataloguePath, "utf8")) as {rows: Row[]}).rows;
const OTHERS = new Set(["defence_tactic", "group_life", "young_care", "hunt_tactic"]);

const read = (file: string) => (fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), "utf8") : "");
/** The lane's own tables, and what the earlier builds carry. */
const OWN = ["src/ark-scene/look-states.json", "src/ark-scene/tail-postures.json", "data/ark/signature-recipes-other.json"];
const BEFORE = ["src/ark-scene/young-life.json", "data/ark/egg-dip.json", "src/ark-scene/bird-moves.json", "data/ark/signature-recipes.json", "src/ark-scene/water-shake.json", "src/ark-scene/canopy-moves.json", "src/ark-scene/defence-moves.json"];
// (A quote sits in a JSON file with its characters escaped.)
const esc = (text: string) => JSON.stringify(text).slice(1, -1);
const own = OWN.map(read).join("\n");
const before = BEFORE.map(read).join("\n");

const themes: Record<string, {total: number; S: number; M: number; L: number; before: number; ownBuilt: number; open: number; ml: number; mlOpen: number}> = {};
for (const row of rows) {
    if (!row.showable || !row.theme || OTHERS.has(row.theme) || !row.quote) continue;
    const t = (themes[row.theme] ??= {total: 0, S: 0, M: 0, L: 0, before: 0, ownBuilt: 0, open: 0, ml: 0, mlOpen: 0});
    const effort = row.effort === "L" ? "L" : row.effort === "M" ? "M" : "S";
    t.total++;
    t[effort]++;
    const mine = own.includes(esc(row.quote));
    const earlier = !mine && before.includes(esc(row.quote));
    if (mine) t.ownBuilt++;
    else if (earlier) t.before++;
    else t.open++;
    if (effort !== "S") {
        t.ml++;
        if (!mine && !earlier) t.mlOpen++;
    }
}
const totals = Object.values(themes).reduce((a, t) => ({total: a.total + t.total, before: a.before + t.before, ownBuilt: a.ownBuilt + t.ownBuilt, open: a.open + t.open, ml: a.ml + t.ml, mlOpen: a.mlOpen + t.mlOpen}), {total: 0, before: 0, ownBuilt: 0, open: 0, ml: 0, mlOpen: 0});
const out = {about: "Lane SIG-OTHER coverage (scripts/ark-signature-other-coverage.mts): showable catalogue rows outside defence tactic, group life, young care and hunt tactic, by theme: shown before this lane (the row's quote is in an earlier build's table), built by this lane, still open; ml = effort M or L. A lower bound for 'before' (the generated recipe table keeps its own phrases).", themes, totals};
console.log("theme".padEnd(14), "rows".padStart(5), "before".padStart(7), "lane".padStart(5), "open".padStart(5), " | M+L rows".padStart(11), "open".padStart(5));
for (const [name, t] of Object.entries(themes).sort((a, b) => b[1].total - a[1].total)) console.log(name.padEnd(14), String(t.total).padStart(5), String(t.before).padStart(7), String(t.ownBuilt).padStart(5), String(t.open).padStart(5), " |", String(t.ml).padStart(9), String(t.mlOpen).padStart(5));
console.log("total".padEnd(14), String(totals.total).padStart(5), String(totals.before).padStart(7), String(totals.ownBuilt).padStart(5), String(totals.open).padStart(5), " |", String(totals.ml).padStart(9), String(totals.mlOpen).padStart(5));
if (!process.argv.includes("--dry")) fs.writeFileSync(path.join(root, "data/ark/signature-other-coverage.json"), JSON.stringify(out, null, 1) + "\n");
