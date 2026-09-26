/**
 * Rebuild the snapshots behind /animal-behaviours and /challenge-yourself.
 *
 * Operator-run. Do NOT add to Next prebuild: the production build forbids
 * remote work during static generation (`assertNoRemoteDuringSeoSsg`), so these
 * pages render from the committed JSON and nothing else.
 *
 * Two sources, both keyed to species that already have a published SEO page so
 * every card on these pages can link somewhere real:
 *   - `species_system_dynamics` — archetype, frequency profile and waveform.
 *     ONLY the fields the signed-out teaser shows. The cross-domain matrix,
 *     failure modes and the full signature explanation are Pro-gated in
 *     `/api/app/system-dynamics`, and a public page must not leak past that.
 *   - `animal_trials_for_viewer_v1` — Trial definitions, which are public: a
 *     visitor can read what a Trial asks before deciding to sign up. Per-viewer
 *     state columns are dropped here; they are null for an anonymous read
 *     anyway.
 */

import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function loadEnvFile(fileName: string) {
    const filePath = join(root, fileName);
    if (!existsSync(filePath)) return;

    for (const line of readFileSync(filePath, "utf8").split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match) continue;
        let value = match[2] ?? "";
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        if (!process.env[match[1]]) process.env[match[1]] = value;
    }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and a read key are required.");

const PAGE = 1000;

async function fetchAll(table: string, select: string) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
        const response = await fetch(`${url}/rest/v1/${table}?select=${select}`, {
            headers: {
                apikey: key as string,
                Authorization: `Bearer ${key}`,
                Range: `${from}-${from + PAGE - 1}`,
                Accept: "application/json"
            }
        });
        if (!response.ok) throw new Error(`${table} returned ${response.status}: ${await response.text()}`);
        const page = (await response.json()) as Record<string, unknown>[];
        rows.push(...page);
        if (page.length < PAGE) return rows;
    }
}

function text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The last sentence of the signature explanation — the teaser's closing line. */
function closingLine(value: unknown) {
    const explanation = text(value);
    if (!explanation) return null;
    const sentences = explanation.match(/[^.!?]+[.!?]+/g);
    return sentences?.length ? sentences[sentences.length - 1].trim() : explanation;
}

const published = JSON.parse(readFileSync(join(root, "src/data/published-seo-animal-pages.json"), "utf8"));
const speciesBySeoId = new Map<string, {slug: string; name: string}>();
for (const entry of published.entries as Array<{slug: string; name: string; speciesProfileId?: string}>) {
    if (entry.speciesProfileId) speciesBySeoId.set(entry.speciesProfileId, {slug: entry.slug, name: entry.name});
}

const dynamicsRows = await fetchAll(
    "species_system_dynamics",
    "species_profile_id,archetype,frequency_profile,waveform,signature_explanation"
);

const behaviours = dynamicsRows.flatMap((row) => {
    const species = speciesBySeoId.get(String(row.species_profile_id));
    if (!species) return [];

    const profile = (row.frequency_profile ?? {}) as {modes?: Array<Record<string, unknown>>};
    const modes = Array.isArray(profile.modes) ? profile.modes : [];
    const waveform = (row.waveform ?? {}) as Record<string, unknown>;
    const archetype = text((row.archetype as {name?: unknown} | null)?.name);
    if (!archetype) return [];

    return [{
        slug: species.slug,
        name: species.name,
        archetype,
        frequency: text(modes[0]?.frequency) ?? "UNKNOWN",
        modes: modes.slice(0, 3).map((mode) => ({
            label: text(mode.label),
            frequency: text(mode.frequency) ?? "UNKNOWN"
        })).filter((mode) => mode.label),
        waveform: text(waveform.path_d)
            ? {pathD: text(waveform.path_d), viewBox: text(waveform.view_box) ?? "0 0 100 50", description: text(waveform.description)}
            : null,
        closingLine: closingLine(row.signature_explanation)
    }];
}).sort((left, right) => left.name.localeCompare(right.name));

const trialRows = await fetchAll(
    "animal_trials_for_viewer_v1",
    "species_profile_id,species_display_name,title,objective,animal_rule,user_benefit,principle_name,"
    + "principle_link,mechanism_connection,frequency,difficulty,estimated_minutes,completion_count"
);

const trials = trialRows.flatMap((row) => {
    const species = speciesBySeoId.get(String(row.species_profile_id));
    const title = text(row.title);
    const mechanism = text(row.mechanism_connection);
    if (!species || !title || !mechanism) return [];

    return [{
        slug: species.slug,
        species: text(row.species_display_name) ?? species.name,
        title,
        objective: text(row.objective),
        animalRule: text(row.animal_rule),
        userBenefit: text(row.user_benefit),
        principleName: text(row.principle_name),
        mechanismConnection: mechanism,
        frequency: text(row.frequency) ?? "MID",
        difficulty: Number(row.difficulty) || 1,
        estimatedMinutes: Number(row.estimated_minutes) || null,
        completionCount: Number(row.completion_count) || 0
    }];
}).sort((left, right) => left.title.localeCompare(right.title));

/**
 * The view returns byte-identical duplicates for some species — 711 rows reduce
 * to 576 distinct Trials. Left in, the page would print the same Trial twice,
 * which is a duplicate-content signal as well as a visible repeat.
 */
const seenTrials = new Set<string>();
const uniqueTrials = trials.filter((trial) => {
    const fingerprint = JSON.stringify(trial);
    if (seenTrials.has(fingerprint)) return false;
    seenTrials.add(fingerprint);
    return true;
});

const generatedAt = new Date().toISOString().slice(0, 10);
const note = "Newly generated rows do not appear on the page until this snapshot is refreshed and deployed. "
    + "The production build consumes this file only and never fetches Supabase.";

writeFileSync(join(root, "src/data/published-animal-behaviours.json"), `${JSON.stringify({
    generatedAt,
    source: "species_system_dynamics, teaser fields only, joined to published SEO species pages",
    note,
    entries: behaviours
}, null, 2)}\n`);

writeFileSync(join(root, "src/data/published-animal-trials.json"), `${JSON.stringify({
    generatedAt,
    source: "animal_trials_for_viewer_v1 definition columns, joined to published SEO species pages",
    note,
    entries: uniqueTrials
}, null, 2)}\n`);

console.log(`dynamics rows ${dynamicsRows.length} -> behaviours ${behaviours.length}`);
console.log(`trial rows ${trialRows.length} -> trials ${trials.length} -> unique ${uniqueTrials.length}`);
