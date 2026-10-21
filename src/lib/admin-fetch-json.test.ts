import assert from "node:assert/strict";
import { test } from "node:test";
import { describeHttpFailure, errorFromBody, fetchJson, readJsonBody } from "./admin-fetch-json";

const html = "<!DOCTYPE html><html><body><h1>502 Bad Gateway</h1></body></html>";

test("readJsonBody turns an nginx HTML 502 into a readable error", async () => {
  const response = new Response(html, { status: 502, statusText: "Bad Gateway", headers: { "content-type": "text/html" } });
  const body = await readJsonBody(response);
  assert.equal(body.ok, false);
  assert.equal(body.error, "The server is restarting. Try again in a few seconds.");
  assert.ok(!String(body.error).includes("Unexpected token"));
});

test("readJsonBody passes JSON bodies through untouched", async () => {
  const response = new Response(JSON.stringify({ ok: true, month: "2026-10" }), { status: 200 });
  assert.deepEqual(await readJsonBody(response), { ok: true, month: "2026-10" });
});

test("readJsonBody keeps the API's own error message on JSON failures", async () => {
  const response = new Response(JSON.stringify({ ok: false, error: "Month out of range" }), { status: 400 });
  assert.deepEqual(await readJsonBody(response), { ok: false, error: "Month out of range" });
});

test("readJsonBody treats an empty 200 as ok and an empty 500 as a failure", async () => {
  assert.deepEqual(await readJsonBody(new Response("", { status: 200 })), { ok: true });
  const failed = await readJsonBody(new Response("", { status: 500 }));
  assert.equal(failed.ok, false);
  assert.equal(failed.error, "The server failed with status 500.");
});

test("describeHttpFailure covers the statuses the proxy and the API emit", () => {
  assert.equal(describeHttpFailure(504), "The server took too long to answer. Try again.");
  assert.equal(describeHttpFailure(401), "Your admin session has expired. Sign in again.");
  assert.equal(describeHttpFailure(404, "Not Found"), "Request failed with status 404 Not Found.");
  assert.equal(describeHttpFailure(404), "Request failed with status 404.");
});

test("fetchJson retries a GET across a container swap and returns the JSON answer", async () => {
  const calls: string[] = [];
  const slept: number[] = [];
  const answers = [
    () => new Response(html, { status: 502 }),
    () => { throw new TypeError("Failed to fetch"); },
    () => new Response(JSON.stringify({ ok: true, fine: 1 }), { status: 200 }),
  ];
  const { response, body } = await fetchJson("/api/admin/growth?month=2026-10", { cache: "no-store" }, {
    fetchImpl: (async (input: RequestInfo | URL) => { calls.push(String(input)); return answers[calls.length - 1]!(); }) as typeof fetch,
    sleep: async (ms) => { slept.push(ms); },
    retryDelayMs: 100,
  });
  assert.equal(calls.length, 3);
  assert.deepEqual(slept, [100, 200]);
  assert.equal(response.status, 200);
  assert.deepEqual(body, { ok: true, fine: 1 });
});

test("fetchJson gives up after the retries with a readable error instead of a parse error", async () => {
  let calls = 0;
  const { response, body } = await fetchJson("/api/admin/metrics?month=2026-10", undefined, {
    fetchImpl: (async () => { calls += 1; return new Response(html, { status: 502 }); }) as typeof fetch,
    sleep: async () => {},
  });
  assert.equal(calls, 3);
  assert.equal(response.status, 502);
  assert.equal(errorFromBody(body, "Unable to load metrics"), "The server is restarting. Try again in a few seconds.");
});

test("fetchJson never retries a POST", async () => {
  let calls = 0;
  const { body } = await fetchJson("/api/admin/growth", { method: "POST", body: "{}" }, {
    fetchImpl: (async () => { calls += 1; return new Response(html, { status: 503 }); }) as typeof fetch,
    sleep: async () => {},
  });
  assert.equal(calls, 1);
  assert.equal(body.ok, false);
});

test("fetchJson does not retry a 401, so a lost session shows up at once", async () => {
  let calls = 0;
  const { response } = await fetchJson("/api/admin/growth", undefined, {
    fetchImpl: (async () => { calls += 1; return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), { status: 401 }); }) as typeof fetch,
    sleep: async () => {},
  });
  assert.equal(calls, 1);
  assert.equal(response.status, 401);
});
