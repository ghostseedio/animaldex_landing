import {NextRequest, NextResponse} from "next/server";
import {findDirectMessagePeople} from "@/data/direct-messages";

/** The New Message picker: the people the reader follows, or `?q=` (two letters at least). */
export async function GET(request: NextRequest) {
    const result = await findDirectMessagePeople(request.nextUrl.searchParams.get("q") ?? "");
    return result.ok
        ? NextResponse.json(result.value)
        : NextResponse.json({error: result.error}, {status: result.status});
}

export const dynamic = "force-dynamic";
