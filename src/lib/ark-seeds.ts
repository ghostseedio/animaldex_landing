/**
 * The Ark's secret year seeds, as the public sees them (AnimalDex migration 20261204200000, P1-6 anti-staging;
 * docs/ark/anti-staging-p1-6.md). Each Ark year (14 real days) has a secret random number the engine's few chance rolls
 * are keyed with. Its SHA-256 commitment is published when the year starts, and the number itself once the year is over
 * and the engine has finished it, so anyone can check that nothing was changed.
 *
 * `voyage_year_seeds_public_v1` answers {available, ark_day, voyage, format, years: [{year, starts_ark_day, ends_ark_day,
 * commitment, committed_at, committed_ark_day, late, revealed, seed?}]}. This module shapes that answer for the route and
 * for the "How the Ark works" page, and CHECKS it: a revealed seed is hashed here and compared with its commitment, and a
 * seed the database says is not yet revealed is never passed on, whatever else the row holds.
 *
 * Plain functions: the route, the page and the tests share them (server side: `node:crypto`).
 */
import {createHash} from "node:crypto";

/** What a commitment is the SHA-256 (hex) of: the voyage, the Ark year and the seed, in the database's own format. */
export const ARK_SEED_FORMAT = "animaldex-ark-seed-v1|<voyage>|<year>|<seed>";

const HEX64 = /^[0-9a-f]{64}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;
const MAX_YEARS = 60;

export type ArkSeedYear = {
    year: number;
    startsArkDay: number;
    endsArkDay: number;
    /** SHA-256 (hex) published when the year was first asked for. */
    commitment: string;
    /** ISO time (UTC) the commitment was published. */
    committedAt: string;
    committedArkDay: number;
    /** Published more than half an Ark day after the year began (the first year, or one the engine was off through). */
    late: boolean;
    revealed: boolean;
    /** The seed: only once revealed. */
    seed: string | null;
    /** For a revealed year: whether sha256(format with its values) is the commitment. null while hidden. */
    matches: boolean | null;
};

export type ArkSeeds = {
    available: boolean;
    arkDay: number | null;
    voyage: string;
    years: ArkSeedYear[];
};

export const ARK_SEEDS_ABSENT: ArkSeeds = {available: false, arkDay: null, voyage: "first", years: []};

/** The commitment of a year's seed: SHA-256 (hex) of `animaldex-ark-seed-v1|<voyage>|<year>|<seed>`. */
export function arkSeedCommitment(voyage: string, year: number, seed: string): string {
    return createHash("sha256").update(`animaldex-ark-seed-v1|${voyage}|${year}|${seed}`, "utf8").digest("hex");
}

function num(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** One year's row, or null when it is not one (bad commitment, a year that is not a whole number, a time that is not one). */
function shapeYear(raw: unknown, voyage: string): ArkSeedYear | null {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as Record<string, unknown>;
    const year = num(row.year);
    const starts = num(row.starts_ark_day);
    const ends = num(row.ends_ark_day);
    const committedArkDay = num(row.committed_ark_day);
    const commitment = typeof row.commitment === "string" ? row.commitment : "";
    const committedAt = typeof row.committed_at === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(row.committed_at) ? row.committed_at : "";
    if (year === null || !Number.isInteger(year) || year < 0 || starts === null || ends === null || committedArkDay === null) return null;
    if (!HEX64.test(commitment) || !committedAt) return null;
    // A seed is passed on only when the database says its year is revealed, and only if it is a seed.
    const revealed = row.revealed === true;
    const seed = revealed && typeof row.seed === "string" && HEX64.test(row.seed) ? row.seed : null;
    return {
        year,
        startsArkDay: starts,
        endsArkDay: ends,
        commitment,
        committedAt,
        committedArkDay,
        late: row.late === true,
        revealed: revealed && seed !== null,
        seed,
        matches: seed ? arkSeedCommitment(voyage, year, seed) === commitment : null
    };
}

/** The database's answer as the page and the route use it; null when it is not an answer this module understands. */
export function shapeArkSeeds(data: unknown): ArkSeeds | null {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const body = data as Record<string, unknown>;
    if (body.available !== true) return {...ARK_SEEDS_ABSENT};
    const voyage = typeof body.voyage === "string" && SLUG.test(body.voyage) ? body.voyage : "first";
    if (!Array.isArray(body.years)) return null;
    const seen = new Set<number>();
    const years: ArkSeedYear[] = [];
    for (const raw of body.years) {
        const row = shapeYear(raw, voyage);
        if (!row || seen.has(row.year)) continue;
        seen.add(row.year);
        years.push(row);
        if (years.length >= MAX_YEARS) break;
    }
    years.sort((a, b) => b.year - a.year);
    return {available: years.length > 0, arkDay: num(body.ark_day), voyage, years};
}
