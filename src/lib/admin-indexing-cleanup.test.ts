import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {formatIndexingCleanupMarkdown, formatRunMarkdown} from "./admin-indexing-cleanup-markdown";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function read(relativePath: string) {
    return readFileSync(join(root, relativePath), "utf8");
}

test("admin indexing cleanup is gated and reads the cron residue", () => {
    const page = read("app/admin/indexing/page.tsx");
    const api = read("app/api/admin/indexing-cleanup/route.ts");
    const dashboard = read("app/admin/page.tsx");

    assert.match(page, /withAdminGate/);
    assert.match(api, /isSupportAdminRequestAuthorized/);
    assert.match(api, /capture_indexing_cleanup_runs/);
    assert.match(api, /capture_indexing_cleanup_attempts/);
    assert.match(api, /index_unindexed_captures_daily/);
    assert.match(api, /nextRunAt/);
    assert.match(api, /byName/);
    assert.match(api, /const fixed =/);
    assert.match(api, /export async function POST/);
    assert.match(api, /dispatch_index_unindexed_captures/);
    assert.doesNotMatch(api, /admin_reanalyze/);
    assert.match(read("app/admin/indexing/admin-indexing-client.tsx"), /Run now/);
    assert.match(dashboard, /href: "\/admin\/indexing"/);
    assert.match(read("app/admin/indexing/admin-indexing-client.tsx"), /useCountdown/);
    assert.match(read("app/admin/indexing/admin-indexing-client.tsx"), /Live run/);
    assert.match(api, /attemptHistory/);
    assert.match(api, /lastError/);
    assert.match(read("app/admin/indexing/admin-indexing-client.tsx"), /formatReason/);
    assert.match(read("app/admin/indexing/admin-indexing-client.tsx"), /attemptHistory/);
    assert.match(read("app/admin/indexing/admin-indexing-client.tsx"), /Copy markdown/);
    assert.match(read("app/admin/indexing/admin-indexing-client.tsx"), /formatIndexingCleanupMarkdown/);
});

test("indexing cleanup markdown includes failures a reviewer can paste", () => {
    const markdown = formatIndexingCleanupMarkdown({
        generatedAt: "2026-09-06T14:51:00.000Z",
        schedule: {
            cron: "0 4 * * *",
            timezone: "UTC",
            dailyBudget: 20,
            nextRunAt: "2026-09-07T04:00:00.000Z",
            estimatedDaysRemaining: 6
        },
        queue: {
            eligibleCaptures: 120,
            untouched: 100,
            waiting: 20,
            permanentlySkipped: 0,
            unindexedProfiles: 400,
            hiddenUnindexedProfiles: 12
        },
        latest: {
            id: "run-1",
            startedAt: "2026-09-06T14:29:24.000Z",
            finishedAt: "2026-09-06T14:29:33.000Z",
            durationSeconds: 9,
            candidates: 20,
            queued: 0,
            indexed: 0,
            merged: 0,
            skippedForever: 0,
            notIndexed: 20,
            error: null,
            results: [{
                capture_id: "476b7e30-d54e-4349-8182-c03400bbe6c0",
                animal_name: "Butterfly",
                action: "failed",
                error: "invalid_credit_cost",
                status: 400
            }]
        },
        captures: [{
            captureId: "476b7e30-d54e-4349-8182-c03400bbe6c0",
            animalName: "Butterfly",
            scientificName: null,
            identityKind: "species",
            identityKey: "butterfly",
            completedAt: "2026-08-01T00:00:00.000Z",
            captureMode: "photo",
            attempts: 1,
            lastAttemptedAt: "2026-09-06T14:29:33.000Z",
            skippedAt: null,
            retryState: "waiting",
            lastError: "invalid_credit_cost",
            attemptHistory: [{
                action: "failed",
                error: "invalid_credit_cost",
                status: 400,
                at: "2026-09-06T14:29:33.000Z"
            }]
        }],
        breakdown: {
            byRetryState: [{key: "waiting", label: "Waiting to retry", count: 20}],
            byKind: [{key: "species", label: "species", count: 20}],
            byName: [{key: "Butterfly", label: "Butterfly", count: 1}]
        }
    });

    assert.match(markdown, /# Indexing cleanup/);
    assert.match(markdown, /invalid_credit_cost \(400\)/);
    assert.match(markdown, /476b7e30-d54e-4349-8182-c03400bbe6c0/);
    assert.match(markdown, /Failures still waiting/);
    assert.match(formatRunMarkdown({
        id: "run-1",
        startedAt: "2026-09-06T14:29:24.000Z",
        finishedAt: "2026-09-06T14:29:33.000Z",
        durationSeconds: 9,
        candidates: 1,
        queued: 0,
        indexed: 0,
        merged: 0,
        skippedForever: 0,
        notIndexed: 1,
        error: null,
        results: []
    }), /no finished attempts/);
});
