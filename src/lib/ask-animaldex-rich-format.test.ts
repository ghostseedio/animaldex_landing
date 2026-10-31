import assert from "node:assert/strict";
import test from "node:test";

// Rich answers (docs/rich-chat/SPEC.md, section 1.2): the web's animal holds
// the apps' rich format rules word for word. Until the server lane's own
// generated fixture lands, the fixture is the SPEC's text itself.
import fixture from "./ask-animaldex/__fixtures__/rich-format-rules.json";
import {
    ANIMAL_RICH_FORMAT_LEAD,
    animalRichFormatRules,
    askRichColumns,
    buildAskStreamingSystemPrompt,
    buildAskSystemPrompt,
    type AskPromptOptions
} from "@/lib/ask-animaldex/prompt";

const BASE: AskPromptOptions = {scope: "species", animalName: "Barn Owl", supportedVisuals: ["flow", "scale", "chart"]};

/** The formatting section as built: its lead through the line before the closing rules. */
function formatting(prompt: string): string[] {
    const lines = prompt.split("\n");
    const start = lines.findIndex((line) => line.startsWith("Formatting —"));
    assert.ok(start >= 0, "no formatting lead");
    const end = lines.findIndex((line, index) => index > start && (line.startsWith("- End ") || line === ""));
    return lines.slice(start, end);
}

function sameLines(web: readonly string[], spec: readonly string[], what: string) {
    for (let index = 0; index < Math.max(web.length, spec.length); index += 1) {
        assert.equal(web[index], spec[index], `${what}, line ${index + 1}`);
    }
}

test("the rich rules are the SPEC's, word for word, at 36 and 72 columns", () => {
    assert.equal(ANIMAL_RICH_FORMAT_LEAD, fixture.lead);
    sameLines(animalRichFormatRules(36), fixture.rules["36"], "rules at 36");
    sameLines(animalRichFormatRules(72), fixture.rules["72"], "rules at 72");
});

test("with rich, the lead and the rules replace the conversational format rules", () => {
    for (const columns of [36, 72] as const) {
        const streaming = formatting(buildAskStreamingSystemPrompt({...BASE, rich: {columns}}));
        sameLines(streaming, [fixture.lead, ...fixture.rules[String(columns) as "36" | "72"]], `streaming at ${columns}`);
        const json = formatting(buildAskSystemPrompt({...BASE, rich: {columns}}));
        sameLines(json, [fixture.lead, ...fixture.rules[String(columns) as "36" | "72"]], `json at ${columns}`);
    }
    const prompt = buildAskStreamingSystemPrompt({...BASE, rich: {columns: 44}});
    assert.equal(prompt.includes("- Plain sentence case. No emoji."), false);
    assert.equal(prompt.includes("fits\n    in 44 characters."), true);
});

test("with rich, a text diagram counts as a drawing", () => {
    const lines = buildAskStreamingSystemPrompt({...BASE, rich: {columns: 36}}).split("\n");
    const small = lines.indexOf("  Never in small talk.");
    assert.ok(small > 0);
    assert.equal(lines[small + 1].trim(), fixture.drawingLine);
    assert.equal(lines.filter((line) => line.trim() === fixture.drawingLine).length, 1);
});

test("without rich, and on a call, a group or a Trial thread, nothing changes", () => {
    const plain = buildAskStreamingSystemPrompt(BASE);
    for (const options of [
        {...BASE, rich: null},
        {...BASE, rich: {columns: 36}, call: true},
        {...BASE, rich: {columns: 36}, groupLines: ["You are in a group."]},
        {...BASE, rich: {columns: 36}, aboutTrial: true}
    ] satisfies AskPromptOptions[]) {
        const prompt = buildAskStreamingSystemPrompt(options);
        assert.equal(prompt.includes(fixture.lead), false, JSON.stringify(options));
        assert.equal(prompt.includes(fixture.drawingLine), false, JSON.stringify(options));
        assert.equal(prompt.includes("- Plain sentence case. No emoji."), true, JSON.stringify(options));
    }
    assert.equal(buildAskStreamingSystemPrompt({...BASE, rich: null}), plain);
});

test("text_columns is clamped to 28–80, and 36 when missing", () => {
    assert.equal(askRichColumns(undefined), 36);
    assert.equal(askRichColumns(null), 36);
    assert.equal(askRichColumns("wide"), 36);
    assert.equal(askRichColumns(10), 28);
    assert.equal(askRichColumns(200), 80);
    assert.equal(askRichColumns(44.7), 44);
    assert.equal(askRichColumns("50"), 50);
    // The rules are written at the clamped width.
    assert.equal(animalRichFormatRules(300).some((line) => line.includes("in 80 characters.")), true);
});
