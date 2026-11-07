import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {askDebateVisuals} from "./ask-animaldex/rich";

// A debate's turns may draw a little (2026-11-07): the stream says "rich",
// with the column's width when the page measured it.

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("a debate's stream says rich, and the column's width only when measured (clamped like a chat's)", () => {
    assert.deepEqual(askDebateVisuals(undefined), {supported_visuals: ["rich"]});
    assert.deepEqual(askDebateVisuals("44"), {supported_visuals: ["rich"]});
    assert.deepEqual(askDebateVisuals(44), {supported_visuals: ["rich"], text_columns: 44});
    assert.deepEqual(askDebateVisuals(999), {supported_visuals: ["rich"], text_columns: 80});
    assert.deepEqual(askDebateVisuals(3), {supported_visuals: ["rich"], text_columns: 28});
});

test("the debate route passes them to the apps' function", () => {
    const route = readFileSync(join(root, "src/app/api/ask/debate/route.ts"), "utf8");
    assert.match(route, /flow: "debate", debate_id: debateId, language_name: askLanguageName\(body\.locale\), \.\.\.askDebateVisuals\(body\.textColumns\)/);
});
