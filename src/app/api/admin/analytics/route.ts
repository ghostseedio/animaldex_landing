import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { resolveAdminActor } from "@/lib/support-admin-auth";
import { getSupabaseHeaders } from "@/lib/supabase-http";
import { config } from "@/app/api/admin/growth/_lib/rows";
import { loadSearchPages } from "@/app/api/admin/growth/_lib/search-console";
import {
  addDays,
  buildAnalyticsReport,
  dayKeyOf,
  daysBetween,
  defaultGrain,
  isDayKey,
  previousRange,
  type Grain,
  type PlatformFilter,
} from "@/lib/product-analytics";
import { buildContentReport } from "@/lib/content-analytics";
import { loadAnalytics } from "./_lib/load";
import { loadContent } from "./_lib/content";

const MAX_RANGE_DAYS = 731;

function parseRange(params: URLSearchParams, today: string) {
  const requestedTo = params.get("to");
  const requestedFrom = params.get("from");
  let to = isDayKey(requestedTo) && requestedTo <= today ? requestedTo : today;
  let from = isDayKey(requestedFrom) ? requestedFrom : addDays(to, -29);
  if (from > to) [from, to] = [to, from];
  if (daysBetween(from, to) >= MAX_RANGE_DAYS) from = addDays(to, -(MAX_RANGE_DAYS - 1));
  const grainParam = params.get("grain");
  const grain: Grain = grainParam === "day" || grainParam === "week" || grainParam === "month" ? grainParam : defaultGrain(from, to);
  const platformParam = params.get("platform");
  const platform: PlatformFilter =
    platformParam === "ios" || platformParam === "android" || platformParam === "web" || platformParam === "unknown" ? platformParam : "all";
  return { from, to, grain, platform };
}

export async function GET(request: NextRequest) {
  const actor = await resolveAdminActor(cookies());
  if (!actor.authorized) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  try {
    const today = dayKeyOf(Date.now());
    const range = parseRange(request.nextUrl.searchParams, today);
    const previous = previousRange(range.from, range.to);
    // Release markers compare the week before; the earliest of those decides how far back to read.
    const since = addDays(previous.from, -7);
    const [data, content, search, searchPrevious] = await Promise.all([
      loadAnalytics(since, today),
      loadContent(range.from),
      loadSearchPages(range.from, range.to, 1000),
      loadSearchPages(previous.from, previous.to, 1000),
    ]);
    const report = buildAnalyticsReport(data, range);
    const contentReport = buildContentReport({
      from: range.from,
      to: range.to,
      grain: range.grain,
      ...content,
      search: new Map(search.pages.map((row) => [row.page, row])),
      searchConnected: !search.note,
      signups: data.users.map((user) => ({ createdAt: user.createdAt, channelKey: user.channel.key, landing: user.landing })),
    });
    const previousClicks = new Map(searchPrevious.pages.map((row) => [row.page, row.clicks]));
    return NextResponse.json({
      ok: true,
      today,
      generatedAt: new Date().toISOString(),
      ...report,
      coverage: data.coverage,
      versions: data.versions,
      push: data.push,
      annotations: data.annotations,
      search: {
        pages: search.pages.slice(0, 25).map((row) => ({ ...row, previousClicks: previousClicks.get(row.page) ?? 0 })),
        totals: search.totals,
        previousTotals: searchPrevious.totals,
        note: search.note ?? null,
      },
      content: contentReport,
      notes: data.notes,
    });
  } catch (error) {
    console.error("[admin-analytics]", error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Unable to load analytics" }, { status: 500 });
  }
}

/** Adds a chart marker: a website launch, a campaign, anything worth lining up against the numbers. */
export async function POST(request: NextRequest) {
  const actor = await resolveAdminActor(cookies());
  if (!actor.authorized) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { day?: string; platform?: string | null; label?: string } | null;
  const label = body?.label?.trim() ?? "";
  const platform = body?.platform === "ios" || body?.platform === "android" || body?.platform === "web" ? body.platform : null;
  if (!isDayKey(body?.day) || !label || label.length > 120) {
    return NextResponse.json({ ok: false, error: "A day and a label (up to 120 characters) are required." }, { status: 400 });
  }
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/analytics_annotations`, {
    method: "POST",
    headers: getSupabaseHeaders(key, { "Content-Type": "application/json", Prefer: "return=representation" }),
    body: JSON.stringify({ day: body!.day, platform, label, created_by: actor.email ?? actor.kind }),
    cache: "no-store",
  });
  if (!response.ok) return NextResponse.json({ ok: false, error: `Saving the marker failed (${response.status}): ${await response.text()}` }, { status: 500 });
  return NextResponse.json({ ok: true, annotation: (await response.json())[0] ?? null });
}

export async function DELETE(request: NextRequest) {
  const actor = await resolveAdminActor(cookies());
  if (!actor.authorized) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const id = request.nextUrl.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ ok: false, error: "Unknown marker" }, { status: 400 });
  const { url, key } = config();
  const response = await fetch(`${url}/rest/v1/analytics_annotations?id=eq.${id}`, {
    method: "DELETE",
    headers: getSupabaseHeaders(key, { Prefer: "return=minimal" }),
    cache: "no-store",
  });
  if (!response.ok) return NextResponse.json({ ok: false, error: `Removing the marker failed (${response.status})` }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
