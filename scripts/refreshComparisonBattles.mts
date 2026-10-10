/**
 * Snapshot the user Arena battles behind published generated comparisons.
 * Operator-run (part of `refresh:published-seo`). Do NOT add to Next prebuild.
 *
 * A battle belongs to a comparison when its two captures' species profiles are
 * the comparison's two species profiles. `round3_species_comparison_slug` was
 * meant to carry that link but the app never fills it, so the pair is matched
 * here. Only public fields are kept: what `discover_challenge_history_v2`
 * already shows to signed-out Discover readers.
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
        const match = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match || process.env[match[1]]) continue;
        let value = match[2] ?? "";
        if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
        }
        process.env[match[1]] = value;
    }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const outPath = join(root, "src/data/published-comparison-battles.json");
const snapshotPath = join(root, "src/data/published-seo-comparison-pages.json");

if (!supabaseUrl || !serviceKey) {
    console.warn("comparison battles: missing Supabase URL or service role key; snapshot left unchanged");
    process.exit(0);
}

type Row = Record<string, unknown>;

async function rest(path: string): Promise<Row[]> {
    const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        headers: {apikey: serviceKey, Authorization: `Bearer ${serviceKey}`}
    });
    if (!response.ok) throw new Error(`${path.split("?")[0]}: ${response.status} ${await response.text()}`);
    return response.json() as Promise<Row[]>;
}

const str = (row: Row, key: string) => (typeof row[key] === "string" && (row[key] as string).trim() ? (row[key] as string).trim() : null);
const num = (row: Row, key: string) => (typeof row[key] === "number" ? row[key] as number : null);

const published = new Set<string>(
    (JSON.parse(readFileSync(snapshotPath, "utf8")).entries as Array<{slug: string}>).map((entry) => entry.slug)
);

const comparisons = await rest("species_comparisons?select=slug,animal_a_species_profile_id,animal_b_species_profile_id&generation_status=eq.ready&limit=5000");
const slugByPair = new Map<string, {slug: string; a: string; b: string}>();
for (const row of comparisons) {
    const slug = str(row, "slug");
    const a = str(row, "animal_a_species_profile_id");
    const b = str(row, "animal_b_species_profile_id");
    if (!slug || !a || !b || !published.has(slug)) continue;
    slugByPair.set([a, b].sort().join("|"), {slug, a, b});
}

const battles = await rest([
    "discover_challenge_history_v2?select=id,created_at,challenge_format,battle_status,settlement_reason",
    "attacker_capture_id,defender_capture_id,winner_capture_id,overall_winner_capture_id,overall_draw",
    "round1_winner_capture_id,round2_winner_capture_id,round3_winner_capture_id,round2_draw,votes_count",
    "rounds_won_attacker,rounds_won_defender,scenario_title,round3_deciding_stat,payout_amount,stake_amount",
    "attacker_profile_display_name,attacker_profile_username,attacker_profile_avatar_url,attacker_animal_name",
    "defender_profile_display_name,defender_profile_username,defender_profile_avatar_url,defender_animal_name"
].join(",") + "&battle_status=eq.completed&order=created_at.desc&limit=5000");

const captureIds = Array.from(new Set(battles.flatMap((row) => [str(row, "attacker_capture_id"), str(row, "defender_capture_id")]).filter((id): id is string => Boolean(id))));
const speciesByCapture = new Map<string, string>();
for (let index = 0; index < captureIds.length; index += 80) {
    const chunk = captureIds.slice(index, index + 80);
    const rows = await rest(`owned_capture_manifest_v1?select=capture_id,species_profile_id&capture_id=in.(${chunk.join(",")})`);
    for (const row of rows) {
        const captureId = str(row, "capture_id");
        const speciesId = str(row, "species_profile_id");
        if (captureId && speciesId) speciesByCapture.set(captureId, speciesId);
    }
}

type Side = "attacker" | "defender";
const STAT_LABELS: Record<string, string> = {
    total_species_score: "Overall species stats",
    round1_winner_fallback: "Tiebreak: Round 1 winner"
};

function voteDetail(row: Row) {
    if (row.round2_draw === true) return "Tied vote";
    const votes = num(row, "votes_count") ?? 0;
    // A winner with no votes means voting closed empty and Round 1's winner advanced.
    if (votes === 0) return "No votes in time, Round 1 winner advanced";
    return `${votes} ${votes === 1 ? "vote" : "votes"}`;
}

function humanizeStat(stat: string | null) {
    if (!stat) return null;
    const label = STAT_LABELS[stat] ?? stat.replace(/_/g, " ");
    return label.charAt(0).toUpperCase() + label.slice(1);
}

// Aliases fold into their canonical row, so an Albino Ball Python battle lands
// on the Ball Python page. Names label the opponent on the animal page.
const speciesIds = Array.from(new Set(speciesByCapture.values()));
const canonicalOf = new Map<string, string>();
const nameOf = new Map<string, string>();
for (let index = 0; index < speciesIds.length; index += 80) {
    const chunk = speciesIds.slice(index, index + 80);
    const rows = await rest(`species_profiles?select=id,canonical_species_profile_id,display_name&id=in.(${chunk.join(",")})`);
    for (const row of rows) {
        const id = str(row, "id");
        if (!id) continue;
        canonicalOf.set(id, str(row, "canonical_species_profile_id") ?? id);
        const name = str(row, "display_name");
        if (name) nameOf.set(id, name);
    }
}
const canonicalIds = Array.from(new Set(canonicalOf.values())).filter((id) => !nameOf.has(id));
for (let index = 0; index < canonicalIds.length; index += 80) {
    const rows = await rest(`species_profiles?select=id,display_name&id=in.(${canonicalIds.slice(index, index + 80).join(",")})`);
    for (const row of rows) {
        const id = str(row, "id");
        const name = str(row, "display_name");
        if (id && name) nameOf.set(id, name);
    }
}
const canonical = (id: string) => (canonicalOf.get(id) ?? id).toLowerCase();

/** Newest battles kept per species; the animal page shows a handful. */
const MAX_PER_SPECIES = 12;
const bySlug: Record<string, unknown[]> = {};
const bySpecies: Record<string, unknown[]> = {};
for (const row of battles) {
    const attackerCapture = str(row, "attacker_capture_id");
    const defenderCapture = str(row, "defender_capture_id");
    if (!attackerCapture || !defenderCapture) continue;
    const attackerSpecies = speciesByCapture.get(attackerCapture);
    const defenderSpecies = speciesByCapture.get(defenderCapture);
    if (!attackerSpecies || !defenderSpecies) continue;
    const comparison = slugByPair.get([attackerSpecies, defenderSpecies].sort().join("|")) ?? null;

    const sideOf = (captureId: string | null): Side | null =>
        captureId === attackerCapture ? "attacker" : captureId === defenderCapture ? "defender" : null;
    const bestOfThree = str(row, "challenge_format") === "best_of_3_v2";
    const draw = row.overall_draw === true;
    const winner = draw ? "draw" : sideOf(str(row, "overall_winner_capture_id") ?? str(row, "winner_capture_id"));
    if (!winner) continue;

    const rounds = bestOfThree
        ? [
            {number: 1, label: "Scenario", detail: str(row, "scenario_title"), winner: sideOf(str(row, "round1_winner_capture_id"))},
            {
                number: 2,
                label: "Community vote",
                detail: voteDetail(row),
                winner: row.round2_draw === true ? "draw" : sideOf(str(row, "round2_winner_capture_id"))
            },
            {number: 3, label: "Species stats", detail: humanizeStat(str(row, "round3_deciding_stat")), winner: sideOf(str(row, "round3_winner_capture_id"))}
        ].filter((round) => round.winner)
        : [{number: 1, label: "Scenario", detail: str(row, "scenario_title"), winner}];

    const player = (side: Side) => ({
        displayName: str(row, `${side}_profile_display_name`) ?? str(row, `${side}_profile_username`) ?? "AnimalDex player",
        username: str(row, `${side}_profile_username`),
        avatarUrl: str(row, `${side}_profile_avatar_url`),
        animalName: str(row, `${side}_animal_name`),
        // Which side of the comparison page this player's animal is.
        comparisonSide: (side === "attacker" ? attackerSpecies : defenderSpecies) === (comparison?.a ?? attackerSpecies) ? "animalA" : "animalB"
    });

    const battle = {
        id: str(row, "id"),
        date: str(row, "created_at"),
        format: bestOfThree ? "best_of_3" : "single_round",
        attacker: player("attacker"),
        defender: player("defender"),
        winner,
        roundsWon: bestOfThree
            ? {attacker: num(row, "rounds_won_attacker") ?? 0, defender: num(row, "rounds_won_defender") ?? 0}
            : {attacker: winner === "attacker" ? 1 : 0, defender: winner === "defender" ? 1 : 0},
        rounds,
        payout: num(row, "payout_amount") ?? 0,
        stake: num(row, "stake_amount") ?? 0
    };

    if (comparison) (bySlug[comparison.slug] ??= []).push(battle);

    // Every battle, published pair or not, on each species' own page. A mirror
    // match is listed once.
    for (const [side, mine, theirs] of [["attacker", attackerSpecies, defenderSpecies], ["defender", defenderSpecies, attackerSpecies]] as const) {
        const key = canonical(mine);
        if (side === "defender" && key === canonical(theirs)) continue;
        const list = (bySpecies[key] ??= []);
        if (list.length >= MAX_PER_SPECIES) continue;
        list.push({
            ...battle,
            side,
            opponentSpeciesName: nameOf.get(canonical(theirs)) ?? nameOf.get(theirs) ?? null,
            comparisonSlug: comparison?.slug ?? null
        });
    }
}

const sorted = Object.fromEntries(Object.keys(bySlug).sort().map((slug) => [slug, bySlug[slug]]));
const sortedSpecies = Object.fromEntries(Object.keys(bySpecies).sort().map((id) => [id, bySpecies[id]]));
writeFileSync(outPath, `${JSON.stringify({
    generatedAt: new Date().toISOString().slice(0, 10),
    source: "completed discover_challenge_history_v2 battles matched to published species_comparisons by capture species pair",
    note: "battles: /comparisons tiles and pages. bySpecies (canonical species_profile_id): the Compare section on /animals pages, every pair. Refresh with yarn refresh:published-seo.",
    battles: sorted,
    bySpecies: sortedSpecies
}, null, 2)}\n`);

const total = Object.values(sorted).reduce((sum, list) => sum + list.length, 0);
console.log(`comparison battles: ${total} battles across ${Object.keys(sorted).length} comparisons; ${Object.keys(sortedSpecies).length} species with battles`);
