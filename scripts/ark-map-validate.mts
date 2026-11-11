#!/usr/bin/env -S npx tsx
/**
 * The Ark map's spawn validator, as a report by species (the owner's brief,
 * section 7): `npx tsx scripts/ark-map-validate.mts [out.md]` (default
 * `docs/ark-map/validator.md`). The same run `src/lib/ark-map.test.ts` makes
 * in CI, plus the grip check where the rig files are on this machine.
 */
import {readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import holds from "../src/ark-scene/map/validator-holds.json";
import {mapPoints} from "../src/ark-scene/map/place.ts";
import {mapHolds, mapSpecies} from "../src/ark-scene/map/species.ts";
import {MAP_AREAS, TAG_AREA} from "../src/ark-scene/map/tags.ts";
import {failuresBySpecies, validateMap, validatorAnimals, VALIDATOR_CHECKS} from "../src/ark-scene/map/validate.ts";
import {validateGrips} from "../src/ark-scene/map/validate-grips.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2] ?? join(root, "docs/ark-map/validator.md");
const started = performance.now();
const {failures, animals, species, placed} = validateMap();
const ms = Math.round(performance.now() - started);
const ids = new Map(validatorAnimals().map((a) => [a.id, a]));
const grips = await validateGrips(placed, (id) => ids.get(id)!.model_slug);
const sampler = mapPoints().sampler;

const lines: string[] = [];
lines.push("# Ark map: the spawn validator's report (generated)", "", `\`scripts/ark-map-validate.mts\` on terrain \`${sampler.id}\`, ${new Date().toISOString().slice(0, 10)}. CI runs the same checks (\`src/lib/ark-map.test.ts\`, workflow \`ark-map-validator\`).`, "");
lines.push(`- **Species placed:** ${species} (every catalogue species with an Ark model, and the breeds as their kind), ${animals} animals (each its own cluster, a lone one and a cluster's third member, all aboard at once), in ${ms} ms.`);
lines.push(`- **Failures:** ${failures.length} (${failuresBySpecies(failures).size} species).`);
for (const check of VALIDATOR_CHECKS) lines.push(`  - \`${check}\`: ${failures.filter((f) => f.check === check).length}`);
lines.push(`- **Grip check** (hangers, climbers, perchers on branches, trunks, ledges, walls, with the rig's foot bones): ${grips.skipped ? `skipped (${grips.skipped})` : `${grips.checked} rigs checked, ${grips.failures.length} with too few feet down in some frame (reviewed: ${Object.keys((holds as {grips: Record<string, string>}).grips).length})`}.`, "");

// Where everyone stands.
const byArea = new Map<string, number>();
const kinds = new Map<string, number>();
let partners = 0;
let roosts = 0;
for (const [id, place] of Array.from(placed.entries())) {
    if (!place.map || place.map.held) continue;
    const area = place.map.tag ? TAG_AREA[place.map.tag] : "?";
    byArea.set(area, (byArea.get(area) ?? 0) + 1);
    const kind = place.host ? `on its host (${place.host.role})` : place.burrow && place.map.attach ? "burrow at an attach point" : place.micro ? `attach point: ${place.micro.attach?.tag}` : place.canopy ? `canopy limb (${place.canopy.mode})` : place.burrow ? "burrow" : place.map.water ? `in the water by its depth band (${place.map.water})` : place.water ? (place.sea ? "in the sea (no band)" : "in fresh water (no band)") : "on the ground";
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    if (place.host) partners++;
    if (place.map.roost && ids.get(id)!.slot_rank === 0) roosts++;
}
lines.push("| Area | Animals placed there |", "|---|---:|", ...MAP_AREAS.map((area) => `| ${area} | ${byArea.get(area) ?? 0} |`), "");
lines.push("| Where | Animals |", "|---|---:|", ...Array.from(kinds.entries()).sort((a, b) => b[1] - a[1]).map(([k, n]) => `| ${k} | ${n} |`), "");
lines.push(`Partners on a host aboard: ${partners}. Species with a roost of their own (from \`sleep_pattern\`) resolved within reach: ${roosts}.`, "");
lines.push("## Failures by species", "");
const by = failuresBySpecies(failures);
if (!by.size) lines.push("None.", "");
for (const [slug, checks] of Array.from(by.entries())) lines.push(`- **${slug}**: ${Array.from(checks.entries()).map(([c, d]) => `\`${c}\` ${d}`).join("; ")}`);
lines.push("## Reviewed holds (not placed; they wait at the landing)", "", "| Species | Why |", "|---|---|");
for (const [slug, reason] of Object.entries(mapHolds().reviewed)) lines.push(`| ${slug} | ${reason} |`);
// Each decision hold's own reason, from the generator's table (decision 2, the head louse's absent host, decision 5's no-text species).
const heldWhy = new Map((JSON.parse(readFileSync(join(root, "docs/ark-map/species.json"), "utf8")) as {held: Array<{slug: string; reason: string}>}).held.map((row) => [row.slug, row.reason]));
for (const slug of mapHolds().decision) lines.push(`| ${slug} | ${mapSpecies(slug, "polar") ? "" : heldWhy.get(slug) ?? "held by the generator (docs/ark-map/species.json)"} |`);
lines.push("", "## Grip check by species", "");
if (grips.skipped) lines.push(`Skipped: ${grips.skipped}.`);
else if (!grips.failures.length) lines.push("None failing.");
for (const failure of grips.failures) lines.push(`- **${failure.slug}** (${failure.clip}): ${failure.detail}${(holds as {grips: Record<string, string>}).grips[failure.slug] ? " (reviewed)" : ""}`);
writeFileSync(out, lines.join("\n") + "\n");
console.log(`${species} species, ${failures.length} failures, grips ${grips.skipped ?? `${grips.checked} checked, ${grips.failures.length} failing`}; ${out}`);
