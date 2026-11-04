import "server-only";
import { fetchRows, isMissingColumnError, isMissingTableError } from "@/app/api/admin/growth/_lib/rows";
import { loadPurchaseLedger } from "@/app/api/admin/growth/_lib/queries";
import {
  classifyAcquisition,
  classifyPurchaseStore,
  estimatedUsdByProduct,
  inferUserPlatform,
  type UserGrowthRow,
} from "@/lib/growth-attribution";
import {
  addDays,
  dayKeyOf,
  dayStartMs,
  type ActivityEvent,
  type ActivityKind,
  type AnalyticsInput,
  type AnalyticsUser,
  type Platform,
  type Purchase,
  type Release,
} from "@/lib/product-analytics";

/**
 * Loads every row /admin/metrics needs, from `since` (a Jakarta day) to now.
 * Each source degrades on its own: a table the migration hasn't created yet
 * leaves a note instead of failing the page.
 */

const GROWTH_COLUMNS =
  "user_id,created_at,first_reported_platform,first_reported_at,reported_platforms,has_apns_token,has_app_store_purchase,has_play_purchase,auth_providers,self_reported_source,self_reported_detail,utm_source,utm_medium,utm_campaign,gclid,apple_ads_attributed";
const FIRST_TOUCH_COLUMNS = ",utm_content,landing_path,referrer_host";

async function optional<T>(table: string, query: string, notes: string[], note: string): Promise<T[] | null> {
  try {
    return await fetchRows<T>(table, query);
  } catch (error) {
    if (isMissingTableError(error, table)) {
      notes.push(note);
      return null;
    }
    throw error;
  }
}

async function loadGrowthRows(notes: string[]) {
  try {
    return await fetchRows<UserGrowthRow>("admin_user_growth_v1", `select=${GROWTH_COLUMNS}${FIRST_TOUCH_COLUMNS}&order=created_at.asc`);
  } catch (error) {
    if (!isMissingColumnError(error, "landing_path") && !isMissingColumnError(error, "utm_content")) throw error;
    notes.push("Web landing pages appear once the product analytics migration (20261104120000) is applied.");
    return fetchRows<UserGrowthRow>("admin_user_growth_v1", `select=${GROWTH_COLUMNS}&order=created_at.asc`);
  }
}

function decode(value: string | null | undefined) {
  if (!value) return null;
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

/** The website page an account came through: its own first visit, or the page of the Play link it tapped. */
export function landingOf(row: UserGrowthRow) {
  if (row.landing_path) return row.landing_path;
  if (row.utm_source !== "web") return null;
  const content = decode(row.utm_content);
  if (content?.startsWith("/")) return content;
  // Older Play links only named the section ("page_animals") or the button ("home_hero").
  const campaign = decode(row.utm_campaign);
  if (!campaign) return null;
  return campaign.startsWith("page_") ? `/${campaign.slice(5)} (section)` : `${campaign} (button)`;
}

export type LoadedAnalytics = AnalyticsInput & {
  coverage: Partial<Record<ActivityKind, string>>;
  versions: Array<{ platform: Platform; version: string; users: number; activeUsers30d: number }>;
  push: { nativeActive30d: number; optedIn: number; byPlatform: Record<"ios" | "android", { users: number; optedIn: number }> };
  annotations: Array<{ id: string; day: string; platform: Platform | null; label: string }>;
  notes: string[];
};

export async function loadAnalytics(since: string, today: string): Promise<LoadedAnalytics> {
  const notes: string[] = [];
  const sinceIso = new Date(dayStartMs(since)).toISOString();
  const [growthRows, tokens, devices, activityDays, captures, chats, trials, debates, ledger, releaseRows, annotationRows] = await Promise.all([
    loadGrowthRows(notes),
    fetchRows<{ user_id: string; platform: string | null }>("user_push_tokens", "select=user_id,platform"),
    fetchRows<{ user_id: string; platform: string; app_version: string | null; first_seen_at: string; last_seen_at: string }>(
      "user_devices",
      "select=user_id,platform,app_version,first_seen_at,last_seen_at",
    ),
    optional<{ user_id: string; day: string; platform: string }>(
      "user_activity_days",
      `select=user_id,day,platform&day=gte.${since}`,
      notes,
      "Daily app opens are logged once the product analytics migration (20261104120000) is applied. Until then, active users are people who captured, talked, did a Trial or a debate, plus the latest open per device.",
    ),
    fetchRows<{ user_id: string; created_at: string }>(
      "captures",
      `select=user_id,created_at&status=eq.ready&created_at=gte.${encodeURIComponent(sinceIso)}&order=created_at.asc`,
    ),
    optional<{ user_id: string; created_at: string; surface: string | null }>(
      "animal_chat_requests",
      `select=user_id,created_at,surface&created_at=gte.${encodeURIComponent(sinceIso)}`,
      notes,
      "Animal chat requests are not logged on this database.",
    ),
    optional<{ user_id: string; created_at: string; completed_at: string | null }>(
      "user_animal_trials",
      `select=user_id,created_at,completed_at&or=(created_at.gte.${encodeURIComponent(sinceIso)},completed_at.gte.${encodeURIComponent(sinceIso)})`,
      notes,
      "Trials are not on this database.",
    ),
    optional<{ asker_user_id: string; created_at: string }>(
      "debates",
      `select=asker_user_id,created_at&created_at=gte.${encodeURIComponent(sinceIso)}`,
      notes,
      "Debates are not on this database.",
    ),
    loadPurchaseLedger(),
    optional<{ platform: string; version: string; released_at: string; source: string; notes: string | null }>(
      "app_releases",
      "select=platform,version,released_at,source,notes&order=released_at.desc",
      notes,
      "Release markers appear once the product analytics migration (20261104120000) is applied.",
    ),
    optional<{ id: string; day: string; platform: string | null; label: string }>(
      "analytics_annotations",
      "select=id,day,platform,label&order=day.desc",
      notes,
      "",
    ),
  ]);

  // Push tokens carry their platform now; the view's has_apns_token is true for
  // an Android token too, so platform inference uses iOS tokens only.
  const tokenPlatforms = new Map<string, Set<string>>();
  for (const token of tokens) {
    const set = tokenPlatforms.get(token.user_id) ?? new Set<string>();
    set.add(token.platform ?? "ios");
    tokenPlatforms.set(token.user_id, set);
  }

  const users: AnalyticsUser[] = growthRows.map((row) => {
    const { platform } = inferUserPlatform({ ...row, has_apns_token: tokenPlatforms.get(row.user_id)?.has("ios") ?? false });
    const channel = classifyAcquisition(row);
    return {
      id: row.user_id,
      createdAt: row.created_at,
      platform,
      channel: { key: channel.key, label: channel.label, kind: channel.kind, evidence: channel.evidence },
      landing: landingOf(row),
      pushOptIn: tokenPlatforms.has(row.user_id),
    };
  });
  const platformOf = new Map(users.map((user) => [user.id, user.platform]));
  const native = (userId: string): Platform | null => {
    const platform = platformOf.get(userId);
    return platform === "ios" || platform === "android" ? platform : null;
  };
  const asPlatform = (value: string | null | undefined): Platform | null =>
    value === "ios" || value === "android" || value === "web" ? value : null;

  const events: ActivityEvent[] = [];
  const push = (userId: string, kind: ActivityKind, time: string | null, day: string | null, platform: Platform | null) => {
    if (!userId) return;
    const at = time ? Date.parse(time) : null;
    const key = day ?? (at != null ? dayKeyOf(at) : null);
    if (!key || key < since) return;
    events.push({ userId, kind, day: key, at, platform });
  };
  for (const row of activityDays ?? []) push(row.user_id, "open", null, row.day, asPlatform(row.platform));
  // The device table holds each account's first and latest open; that keeps
  // the open signal alive before the daily log exists (and fills its start).
  for (const row of devices) {
    push(row.user_id, "open", null, dayKeyOf(row.first_seen_at), asPlatform(row.platform));
    push(row.user_id, "open", null, dayKeyOf(row.last_seen_at), asPlatform(row.platform));
  }
  for (const row of captures) push(row.user_id, "capture", row.created_at, null, null);
  for (const row of chats ?? []) push(row.user_id, "talk", row.created_at, null, row.surface === "web" ? "web" : native(row.user_id));
  for (const row of trials ?? []) {
    push(row.user_id, "trial", row.created_at, null, null);
    if (row.completed_at) push(row.user_id, "trial", row.completed_at, null, null);
  }
  for (const row of debates ?? []) push(row.asker_user_id, "debate", row.created_at, null, null);

  const coverage: LoadedAnalytics["coverage"] = {};
  for (const event of events) {
    const first = coverage[event.kind];
    if (!first || event.day < first) coverage[event.kind] = event.day;
  }

  const purchases: Purchase[] = ledger.flatMap((row) => {
    const store = classifyPurchaseStore(row);
    if (store === "test") return [];
    return [
      {
        userId: row.userId,
        createdAt: row.createdAt,
        store,
        usd: estimatedUsdByProduct[row.productCode ?? ""] ?? 0,
        pro: row.productCode === "pro_upgrade",
      },
    ];
  });

  const releases: Release[] = [
    ...(releaseRows ?? []).flatMap((row) => {
      const platform = asPlatform(row.platform);
      return platform
        ? [{ platform, version: row.version, day: dayKeyOf(row.released_at), source: row.source === "build" ? ("build" as const) : ("store" as const), label: row.notes }]
        : [];
    }),
    ...(annotationRows ?? []).map((row) => ({
      platform: asPlatform(row.platform) ?? ("unknown" as const),
      version: "",
      day: row.day,
      source: "note" as const,
      label: row.label,
    })),
  ];

  const recent = addDays(today, -29);
  const versionMap = new Map<string, { platform: Platform; version: string; users: number; activeUsers30d: number }>();
  const pushStats = { nativeActive30d: 0, optedIn: 0, byPlatform: { ios: { users: 0, optedIn: 0 }, android: { users: 0, optedIn: 0 } } };
  for (const row of devices) {
    const platform = row.platform;
    if (platform !== "ios" && platform !== "android") continue;
    const version = row.app_version ?? "unknown";
    const key = `${platform}|${version}`;
    const entry = versionMap.get(key) ?? { platform, version, users: 0, activeUsers30d: 0 };
    entry.users += 1;
    const active = dayKeyOf(row.last_seen_at) >= recent;
    if (active) entry.activeUsers30d += 1;
    versionMap.set(key, entry);
    if (active) {
      const optedIn = tokenPlatforms.get(row.user_id)?.has(platform) ?? false;
      pushStats.nativeActive30d += 1;
      pushStats.byPlatform[platform].users += 1;
      if (optedIn) {
        pushStats.optedIn += 1;
        pushStats.byPlatform[platform].optedIn += 1;
      }
    }
  }
  const versionOrder = (version: string) => version.split(".").map((part) => part.padStart(4, "0")).join(".");

  return {
    users,
    events,
    purchases,
    releases,
    today,
    now: Date.now(),
    coverage,
    versions: Array.from(versionMap.values()).sort(
      (a, b) => a.platform.localeCompare(b.platform) || versionOrder(b.version).localeCompare(versionOrder(a.version)),
    ),
    push: pushStats,
    annotations: (annotationRows ?? []).map((row) => ({ id: row.id, day: row.day, platform: asPlatform(row.platform), label: row.label })),
    notes: notes.filter(Boolean),
  };
}
