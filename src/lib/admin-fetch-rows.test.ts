import assert from "node:assert/strict";
import test from "node:test";
import {fetchRows, totalFromContentRange} from "../app/api/admin/growth/_lib/rows";

// fetchRows feeds /admin/metrics and the growth pages. It now asks for the row
// total on the first page and fetches the rest a few at a time; these pin that
// the rows still come back complete and in order.

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";

type Call = {offset: number; counted: boolean};

function stubTable(total: number, {sendTotal = true, delayMs = 5} = {}) {
    const calls: Call[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        const offset = Number(url.searchParams.get("offset"));
        const limit = Number(url.searchParams.get("limit"));
        const counted = (init?.headers as Record<string, string> | undefined)?.Prefer === "count=exact";
        calls.push({offset, counted});
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        inFlight -= 1;
        const rows = Array.from({length: Math.max(0, Math.min(limit, total - offset))}, (_, index) => ({n: offset + index}));
        const headers: Record<string, string> = {"content-type": "application/json"};
        if (counted) headers["content-range"] = sendTotal ? `${offset}-${offset + rows.length - 1}/${total}` : `${offset}-${offset + rows.length - 1}/*`;
        return new Response(JSON.stringify(rows), {status: 200, headers});
    }) as typeof fetch;
    return {calls, maxInFlight: () => maxInFlight, restore: () => { globalThis.fetch = original; }};
}

test("totalFromContentRange reads the total, or null when PostgREST sends none", () => {
    assert.equal(totalFromContentRange("0-999/5083"), 5083);
    assert.equal(totalFromContentRange("*/0"), 0);
    assert.equal(totalFromContentRange("0-999/*"), null);
    assert.equal(totalFromContentRange(null), null);
});

test("a small table is one counted request", async () => {
    const stub = stubTable(405);
    try {
        const rows = await fetchRows<{n: number}>("t", "select=n");
        assert.equal(rows.length, 405);
        assert.deepEqual(stub.calls, [{offset: 0, counted: true}]);
    } finally {
        stub.restore();
    }
});

test("a large table comes back complete and in order, at most four pages at once", async () => {
    const stub = stubTable(9_500);
    try {
        const rows = await fetchRows<{n: number}>("t", "select=n");
        assert.equal(rows.length, 9_500);
        assert.ok(rows.every((row, index) => row.n === index), "rows stay in offset order");
        assert.equal(stub.calls.length, 10);
        assert.equal(stub.calls.filter((call) => call.counted).length, 1);
        assert.ok(stub.maxInFlight() <= 4, `at most 4 pages in flight, saw ${stub.maxInFlight()}`);
        assert.ok(stub.maxInFlight() > 1, "pages after the first run in parallel");
    } finally {
        stub.restore();
    }
});

test("an exact multiple of the page size asks for no empty page", async () => {
    const stub = stubTable(3_000);
    try {
        const rows = await fetchRows<{n: number}>("t", "select=n");
        assert.equal(rows.length, 3_000);
        assert.deepEqual(stub.calls.map((call) => call.offset).sort((a, b) => a - b), [0, 1000, 2000]);
    } finally {
        stub.restore();
    }
});

test("without a total it walks the pages in order, as before", async () => {
    const stub = stubTable(2_500, {sendTotal: false});
    try {
        const rows = await fetchRows<{n: number}>("t", "select=n");
        assert.equal(rows.length, 2_500);
        assert.deepEqual(stub.calls.map((call) => call.offset), [0, 1000, 2000]);
        assert.equal(stub.maxInFlight(), 1);
    } finally {
        stub.restore();
    }
});
