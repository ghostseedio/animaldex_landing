import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

// `request.ts` is server-only, so its rule is read from the source, as other
// tests here do. The owner's "hi" was refused as invalid_question (2026-11-07):
// the web's minimum was 3 characters while the apps' function takes any
// non-empty message.
const here = dirname(fileURLToPath(import.meta.url));
const requestSource = readFileSync(join(here, "ask-animaldex", "request.ts"), "utf8");
const streamSource = readFileSync(join(here, "..", "app", "api", "ask", "stream", "route.ts"), "utf8");

test("any non-empty message is a question: a two-letter hello is not refused", () => {
    const min = Number(/export const ASK_QUESTION_MIN = (\d+);/.exec(requestSource)?.[1]);
    assert.equal(min, 1, "ASK_QUESTION_MIN must stay 1 so that \"hi\", \"yo\" and \"gm\" are answered");
    for (const hello of ["hi", "yo", "gm", "k"]) assert.ok(hello.length >= min, hello);
});

test("the question is still trimmed before the length check, so spaces alone are refused", () => {
    assert.match(requestSource, /export function resolveAskQuestion\(raw: unknown\): string \| null \{\s*const question = typeof raw === "string" \? raw\.replace\(\/\\s\+\/g, " "\)\.trim\(\) : "";/);
});

test("the chat stream validates typed messages with resolveAskQuestion", () => {
    assert.match(streamSource, /resolveAskQuestion\(body\.question\)/);
});
