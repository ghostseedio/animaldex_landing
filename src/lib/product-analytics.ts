/**
 * Product analytics for /admin/metrics: signups, activation, D1/D7/D30
 * retention, active users, what active users do, push opt-in and revenue,
 * for any date range at day, week or month grain, against the period before.
 *
 * Pure: the API route loads rows and hands them over, so every number here is
 * testable without Supabase. Days are Asia/Jakarta calendar days (UTC+7, no
 * daylight saving), the same calendar the rest of the growth admin uses.
 */

export type Platform = "ios" | "android" | "web" | "unknown";
export const analyticsPlatforms: Platform[] = ["ios", "android", "web", "unknown"];
export type PlatformFilter = "all" | Platform;
export type Grain = "day" | "week" | "month";

/** What counts as someone using AnimalDex on a day. "open" is an app or web-app visit. */
export type ActivityKind = "open" | "capture" | "talk" | "trial" | "debate";
export const activityKinds: ActivityKind[] = ["open", "capture", "talk", "trial", "debate"];
/** The actions that make a new user "activated". Opening the app is not one. */
export const coreActions: ActivityKind[] = ["capture", "talk", "trial", "debate"];

export type AnalyticsUser = {
  id: string;
  createdAt: string;
  platform: Platform;
  channel: { key: string; label: string; kind: "paid" | "organic" | "unknown"; evidence?: "store" | "self_reported" | "none" };
  /** The website page (or Play link placement) the account first came through. */
  landing: string | null;
  pushOptIn: boolean;
};

export type ActivityEvent = {
  userId: string;
  kind: ActivityKind;
  /** Jakarta day of the activity. */
  day: string;
  /** Exact time when the source has one (app opens are logged per day only). */
  at: number | null;
  platform: Platform | null;
};

export type Purchase = {
  userId: string;
  createdAt: string;
  store: "app_store" | "google_play" | "web" | "unknown";
  usd: number;
  pro: boolean;
};

export type Release = {
  platform: Platform;
  version: string;
  day: string;
  /** "store" when the first user on the version reported it; "build" for a version bump in the repo; "note" for a hand-added marker. */
  source: "store" | "build" | "note";
  label?: string | null;
};

const DAY_MS = 86_400_000;
const JAKARTA_OFFSET_MS = 7 * 3_600_000;

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export function dayKeyOf(time: number | string | Date) {
  const ms = typeof time === "number" ? time : new Date(time).getTime();
  return new Date(ms + JAKARTA_OFFSET_MS).toISOString().slice(0, 10);
}

/** Midnight that starts a Jakarta day, as epoch ms. */
export function dayStartMs(day: string) {
  return Date.parse(`${day}T00:00:00Z`) - JAKARTA_OFFSET_MS;
}

export function addDays(day: string, days: number) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

export function isDayKey(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
}

/** Monday of the week, or the 1st of the month, that holds the day. */
export function bucketStart(day: string, grain: Grain) {
  if (grain === "day") return day;
  if (grain === "month") return `${day.slice(0, 7)}-01`;
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((weekday + 6) % 7));
}

function bucketEnd(start: string, grain: Grain) {
  if (grain === "day") return start;
  if (grain === "week") return addDays(start, 6);
  const [year, month] = start.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export type Bucket = { key: string; from: string; to: string; label: string; partial: boolean };

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function shortDate(day: string) {
  return `${monthNames[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`;
}

export function bucketLabel(start: string, grain: Grain) {
  if (grain === "month") return `${monthNames[Number(start.slice(5, 7)) - 1]} ${start.slice(0, 4)}`;
  if (grain === "week") return `Wk of ${shortDate(start)}`;
  return shortDate(start);
}

/** Buckets covering [from, to], clipped to the range; a clipped one is partial. */
export function buildBuckets(from: string, to: string, grain: Grain): Bucket[] {
  const buckets: Bucket[] = [];
  let start = bucketStart(from, grain);
  while (start <= to) {
    const end = bucketEnd(start, grain);
    const clippedFrom = start < from ? from : start;
    const clippedTo = end > to ? to : end;
    buckets.push({
      key: start,
      from: clippedFrom,
      to: clippedTo,
      label: bucketLabel(start, grain),
      partial: clippedFrom !== start || clippedTo !== end,
    });
    start = addDays(end, 1);
  }
  return buckets;
}

/** The grain that keeps a chart readable: days up to ~5 weeks, weeks up to ~4 months, then months. */
export function defaultGrain(from: string, to: string): Grain {
  const span = daysBetween(from, to) + 1;
  if (span <= 35) return "day";
  if (span <= 120) return "week";
  return "month";
}

/** The equally long period just before [from, to]. */
export function previousRange(from: string, to: string) {
  const span = daysBetween(from, to) + 1;
  return { from: addDays(from, -span), to: addDays(from, -1) };
}

// ---------------------------------------------------------------------------
// Indexes
// ---------------------------------------------------------------------------

type DayActivity = {
  active: Map<string, Platform>;
  kinds: Record<ActivityKind, Set<string>>;
  counts: Record<ActivityKind, number>;
};

export type AnalyticsInput = {
  users: AnalyticsUser[];
  events: ActivityEvent[];
  purchases: Purchase[];
  releases: Release[];
  /** "Today" in Jakarta; days from today on are not complete and never count for retention. */
  today: string;
  now: number;
  /** First day each source has data. Before it a metric is unknown, not zero. */
  coverage?: Partial<Record<ActivityKind, string>>;
};

function emptyKinds<T>(make: () => T) {
  return Object.fromEntries(activityKinds.map((kind) => [kind, make()])) as Record<ActivityKind, T>;
}

export function indexAnalytics(input: AnalyticsInput) {
  const userById = new Map(input.users.map((user) => [user.id, user]));
  const byDay = new Map<string, DayActivity>();
  const daysByUser = new Map<string, Set<string>>();
  const firstCoreAtByUser = new Map<string, number>();
  const coreDaysByUser = new Map<string, Set<string>>();
  const capturesByUser = new Map<string, Array<number | null>>();
  const talkUsers = new Map<string, string[]>();

  for (const event of input.events) {
    const user = userById.get(event.userId);
    if (!user) continue;
    const platform = event.platform ?? user.platform;
    let day = byDay.get(event.day);
    if (!day) {
      day = { active: new Map(), kinds: emptyKinds(() => new Set<string>()), counts: emptyKinds(() => 0) };
      byDay.set(event.day, day);
    }
    // A person active on two platforms in a day counts on the first seen; an
    // app report beats an unknown one.
    const existing = day.active.get(event.userId);
    if (!existing || (existing === "unknown" && platform !== "unknown")) day.active.set(event.userId, platform);
    day.kinds[event.kind].add(event.userId);
    day.counts[event.kind] += 1;

    const days = daysByUser.get(event.userId) ?? new Set<string>();
    days.add(event.day);
    daysByUser.set(event.userId, days);

    if (coreActions.includes(event.kind)) {
      const at = event.at ?? dayStartMs(event.day);
      const first = firstCoreAtByUser.get(event.userId);
      if (first == null || at < first) firstCoreAtByUser.set(event.userId, at);
      const core = coreDaysByUser.get(event.userId) ?? new Set<string>();
      core.add(event.day);
      coreDaysByUser.set(event.userId, core);
    }
    if (event.kind === "capture") {
      const list = capturesByUser.get(event.userId) ?? [];
      list.push(event.at);
      capturesByUser.set(event.userId, list);
    }
    if (event.kind === "talk") {
      const list = talkUsers.get(event.userId) ?? [];
      list.push(event.day);
      talkUsers.set(event.userId, list);
    }
  }

  const purchasesByUser = new Map<string, Purchase[]>();
  for (const purchase of [...input.purchases].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const list = purchasesByUser.get(purchase.userId) ?? [];
    list.push(purchase);
    purchasesByUser.set(purchase.userId, list);
  }
  const firstPurchaseDay = new Map(
    Array.from(purchasesByUser.entries()).map(([userId, list]) => [userId, dayKeyOf(list[0].createdAt)]),
  );

  return { ...input, userById, byDay, daysByUser, firstCoreAtByUser, coreDaysByUser, capturesByUser, talkUsers, purchasesByUser, firstPurchaseDay };
}

export type AnalyticsIndex = ReturnType<typeof indexAnalytics>;

function matches(platform: Platform, filter: PlatformFilter) {
  return filter === "all" || platform === filter;
}

function rate(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

// ---------------------------------------------------------------------------
// Cohorts: what happened to the people who signed up in a window
// ---------------------------------------------------------------------------

export type CohortStats = {
  users: number;
  byPlatform: Record<Platform, number>;
  /** Did a capture, talk, trial or debate within 24h of signup. */
  activation: { rate: number | null; users: number; eligible: number };
  /** Came back (any activity) on the calendar day after signup. */
  d1: { rate: number | null; users: number; eligible: number };
  d7: { rate: number | null; users: number; eligible: number };
  d30: { rate: number | null; users: number; eligible: number };
  /** Talked to an animal in their first 7 days. */
  talkedWeek1: { rate: number | null; users: number; eligible: number };
  capturesWeek1: number | null;
  /** Push token on file now (native users only; the web app has no push). */
  pushOptIn: { rate: number | null; users: number; eligible: number };
  payers: { rate: number | null; users: number };
};

function returnedOn(index: AnalyticsIndex, userId: string, signupDay: string, offset: number) {
  return index.daysByUser.get(userId)?.has(addDays(signupDay, offset)) ?? false;
}

export function cohortStats(index: AnalyticsIndex, users: AnalyticsUser[]): CohortStats {
  const byPlatform = Object.fromEntries(analyticsPlatforms.map((platform) => [platform, 0])) as Record<Platform, number>;
  const counters = { act: [0, 0], d1: [0, 0], d7: [0, 0], d30: [0, 0], talk: [0, 0], push: [0, 0] };
  let payers = 0;
  let week1Captures = 0;
  let week1Eligible = 0;
  for (const user of users) {
    byPlatform[user.platform] += 1;
    const created = Date.parse(user.createdAt);
    const signupDay = dayKeyOf(created);
    if (created + DAY_MS <= index.now) {
      counters.act[1] += 1;
      const first = index.firstCoreAtByUser.get(user.id);
      if (first != null && first - created <= DAY_MS) counters.act[0] += 1;
    }
    for (const [key, offset] of [["d1", 1], ["d7", 7], ["d30", 30]] as const) {
      if (addDays(signupDay, offset) < index.today) {
        counters[key][1] += 1;
        if (returnedOn(index, user.id, signupDay, offset)) counters[key][0] += 1;
      }
    }
    if (addDays(signupDay, 7) <= index.today) {
      week1Eligible += 1;
      const weekEnd = addDays(signupDay, 6);
      const talkFrom = index.coverage?.talk;
      if (talkFrom && signupDay >= talkFrom) {
        counters.talk[1] += 1;
        if ((index.talkUsers.get(user.id) ?? []).some((day) => day >= signupDay && day <= weekEnd)) counters.talk[0] += 1;
      }
      week1Captures += (index.capturesByUser.get(user.id) ?? []).filter(
        (at) => at != null && at >= created && at < created + 7 * DAY_MS,
      ).length;
    }
    if (user.platform === "ios" || user.platform === "android") {
      counters.push[1] += 1;
      if (user.pushOptIn) counters.push[0] += 1;
    }
    if (index.purchasesByUser.has(user.id)) payers += 1;
  }
  const pack = ([hit, eligible]: number[]) => ({ rate: rate(hit, eligible), users: hit, eligible });
  return {
    users: users.length,
    byPlatform,
    activation: pack(counters.act),
    d1: pack(counters.d1),
    d7: pack(counters.d7),
    d30: pack(counters.d30),
    talkedWeek1: pack(counters.talk),
    capturesWeek1: week1Eligible ? Math.round((week1Captures / week1Eligible) * 10) / 10 : null,
    pushOptIn: pack(counters.push),
    payers: { rate: rate(payers, users.length), users: payers },
  };
}

function signupsIn(index: AnalyticsIndex, from: string, to: string, filter: PlatformFilter) {
  return index.users.filter((user) => {
    const day = dayKeyOf(user.createdAt);
    return day >= from && day <= to && matches(user.platform, filter);
  });
}

// ---------------------------------------------------------------------------
// Activity: who used AnimalDex in a window and what they did
// ---------------------------------------------------------------------------

export type ActivityStats = {
  /** Distinct people active in the window (DAU for a day, WAU for a week, MAU for a month). */
  activeUsers: number;
  activeByPlatform: Record<Platform, number>;
  /** Mean daily active users across the window's days. */
  avgDau: number | null;
  /** Avg DAU ÷ active users: how many of the window's days a typical user shows up. */
  stickiness: number | null;
  /** Active users who did not sign up in the window. */
  returningUsers: number;
  /** Share of active users who did each thing at least once. */
  reach: Record<ActivityKind, { users: number; rate: number | null }>;
  /** How many times each thing happened. */
  counts: Record<ActivityKind, number>;
};

export function activityStats(index: AnalyticsIndex, from: string, to: string, filter: PlatformFilter): ActivityStats {
  const users = new Map<string, Platform>();
  const kinds = emptyKinds(() => new Set<string>());
  const counts = emptyKinds(() => 0);
  let dauSum = 0;
  let days = 0;
  // Today counts toward who was active, but not toward the daily average: it
  // isn't over yet.
  for (let day = from; day <= to && day <= index.today; day = addDays(day, 1)) {
    const complete = day < index.today;
    if (complete) days += 1;
    const activity = index.byDay.get(day);
    if (!activity) continue;
    let dau = 0;
    for (const [userId, platform] of Array.from(activity.active)) {
      if (!matches(platform, filter)) continue;
      dau += 1;
      if (!users.has(userId)) users.set(userId, platform);
      for (const kind of activityKinds) if (activity.kinds[kind].has(userId)) kinds[kind].add(userId);
    }
    if (complete) dauSum += dau;
    if (filter === "all") for (const kind of activityKinds) counts[kind] += activity.counts[kind];
  }
  // Event counts per platform need the raw events; only "all" keeps the cheap path.
  if (filter !== "all") {
    for (const event of index.events) {
      if (event.day < from || event.day > to || event.day > index.today) continue;
      const platform = event.platform ?? index.userById.get(event.userId)?.platform ?? "unknown";
      if (matches(platform, filter)) counts[event.kind] += 1;
    }
  }
  const activeByPlatform = Object.fromEntries(analyticsPlatforms.map((platform) => [platform, 0])) as Record<Platform, number>;
  let returning = 0;
  for (const [userId, platform] of Array.from(users)) {
    activeByPlatform[platform] += 1;
    const created = index.userById.get(userId)?.createdAt;
    if (created && dayKeyOf(created) < from) returning += 1;
  }
  const avgDau = days ? Math.round((dauSum / days) * 10) / 10 : null;
  return {
    activeUsers: users.size,
    activeByPlatform,
    avgDau,
    stickiness: avgDau != null && users.size ? Math.round((avgDau / users.size) * 1000) / 10 : null,
    returningUsers: returning,
    // A source that starts after the window has no data for it: unknown, not
    // 0%. And without app opens, the only active users are people who did
    // something, so "captured" would read 100%: also unknown.
    reach: Object.fromEntries(
      activityKinds.map((kind) => {
        const covered = (source: ActivityKind) => {
          const start = index.coverage?.[source];
          return !index.coverage || (start != null && start <= to);
        };
        const known = covered(kind) && (kind === "open" || covered("open"));
        return [kind, { users: kinds[kind].size, rate: known ? rate(kinds[kind].size, users.size) : null }];
      }),
    ) as ActivityStats["reach"],
    counts,
  };
}

// ---------------------------------------------------------------------------
// Revenue
// ---------------------------------------------------------------------------

export type RevenueStats = {
  purchases: number;
  usd: number;
  payers: number;
  newPayers: number;
  pro: number;
  byStore: Record<Purchase["store"], { purchases: number; usd: number }>;
};

export function revenueStats(index: AnalyticsIndex, from: string, to: string, filter: PlatformFilter): RevenueStats {
  const byStore: RevenueStats["byStore"] = {
    app_store: { purchases: 0, usd: 0 },
    google_play: { purchases: 0, usd: 0 },
    web: { purchases: 0, usd: 0 },
    unknown: { purchases: 0, usd: 0 },
  };
  const payers = new Set<string>();
  const newPayers = new Set<string>();
  let usd = 0;
  let purchases = 0;
  let pro = 0;
  const storePlatform: Record<Purchase["store"], Platform> = { app_store: "ios", google_play: "android", web: "web", unknown: "unknown" };
  for (const purchase of index.purchases) {
    const day = dayKeyOf(purchase.createdAt);
    if (day < from || day > to || !matches(storePlatform[purchase.store], filter)) continue;
    purchases += 1;
    usd += purchase.usd;
    if (purchase.pro) pro += 1;
    byStore[purchase.store].purchases += 1;
    byStore[purchase.store].usd += purchase.usd;
    payers.add(purchase.userId);
    if (index.firstPurchaseDay.get(purchase.userId) === day) newPayers.add(purchase.userId);
  }
  const round = (value: number) => Math.round(value * 100) / 100;
  for (const store of Object.values(byStore)) store.usd = round(store.usd);
  return { purchases, usd: round(usd), payers: payers.size, newPayers: newPayers.size, pro, byStore };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export type PeriodSummary = {
  from: string;
  to: string;
  signups: CohortStats;
  activity: ActivityStats;
  revenue: RevenueStats;
};

export function periodSummary(index: AnalyticsIndex, from: string, to: string, filter: PlatformFilter): PeriodSummary {
  return {
    from,
    to,
    signups: cohortStats(index, signupsIn(index, from, to, filter)),
    activity: activityStats(index, from, to, filter),
    revenue: revenueStats(index, from, to, filter),
  };
}

export type GroupRow = { key: string; label: string; platform?: Platform; kind?: string; evidence?: string } & CohortStats;

function groupCohorts(
  index: AnalyticsIndex,
  users: AnalyticsUser[],
  keyOf: (user: AnalyticsUser) => { key: string; label: string; kind?: string; evidence?: string } | null,
  splitPlatform: boolean,
): GroupRow[] {
  const groups = new Map<string, { key: string; label: string; kind?: string; evidence?: string; platform?: Platform; users: AnalyticsUser[] }>();
  for (const user of users) {
    const group = keyOf(user);
    if (!group) continue;
    const id = splitPlatform ? `${group.key}|${user.platform}` : group.key;
    const entry = groups.get(id) ?? { ...group, platform: splitPlatform ? user.platform : undefined, users: [] };
    entry.users.push(user);
    groups.set(id, entry);
  }
  return Array.from(groups.values())
    .map(({ users: members, ...group }) => ({ ...group, ...cohortStats(index, members) }))
    .sort((left, right) => right.users - left.users || left.label.localeCompare(right.label));
}

export type RetentionRow = { cohort: string; label: string; size: number; days: Record<"d1" | "d3" | "d7" | "d14" | "d30", number | null> };

/** Weekly signup cohorts: share who were active N days after signing up. */
export function retentionGrid(index: AnalyticsIndex, from: string, to: string, filter: PlatformFilter): RetentionRow[] {
  const offsets = { d1: 1, d3: 3, d7: 7, d14: 14, d30: 30 } as const;
  return buildBuckets(from, to, "week").map((bucket) => {
    const members = signupsIn(index, bucket.from, bucket.to, filter);
    const days = {} as RetentionRow["days"];
    for (const [key, offset] of Object.entries(offsets) as Array<[keyof typeof offsets, number]>) {
      let hit = 0;
      let eligible = 0;
      for (const user of members) {
        const signupDay = dayKeyOf(user.createdAt);
        if (addDays(signupDay, offset) >= index.today) continue;
        eligible += 1;
        if (returnedOn(index, user.id, signupDay, offset)) hit += 1;
      }
      days[key] = rate(hit, eligible);
    }
    return { cohort: bucket.key, label: bucket.label, size: members.length, days };
  });
}

export type ReleaseImpact = Release & {
  /** Signups in the 7 days before vs the 7 days from the release, on that platform. */
  before: Pick<CohortStats, "users" | "activation" | "d1" | "d7">;
  after: Pick<CohortStats, "users" | "activation" | "d1" | "d7">;
  /** Complete days after the release so far (the "after" window fills over a week). */
  daysAfter: number;
};

export function releaseImpact(index: AnalyticsIndex, releases: Release[]): ReleaseImpact[] {
  const pick = ({ users, activation, d1, d7 }: CohortStats) => ({ users, activation, d1, d7 });
  return releases.map((release) => {
    const filter: PlatformFilter = release.platform === "unknown" ? "all" : release.platform;
    const before = cohortStats(index, signupsIn(index, addDays(release.day, -7), addDays(release.day, -1), filter));
    const after = cohortStats(index, signupsIn(index, release.day, addDays(release.day, 6), filter));
    return { ...release, before: pick(before), after: pick(after), daysAfter: Math.max(0, Math.min(7, daysBetween(release.day, index.today))) };
  });
}

export type AnalyticsReport = {
  range: { from: string; to: string; grain: Grain; platform: PlatformFilter };
  previous: { from: string; to: string };
  current: PeriodSummary;
  prior: PeriodSummary;
  /** The range split by platform, whatever the platform filter. */
  platforms: Record<Platform, PeriodSummary>;
  series: Array<PeriodSummary & { key: string; label: string; partial: boolean }>;
  channels: GroupRow[];
  landingPages: GroupRow[];
  retention: RetentionRow[];
  releases: ReleaseImpact[];
};

export function buildAnalyticsReport(
  input: AnalyticsInput,
  options: { from: string; to: string; grain: Grain; platform: PlatformFilter },
): AnalyticsReport {
  const index = indexAnalytics(input);
  const { from, to, grain, platform } = options;
  const previous = previousRange(from, to);
  const rangeUsers = signupsIn(index, from, to, platform);
  return {
    range: options,
    previous,
    current: periodSummary(index, from, to, platform),
    prior: periodSummary(index, previous.from, previous.to, platform),
    platforms: Object.fromEntries(analyticsPlatforms.map((item) => [item, periodSummary(index, from, to, item)])) as Record<Platform, PeriodSummary>,
    series: buildBuckets(from, to, grain).map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      partial: bucket.partial,
      ...periodSummary(index, bucket.from, bucket.to, platform),
    })),
    channels: groupCohorts(index, rangeUsers, (user) => ({ key: user.channel.key, label: user.channel.label, kind: user.channel.kind, evidence: user.channel.evidence }), true),
    landingPages: groupCohorts(index, rangeUsers, (user) => (user.landing ? { key: user.landing, label: user.landing } : null), false),
    retention: retentionGrid(index, from, to, platform),
    releases: releaseImpact(
      index,
      input.releases
        .filter((release) => release.day >= addDays(from, -7) && release.day <= to)
        .filter((release) => platform === "all" || release.platform === platform || release.platform === "unknown")
        .sort((a, b) => b.day.localeCompare(a.day)),
    ),
  };
}
