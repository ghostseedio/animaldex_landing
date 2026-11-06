import {NextResponse} from "next/server";
import {getDirectMessageCardChoices} from "@/data/direct-messages";

/** The reader's own animals to send as cards, newest first. */
export async function GET() {
    const result = await getDirectMessageCardChoices();
    return result.ok
        ? NextResponse.json({cards: result.value})
        : NextResponse.json({error: result.error}, {status: result.status});
}

export const dynamic = "force-dynamic";
