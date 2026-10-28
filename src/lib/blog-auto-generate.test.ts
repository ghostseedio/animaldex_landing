import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {AUTOMATION_JOBS} from "@/lib/automation-runs";
import {nextTimerRun} from "@/lib/automation-schedule";
import {AUTO_FOCUSES, pickAutoFocus, RECENT_FOCUS_WINDOW} from "@/lib/blog-generator/auto-generate-plan";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

test("the auto focus avoids the recent ones, and falls back when all are recent", () => {
    const recent = AUTO_FOCUSES.slice(0, RECENT_FOCUS_WINDOW);
    for (let index = 0; index < 50; index += 1) {
        assert.ok(!recent.includes(pickAutoFocus(recent)));
    }
    assert.ok(AUTO_FOCUSES.includes(pickAutoFocus([...AUTO_FOCUSES], () => 0.999)));
    assert.equal(pickAutoFocus([], () => 0), AUTO_FOCUSES[0]);
});

test("the focus list covers conservation crises", () => {
    assert.ok(AUTO_FOCUSES.some((focus) => /wildfire/i.test(focus)));
    assert.ok(AUTO_FOCUSES.some((focus) => /habitat loss/i.test(focus)));
});

test("blog auto-generate runs the manual news flow at standard depth and publishes", () => {
    const source = read("src/lib/blog-generator/auto-generate.ts");
    // The radar's best story when there is one, else Claude searches a random focus.
    assert.match(source, /start\(\{mode: "news", focus, publish: true, depth: "standard"\}/);
    assert.match(source, /mode: topic\.kind === "news" \? "news" : "catalog", idea: topic\.idea, publish: true, depth: "standard"/);
    assert.match(source, /generateJobRunning\(\)/);
});

test("the admin panel's schedule matches the timer installer", () => {
    const installer = read("scripts/install-blog-auto-generate-timer.sh");
    assert.match(installer, /OnCalendar=\*-\*-\* 07,19:40:00/);
    assert.equal(nextTimerRun("blog-auto-generate", new Date("2026-10-20T07:00:00Z")).toISOString(), "2026-10-20T07:40:00.000Z");
    assert.equal(nextTimerRun("blog-auto-generate", new Date("2026-10-20T08:00:00Z")).toISOString(), "2026-10-20T19:40:00.000Z");
    assert.equal(nextTimerRun("blog-auto-generate", new Date("2026-10-20T20:00:00Z")).toISOString(), "2026-10-21T07:40:00.000Z");
});

test("the run log's job constraint allows every automation job", () => {
    const migration = read("supabase/migrations/20261028180000_trend_radar.sql");
    for (const job of AUTOMATION_JOBS) assert.match(migration, new RegExp(`'${job}'`));
});

test("news topic discovery covers conservation crises", () => {
    const pipeline = read("src/lib/blog-generator/pipeline.ts");
    assert.match(pipeline, /- STAKES: animals in real trouble right now/);
    assert.match(pipeline, /conservation crises unfolding now \(wildfires/);
    assert.match(pipeline, /craziness \| stakes"/);
});
