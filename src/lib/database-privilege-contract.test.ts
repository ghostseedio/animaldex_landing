import assert from "node:assert/strict";
import {describe, it} from "node:test";

/**
 * The database's privilege posture, asserted in CI.
 *
 * Three Severity-0 exposures were found by hand on 2026-09-25: 23 tables
 * writable by the logged-out role, 202 mutating SECURITY DEFINER functions it
 * could execute, and the ALTER DEFAULT PRIVILEGES entries that regenerated both
 * on every CREATE. None of them were visible in code review, because none of
 * them live in a migration — they are database state, and nothing in either
 * repo ever asserted anything about it. A `create table` plus the inherited
 * default was enough to reopen the hole silently.
 *
 * This test is that assertion. It calls admin_privilege_audit_v1(), which
 * returns one row per violation, and fails on any `critical`. Warnings are
 * printed rather than failed: an anon write grant on an RLS-protected table is
 * contained today by the policy predicate, and failing CI on all 97 of those
 * would train everyone to ignore this test.
 *
 * Skips when Supabase credentials are absent, so local runs and forks are not
 * blocked. That means a misconfigured CI passes silently — the guard against
 * that is asserting the skip is loud, below.
 */

type Violation = {severity: string; kind: string; object_name: string; detail: string};

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && key);

async function audit(): Promise<Violation[]> {
    const response = await fetch(`${url}/rest/v1/rpc/admin_privilege_audit_v1`, {
        method: "POST",
        headers: {apikey: key!, Authorization: `Bearer ${key}`, "Content-Type": "application/json"},
        body: "{}"
    });
    if (response.status === 404) {
        throw new Error("admin_privilege_audit_v1 is not installed. Apply supabase/migrations/20260926150000_admin_privilege_audit.sql.");
    }
    if (!response.ok) throw new Error(`privilege audit failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    return (await response.json()) as Violation[];
}

describe("database privilege contract", {skip: configured ? false : "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set"}, () => {
    it("has no critical privilege violations", async () => {
        const violations = await audit();
        const critical = violations.filter((v) => v.severity === "critical");
        const warnings = violations.filter((v) => v.severity === "warning");

        if (warnings.length > 0) {
            // Printed, not failed. These are contained by RLS; they are listed
            // so the number is visible and can be driven down deliberately.
            console.log(`  (${warnings.length} privilege warnings, contained by RLS)`);
        }

        assert.deepEqual(
            critical.map((v) => `${v.kind}: ${v.object_name} — ${v.detail}`),
            [],
            "critical database privilege violations are present; see supabase/migrations/20260926150000_admin_privilege_audit.sql for what each kind means"
        );
    });

    it("keeps row level security on every table holding user data", async () => {
        const violations = await audit();
        assert.deepEqual(
            violations.filter((v) => v.kind === "rls_disabled").map((v) => v.object_name),
            [],
            "row level security has been switched off on a table holding user data"
        );
    });

    it("keeps the catalogue and pricing tables out of client hands", async () => {
        const violations = await audit();
        assert.deepEqual(
            violations.filter((v) => v.kind === "reference_table_client_write").map((v) => `${v.object_name} (${v.detail})`),
            [],
            "a reference or config table became writable by anon or authenticated"
        );
    });
});

describe("database privilege contract wiring", () => {
    it("is actually running against a database in CI", () => {
        // A skipped security test is indistinguishable from a passing one in a
        // CI summary. In CI the credentials must be present.
        if (process.env.CI) {
            assert.ok(configured, "CI must provide SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY so the privilege contract is actually checked");
        } else {
            assert.ok(true);
        }
    });
});
