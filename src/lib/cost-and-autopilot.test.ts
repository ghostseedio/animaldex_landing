import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {blogLaneOrder, SEARCH_CONSOLE_LANE} from "./blog-generator/auto-generate-plan";
import {isWritableQuery, pickSearchConsoleTopic, searchConsoleFocus, searchConsoleTopicId, type OpportunityQuery} from "./blog-generator/search-console-topics";
import {CONTENT_VIDEO_DAILY_MAX_DEFAULT, contentVideoDailyMax, videosMadeToday} from "./content-video/auto-generate-plan";
import {contentKindOf, DEFAULT_DAILY_CAPS, dayStartMs} from "./social/auto-share-plan";
import {REAL_FOOTAGE_FORMAT, withShareFormat} from "./social/post-format";

// The 16 Nov 2026 cost decisions (change set "CC 4"), pinned: two generated
// videos a day across every format, real uploaded clips kept apart from the
// generated ones on the format board, the blog's topic picker preferring
// Search Console queries, and one article a day.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

// ── Decision 1: videos and carousels ────────────────────────────────────────

test("the autopilot makes at most two videos a day, every format and the admin's manual ones counted together", () => {
    assert.equal(CONTENT_VIDEO_DAILY_MAX_DEFAULT, 2);
    assert.equal(contentVideoDailyMax({}), 2);
    assert.equal(contentVideoDailyMax({CONTENT_VIDEO_DAILY_MAX: "5"}), 5);
    assert.equal(contentVideoDailyMax({CONTENT_VIDEO_DAILY_MAX: "nonsense"}), 2);
    const now = Date.parse("2026-11-16T10:00:00Z");
    const start = new Date(dayStartMs(now)).toISOString();
    assert.equal(start, "2026-11-15T17:00:00.000Z");
    const rows = [
        {status: "ready", created_at: "2026-11-16T01:00:00Z", source_type: "lesson"},
        {status: "rendering", created_at: "2026-11-16T09:00:00Z", source_type: "scan"},
        {status: "failed", created_at: "2026-11-16T08:00:00Z", source_type: "battle"},
        {status: "ready", created_at: "2026-11-15T12:00:00Z", source_type: "guess"}
    ];
    assert.deepEqual(videosMadeToday(rows, now).map((row) => row.source_type), ["lesson", "scan"]);
    const source = read("src/lib/content-video/auto-generate.ts");
    assert.match(source, /const dailyMax = contentVideoDailyMax\(\);/);
    // Counted over every video row, not only the timer's own.
    assert.match(source, /const madeToday = videosMadeToday\(allRows, Date\.now\(\)\)\.length;/);
    assert.match(source, /if \(madeToday >= dailyMax\)/);
});

test("every share path counts every video kind against the same per-platform cap of two, carousels one and only on TikTok", () => {
    for (const kind of ["story_video", "blog_video", "uploaded_video", "hook"]) assert.equal(contentKindOf({media_kind: kind}), "video");
    for (const caps of Object.values(DEFAULT_DAILY_CAPS)) assert.ok(caps.video <= 2 && caps.carousel <= 1);
    assert.equal(DEFAULT_DAILY_CAPS.tiktok.carousel, 1);
    const autoShare = read("src/lib/social/auto-share.ts");
    // The 2-hourly auto-share: videos and light items both go through platformsWithRoom under the pause-applied caps.
    assert.match(autoShare, /const withRoom = platformsWithRoom\(unpaused\.allowed, "video", posts, caps, now\);/);
    assert.match(autoShare, /const withRoom = platformsWithRoom\(ready\.platforms, kind, posts, caps, now\);/);
});

test("an uploaded real clip is stamped real_footage on its share row; page videos carry their plan's format", () => {
    assert.equal(REAL_FOOTAGE_FORMAT, "real_footage");
    assert.deepEqual(withShareFormat(null, "uploaded_video"), {format: "real_footage"});
    assert.deepEqual(withShareFormat({auto: true}, "story_video"), {auto: true, format: "app_story"});
    assert.deepEqual(withShareFormat({link: "x"}, "blog_video", "lesson", "lesson"), {link: "x", format: "lesson"});
    assert.deepEqual(withShareFormat(null, "blog_video", null, "comparison"), {format: "battle"});
    // An existing stamp is kept; an unknown family gets none.
    assert.deepEqual(withShareFormat({format: "guess"}, "uploaded_video"), {format: "guess"});
    assert.equal(withShareFormat(null, "blog_video", null, "mystery"), null);
    assert.match(read("src/app/api/admin/social/posts/route.ts"), /options: withShareFormat\(/);
    assert.match(read("src/lib/social/auto-share.ts"), /options: withShareFormat\(zernioRowOptions\(/);
    assert.match(read("src/lib/social-lab/format-board-server.ts"), /optionsFormat: post\.options\?\.format/);
});

// ── Decision 2: the blog ────────────────────────────────────────────────────

const query = (overrides: Partial<OpportunityQuery> & {query: string}): OpportunityQuery => ({impressions: 400, clicks: 4, position: 9.5, page: "/animals/cheetah", ...overrides});

test("Search Console goes first every day; one article a day", () => {
    for (let day = 0; day < 4; day += 1) assert.equal(blogLaneOrder(day)[0], SEARCH_CONSOLE_LANE);
    assert.deepEqual(blogLaneOrder(0).slice(1), ["radar", "lessons", "search"]);
    const source = read("src/lib/blog-generator/auto-generate.ts");
    assert.match(source, /numberEnv\("BLOG_AUTO_PER_DAY", 1\)/);
    assert.match(source, /\[SEARCH_CONSOLE_LANE\]: writeFromSearchConsole/);
    assert.match(source, /pickSearchConsoleTopic\(queries, await writtenTopics\("gscQuery"\)\)/);
});

test("a Search Console query is written for when it has demand we can win, is not brand, not already a blog post, and passes the policy", () => {
    assert.equal(isWritableQuery(query({query: "how fast can a cheetah run"})), true);
    assert.equal(isWritableQuery(query({query: "cheetah"})), false, "one word");
    assert.equal(isWritableQuery(query({query: "animaldex app review"})), false, "brand");
    assert.equal(isWritableQuery(query({query: "how fast can a cheetah run", impressions: 20})), false, "too few impressions");
    assert.equal(isWritableQuery(query({query: "how fast can a cheetah run", position: 2})), false, "already top 3");
    assert.equal(isWritableQuery(query({query: "how fast can a cheetah run", position: 48})), false, "out of reach");
    assert.equal(isWritableQuery(query({query: "how fast can a cheetah run", page: "/blog/cheetah-speed"})), false, "a post already answers it");
    assert.equal(isWritableQuery(query({query: "how fast can a cheetah run", page: "/id/blog/cheetah-speed"})), false);
    assert.equal(isWritableQuery(query({query: "animal therapy for anxiety"})), false, "clinical");
});

test("the best unwritten query wins: most impressions, then the weakest click-through", () => {
    const rows = [
        query({query: "why do lions roar", impressions: 300, clicks: 30}),
        query({query: "how do bees choose a new home", impressions: 300, clicks: 3}),
        query({query: "how fast can a cheetah run", impressions: 900, clicks: 9}),
        query({query: "animaldex", impressions: 5000, clicks: 400})
    ];
    assert.equal(pickSearchConsoleTopic(rows, new Set())?.query, "how fast can a cheetah run");
    assert.equal(pickSearchConsoleTopic(rows, new Set([searchConsoleTopicId("How fast can a  cheetah run ")]))?.query, "how do bees choose a new home");
    assert.equal(pickSearchConsoleTopic([], new Set()), null);
    const focus = searchConsoleFocus(rows[2]);
    assert.match(focus, /PROBLEM-LED SEARCH PAGE/);
    assert.match(focus, /"how fast can a cheetah run" \(900 impressions, 9 clicks, average position 9\.5/);
    assert.match(focus, /Our page \/animals\/cheetah ranks for it now/);
});

// ── Decision 3: the AI ledger ───────────────────────────────────────────────

test("the monthly cap is $100 with a notice from 80%; over it the notice is red", async () => {
    const {AI_SPEND_MONTHLY_CAP_DEFAULT_USD, AI_SPEND_WARN_RATIO_DEFAULT, monthlyCapNotice, monthlyCapStatus} = await import("./ai-usage-core");
    assert.equal(AI_SPEND_MONTHLY_CAP_DEFAULT_USD, 100);
    assert.equal(AI_SPEND_WARN_RATIO_DEFAULT, 0.8);
    const now = new Date("2026-11-16T12:00:00Z");
    const ok = monthlyCapStatus({capUsd: 100, warnRatio: 0.8, monthToDateUsd: 41.5, now});
    assert.equal(ok.level, "ok");
    assert.equal(ok.month, "2026-11");
    assert.equal(ok.remainingUsd, 58.5);
    // 41.5 over 15.5 days, projected over 30.
    assert.equal(ok.projectedUsd, Math.round((41.5 / 15.5) * 30 * 100) / 100);
    assert.equal(monthlyCapNotice(ok), null);
    const warn = monthlyCapStatus({capUsd: 100, warnRatio: 0.8, monthToDateUsd: 80, now});
    assert.equal(warn.level, "warn");
    assert.match(monthlyCapNotice(warn)?.label ?? "", /80% of the \$100 monthly cap/);
    assert.equal(monthlyCapNotice(warn)?.tone, "warn");
    const over = monthlyCapStatus({capUsd: 100, warnRatio: 0.8, monthToDateUsd: 101, now});
    assert.equal(over.level, "over");
    assert.equal(monthlyCapNotice(over)?.tone, "bad");
    // Switched off in the table: no notice; a bad cap falls back to the default.
    assert.equal(monthlyCapStatus({capUsd: 100, warnRatio: 0.8, monthToDateUsd: 500, now, enabled: false}).level, "ok");
    assert.equal(monthlyCapStatus({capUsd: 0, warnRatio: 5, monthToDateUsd: 50, now}).capUsd, 100);
    const {envMonthlyCapConfig} = await import("./ai-spend-cap");
    assert.deepEqual(envMonthlyCapConfig({}), {capUsd: 100, warnRatio: 0.8, enabled: true, source: "default"});
    assert.equal(envMonthlyCapConfig({AI_SPEND_MONTHLY_CAP_USD: "250"}).capUsd, 250);
    const migration = read("supabase/migrations/20261116120000_ai_spend_monthly_cap.sql");
    assert.match(migration, /monthly_cap_usd numeric\(10, 2\) NOT NULL DEFAULT 100/);
    assert.match(migration, /monthly_warn_ratio numeric\(4, 3\) NOT NULL DEFAULT 0\.8/);
    assert.match(read("src/app/admin/admin-overview-client.tsx"), /fetch\("\/api\/admin\/ai-spend\/cap"/);
});

test("background jobs name their AI calls: the job's feature beats the stack, and the stack of a fire-and-forget job names nothing", async () => {
    const {currentAiFeature, runWithAiFeature} = await import("./ai-usage-context");
    const {featureFromStack} = await import("./ai-usage-core");
    assert.equal(currentAiFeature(), null);
    // What a production stack looks like once the request that started the job has returned: chunks only.
    const detached = "Error\n    at wrapped (/app/.next/server/chunks/8812.js:1:200)\n    at async runJob (/app/.next/server/chunks/4471.js:1:9000)\n    at async /app/node_modules/next/dist/server/lib/patch-fetch.js:40:1";
    assert.equal(featureFromStack(detached), "unattributed");
    const inside = await runWithAiFeature("content-video/runner", async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        // A promise started inside the job and left to run (void job()) keeps the name.
        const later = new Promise<string | null>((resolve) => setTimeout(() => resolve(currentAiFeature()), 2));
        return {now: currentAiFeature(), later: await later};
    });
    assert.deepEqual(inside, {now: "content-video/runner", later: "content-video/runner"});
    assert.equal(currentAiFeature(), null);
    // The nested, more specific name wins.
    assert.equal(runWithAiFeature("blog-generator/auto-generate", () => runWithAiFeature("blog-generator/generate", () => currentAiFeature())), "blog-generator/generate");
    assert.match(read("src/lib/ai-usage.ts"), /webFeature\(source, currentAiFeature\(\) \?\? featureFromStack\(stack\)\)/);
    for (const [file, name] of [
        ["src/lib/blog-generator/jobs.ts", "runWithAiFeature(`blog-generator/${job.kind}`"],
        ["src/lib/content-video/runner.ts", 'runWithAiFeature("content-video/runner"'],
        ["src/lib/social/runner.ts", 'runWithAiFeature("social/runner"'],
        ["src/lib/social/auto-share.ts", 'runWithAiFeature("social/auto-share"'],
        ["src/lib/social-content/auto.ts", 'runWithAiFeature("social-content/auto"'],
        ["src/lib/trend-radar/radar.ts", 'runWithAiFeature("trend-radar/radar"'],
        ["src/lib/content-video/auto-generate.ts", 'runWithAiFeature("content-video/auto-generate"'],
        ["src/lib/blog-generator/auto-generate.ts", 'runWithAiFeature("blog-generator/auto-generate"']
    ]) assert.ok(read(file).includes(name), `${file} names its job`);
});

// ── Decision 4: comparisons ─────────────────────────────────────────────────

test("the web makes no new comparison pairs unless COMPARISONS_GENERATE=on", async () => {
    const {comparisonsGenerateEnabled, generationRefusal} = await import("./comparison-generation-guard");
    assert.equal(comparisonsGenerateEnabled({}), false);
    assert.equal(comparisonsGenerateEnabled({COMPARISONS_GENERATE: "off"}), false);
    assert.equal(comparisonsGenerateEnabled({COMPARISONS_GENERATE: "1"}), false);
    assert.equal(comparisonsGenerateEnabled({COMPARISONS_GENERATE: "on"}), true);
    assert.equal(comparisonsGenerateEnabled({COMPARISONS_GENERATE: " ON "}), true);
    const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
    const good = {requester: {kind: "admin"} as const, userAgent: ua, sameOrigin: true, intent: "ok" as const, pairMatchesIntent: true, refreshImage: false};
    assert.deepEqual(generationRefusal({...good, generationOn: false}), {status: 403, error: "generation_off"});
    assert.equal(generationRefusal({...good, generationOn: true}), null);
    // Off by default from the env too.
    delete process.env.COMPARISONS_GENERATE;
    assert.deepEqual(generationRefusal(good), {status: 403, error: "generation_off"});
    const data = read("src/data/species-comparisons.ts");
    assert.match(data, /if \(!comparisonsGenerateEnabled\(\)\) return null;\n\s+const supabaseUrl = getSupabaseUrl\(\);/);
    const route = read("src/app/api/comparisons/generate/route.ts");
    assert.match(route, /\{status: "pending", intent: null, generationOff: true\}/);
    assert.match(route, /generationOn: comparisonsGenerateEnabled\(\)/);
    const screen = read("src/app/[locale]/(composited)/comparisons/[slug]/_components/comparison-generating.tsx");
    assert.match(screen, /payload\?\.generationOff/);
    assert.match(screen, /payload\?\.error === "generation_off"/);
    for (const locale of ["en", "id"]) {
        const copy = JSON.parse(read(`src/data/locales/${locale}.json`)) as {comparisons: {generating: Record<string, string>}};
        assert.ok(copy.comparisons.generating.offTitle && copy.comparisons.generating.offDescription, locale);
    }
    assert.match(read("docs/ops/comparisons-off.md"), /SPECIES_COMPARISON_GENERATE/);
});

// ── Decision 5: the growth log ──────────────────────────────────────────────

test("the growth log is written nightly for finished Jakarta days, never over a hand entry", () => {
    // finishedDays is pure; the module is server-only, so its date logic is checked here through the same helpers it uses.
    const {previousDateKey} = require("./growth-command-center") as typeof import("./growth-command-center");
    assert.equal(previousDateKey("2026-11-16"), "2026-11-15");
    assert.equal(previousDateKey("2026-11-01"), "2026-10-31");
    const source = read("src/lib/growth-daily-log.ts");
    assert.match(source, /export const GROWTH_LOG_WRITER = "auto-fill";/);
    assert.match(source, /export const GROWTH_LOG_DAYS = 3;/);
    assert.match(source, /current\.updated_by !== GROWTH_LOG_WRITER/);
    assert.match(source, /ad_spend: "0\.00"/);
    assert.match(read("scripts/install-growth-daily-log-timer.sh"), /OnCalendar=\*-\*-\* 20:10:00/);
    assert.match(read("src/app/api/cron/growth-daily-log/route.ts"), /GROWTH_DAILY_LOG_DISABLED/);
    const sql = read("supabase/one-off/2026-11-16-growth-marketing-daily-rupiah-spend.sql");
    assert.match(sql, /'IDR'/);
    assert.match(sql, /NOT a migration/);
});
