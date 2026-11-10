import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveAdminActor } from "@/lib/support-admin-auth";
import { addDays, dayKeyOf, isDayKey } from "@/lib/product-analytics";
import { loadArkMeasure } from "../_lib/ark";

/**
 * GET /api/admin/analytics/ark?from=&to=&testers=1: the Ark tab of
 * /admin/metrics, weekly, from the baseline weeks before the Ark's launch to
 * `to`. Dev testers are left out unless `testers=1`.
 */
export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(cookies());
  if (!actor.authorized) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const today = dayKeyOf(Date.now());
    const params = request.nextUrl.searchParams;
    const requestedTo = params.get("to");
    const requestedFrom = params.get("from");
    const to = isDayKey(requestedTo) && requestedTo <= today ? requestedTo : today;
    const from = isDayKey(requestedFrom) && requestedFrom <= to ? requestedFrom : addDays(to, -29);
    const ark = await loadArkMeasure({ from, to, includeTesters: params.get("testers") === "1" });
    return NextResponse.json({ ok: true, today, generatedAt: new Date().toISOString(), ...ark }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[admin-analytics-ark]", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to load the Ark numbers" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
