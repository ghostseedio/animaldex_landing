import {NextRequest, NextResponse} from "next/server";
import {getNotificationsPage} from "@/data/notifications";
import {parseNotificationFilter} from "@/lib/notification-presentation";

/** A page of notifications in one of iOS's three buckets (`?filter=all|important|following&offset=`). */
export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const offset = Number.parseInt(params.get("offset") ?? "0", 10);
    const result = await getNotificationsPage(parseNotificationFilter(params.get("filter")), Number.isFinite(offset) ? offset : 0);
    return result.ok
        ? NextResponse.json(result.value)
        : NextResponse.json({error: "notifications_unavailable"}, {status: result.status});
}

export const dynamic = "force-dynamic";
