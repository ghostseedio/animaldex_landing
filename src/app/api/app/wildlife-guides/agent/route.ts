import {NextResponse} from "next/server";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";
import {AGENT_DAILY_LIMIT_MESSAGE, AGENT_UNAVAILABLE_MESSAGE, sanitizeAgentReply, sanitizeAgentTurns} from "@/lib/wildlife-guide-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = {"Cache-Control": "private, no-store"};

/**
 * One turn of Ask AnimalDex for Wildlife Guides: forwards the whole chat so far
 * (oldest first, ending with the author's new message) to the
 * `wildlife-guide-agent` edge function with the signed-in author's session.
 */
export async function POST(request: Request) {
    const body = await request.json().catch(() => null) as {messages?: unknown} | null;
    const messages = sanitizeAgentTurns(body?.messages);
    if (!messages) return NextResponse.json({error: "Ask for a change first."}, {status: 400, headers: NO_STORE});
    try {
        const invoked = await invokeAuthenticatedSupabaseFunctionResponse("wildlife-guide-agent", {messages});
        if (invoked.status === 429) {
            return NextResponse.json({error: AGENT_DAILY_LIMIT_MESSAGE, code: "daily_limit"}, {status: 429, headers: NO_STORE});
        }
        if (!invoked.ok) {
            return NextResponse.json({error: AGENT_UNAVAILABLE_MESSAGE}, {status: 502, headers: NO_STORE});
        }
        return NextResponse.json(sanitizeAgentReply(invoked.payload), {headers: NO_STORE});
    } catch (error) {
        const signedOut = error instanceof Error && /Authentication required/.test(error.message);
        return NextResponse.json(
            {error: signedOut ? "Sign in to edit your guides." : AGENT_UNAVAILABLE_MESSAGE},
            {status: signedOut ? 401 : 503, headers: NO_STORE}
        );
    }
}
