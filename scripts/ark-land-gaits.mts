#!/usr/bin/env -S npx tsx
/**
 * How seals, sea lions, walruses, frogs, toads, newts and salamanders get about on land (movement audit lane MA4,
 * findings 10 and 11; docs/ark/movement-audit-2026-11-13.md), by family from the stored taxonomy only. Deterministic
 * rules, no AI calls. The scene decodes it in `locomotion/gaits.ts` (`landGait`).
 *
 * Input (read-only, local): the catalogue's taxonomy, either the behaviour lane's live export (rows with `slug`,
 * `class_name`, `order_name`, `family_name`: `scripts/ark-behaviour-profiles.mts` input 1) or the sleep lane's export
 * (`{slug: {cls, ord, fam}}`).
 *
 *   npx tsx scripts/ark-land-gaits.mts <export.json>
 *
 * Outputs: `src/ark-scene/locomotion/land-gaits.json` ({slug: gait}) and `data/ark/land-gaits.json` (the family and
 * the rule per species). Gaits:
 *
 *   galumph         true seals (Phocidae): on the belly, the body humping in a wave from the chest back, the hind
 *                   flippers held up off the ground (they cannot turn them forward): `land-drivers.ts` galumphDriver.
 *   flipper_gallop  sea lions and fur seals (Otariidae): the hind flippers turned forward under the body, a walk on all
 *                   four flippers (lateral sequence) and a gallop with the hind flippers together when fast (Beentjes
 *                   1990, "Comparative terrestrial locomotion of the Hooker's sea lion and the New Zealand fur seal").
 *   flipper_walk    the walrus (Odobenidae): four flippers like a sea lion, but it only walks, slowly.
 *   leap            frogs that jump far (Emerson 1979's fore-aft sliding sacrum; Reilly & Jorgensen 2011, "The evolution
 *                   of jumping in frogs"): true frogs, tree frogs, reed and flying frogs: long low hops with a sit between.
 *   hop             walker-hoppers: toads, poison frogs, fire-bellied toads, horned frogs, midwife toads, spadefoots,
 *                   clawed frogs and other short hoppers: they walk when slow and make short hops when faster.
 *   walk            walkers and burrowers that rarely hop (narrow-mouthed and rain frogs, the turtle frog, monkey frogs
 *                   that walk hand over hand, the purple frog): a sprawling walk only.
 *   crawl           newts and salamanders (Caudata): a sprawling walk and its faster, body-bending run; never a hop.
 */

import fs from "node:fs";
import path from "node:path";

type Taxon = {slug: string; cls: string; ord: string; fam: string};
const exportPath = process.argv[2];
if (!exportPath) {
    console.error("usage: ark-land-gaits.mts <export.json>");
    process.exit(1);
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const raw = JSON.parse(fs.readFileSync(exportPath, "utf8")) as unknown;
const taxa: Taxon[] = Array.isArray(raw) || (raw as {rows?: unknown}).rows
    ? ((Array.isArray(raw) ? raw : (raw as {rows: unknown[]}).rows) as Array<{slug?: string; excluded_reason?: string | null; class_name?: string; order_name?: string; family_name?: string}>)
          .filter((r) => r.slug && !r.excluded_reason)
          .map((r) => ({slug: r.slug!, cls: r.class_name ?? "", ord: r.order_name ?? "", fam: r.family_name ?? ""}))
    : Object.entries(raw as Record<string, {cls?: string; ord?: string; fam?: string}>).map(([slug, r]) => ({slug, cls: r.cls ?? "", ord: r.ord ?? "", fam: r.fam ?? ""}));

const PINNIPEDS: Record<string, [string, string]> = {
    Phocidae: ["galumph", "true seal: humps along on its belly, hind flippers held up (they cannot turn forward)"],
    Otariidae: ["flipper_gallop", "eared seal: walks on four flippers, hind flippers turned forward; gallops when fast"],
    Odobenidae: ["flipper_walk", "walrus: walks slowly on four flippers, hind flippers turned forward"]
};
/** Frog and toad families by how they move on land (Emerson 1979; Reilly & Jorgensen 2011; field guides). */
const ANURANS: Record<string, [string, string]> = {
    Ranidae: ["leap", "true frogs: long jumps"],
    Hylidae: ["leap", "tree frogs: jumpers"],
    Pelodryadidae: ["leap", "Australo-Papuan tree frogs: jumpers"],
    Rhacophoridae: ["leap", "Old World tree and flying frogs: jumpers"],
    Hyperoliidae: ["leap", "reed frogs: jumpers"],
    Conrauidae: ["leap", "the goliath frog: a powerful jumper"],
    Dicroglossidae: ["leap", "fork-tongued frogs: jumpers"],
    Mantellidae: ["hop", "mantellas: small hoppers"],
    Eleutherodactylidae: ["leap", "rain frogs (Eleutherodactylus): small jumpers"],
    Bufonidae: ["hop", "toads: walker-hoppers, short hops"],
    Dendrobatidae: ["hop", "poison frogs: short hops"],
    Bombinatoridae: ["hop", "fire-bellied toads: short hops"],
    Ceratophryidae: ["hop", "horned frogs: sit-and-wait, short clumsy hops"],
    Megophryidae: ["hop", "Asian horned frogs: walk and short hops"],
    Alytidae: ["hop", "midwife toads: walk and short hops"],
    Scaphiopodidae: ["hop", "spadefoots: short hops"],
    Rhinodermatidae: ["hop", "Darwin's frogs: short hops"],
    Leiopelmatidae: ["hop", "New Zealand frogs: walker-hoppers, poor jumpers"],
    Pyxicephalidae: ["hop", "African bullfrogs: heavy, short hops"],
    Telmatobiidae: ["hop", "water frogs: aquatic, clumsy short hops on land"],
    Pipidae: ["hop", "clawed frogs and the Surinam toad: aquatic, lunging hops on land"],
    Microhylidae: ["walk", "narrow-mouthed frogs: walkers and burrowers"],
    Brevicipitidae: ["walk", "rain frogs (Breviceps): walk, cannot hop"],
    Myobatrachidae: ["walk", "the turtle frog: walks and burrows head first"],
    Phyllomedusidae: ["walk", "monkey frogs: walk hand over hand"],
    Nasikabatrachidae: ["walk", "the purple frog: a burrower, walks"]
};

const out: Record<string, string> = {};
const reasons: Record<string, {gait: string; why: string}> = {};
const tally: Record<string, number> = {};
for (const t of taxa.sort((a, b) => a.slug.localeCompare(b.slug))) {
    let hit: [string, string] | null = null;
    let why = "";
    if (PINNIPEDS[t.fam]) {
        hit = PINNIPEDS[t.fam];
        why = `${t.fam}: ${hit[1]}`;
    } else if (t.ord === "Anura") {
        hit = ANURANS[t.fam] ?? ["hop", "a frog of a family not listed: short hops"];
        why = `Anura/${t.fam || "?"}: ${hit[1]}`;
    } else if (t.ord === "Caudata") {
        hit = ["crawl", ""];
        why = `Caudata/${t.fam || "?"}: newts and salamanders walk and run with a bending body, never hop`;
    }
    if (!hit) continue;
    out[t.slug] = hit[0];
    reasons[t.slug] = {gait: hit[0], why};
    tally[hit[0]] = (tally[hit[0]] ?? 0) + 1;
}
const slugs = Object.keys(out).sort();
fs.writeFileSync(
    path.join(root, "src/ark-scene/locomotion/land-gaits.json"),
    `{"about":"Generated by scripts/ark-land-gaits.mts from the stored taxonomy (reasons per species: data/ark/land-gaits.json). How a seal, sea lion, walrus, frog, toad, newt or salamander moves on land: galumph (true seals), flipper_gallop (sea lions, fur seals), flipper_walk (the walrus), leap, hop, walk (frogs and toads by family), crawl (Caudata). Decoded by locomotion/gaits.ts landGait.",\n"species":{\n${slugs.map((s) => `${JSON.stringify(s)}:${JSON.stringify(out[s])}`).join(",\n")}\n}}\n`
);
fs.writeFileSync(path.join(root, "data/ark/land-gaits.json"), JSON.stringify({generated_from: "the catalogue's stored taxonomy (class, order, family)", tally, species: Object.fromEntries(slugs.map((s) => [s, reasons[s]]))}, null, 1) + "\n");
console.log(JSON.stringify(tally));
console.log(`${slugs.length} species`);
