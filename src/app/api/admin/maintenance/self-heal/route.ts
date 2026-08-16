import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * The repairs that are safe to run unattended, in one call.
 *
 * Both of these only ever write down something already true, which is what makes
 * them safe to schedule:
 *
 *   relink   points an analysis at the entry it already resolves to. The target
 *            is the entry holding that number, so it cannot move a capture
 *            between entries — and without it, duplicate merging refuses to
 *            consider the capture at all.
 *   sweep    folds captures sharing an owner and an AnimalDex number, using the
 *            database's own pairing rule and its own eligibility check.
 *
 * Burst merging is deliberately excluded. It rests on a judgement — that photos
 * taken seconds apart with the same name are one animal — and judgements should
 * not run while nobody is watching. It stays a reviewed action in the panel.
 *
 * Authorised either by an operator session or by CRON_SECRET, so a scheduler can
 * call it without holding an admin cookie.
 */

const STEPS = ["relink", "sweep"] as const;

function authorized(request: NextRequest) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret) return false;

    const header = request.headers.get("authorization")?.trim() ?? "";
    return header === `Bearer ${secret}`;
}

async function callSelf(request: NextRequest, path: string, init: RequestInit) {
    const url = new URL(path, request.nextUrl.origin);
    const response = await fetch(url, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            // Carries the caller's own authorisation forward; this route never
            // mints credentials of its own.
            cookie: request.headers.get("cookie") ?? "",
            ...(init.headers as Record<string, string> ?? {})
        },
        cache: "no-store"
    });

    const body = await response.json().catch(() => ({}));
    return {ok: response.ok && body?.ok !== false, body};
}

export async function POST(request: NextRequest) {
    const isOperator = await isSupportAdminRequestAuthorized(request);

    if (!isOperator && !authorized(request)) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const days = Math.min(365, Math.max(1, Number(request.nextUrl.searchParams.get("days")) || 30));
    const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
    const results: Record<string, unknown> = {};

    // A scheduler needs to know what would happen before it is trusted to let it
    // happen, so the same endpoint reports without writing.
    if (dryRun) {
        const relink = await callSelf(request, "/api/admin/catalog/relink", {method: "GET"});
        const sweep = await callSelf(request, `/api/admin/maintenance/duplicate-sweep?days=${days}`, {method: "GET"});

        return NextResponse.json({
            ok: true,
            dryRun: true,
            days,
            relinkable: relink.body?.relinkable ?? null,
            mergeable: sweep.body?.captures ?? null,
            members: sweep.body?.members ?? null
        });
    }

    for (const step of STEPS) {
        if (step === "relink") {
            const {ok, body} = await callSelf(request, "/api/admin/catalog/relink", {
                method: "POST",
                body: JSON.stringify({confirm: true})
            });
            results.relink = ok
                ? {linked: body?.captures ?? 0, failed: body?.failed ?? 0}
                : {error: body?.error ?? "relink failed"};
        }

        if (step === "sweep") {
            const {ok, body} = await callSelf(request, "/api/admin/maintenance/duplicate-sweep", {
                method: "POST",
                body: JSON.stringify({confirm: true, days})
            });
            results.sweep = ok
                ? {merged: body?.merged ?? 0, failed: body?.failed ?? 0}
                : {error: body?.error ?? "sweep failed"};
        }
    }

    return NextResponse.json({ok: true, days, ...results, ranAt: new Date().toISOString()});
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
