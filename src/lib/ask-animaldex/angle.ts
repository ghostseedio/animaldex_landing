/* Ported from the apps' supabase/functions/_shared/animal-angle.ts (AnimalDex strategy/chat-engine, 2026-11-04): keep the two in step. */
/// The angle: the one real behaviour from the species record that a take is
/// built on (strategy, 2026-11-04). "Answer as a lion" anywhere gives bravery;
/// ours latches onto something the lion's record says it actually does ("the
/// roar is an honest count") and turns it into an idea no generic model would
/// offer.
///
/// The kind's verdict (animal-kind-verdict.ts) proposes up to three candidate
/// latches in its one cheap call, each from a different part of the record:
/// System Dynamics, the Power's evidence, the field guide. This file picks the
/// least obvious one that still fits, skipping what this person has already
/// heard from this animal (animal_chat_angles_heard, migration
/// 20261104170000), and keeps what was used so the next take is new.
///
/// The client shows the chosen behaviour under the reply ("Why a lion sees it
/// this way"): `angle: {behaviour, source, species_profile_id}` in `done`.

import type {AskSpeciesGrounding} from "@/lib/ask-animaldex/grounding";

/// How alike two short texts read, as Postgres pg_trgm counts it: shared
/// three-letter pieces of their words over all of them (0 to 1). The kind's
/// verdict matches held stances with it too (problemSimilarity).
export function trigramSimilarity(a: string, b: string): number {
    const grams = (text: string) => {
        const out = new Set<string>();
        for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
            const padded = `  ${word} `;
            for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
        }
        return out;
    };
    const left = grams(a);
    const right = grams(b);
    let shared = 0;
    left.forEach((gram) => {
        if (right.has(gram)) shared++;
    });
    const union = left.size + right.size - shared;
    return union === 0 ? 0 : shared / union;
}

export const ANGLE_SOURCES = ["system_dynamics", "power", "field_guide", "species_record"] as const;
export type AngleSource = typeof ANGLE_SOURCES[number];

/// A latch the verdict proposed.
export type AngleCandidate = {
    source: AngleSource;
    /// The real behaviour, in plain words.
    behaviour: string;
    /// The new idea it gives them, for an idea; null for a decision's latch.
    twist: string | null;
    /// 1-5: how well it fits what they said.
    fit: number;
    /// 1-5: how far it is from the obvious take.
    fresh: number;
};

/// The latch a take is built on.
export type ChosenAngle = {
    source: AngleSource;
    behaviour: string;
    twist: string | null;
    /// What is kept in animal_chat_angles_heard: the behaviour's own words.
    key: string;
    /// Every fitting candidate had been heard: this one the longest ago.
    repeat?: boolean;
};

/// The `angle` field of `done` (SPEC 3.3).
export type ClientAngle = { behaviour: string; source: AngleSource; species_profile_id: string };

/// Below this fit a candidate does not answer what they said.
export const ANGLE_MIN_FIT = 3;
/// At or above this a candidate reads like one they have heard.
export const ANGLE_HEARD_SIMILARITY = 0.45;
/// The behaviour line the client shows, at most.
export const ANGLE_BEHAVIOUR_MAX = 140;

function clean(value: unknown, max: number): string {
    if (typeof value !== "string") return "";
    const text = value.replace(/\s+/g, " ").trim().replace(/^["“]|["”]$/g, "").trim();
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const space = cut.lastIndexOf(" ");
    return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

export function angleSource(raw: unknown): AngleSource {
    const value = typeof raw === "string" ? raw.trim().toLowerCase().replace(/[\s-]+/g, "_") : "";
    if (value.startsWith("system") || value === "sd" || value.includes("dynamics")) return "system_dynamics";
    if (value.startsWith("power") || value.includes("evidence") || value === "principle") return "power";
    if (value.startsWith("field") || value.includes("guide") || value === "facts") return "field_guide";
    return "species_record";
}

function score(raw: unknown, fallback: number): number {
    const value = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(value) ? Math.max(1, Math.min(5, Math.round(value))) : fallback;
}

const STOPWORDS = new Set(
    ("a an and are as at be been but by for from has have in into is it its of on or that the their them they this to " +
        "was were when where which while who will with you your it's its' than then so if not no only one own just also")
        .split(" "),
);

/// The behaviour's own words, lowercase, without the small words: how an
/// angle is kept and compared ("roar honest count"). At most 80 characters.
export function angleKey(behaviour: string): string {
    const content = (behaviour.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((word) => !STOPWORDS.has(word));
    return content.join(" ").slice(0, 80).trim();
}

/// Up to three candidates, one per behaviour, from the verdict's JSON.
export function parseAngleCandidates(raw: unknown, options: { withTwist?: boolean } = {}): AngleCandidate[] {
    const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
    const out: AngleCandidate[] = [];
    const keys = new Set<string>();
    for (const item of list) {
        if (!item || typeof item !== "object") continue;
        const row = item as Record<string, unknown>;
        const behaviour = clean(row.behaviour ?? row.behavior, ANGLE_BEHAVIOUR_MAX);
        const key = angleKey(behaviour);
        if (behaviour.length < 8 || !key || keys.has(key)) continue;
        keys.add(key);
        const twist = clean(row.twist, 200);
        out.push({
            source: angleSource(row.from ?? row.source),
            behaviour,
            twist: options.withTwist === false ? null : twist || null,
            fit: score(row.fit, 4),
            fresh: score(row.fresh, 3),
        });
        if (out.length >= 3) break;
    }
    return out;
}

/// How like one already heard: the closest, 0 to 1, and how far back it was
/// (0 = the newest heard).
function heardMatch(key: string, heard: string[]): { similarity: number; index: number } {
    let best = { similarity: 0, index: -1 };
    heard.forEach((entry, index) => {
        const similarity = entry === key ? 1 : trigramSimilarity(entry, key);
        if (similarity > best.similarity) best = { similarity, index };
    });
    return best;
}

/// The least obvious candidate that still fits and that they have not heard;
/// if every fitting one was heard, the one heard longest ago. Null when none
/// fits. `heard` is newest first.
export function chooseAngle(params: {
    candidates: AngleCandidate[];
    obvious?: string | null;
    heard?: string[];
}): ChosenAngle | null {
    const heard = (params.heard ?? []).map((entry) => angleKey(entry)).filter(Boolean);
    const obvious = params.obvious ?? "";
    const fitting = params.candidates
        .map((candidate, order) => {
            const key = angleKey(candidate.behaviour);
            const match = heardMatch(key, heard);
            return {
                candidate,
                key,
                order,
                heard: match.similarity >= ANGLE_HEARD_SIMILARITY,
                heardIndex: match.index,
                // How much of the obvious take it repeats.
                overlap: obvious ? trigramSimilarity(`${candidate.behaviour} ${candidate.twist ?? ""}`, obvious) : 0,
            };
        })
        .filter((entry) => entry.candidate.fit >= ANGLE_MIN_FIT && entry.key);
    if (fitting.length === 0) return null;
    const fresh = fitting.filter((entry) => !entry.heard);
    const pool = fresh.length > 0 ? fresh : fitting;
    const ranked = [...pool].sort((a, b) =>
        fresh.length === 0 && a.heardIndex !== b.heardIndex
            ? b.heardIndex - a.heardIndex
            : b.candidate.fresh - a.candidate.fresh ||
                a.overlap - b.overlap ||
                b.candidate.fit - a.candidate.fit ||
                a.order - b.order
    );
    const best = ranked[0];
    return {
        source: best.candidate.source,
        behaviour: best.candidate.behaviour,
        twist: best.candidate.twist,
        key: best.key,
        ...(fresh.length === 0 ? { repeat: true } : {}),
    };
}

export function angleForClient(angle: ChosenAngle | null | undefined, speciesProfileId: string | null | undefined): ClientAngle | null {
    if (!angle || !speciesProfileId || !angle.behaviour) return null;
    return { behaviour: clean(angle.behaviour, ANGLE_BEHAVIOUR_MAX), source: angle.source, species_profile_id: speciesProfileId };
}

// ---------------------------------------------------------------------------
// The record's facets, as the verdict reads them
// ---------------------------------------------------------------------------

export type RecordFacets = Record<Exclude<AngleSource, "species_record">, string[]>;

function record(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function rows(value: unknown): Record<string, unknown>[] {
    return Array.isArray(value) ? value.map(record).filter((row): row is Record<string, unknown> => row !== null) : [];
}

function strings(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

/// What the record says the animal does, by facet, a few short lines each:
/// System Dynamics (its modes and how it fails), the Power's evidence, and the
/// field guide's facts. Takes the raw table rows or the chat's normalised
/// record (modes at the top or under frequency_profile).
export function recordFacets(input: {
    power?: Record<string, unknown> | null;
    systemDynamics?: Record<string, unknown> | null;
    fieldGuide?: Record<string, unknown> | null;
}): RecordFacets {
    const sd = record(input.systemDynamics);
    const profile = record(sd?.frequency_profile);
    const modes = rows(sd?.modes).length > 0 ? rows(sd?.modes) : rows(profile?.modes);
    const archetype = record(sd?.archetype);
    const system = [
        ...(typeof archetype?.name === "string" ? [`its system: ${clean(archetype.name, 80)}`] : []),
        ...modes.slice(0, 2).map((mode) => {
            const label = clean(mode.label ?? mode.state_name, 80);
            const role = clean(mode.role ?? mode.behavior ?? mode.description, 170);
            return [label, role].filter(Boolean).join(": ");
        }),
        ...rows(sd?.failure_modes).slice(0, 2).map((failure) => {
            const name = clean(failure.name ?? failure.title, 80);
            const why = clean(failure.description ?? failure.explanation, 150);
            return `where it fails: ${[name, why].filter(Boolean).join(": ")}`;
        }),
    ].filter((line) => line.length > 3);

    const power = record(input.power);
    const evidence = rows(power?.behavioral_evidence).slice(0, 3).map((item) => {
        const title = clean(item.title, 70);
        const seen = clean(item.observation, 160);
        return [title, seen].filter(Boolean).join(": ");
    }).filter((line) => line.length > 3);

    const guide = record(input.fieldGuide);
    const field = [
        ...strings(guide?.interesting_facts).slice(0, 3).map((fact) => clean(fact, 160)),
        ...strings(guide?.signature_traits).slice(0, 2).map((trait) => `body: ${clean(trait, 100)}`),
        ...(typeof guide?.diet_summary === "string" ? [`food: ${clean(guide.diet_summary, 120)}`] : []),
        ...(typeof guide?.predators_summary === "string" ? [`danger: ${clean(guide.predators_summary, 120)}`] : []),
        ...(typeof guide?.sleep_pattern === "string" ? [`rest: ${clean(guide.sleep_pattern, 110)}`] : []),
    ].filter((line) => line.length > 3);

    return { system_dynamics: system, power: evidence, field_guide: field };
}

/// The facets as prompt lines, one labelled list per facet; empty facets are left out.
export function recordFacetLines(facets: RecordFacets): string[] {
    return (Object.entries(facets) as Array<[keyof RecordFacets, string[]]>)
        .filter(([, lines]) => lines.length > 0)
        .flatMap(([facet, lines]) => [`${facet}:`, ...lines.map((line) => `- ${line}`)]);
}

// ---------------------------------------------------------------------------
// Angles heard (animal_chat_angles_heard)
// ---------------------------------------------------------------------------

type AngleAdmin = {
    from: (table: string) => unknown;
    rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

/// The angles this person has heard from this animal, newest first. Empty on
/// any error, including before the migration is applied.
export async function loadAnglesHeard(admin: AngleAdmin, userId: string, speciesProfileId: string, limit = 30): Promise<string[]> {
    try {
        // deno-lint-ignore no-explicit-any
        const query = (admin.from("animal_chat_angles_heard") as any)
            .select("angle_key")
            .eq("user_id", userId)
            .eq("species_profile_id", speciesProfileId)
            .order("created_at", { ascending: false })
            .limit(limit);
        const { data, error } = await query;
        if (error || !Array.isArray(data)) return [];
        return data.map((row: { angle_key?: unknown }) => (typeof row.angle_key === "string" ? row.angle_key : "")).filter(Boolean);
    } catch {
        return [];
    }
}

/// Keeps the angle a reply was built on. Never fails a turn.
export async function recordAngleHeard(
    admin: AngleAdmin,
    params: { userId: string; speciesProfileId: string; angle: ChosenAngle },
): Promise<void> {
    try {
        const { error } = await admin.rpc("record_animal_chat_angle", {
            p_user_id: params.userId,
            p_species_profile_id: params.speciesProfileId,
            p_angle_key: params.angle.key,
        });
        if (error && error.code !== "PGRST202" && error.code !== "42883") console.warn("record_animal_chat_angle failed", error.message);
    } catch (error) {
        console.warn("record_animal_chat_angle failed", error instanceof Error ? error.message : String(error));
    }
}

/**
 * Web only: the facets from the website's species packet (`grounding.ts`),
 * which names things in its own way and carries the modes without their roles.
 */
export function askRecordFacets(species: AskSpeciesGrounding | null | undefined): RecordFacets {
    if (!species) return recordFacets({});
    const sd = species.systemDynamics;
    return recordFacets({
        power: species.power
            ? {behavioral_evidence: species.power.behavioralEvidence.map((item) => ({title: item.title, observation: item.observation}))}
            : null,
        systemDynamics: sd
            ? {
                archetype: {name: sd.archetypeName},
                modes: sd.frequency.modes.map((mode) => ({label: mode.name})),
                failure_modes: sd.failureModes.map((failure) => ({name: failure.title, description: failure.explanation}))
            }
            : null,
        fieldGuide: {
            interesting_facts: species.interestingFacts,
            signature_traits: species.identification,
            diet_summary: species.diet,
            predators_summary: species.predators,
            sleep_pattern: species.sleepPattern
        }
    });
}
