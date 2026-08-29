import {NextRequest, NextResponse} from "next/server";
import {resolveAdminActor} from "@/lib/support-admin-auth";

export async function GET(request: NextRequest) {
    const actor = await resolveAdminActor(request.cookies);
    return NextResponse.json({
        ok: true,
        isAdmin: actor.authorized,
        actor: {
            kind: actor.kind,
            email: actor.email,
            canActAsFinanceActor: actor.canActAsFinanceActor
        }
    }, {
        headers: {"Cache-Control": "private, no-store"}
    });
}

export const dynamic = "force-dynamic";
