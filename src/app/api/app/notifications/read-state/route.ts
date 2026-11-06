import {NextRequest, NextResponse} from "next/server";
import {setNotificationReadState} from "@/data/notifications";

/** Marks one of the reader's notifications read or unread. */
export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null) as {id?: unknown; read?: unknown} | null;
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    if (!id) return NextResponse.json({error: "invalid_request"}, {status: 400});
    const ok = await setNotificationReadState(id, body?.read !== false);
    return ok ? NextResponse.json({ok: true}) : NextResponse.json({error: "update_failed"}, {status: 400});
}

export const dynamic = "force-dynamic";
