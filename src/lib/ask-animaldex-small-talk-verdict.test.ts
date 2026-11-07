import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

// Small talk by its words never starts its kind's verdict (2026-11-07): a "hi"
// has no side to take, the turn never waits for it, and a verdict nobody
// awaits must never become an unhandled rejection. Checked against a local
// run of the route with a stubbed model: "hi" makes the crisis check and the
// reply only; a real problem still gets its verdict.

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const route = readFileSync(join(root, "src/app/api/ask/stream/route.ts"), "utf8");

test("small talk is known before the verdict would start", () => {
    const smallTalkAt = route.indexOf("const smallTalk = ");
    const verdictAt = route.indexOf("const kindVerdict = ");
    assert.ok(smallTalkAt > 0 && verdictAt > 0);
    assert.ok(smallTalkAt < verdictAt, "smallTalk must be decided before kindVerdict starts");
});

test("the verdict is not started for small talk, and a failure inside it is no verdict", () => {
    const start = route.indexOf("const kindVerdict = ");
    const end = route.indexOf(": Promise.resolve(null);", start);
    const verdict = route.slice(start, end);
    assert.match(verdict, /question &&\s+!smallTalk &&/);
    assert.match(verdict, /\)\.catch\(\(\) => null\)\s*$/);
});

test("the turn still reads small talk as chat without waiting for a verdict", () => {
    assert.match(route, /const turnRead = smallTalk \? null : await kindVerdict;/);
});
