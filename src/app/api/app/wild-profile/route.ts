import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {
    WildProfileInterviewError,
    fetchNextWildProfileQuestion,
    fetchOpenWildProfileSession,
    generateWildProfile,
    isUuid,
    resetWildProfileSessions,
    saveWildProfileAnswer,
    startWildProfileSession
} from "@/lib/wild-profile-interview";
import type {WildProfileInterviewPayload} from "@/lib/wild-profile-interview-types";

export const runtime = "nodejs";
// generate-identity-profile can take minutes (iOS waits 240s plus a 24s poll).
// The self-hosted server has no function time limit, and Next 13.4 rejects a
// `maxDuration` route export at build time, so none is declared here.

function errorResponse(error: unknown) {
    if (error instanceof WildProfileInterviewError) {
        return NextResponse.json({error: error.message}, {status: error.status});
    }
    return NextResponse.json({error: error instanceof Error ? error.message : "Wild Profile is unavailable right now."}, {status: 500});
}

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({error: "Authentication required."}, {status: 401});
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action ?? "load");

    try {
        if (action === "load") {
            const session = await startWildProfileSession(supabase, user.id);
            if (session.status === "generating") {
                return NextResponse.json({session, generating: true, response: null} satisfies WildProfileInterviewPayload);
            }
            const response = await fetchNextWildProfileQuestion(session.id);
            return NextResponse.json({session, generating: false, response} satisfies WildProfileInterviewPayload);
        }

        if (action === "status") {
            const session = await fetchOpenWildProfileSession(supabase, user.id);
            return NextResponse.json({session});
        }

        const sessionId = body.sessionId;
        if (action !== "reset" && !isUuid(sessionId)) {
            return NextResponse.json({error: "Session id is required."}, {status: 400});
        }

        if (action === "answer") {
            if (!isUuid(body.questionId)) {
                return NextResponse.json({error: "Question id is required."}, {status: 400});
            }
            const skipped = body.skipped === true;
            const freeText = typeof body.freeText === "string" ? body.freeText : null;
            if (!skipped && !freeText?.trim()) {
                return NextResponse.json({error: "Type a short answer."}, {status: 400});
            }
            await saveWildProfileAnswer(supabase, user.id, {sessionId, questionId: body.questionId, freeText, skipped});
            const response = await fetchNextWildProfileQuestion(sessionId);
            return NextResponse.json({response});
        }

        if (action === "generate") {
            await generateWildProfile(supabase, user.id, sessionId);
            return NextResponse.json({ok: true});
        }

        if (action === "reset") {
            await resetWildProfileSessions(supabase, user.id);
            return NextResponse.json({ok: true});
        }

        return NextResponse.json({error: "Unknown action."}, {status: 400});
    } catch (error) {
        return errorResponse(error);
    }
}
