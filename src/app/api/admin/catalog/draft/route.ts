import {NextRequest, NextResponse} from "next/server";
import {getBattleTier, type SpeciesStats} from "@/lib/battle-tier";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Draft the content an AnimalDex number implies, for review.
 *
 * Indexing an animal by hand means writing a subtitle, a behaviour principle
 * with a core lesson, a motto and five calibrated stats in the voice the rest of
 * the catalog uses. That is the slow part, and it is why entries sat unindexed.
 *
 * The draft is never written anywhere: it comes back to the panel for the
 * operator to read, edit and save through the normal path. Stats especially are
 * a judgement — the prompt is given real neighbours from the catalog so the
 * numbers land on the same scale rather than being invented against nothing.
 */

const MODEL = "gpt-4o";
const NEIGHBOUR_LIMIT = 12;

type Neighbour = {
    animaldex_number: number | null;
    display_name: string | null;
    scientific_name: string | null;
    canonical_game_stats: Record<string, number> | null;
    species_subtitle: string | null;
    core_lesson: string | null;
    principle_name: string | null;
};

/**
 * Entries whose stats this animal's should sit beside. Same first word of the
 * scientific name catches close relatives; the rest is filled from a size band,
 * because a stat scale is only meaningful next to comparable animals.
 */
async function findNeighbours(scientificName: string | null, displayName: string) {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) return [] as Neighbour[];

    const select = "animaldex_number,display_name,scientific_name,canonical_game_stats,species_subtitle,core_lesson,principle_name";
    const genus = scientificName?.trim().split(/\s+/)[0] ?? "";
    const word = displayName.trim().split(/\s+/).at(-1) ?? "";
    const filters: string[] = [];

    if (genus) filters.push(`scientific_name.ilike.${genus}*`);
    if (word.length > 3) filters.push(`display_name.ilike.*${word}*`);
    if (!filters.length) return [];

    const params = new URLSearchParams({
        select,
        animaldex_number: "not.is.null",
        or: `(${filters.join(",")})`,
        limit: String(NEIGHBOUR_LIMIT)
    });

    const response = await fetch(`${url}/rest/v1/species_catalog_v1?${params}`, {
        headers: getSupabaseHeaders(key, {Accept: "application/json"}),
        cache: "no-store"
    });

    return response.ok ? await response.json() as Neighbour[] : [];
}

function clampStat(value: unknown) {
    const number = Math.round(Number(value));
    return Number.isFinite(number) ? Math.max(0, Math.min(100, number)) : null;
}

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
        return NextResponse.json({
            ok: false,
            error: "OPENAI_API_KEY is not configured for this environment"
        }, {status: 500});
    }

    const body = await request.json().catch(() => ({})) as {displayName?: string; scientificName?: string};
    const displayName = body.displayName?.trim() ?? "";
    const scientificName = body.scientificName?.trim() || null;

    if (!displayName) {
        return NextResponse.json({ok: false, error: "An animal name is required"}, {status: 400});
    }

    try {
        const neighbours = await findNeighbours(scientificName, displayName);
        const reference = neighbours
            .filter((row) => row.canonical_game_stats)
            .map((row) => `#${row.animaldex_number} ${row.display_name} (${row.scientific_name ?? "?"}) ${JSON.stringify(row.canonical_game_stats)}${row.species_subtitle ? ` — subtitle: "${row.species_subtitle}"` : ""}`)
            .join("\n");

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {"Content-Type": "application/json", Authorization: `Bearer ${apiKey}`},
            cache: "no-store",
            signal: AbortSignal.timeout(60_000),
            body: JSON.stringify({
                model: MODEL,
                response_format: {type: "json_object"},
                messages: [
                    {
                        role: "system",
                        content: [
                            "You write catalog entries for AnimalDex, a field guide where each animal holds one numbered entry.",
                            "House voice: plain, concrete, unsentimental. No exclamation marks, no second person, no marketing language.",
                            "A subtitle is 'The <Two To Four Word Epithet>. <One sentence about what the animal actually does>.'",
                            "A core lesson is a single sentence a person could apply to their own life, drawn from the animal's real behaviour. Never a platitude.",
                            "Stats are integers 0-100 on the same scale as the reference entries given. rarity means how seldom a person encounters one, not conservation status.",
                            "Return JSON with keys: subtitle, subtitleStory, principleName, principleExpression, coreLesson, shortMotto, stats {dominance, speed, size, intelligence, rarity}, biologicalBasis."
                        ].join(" ")
                    },
                    {
                        role: "user",
                        content: [
                            `Animal: ${displayName}`,
                            scientificName ? `Scientific name: ${scientificName}` : "Scientific name: unknown",
                            reference
                                ? `Calibrate the stats against these entries already in the catalog:\n${reference}`
                                : "No close entries exist in the catalog; use the 0-100 scale conservatively."
                        ].join("\n")
                    }
                ]
            })
        });

        if (!response.ok) {
            const detail = await response.text();
            throw new Error(`OpenAI request failed (${response.status}): ${detail.slice(0, 300)}`);
        }

        const payload = await response.json() as {choices?: Array<{message?: {content?: string}}>};
        const content = payload.choices?.[0]?.message?.content;
        if (!content) throw new Error("The model returned nothing to read");

        const draft = JSON.parse(content) as Record<string, unknown>;
        const rawStats = (draft.stats ?? {}) as Record<string, unknown>;
        const stats: Record<string, number> = {};

        for (const key of ["dominance", "speed", "size", "intelligence", "rarity"]) {
            const value = clampStat(rawStats[key]);
            if (value != null) stats[key] = value;
        }

        const complete = Object.keys(stats).length === 5;

        return NextResponse.json({
            ok: true,
            draft: {
                subtitle: typeof draft.subtitle === "string" ? draft.subtitle : "",
                subtitleStory: typeof draft.subtitleStory === "string" ? draft.subtitleStory : "",
                principleName: typeof draft.principleName === "string" ? draft.principleName : "",
                principleExpression: typeof draft.principleExpression === "string" ? draft.principleExpression : "",
                coreLesson: typeof draft.coreLesson === "string" ? draft.coreLesson : "",
                shortMotto: typeof draft.shortMotto === "string" ? draft.shortMotto : "",
                biologicalBasis: typeof draft.biologicalBasis === "string" ? draft.biologicalBasis : "",
                stats: complete ? stats : null,
                // Shown so the operator can sanity-check the stats before saving:
                // a house cat coming back tier S means the numbers are wrong.
                tier: complete ? getBattleTier(stats as unknown as SpeciesStats) : null
            },
            neighbours: neighbours.map((row) => ({
                number: row.animaldex_number,
                displayName: row.display_name,
                stats: row.canonical_game_stats
            })),
            model: MODEL
        });
    } catch (error) {
        console.error("[admin-catalog-draft]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to draft this entry"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
