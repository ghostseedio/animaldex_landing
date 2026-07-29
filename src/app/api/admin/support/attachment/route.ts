import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {getReceivedAttachmentDownloadUrl} from "@/lib/support";

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const emailId = request.nextUrl.searchParams.get("emailId")?.trim();
    const attachmentId = request.nextUrl.searchParams.get("attachmentId")?.trim();

    if (!emailId || !attachmentId) {
        return NextResponse.json({ok: false, error: "Missing attachment"}, {status: 400});
    }

    const downloadUrl = await getReceivedAttachmentDownloadUrl(emailId, attachmentId);

    if (!downloadUrl) {
        return NextResponse.json({ok: false, error: "Attachment was not found"}, {status: 404});
    }

    const response = await fetch(downloadUrl, {cache: "no-store"});

    if (!response.ok || !response.body) {
        return NextResponse.json({ok: false, error: "Unable to load attachment"}, {status: 502});
    }

    return new Response(response.body, {
        headers: {
            "Content-Type": response.headers.get("content-type") || "application/octet-stream",
            "Content-Disposition": response.headers.get("content-disposition") || "inline",
            "Cache-Control": "private, max-age=300"
        }
    });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
