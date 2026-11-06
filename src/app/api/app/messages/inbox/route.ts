import {NextResponse} from "next/server";
import {getDirectMessageInbox} from "@/data/direct-messages";

/** The inbox, as the reader sees it (`direct_message_inbox`): polled while Messages is open, and its Retry. */
export async function GET() {
    const result = await getDirectMessageInbox(40);
    return result.ok
        ? NextResponse.json({inbox: result.value})
        : NextResponse.json({error: result.error}, {status: result.status});
}

export const dynamic = "force-dynamic";
