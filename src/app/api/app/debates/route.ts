import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";
import {
    loadDebatesEnabled,
    readDebate,
    readMyDebates,
    readRosterOptIn,
    withCandidateSlugs
} from "@/data/debates";
import {
    DEBATE_MAX_PICKS,
    DEBATE_MIN_PICKS,
    DEBATE_MIN_SOLUTION,
    DEBATE_PROBLEM_MAX,
    DEBATE_PUBLIC_TEXT_MAX,
    debatePicksParam,
    debateProblemCode,
    debateUuid,
    debateVisibility,
    decodeDebate,
    decodeDebateCandidates,
    decodeDebatePicks,
    decodeDebateQualities,
    decodeDebateSolution,
    decodeDebateWayChoice
} from "@/lib/debates";
import {askLanguageName} from "@/lib/ask-animaldex/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AnimalDex 3.2 Debates (docs/debates/SPEC.md, section 3), as the signed-in
 * reader. Every RPC acts on auth.uid() and refuses with a code.
 *
 * GET                       the switch, the reader's debates (`my_debates_v1`) and their roster opt-in.
 * GET ?captureId=           the same, only the debates that card of theirs was in (`p_capture_id`: the card's tab, the chat).
 * GET ?id=                  one debate (`debate_v1`): turns, report, votes, the reader's vote, `can_vote`.
 * POST {action: "candidates", hostCaptureId, visibility, problem}   the sheet's animals, with up to 3
 *                           "Fits this best" picked by a fast model (`generate-applied-insight`,
 *                           `mode: "debate_candidates"`), else `debate_candidates_v1`'s keyword marks.
 * POST {action: "create", hostCaptureId, visibility, problem, captureIds}   `create_debate_v1`.
 * POST {action: "approve", debateId, problemPublic}   `approve_public_debate_v1`.
 * POST {action: "cancel", debateId}                   `cancel_debate_v1` (not argued yet).
 * POST {action: "vote", debateId, participantId}      `vote_debate_v1`.
 * POST {action: "choose", debateId, participantId}    `choose_debate_way_v1` (never a vote).
 * POST {action: "roster", optedIn}                    `set_debate_roster_v1`.
 *
 * Debates v2 (docs/debates/V2.md; iOS e15b474b and 390e5c2a):
 * POST {action: "candidatesV2", hostCaptureId, problem, excludeSpecies?}   own and wild animals, the
 *                           model's picks first (`mode: "debate_candidates"`, `version: 2`), else
 *                           `debate_candidates_v2`'s keyword marks. `excludeSpecies`: Ask more animals.
 * POST {action: "createV2", hostCaptureId, problem, picks}   `create_debate_v2`: private, no Power needed;
 *                           each pick `{captureId}` or a wild animal's `{speciesProfileId}`.
 * POST {action: "extend", debateId, picks}            `extend_debate_v1` (Ask more animals).
 * POST {action: "qualities", speciesProfileId}         `species_top_qualities` (what a pick adds).
 * POST {action: "solve", debateId, account, locale?}   "I solved it my way" (flow `debate_solution`).
 * POST {action: "askPublic", debateId}                 `ask_public_v1`.
 * POST {action: "keepPrivate", debateId}               `keep_debate_private_v1`.
 * POST {action: "postPublic", debateId, text}          Post it (flow `debate_post_public`, which checks the text).
 * POST {action: "offerCandidates", debateId}           `debate_offer_candidates_v1`.
 * POST {action: "offerAnimal", debateId, captureId, locale?}   Add one of your animals (flow `debate_offer_animal`).
 *
 * A refusal answers `{ok: false, code}` for the client to say in words; with
 * the switch off every write answers `debates_off` without calling the server.
 */

function failed(what: string, message: string) {
    const code = debateProblemCode(message);
    if (code === "debate_unavailable") console.warn(`[debates] ${what} failed`, message.slice(0, 200));
    const status = code === "debate_unavailable" ? 502 : code === "not_authenticated" ? 401 : code === "debates_off" ? 403 : 400;
    return NextResponse.json({ok: false, code}, {status});
}

function refuse(code: string, status = 400) {
    return NextResponse.json({ok: false, code}, {status});
}

function problemText(value: unknown, max: number): string {
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

const PRIVATE = {"Cache-Control": "private, no-store"};

/**
 * One of a debate's own actions in the apps' chat function (not streamed):
 * "I solved it my way", posting it in public, an offered animal. Its
 * refusals come back as the debate's codes (`solution_too_short`,
 * `judge_unavailable`, `debate_not_public`, `way_unavailable`, …).
 */
async function debateFlow(flow: string, debateId: string, extra: Record<string, unknown>) {
    return chatFlow(flow, {debate_id: debateId, ...extra});
}

/** One of the chat function's non-streamed flows, in the envelope the apps send. */
async function chatFlow(flow: string, extra: Record<string, unknown>) {
    const invoked = await invokeAuthenticatedSupabaseFunctionResponse("generate-applied-insight", {
        mode: "animal_group_query",
        animal_group_query: {
            capture_ids: [],
            user_question: "",
            conversation_history: [],
            request_id: crypto.randomUUID(),
            pay_with_credits: false,
            surface: "web",
            stream: false,
            flow,
            ...extra
        }
    }).catch(() => null);
    if (!invoked) return {ok: false as const, response: refuse("debate_unavailable", 502)};
    const payload = invoked.payload && typeof invoked.payload === "object" ? invoked.payload as Record<string, unknown> : {};
    if (!invoked.ok || payload.ok === false) {
        const code = typeof payload.error === "string" ? payload.error : typeof payload.code === "string" ? payload.code : "";
        return {ok: false as const, response: failed(flow, code || `status ${invoked.status}`)};
    }
    return {ok: true as const, payload};
}

export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const params = new URL(request.url).searchParams;
    const enabled = await loadDebatesEnabled();
    if (!enabled) return NextResponse.json({enabled: false, debates: [], debate: null, optedIn: null}, {headers: PRIVATE});

    if (params.has("id")) {
        const debateId = debateUuid(params.get("id"));
        if (!debateId) return refuse("not_found");
        const {debate, error} = await readDebate(supabase, debateId);
        if (!debate) return failed("debate_v1", error ?? "not_found");
        return NextResponse.json({enabled, debate}, {headers: PRIVATE});
    }

    const captureId = debateUuid(params.get("captureId"));
    const [debates, optedIn] = await Promise.all([readMyDebates(supabase, captureId), readRosterOptIn(supabase)]);
    const listed = debates ?? [];
    return NextResponse.json({enabled, available: debates !== null, debates: listed, optedIn}, {headers: PRIVATE});
}

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return refuse("not_authenticated", 401);

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "";
    if (!(await loadDebatesEnabled())) return refuse("debates_off", 403);

    if (action === "candidates" || action === "create") {
        const hostCaptureId = debateUuid(body.hostCaptureId);
        const visibility = debateVisibility(body.visibility);
        const problem = problemText(body.problem, DEBATE_PROBLEM_MAX);
        if (!hostCaptureId || !visibility) return refuse("invalid_participants");
        if (action === "candidates") {
            // The model's picks first (SERVER.md "Candidate suggestions"); its refusals are the RPC's.
            const suggested = await invokeAuthenticatedSupabaseFunctionResponse("generate-applied-insight", {
                mode: "debate_candidates",
                debate_candidates: {host_capture_id: hostCaptureId, visibility, problem}
            }).catch(() => null);
            if (suggested?.ok && suggested.payload?.ok === true) {
                const candidates = decodeDebateCandidates(suggested.payload.candidates).filter((candidate) => candidate.captureId !== hostCaptureId);
                return NextResponse.json({ok: true, candidates: await withCandidateSlugs(candidates), fitsBy: suggested.payload.fits_by ?? "model"});
            }
            const refused = typeof suggested?.payload?.error === "string" ? suggested.payload.error : null;
            if (refused && ["debates_off", "capture_not_found", "power_not_earned", "no_hearts", "invalid_visibility"].includes(refused)) {
                return failed("debate_candidates", refused);
            }
            const {data, error} = await supabase.rpc("debate_candidates_v1", {
                p_host_capture_id: hostCaptureId,
                p_visibility: visibility,
                p_problem: problem
            });
            if (error) return failed("debate_candidates_v1", error.message);
            // The host is never its own candidate.
            const candidates = decodeDebateCandidates(data).filter((candidate) => candidate.captureId !== hostCaptureId);
            return NextResponse.json({ok: true, candidates: await withCandidateSlugs(candidates), fitsBy: "keywords"});
        }
        const captureIds = Array.from(new Set(
            (Array.isArray(body.captureIds) ? body.captureIds : []).map(debateUuid).filter((id): id is string => id !== null && id !== hostCaptureId)
        ));
        if (captureIds.length < DEBATE_MIN_PICKS || captureIds.length > DEBATE_MAX_PICKS) return refuse("invalid_participants");
        if (!problem) return refuse("invalid_participants");
        const {data, error} = await supabase.rpc("create_debate_v1", {
            p_host_capture_id: hostCaptureId,
            p_visibility: visibility,
            p_problem: problem,
            p_capture_ids: captureIds
        });
        if (error) return failed("create_debate_v1", error.message);
        const debate = decodeDebate(data);
        return debate ? NextResponse.json({ok: true, debate}) : failed("create_debate_v1", "no debate returned");
    }

    if (action === "approve") {
        const debateId = debateUuid(body.debateId);
        const text = problemText(body.problemPublic, DEBATE_PUBLIC_TEXT_MAX + 1);
        if (!debateId) return refuse("not_found");
        if (!text) return refuse("invalid_participants");
        if (text.length > DEBATE_PUBLIC_TEXT_MAX) return refuse("text_too_long");
        const {data, error} = await supabase.rpc("approve_public_debate_v1", {p_debate_id: debateId, p_problem_public: text});
        if (error) return failed("approve_public_debate_v1", error.message);
        return NextResponse.json({ok: true, debate: decodeDebate(data)});
    }

    if (action === "cancel") {
        const debateId = debateUuid(body.debateId);
        if (!debateId) return refuse("not_found");
        const {data, error} = await supabase.rpc("cancel_debate_v1", {p_debate_id: debateId});
        if (error) return failed("cancel_debate_v1", error.message);
        return NextResponse.json({ok: true, debate: decodeDebate(data)});
    }

    if (action === "vote" || action === "choose") {
        const debateId = debateUuid(body.debateId);
        const participantId = debateUuid(body.participantId);
        if (!debateId || !participantId) return refuse("not_found");
        if (action === "vote") {
            const {data, error} = await supabase.rpc("vote_debate_v1", {p_debate_id: debateId, p_participant_id: participantId});
            if (error) return failed("vote_debate_v1", error.message);
            const row = data && typeof data === "object" ? data as Record<string, unknown> : {};
            if (row.ok === false) return failed("vote_debate_v1", String(row.code ?? row.error ?? ""));
            return NextResponse.json({ok: true, votes: row.votes ?? null, counts: Array.isArray(row.counts) ? row.counts : []});
        }
        const {data, error} = await supabase.rpc("choose_debate_way_v1", {p_debate_id: debateId, p_participant_id: participantId});
        if (error) return failed("choose_debate_way_v1", error.message);
        const choice = decodeDebateWayChoice(data);
        return choice ? NextResponse.json({ok: true, choice}) : failed("choose_debate_way_v1", "no choice returned");
    }

    // MARK: Debates v2

    if (action === "candidatesV2") {
        const hostCaptureId = debateUuid(body.hostCaptureId);
        const problem = problemText(body.problem, DEBATE_PROBLEM_MAX);
        if (!hostCaptureId) return refuse("invalid_participants");
        const exclude = Array.from(new Set((Array.isArray(body.excludeSpecies) ? body.excludeSpecies : []).map(debateUuid).filter((id): id is string => id !== null))).slice(0, 7);
        // The model's picks first (V2 section 2); its refusals are the RPC's.
        const suggested = await invokeAuthenticatedSupabaseFunctionResponse("generate-applied-insight", {
            mode: "debate_candidates",
            debate_candidates: {host_capture_id: hostCaptureId, problem, version: 2, exclude_species: exclude}
        }).catch(() => null);
        if (suggested?.ok && suggested.payload?.ok === true) {
            const candidates = decodeDebateCandidates(suggested.payload.candidates).filter((candidate) => candidate.id !== hostCaptureId);
            return NextResponse.json({ok: true, candidates: await withCandidateSlugs(candidates), fitsBy: suggested.payload.fits_by ?? "model"});
        }
        const refused = typeof suggested?.payload?.error === "string" ? suggested.payload.error : null;
        if (refused && ["debates_off", "capture_not_found", "no_power"].includes(refused)) return failed("debate_candidates", refused);
        const {data, error} = await supabase.rpc("debate_candidates_v2", {p_host_capture_id: hostCaptureId, p_problem: problem, p_exclude: exclude});
        if (error) return failed("debate_candidates_v2", error.message);
        const candidates = decodeDebateCandidates(data).filter((candidate) => candidate.id !== hostCaptureId);
        return NextResponse.json({ok: true, candidates: await withCandidateSlugs(candidates), fitsBy: "keywords"});
    }

    if (action === "createV2") {
        const hostCaptureId = debateUuid(body.hostCaptureId);
        const problem = problemText(body.problem, DEBATE_PROBLEM_MAX);
        const picks = decodeDebatePicks(body.picks).filter((pick) => !("captureId" in pick) || pick.captureId !== hostCaptureId);
        if (!hostCaptureId || !problem || picks.length < DEBATE_MIN_PICKS || picks.length > DEBATE_MAX_PICKS) return refuse("invalid_participants");
        const {data, error} = await supabase.rpc("create_debate_v2", {p_host_capture_id: hostCaptureId, p_problem: problem, p_picks: debatePicksParam(picks)});
        if (error) return failed("create_debate_v2", error.message);
        const debate = decodeDebate(data);
        return debate ? NextResponse.json({ok: true, debate}) : failed("create_debate_v2", "no debate returned");
    }

    if (action === "extend") {
        const debateId = debateUuid(body.debateId);
        const picks = decodeDebatePicks(body.picks);
        if (!debateId) return refuse("not_found");
        if (picks.length < DEBATE_MIN_PICKS) return refuse("invalid_participants");
        const {data, error} = await supabase.rpc("extend_debate_v1", {p_debate_id: debateId, p_picks: debatePicksParam(picks)});
        if (error) return failed("extend_debate_v1", error.message);
        const debate = decodeDebate(data);
        return debate ? NextResponse.json({ok: true, debate}) : failed("extend_debate_v1", "no debate returned");
    }

    if (action === "qualities") {
        const speciesProfileId = debateUuid(body.speciesProfileId);
        if (!speciesProfileId) return refuse("not_found");
        const {data, error} = await supabase.rpc("species_top_qualities", {p_species_profile_id: speciesProfileId, p_limit: 2});
        if (error) return failed("species_top_qualities", error.message);
        return NextResponse.json({ok: true, qualities: decodeDebateQualities(data)});
    }

    if (action === "askPublic" || action === "keepPrivate" || action === "offerCandidates") {
        const debateId = debateUuid(body.debateId);
        if (!debateId) return refuse("not_found");
        if (action === "offerCandidates") {
            const {data, error} = await supabase.rpc("debate_offer_candidates_v1", {p_debate_id: debateId});
            if (error) return failed("debate_offer_candidates_v1", error.message);
            return NextResponse.json({ok: true, candidates: await withCandidateSlugs(decodeDebateCandidates(data))});
        }
        const rpc = action === "askPublic" ? "ask_public_v1" : "keep_debate_private_v1";
        const {data, error} = await supabase.rpc(rpc, {p_debate_id: debateId});
        if (error) return failed(rpc, error.message);
        const debate = decodeDebate(data);
        return debate ? NextResponse.json({ok: true, debate}) : failed(rpc, "no debate returned");
    }

    if (action === "solve") {
        const debateId = debateUuid(body.debateId);
        const account = problemText(body.account, DEBATE_PROBLEM_MAX);
        if (!debateId) return refuse("not_found");
        if (account.length < DEBATE_MIN_SOLUTION) return refuse("solution_too_short");
        const result = await debateFlow("debate_solution", debateId, {account, language_name: askLanguageName(body.locale)});
        if (!result.ok) return result.response;
        const solution = decodeDebateSolution(result.payload);
        return solution ? NextResponse.json({ok: true, solution}) : failed("debate_solution", "no solution returned");
    }

    if (action === "postPublic") {
        const debateId = debateUuid(body.debateId);
        const text = problemText(body.text, DEBATE_PUBLIC_TEXT_MAX + 1);
        if (!debateId) return refuse("not_found");
        if (text.length < DEBATE_MIN_SOLUTION) return refuse("problem_too_short");
        if (text.length > DEBATE_PUBLIC_TEXT_MAX) return refuse("text_too_long");
        const result = await debateFlow("debate_post_public", debateId, {public_text: text});
        if (!result.ok) return result.response;
        const debate = decodeDebate(result.payload.debate);
        return debate ? NextResponse.json({ok: true, debate}) : failed("debate_post_public", "no debate returned");
    }

    if (action === "offerAnimal") {
        const debateId = debateUuid(body.debateId);
        const captureId = debateUuid(body.captureId);
        if (!debateId || !captureId) return refuse("not_found");
        const result = await debateFlow("debate_offer_animal", debateId, {capture_id: captureId, language_name: askLanguageName(body.locale)});
        if (!result.ok) return result.response;
        const debate = decodeDebate(result.payload.debate);
        return debate ? NextResponse.json({ok: true, debate}) : failed("debate_offer_animal", "no debate returned");
    }

    if (action === "roster") {
        if (typeof body.optedIn !== "boolean") return refuse("invalid_participants");
        const {data, error} = await supabase.rpc("set_debate_roster_v1", {p_opted_in: body.optedIn});
        if (error) return failed("set_debate_roster_v1", error.message);
        const row = data && typeof data === "object" ? data as Record<string, unknown> : null;
        return NextResponse.json({ok: true, optedIn: typeof data === "boolean" ? data : row && "opted_in" in row ? row.opted_in === true : body.optedIn});
    }

    return refuse("debate_unavailable");
}
