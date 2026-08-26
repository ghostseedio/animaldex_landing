import {readFileSync} from "node:fs";
import {join} from "node:path";
import {describe, it} from "node:test";
import * as assert from "node:assert/strict";

const routeSource = readFileSync(join(process.cwd(), "src/app/api/admin/growth/route.ts"), "utf8");
const migrationSource = readFileSync(join(process.cwd(), "supabase/migrations/20260826090000_growth_command_center.sql"), "utf8");

describe("growth command center route contract", () => {
    it("keeps growth APIs admin-only and service-role backed", () => {
        assert.match(routeSource, /resolveAdminActor/);
        assert.match(routeSource, /status: 401/);
        assert.match(routeSource, /getSupabaseServiceKey/);
        assert.doesNotMatch(routeSource, /NEXT_PUBLIC_/);
    });

    it("upserts daily manual marketing values by date", () => {
        assert.match(routeSource, /action === "save-marketing"/);
        assert.match(routeSource, /on_conflict=date/);
        assert.match(routeSource, /social_views/);
        assert.match(routeSource, /search_clicks/);
        assert.match(routeSource, /ad_spend/);
        assert.match(routeSource, /updated_by: actor.email \?\? actor.kind/);
    });

    it("stores plans separately from automatic metrics", () => {
        assert.match(routeSource, /growth_monthly_plans/);
        assert.match(routeSource, /growth_marketing_daily/);
        assert.match(migrationSource, /alter table public\.growth_monthly_plans enable row level security/);
        assert.match(migrationSource, /alter table public\.growth_marketing_daily enable row level security/);
        assert.doesNotMatch(migrationSource, /create policy/i);
    });
});
