import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {dailyCaps, pickLightKind} from "./social/auto-share-plan";
import {
    applyPauses,
    fatalPauseReason,
    fullyPaused,
    isPaused,
    pausedList,
    pauseLabel,
    resolvePauses,
    UNREADABLE_REASON,
    withoutPaused
} from "./social/platform-pauses";
import {SOCIAL_PLATFORMS} from "./social/types";

// The auto-share's per-platform pauses (Nov 2026): X, Facebook, Pinterest and
// Instagram carousels are off by default and stay off until the admin turns
// them back on; TikTok, YouTube and Instagram videos keep posting.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

test("by default X, Facebook and Pinterest are paused, and Instagram carousels; TikTok, YouTube and Instagram videos are on", () => {
    const pauses = resolvePauses([], "saved");
    for (const kind of ["video", "carousel", "text"] as const) {
        assert.equal(isPaused(pauses, "x", kind), true);
        assert.equal(isPaused(pauses, "facebook", kind), true);
        assert.equal(isPaused(pauses, "pinterest", kind), true);
        assert.equal(isPaused(pauses, "tiktok", kind), false);
        assert.equal(isPaused(pauses, "youtube", kind), false);
    }
    assert.equal(isPaused(pauses, "instagram", "carousel"), true);
    assert.equal(isPaused(pauses, "instagram", "video"), false);
    assert.equal(pauseLabel(pauses, "x", "video"), "Paused: credits depleted");
    assert.equal(pauseLabel(pauses, "facebook", "carousel"), "Paused: check this is the AnimalDex Page");
    assert.equal(pauseLabel(pauses, "tiktok", "video"), null);
    // Before the migration is applied there is nothing saved: the same defaults.
    assert.deepEqual(resolvePauses([], "defaults").entries, pauses.entries);
});

test("the admin's saved choice overrides one platform and kind; unknown rows are ignored", () => {
    const pauses = resolvePauses([
        {platform: "x", kind: "video", paused: false, reason: null, updated_at: "2026-11-05T00:00:00Z"},
        {platform: "tiktok", kind: "carousel", paused: true, reason: "  ", updated_at: null},
        {platform: "myspace", kind: "video", paused: false, reason: null, updated_at: null},
        {platform: "x", kind: "story", paused: false, reason: null, updated_at: null}
    ]);
    assert.equal(isPaused(pauses, "x", "video"), false);
    assert.equal(pauses.entries.x.video.source, "admin");
    // Turning X videos back on leaves its carousels and text paused.
    assert.equal(isPaused(pauses, "x", "carousel"), true);
    assert.equal(pauseLabel(pauses, "tiktok", "carousel"), "Paused: paused in the admin");
    assert.equal(isPaused(pauses, "tiktok", "video"), false);
});

test("settings that cannot be read pause every platform: a pause never lapses on a failed read", () => {
    const pauses = resolvePauses(null);
    assert.equal(pauses.source, "unreadable");
    for (const platform of SOCIAL_PLATFORMS) {
        for (const kind of ["video", "carousel", "text"] as const) assert.equal(isPaused(pauses, platform, kind), true);
    }
    assert.equal(pauseLabel(pauses, "tiktok", "video"), `Paused: ${UNREADABLE_REASON}`);
});

test("a paused kind's cap is 0, whatever SOCIAL_DAILY_CAPS says", () => {
    const pauses = resolvePauses([]);
    const caps = applyPauses(dailyCaps('{"x":{"video":9,"text":9},"instagram":{"carousel":5},"tiktok":{"video":7}}'), pauses);
    assert.equal(caps.x.video, 0);
    assert.equal(caps.x.text, 0);
    assert.equal(caps.instagram.carousel, 0);
    assert.equal(caps.instagram.video, 2);
    assert.equal(caps.tiktok.video, 7);
    // With carousels and text paused everywhere but TikTok, the light pick is a TikTok carousel.
    assert.equal(pickLightKind(["tiktok", "instagram", "x", "facebook"], [], caps, Date.now()), "carousel");
    assert.equal(pickLightKind(["instagram", "x", "facebook"], [], caps, Date.now()), null);
});

test("the auto-share leaves paused platforms out, with the reason, and skips checking fully paused ones", () => {
    const pauses = resolvePauses([]);
    const {allowed, skipped} = withoutPaused(["youtube", "tiktok", "instagram", "facebook", "x"], "video", pauses);
    assert.deepEqual(allowed, ["youtube", "tiktok", "instagram"]);
    assert.deepEqual(skipped, {facebook: "Paused: check this is the AnimalDex Page", x: "Paused: credits depleted"});
    assert.deepEqual(withoutPaused(["instagram", "tiktok"], "carousel", pauses).allowed, ["tiktok"]);
    const caps = dailyCaps();
    assert.equal(fullyPaused(pauses, "x", caps), true);
    assert.equal(fullyPaused(pauses, "instagram", caps), false);
    assert.deepEqual(pausedList(pauses, caps).filter((entry) => entry.platform === "instagram"), [{platform: "instagram", kind: "carousel", reason: "carousels got 4–14 views"}]);
});

test("X out of API credits pauses X; other failures are retried", () => {
    assert.equal(fatalPauseReason("x", 'X post failed (402): {"title":"CreditsDepleted","detail":"Your enrolled account does not have any credits"}'), "credits depleted");
    assert.equal(fatalPauseReason("x", "X media upload failed (503): try again"), null);
    assert.equal(fatalPauseReason("youtube", "402 credits depleted"), null);
});

test("every share path reads the pauses; the runner pauses X on 402; the table is service-role only", () => {
    const autoShare = read("src/lib/social/auto-share.ts");
    assert.match(autoShare, /const \{pauses, raw, caps\} = await pausesAndCaps\(\);\n {4}const ready = await readyPlatforms\(pauses, raw\);/);
    assert.match(autoShare, /applyPauses\(raw, pauses\)/);
    assert.match(autoShare, /withoutPaused\(ready\.platforms, "video", ready\.pauses\)/);
    assert.match(autoShare, /withoutPaused\(ready\.platforms, kind, ready\.pauses\)/);
    assert.match(autoShare, /withoutPaused\(ready\.platforms, kind, pauses\)/);
    assert.doesNotMatch(autoShare, /readyPlatforms\(\)/);
    assert.equal(read("src/lib/social/runner.ts").match(/await pauseOnFatalError\(row\.platform, error\)/g)?.length, 2);
    const migration = read("supabase/migrations/20261104193000_admin_social_platform_settings.sql");
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.admin_social_platform_settings/);
    assert.match(migration, /ENABLE ROW LEVEL SECURITY/);
    assert.match(migration, /REVOKE ALL ON public\.admin_social_platform_settings FROM anon, authenticated/);
    assert.match(read("supabase/rollbacks/20261104193000_admin_social_platform_settings.rollback.sql"), /DROP TABLE IF EXISTS public\.admin_social_platform_settings/);
});
