import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addDays,
  bucketStart,
  buildAnalyticsReport,
  buildBuckets,
  dayKeyOf,
  dayStartMs,
  defaultGrain,
  previousRange,
  type ActivityEvent,
  type AnalyticsInput,
  type AnalyticsUser,
} from "./product-analytics";

const at = (day: string, hour = 10) => new Date(dayStartMs(day) + hour * 3_600_000).toISOString();
const user = (id: string, day: string, extra: Partial<AnalyticsUser> = {}): AnalyticsUser => ({
  id,
  createdAt: at(day),
  platform: "ios",
  channel: { key: "said:tiktok", label: "TikTok", kind: "organic" },
  landing: null,
  pushOptIn: false,
  ...extra,
});
const event = (userId: string, kind: ActivityEvent["kind"], day: string, extra: Partial<ActivityEvent> = {}): ActivityEvent => ({
  userId,
  kind,
  day,
  at: kind === "open" ? null : Date.parse(at(day, 12)),
  platform: null,
  ...extra,
});
const input = (partial: Partial<AnalyticsInput>): AnalyticsInput => ({
  users: [],
  events: [],
  purchases: [],
  releases: [],
  today: "2026-11-04",
  now: dayStartMs("2026-11-04") + 9 * 3_600_000,
  ...partial,
});

describe("calendar", () => {
  it("uses Jakarta days", () => {
    // 18:00 UTC is 01:00 the next day in Jakarta.
    assert.equal(dayKeyOf("2026-10-31T18:00:00Z"), "2026-11-01");
    assert.equal(dayKeyOf("2026-10-31T16:59:59Z"), "2026-10-31");
  });

  it("starts weeks on Monday and months on the 1st", () => {
    assert.equal(bucketStart("2026-11-04", "week"), "2026-11-02");
    assert.equal(bucketStart("2026-11-02", "week"), "2026-11-02");
    assert.equal(bucketStart("2026-11-01", "week"), "2026-10-26");
    assert.equal(bucketStart("2026-11-04", "month"), "2026-11-01");
  });

  it("clips buckets to the range and marks the clipped ones partial", () => {
    const buckets = buildBuckets("2026-10-15", "2026-11-04", "month");
    assert.deepEqual(buckets.map((bucket) => [bucket.key, bucket.from, bucket.to, bucket.partial]), [
      ["2026-10-01", "2026-10-15", "2026-10-31", true],
      ["2026-11-01", "2026-11-01", "2026-11-04", true],
    ]);
    assert.equal(buildBuckets("2026-10-01", "2026-10-31", "month")[0].partial, false);
  });

  it("compares against the equally long period before", () => {
    assert.deepEqual(previousRange("2026-10-01", "2026-10-31"), { from: "2026-08-31", to: "2026-09-30" });
    assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  });

  it("picks a readable grain for the span", () => {
    assert.equal(defaultGrain("2026-10-06", "2026-11-04"), "day");
    assert.equal(defaultGrain("2026-08-06", "2026-11-04"), "week");
    assert.equal(defaultGrain("2026-01-01", "2026-11-04"), "month");
  });
});

describe("signup cohorts", () => {
  const users = [
    user("a", "2026-10-01"),
    user("b", "2026-10-01", { platform: "android", pushOptIn: true }),
    user("c", "2026-10-01", { platform: "web" }),
  ];
  const events = [
    event("a", "capture", "2026-10-01"),
    event("a", "open", "2026-10-02"),
    event("a", "talk", "2026-10-08"),
    // b opens the app but never does a core action: not activated.
    event("b", "open", "2026-10-01"),
    event("b", "open", "2026-10-02"),
  ];
  const report = buildAnalyticsReport(input({ users, events }), { from: "2026-10-01", to: "2026-10-31", grain: "week", platform: "all" });
  const signups = report.current.signups;

  it("counts activation as a core action within 24h, not an app open", () => {
    assert.equal(signups.activation.users, 1);
    assert.equal(signups.activation.eligible, 3);
  });

  it("counts D1 and D7 as any activity on that calendar day", () => {
    assert.equal(signups.d1.users, 2);
    assert.equal(signups.d7.users, 1);
    assert.equal(signups.d7.rate, 33.3);
  });

  it("only counts push opt-in among app users", () => {
    assert.equal(signups.pushOptIn.eligible, 2);
    assert.equal(signups.pushOptIn.users, 1);
  });

  it("filters by platform", () => {
    const android = buildAnalyticsReport(input({ users, events }), { from: "2026-10-01", to: "2026-10-31", grain: "week", platform: "android" });
    assert.equal(android.current.signups.users, 1);
    assert.equal(android.current.signups.d1.users, 1);
    assert.equal(android.current.signups.activation.users, 0);
  });

  it("leaves days that have not finished out of retention", () => {
    const fresh = buildAnalyticsReport(input({ users: [user("n", "2026-11-03")], events: [event("n", "capture", "2026-11-04")] }), {
      from: "2026-11-01",
      to: "2026-11-04",
      grain: "day",
      platform: "all",
    });
    assert.equal(fresh.current.signups.d1.eligible, 0);
    assert.equal(fresh.current.signups.d1.rate, null);
  });
});

describe("activity", () => {
  const users = [user("a", "2026-09-01"), user("b", "2026-10-05", { platform: "android" })];
  const events = [
    event("a", "talk", "2026-10-05"),
    event("a", "talk", "2026-10-05"),
    event("a", "capture", "2026-10-06"),
    event("b", "capture", "2026-10-05"),
    event("b", "open", "2026-10-06"),
  ];
  const report = buildAnalyticsReport(input({ users, events }), { from: "2026-10-05", to: "2026-10-06", grain: "day", platform: "all" });

  it("counts distinct active users, the average DAU and returning users", () => {
    assert.equal(report.current.activity.activeUsers, 2);
    assert.equal(report.current.activity.avgDau, 2);
    assert.equal(report.current.activity.returningUsers, 1);
  });

  it("measures how many active users talked and captured", () => {
    assert.equal(report.current.activity.reach.talk.rate, 50);
    assert.equal(report.current.activity.reach.capture.rate, 100);
    assert.equal(report.current.activity.counts.talk, 2);
  });

  it("gives one row per bucket", () => {
    assert.deepEqual(report.series.map((row) => [row.key, row.activity.activeUsers]), [
      ["2026-10-05", 2],
      ["2026-10-06", 2],
    ]);
  });
});

describe("data coverage", () => {
  it("reports talk metrics as unknown before talk logging started, not as 0%", () => {
    const users = [user("a", "2026-10-01"), user("b", "2026-10-20")];
    const events = [event("a", "capture", "2026-10-02"), event("b", "talk", "2026-10-21")];
    const before = buildAnalyticsReport(input({ users, events, coverage: { talk: "2026-10-15", capture: "2026-04-02", open: "2026-09-20" } }), {
      from: "2026-10-01",
      to: "2026-10-07",
      grain: "day",
      platform: "all",
    });
    assert.equal(before.current.activity.reach.talk.rate, null);
    assert.equal(before.current.signups.talkedWeek1.rate, null);
    const after = buildAnalyticsReport(input({ users, events, coverage: { talk: "2026-10-15", capture: "2026-04-02", open: "2026-09-20" } }), {
      from: "2026-10-15",
      to: "2026-10-31",
      grain: "week",
      platform: "all",
    });
    assert.equal(after.current.signups.talkedWeek1.rate, 100);
    assert.equal(after.current.activity.reach.talk.rate, 100);
  });

  it("leaves the capture rate unknown before app opens were logged: every active user would be a capturer", () => {
    const users = [user("a", "2026-08-01")];
    const report = buildAnalyticsReport(input({ users, events: [event("a", "capture", "2026-08-02")], coverage: { capture: "2026-04-02", open: "2026-09-20" } }), {
      from: "2026-08-01",
      to: "2026-08-31",
      grain: "month",
      platform: "all",
    });
    assert.equal(report.current.activity.reach.capture.rate, null);
  });
});

describe("groups and releases", () => {
  const users = [
    user("a", "2026-10-20", { landing: "/animals/red-fox" }),
    user("b", "2026-10-21", { landing: "/animals/red-fox", platform: "android", channel: { key: "play_store", label: "Google Play search", kind: "organic" } }),
    user("c", "2026-10-28"),
  ];
  const events = [event("c", "capture", "2026-10-28")];
  const report = buildAnalyticsReport(
    input({ users, events, releases: [{ platform: "ios", version: "3.1.0", day: "2026-10-27", source: "store" }] }),
    { from: "2026-10-01", to: "2026-10-31", grain: "week", platform: "all" },
  );

  it("groups signups by landing page", () => {
    assert.equal(report.landingPages[0].label, "/animals/red-fox");
    assert.equal(report.landingPages[0].users, 2);
  });

  it("splits channels by platform", () => {
    assert.deepEqual(report.channels.map((row) => [row.label, row.platform, row.users]), [
      ["TikTok", "ios", 2],
      ["Google Play search", "android", 1],
    ]);
  });

  it("compares the week before a release with the week after, on that platform", () => {
    const [release] = report.releases;
    assert.equal(release.before.users, 1);
    assert.equal(release.after.users, 1);
    assert.equal(release.after.activation.rate, 100);
  });

  it("totals revenue by store", () => {
    const paid = buildAnalyticsReport(
      input({ users, purchases: [{ userId: "a", createdAt: at("2026-10-22"), store: "app_store", usd: 9.99, pro: true }] }),
      { from: "2026-10-01", to: "2026-10-31", grain: "month", platform: "all" },
    );
    assert.equal(paid.current.revenue.usd, 9.99);
    assert.equal(paid.current.revenue.newPayers, 1);
    assert.equal(paid.current.signups.payers.users, 1);
  });
});
