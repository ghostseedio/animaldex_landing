import {NextResponse} from "next/server";
import {createSignedStorageUrl} from "@/lib/capture-storage-image";
import {decodeProblemDiary, type ProblemDiaryEntry} from "@/lib/problem-diary";
import {createSupabaseServerClient, createSupabaseServiceClient} from "@/lib/supabase/server";
import {STEP_MEDIA_BUCKET, isOwnStepMediaPath, stepMediaKind, type StepRecordMedia} from "@/lib/your-step";
import {arkDiaryVisibility, decodeArkStats} from "@/lib/ark";
import {loadAgeBand} from "@/lib/ask-animaldex/age-band";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Diary on your own profile (iOS `ProfileDiaryTabSection`): every problem
 * you have worked through, newest first, as the signed-in reader
 * (`my_problem_diary_v1`, p_limit 100, as iOS asks). Each entry carries its
 * species' icon-art slug, and a done step's photo or video comes signed for
 * an hour so "Step done" can show it. Private: the RPC reads auth.uid()'s
 * own rows only.
 *
 * A failed read answers 502 so the tab can say "Couldn't load this" and
 * offer Try again, never an empty diary.
 *
 * Life Sim (docs/life-sim/CONTRACT.md, section 7): each entry carries its
 * Ark state and changes and whether it is sensitive (no public summaries,
 * owner 2026-11-09: no entry's words are ever public); the answer carries the profile-wide switch (`visibility`, read from the
 * diary's envelope or `ark_stats_v1` when the server says it, else the
 * contract's default, public), `teen` (always private, no public option)
 * and `ark` (whether the server has the Ark at all).
 */

const DIARY_LIMIT = 100;
const SIGNED_MEDIA_SECONDS = 60 * 60;

/** The icon art is filed by the species' identity key, written with hyphens. */
async function slugsFor(ids: string[]): Promise<Map<string, string>> {
    const service = createSupabaseServiceClient();
    if (!service || ids.length === 0) return new Map();
    try {
        const {data} = await service.from("species_profiles").select("id, normalized_identity_key").in("id", ids.slice(0, 200));
        return new Map((data ?? []).flatMap((row) => {
            const key = typeof row.normalized_identity_key === "string" ? row.normalized_identity_key.trim() : "";
            return key ? [[String(row.id).toLowerCase(), key.replace(/_/g, "-")] as [string, string]] : [];
        }));
    } catch {
        return new Map();
    }
}

async function signedMedia(userId: string, paths: string[]): Promise<StepRecordMedia[]> {
    const own = paths.filter((path) => isOwnStepMediaPath(userId, path));
    const signed = await Promise.all(own.map(async (path) => {
        const url = await createSignedStorageUrl(STEP_MEDIA_BUCKET, path, SIGNED_MEDIA_SECONDS).catch(() => null);
        return url ? [{path, url, kind: stepMediaKind(path)} satisfies StepRecordMedia] : [];
    }));
    return signed.flat();
}

export async function GET() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const service = createSupabaseServiceClient();
    const [{data, error}, stats, band] = await Promise.all([
        supabase.rpc("my_problem_diary_v1", {p_limit: DIARY_LIMIT}),
        Promise.resolve(supabase.rpc("ark_stats_v1", {p_user_id: null})).then((result) => (result.error ? null : result.data)).catch(() => null),
        service ? loadAgeBand(service, user.id) : Promise.resolve("unknown" as const)
    ]);
    if (error) {
        console.warn("[diary] my_problem_diary_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({error: "The diary could not be read."}, {status: 502});
    }

    const entries = decodeProblemDiary(data);
    const slugs = await slugsFor(Array.from(new Set(entries.flatMap((entry) => (entry.speciesProfileId ? [entry.speciesProfileId] : [])))));
    const withMedia: ProblemDiaryEntry[] = await Promise.all(entries.map(async (entry) => ({
        ...entry,
        slug: entry.speciesProfileId ? slugs.get(entry.speciesProfileId) ?? null : null,
        steps: await Promise.all(entry.steps.map(async (step) => (
            step.isDone && step.record.mediaPaths.length > 0
                ? {...step, media: await signedMedia(user.id, step.record.mediaPaths)}
                : step
        )))
    })));

    const envelope = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
    const arkStats = decodeArkStats(stats);
    const teen = band === "teen" || arkStats?.teen === true;
    const visibility = teen
        ? "private"
        : arkDiaryVisibility(envelope?.visibility) ?? arkDiaryVisibility(envelope?.diary_visibility) ?? arkStats?.diaryVisibility ?? "public";
    return NextResponse.json({
        entries: withMedia,
        visibility,
        teen,
        ark: arkStats !== null || entries.some((entry) => entry.ark !== null)
    }, {headers: {"Cache-Control": "private, no-store"}});
}
