import {NextResponse} from "next/server";

/**
 * Report something an animal said (Android 8649e5a; strings iOS f41e3d0d).
 * AI-generated content needs an in-product way to flag offensive output, so
 * every animal reply offers Report.
 *
 * POST {choice, text, animalName, captureId?}. Filed into `moderation_reports`
 * as the signed-in reporter (RLS allows reporter_id = auth.uid()): the animal
 * has no account, so nobody is reported — `content_type` 'other',
 * `reported_user_id` null, `content_id` the card the chat is about, the reason
 * "animal_reply: <choice>" and the snapshot "<animal>: <reply>" cut to 1,500
 * characters, as the Android app files it. Signed-out readers get a 401.
 */

import {ASK_RESPONSE_HEADERS, resolveAskViewer} from "@/lib/ask-animaldex/request";
import {askReplyReport, isAskReportChoice} from "@/lib/ask-animaldex/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const viewer = await resolveAskViewer(request);
    if (!viewer.signedIn || !viewer.client || !viewer.userId) {
        return NextResponse.json({ok: false, error: "sign_in_required"}, {status: 401, headers: ASK_RESPONSE_HEADERS});
    }
    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        body = {};
    }
    const text = typeof body.text === "string" ? body.text : "";
    if (!isAskReportChoice(body.choice) || !text.trim()) {
        return NextResponse.json({ok: false, error: "invalid_report"}, {status: 400, headers: ASK_RESPONSE_HEADERS});
    }
    const report = askReplyReport({
        choice: body.choice,
        animalName: typeof body.animalName === "string" ? body.animalName : "",
        replyText: text,
        captureId: typeof body.captureId === "string" ? body.captureId : null
    });
    const {error} = await viewer.client.from("moderation_reports").insert({
        reporter_id: viewer.userId,
        reported_user_id: null,
        content_type: "other",
        content_id: report.contentId,
        reason: report.reason,
        snapshot: report.snapshot
    });
    if (error) {
        console.warn("[ask-animaldex] report failed", error.message.slice(0, 200));
        return NextResponse.json({ok: false, error: "report_unavailable"}, {status: 502, headers: ASK_RESPONSE_HEADERS});
    }
    return NextResponse.json({ok: true}, {headers: ASK_RESPONSE_HEADERS});
}
