#!/usr/bin/env -S npx tsx
/**
 * `src/ark-scene/care.json`: how each Ark species' young are cared for
 * (`src/lib/ark-care.ts`), from its stored text, for the liveliness pass's
 * young (follow a parent, carried, at the nest or den, guarded, on their own).
 * A breed with no text of its own reads its kind's (A1). Species whose text
 * says nothing are left out: the scene gives them their body plan's default,
 * flagged `plan_default`.
 *
 * The data is a read-only query of the live catalogue, run from the AnimalDex repo:
 *
 *   supabase db query --linked -o json "select vs.species_profile_id, vs.model_slug,
 *     vs.parent_species_profile_id, coalesce(sp.display_name, sp.animal_name) as name,
 *     fg.female_offspring_notes
 *     from voyage_species vs join species_profiles sp on sp.id = vs.species_profile_id
 *     left join species_field_guide fg on fg.species_profile_id = vs.species_profile_id
 *     where vs.excluded_reason is null" > care-text.json
 *
 *   npx tsx scripts/ark-care.mts care-text.json [phrases.tsv]
 *
 * `phrases.tsv` records every deciding sentence (slug, name, kind, basis,
 * independent days, sentence) for review.
 */

import {readFileSync, writeFileSync} from "node:fs";
import {careFromText, encodeCare} from "../src/lib/ark-care";

type Row = {species_profile_id: string; model_slug: string; parent_species_profile_id?: string | null; name: string; female_offspring_notes: string | null};

const [input, phrasesPath] = process.argv.slice(2);
if (!input) throw new Error("usage: ark-care.mts care-text.json [phrases.tsv]");
const raw = JSON.parse(readFileSync(input, "utf8"));
const rows: Row[] = Array.isArray(raw) ? raw : raw.rows;
const byId = new Map(rows.map((r) => [r.species_profile_id, r]));

const species: Record<string, [string, number, string]> = {};
const lines = ["slug\tname\tkind\tbasis\tindependent_days\tfrom\tsentence"];
const counts: Record<string, number> = {};
let silent = 0;
// A species with no model yet (A13) has no slug: it is drawn as the placeholder and takes its plan's default.
const noModel = rows.filter((r) => !r.model_slug).length;
for (const row of rows.filter((r) => r.model_slug).sort((a, b) => a.model_slug.localeCompare(b.model_slug))) {
    let text = row.female_offspring_notes;
    let from = "own";
    if (!text?.trim() && row.parent_species_profile_id) {
        text = byId.get(row.parent_species_profile_id)?.female_offspring_notes ?? null;
        from = "kind";
    }
    const care = careFromText(text);
    if (!care) {
        silent++;
        continue;
    }
    if (species[row.model_slug]) continue;
    species[row.model_slug] = encodeCare(care);
    counts[`${care.kind}/${care.basis}`] = (counts[`${care.kind}/${care.basis}`] ?? 0) + 1;
    lines.push([row.model_slug, row.name, care.kind, care.basis, care.independentDays ?? "", from, (care.phrase ?? "").replace(/\s+/g, " ")].join("\t"));
}

writeFileSync(
    new URL("../src/ark-scene/care.json", import.meta.url),
    `${JSON.stringify({version: 1, source: "species_field_guide.female_offspring_notes (a breed reads its kind's)", species})}\n`
);
if (phrasesPath) writeFileSync(phrasesPath, `${lines.join("\n")}\n`);
console.log(JSON.stringify({species: Object.keys(species).length, silent, noModel, counts}, null, 1));
