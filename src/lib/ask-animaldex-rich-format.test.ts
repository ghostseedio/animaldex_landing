import assert from "node:assert/strict";
import test from "node:test";

// Rich answers (docs/rich-chat/SPEC.md, sections 1.2 and 1.3): the web's
// animal holds the apps' rich format rules word for word, and says aloud
// exactly what the server says. The fixture is the server's own modules'
// output (AnimalDex rich-server, `_shared/animal-voice.ts` and
// `_shared/speech-text.ts`): the lead, the medium line, the rules at 36 and
// 72 columns, the text_columns clamp, the medium and formatting sections as
// built for five cases, and speakableText pairs.
import fixture from "./ask-animaldex/__fixtures__/rich-format-fixture.json";
import {
    ANIMAL_RICH_DRAWING_LINE,
    ANIMAL_RICH_FORMAT_LEAD,
    ANIMAL_RICH_LAST_CHECK_LINE,
    animalRichFormatRules,
    askRichColumns,
    buildAskStreamingSystemPrompt,
    buildAskSystemPrompt,
    type AskPromptOptions,
    type AskVisualMedium
} from "@/lib/ask-animaldex/prompt";
import {speakableText} from "@/lib/ask-animaldex/call-speech";

type ServerCase = {
    options: {
        mode?: string;
        companionLoop?: {offersSteps: boolean; debates?: boolean} | null;
        suggestSteps?: boolean;
        stories?: boolean;
        supportedVisuals: string[];
        textColumns?: number;
        call?: boolean;
    };
    medium: string[];
    formatting: string[];
    lastCheck: string[];
};

/**
 * The server's case as the web route builds it: "rich" is not a drawing
 * medium on the web but its own option, with the clamped text_columns.
 */
function webOptions(input: ServerCase["options"]): AskPromptOptions {
    const advertised = input.supportedVisuals;
    return {
        scope: "species",
        animalName: "African Lion",
        mode: "auto",
        supportedVisuals: advertised.filter((name): name is AskVisualMedium => name !== "rich"),
        companionLoop: input.companionLoop ?? null,
        suggestSteps: input.suggestSteps,
        stories: input.stories,
        call: input.call === true,
        rich: advertised.includes("rich") ? {columns: askRichColumns(input.textColumns)} : null
    };
}

/** Lines from the first starting with `from` up to (not including) the next starting with `to`. */
function slice(prompt: string, from: string, to: (line: string) => boolean): string[] {
    const lines = prompt.split("\n");
    const start = lines.findIndex((line) => line.startsWith(from));
    assert.ok(start >= 0, `no line starts with ${from}`);
    const end = lines.findIndex((line, index) => index > start && to(line));
    assert.ok(end >= 0, `nothing ends the section after ${from}`);
    return lines.slice(start, end);
}

function sections(prompt: string) {
    return {
        medium: slice(prompt, "Medium —", (line) => line.startsWith("Formatting —"))
            .filter((line, index, all) => !(index === all.length - 1 && line === "")),
        // The lead and its rules, up to the closing rules ("- End …").
        formatting: slice(prompt, "Formatting —", (line) => line.startsWith("- End ") || line === "")
    };
}

function sameLines(web: readonly string[], server: readonly string[], what: string) {
    for (let index = 0; index < Math.max(web.length, server.length); index += 1) {
        assert.equal(web[index], server[index], `${what}, line ${index + 1}`);
    }
}

test("the fixture is the rich-chat server lane's build (owner, 2026-10-31)", () => {
    assert.equal(fixture.source.repo, "AnimalDex");
    assert.ok(fixture.source.files.includes("supabase/functions/_shared/animal-voice.ts"));
});

test("the rich lead, medium line and rules are the server's, word for word", () => {
    assert.equal(ANIMAL_RICH_FORMAT_LEAD, fixture.lead);
    assert.equal(ANIMAL_RICH_DRAWING_LINE, fixture.mediumLine);
    assert.equal(ANIMAL_RICH_LAST_CHECK_LINE, fixture.lastCheckLine);
    sameLines(animalRichFormatRules(36), fixture.rules36, "rules at 36");
    sameLines(animalRichFormatRules(72), fixture.rules72, "rules at 72");
});

test("text_columns is clamped as the server clamps it", () => {
    assert.equal(fixture.textColumns.min, 28);
    assert.equal(fixture.textColumns.max, 80);
    assert.equal(askRichColumns(undefined), fixture.textColumns.default);
    for (const pair of fixture.textColumns.clamp) {
        assert.equal(askRichColumns(pair.input), pair.output, JSON.stringify(pair.input));
    }
});

test("the medium and formatting sections come out as the server builds them, in every case", () => {
    for (const [name, raw] of Object.entries(fixture.prompts)) {
        const item = raw as ServerCase;
        const options = webOptions(item.options);
        for (const [variant, prompt] of [
            ["streaming", buildAskStreamingSystemPrompt(options)],
            ["json", buildAskSystemPrompt(options)]
        ] as const) {
            const built = sections(prompt);
            sameLines(built.medium, item.medium, `${name} (${variant}) medium`);
            // The JSON variant's conversational lead says "the answer is"; the rich lead is one.
            const formatting = variant === "json" && built.formatting[0] !== fixture.lead
                ? built.formatting.map((line, index) => (index === 0 ? line.replace("the answer is", "your reply is") : line))
                : built.formatting;
            sameLines(formatting, item.formatting, `${name} (${variant}) formatting`);
            const lines = prompt.split("\n");
            const check = lines.findIndex((line) => line.startsWith("Last check before you finish"));
            sameLines(lines.slice(check, check + item.lastCheck.length), item.lastCheck, `${name} (${variant}) last check`);
        }
    }
});

test("in rich mode the last check keeps the layout; elsewhere it is unchanged", () => {
    const rich = buildAskStreamingSystemPrompt(webOptions((fixture.prompts.publicRich44 as ServerCase).options));
    assert.equal(rich.includes(ANIMAL_RICH_LAST_CHECK_LINE), true);
    assert.equal(rich.includes("say it out loud like this? If it reads like a report, say it your own way."), false);
    const plain = buildAskStreamingSystemPrompt(webOptions((fixture.prompts.ownerPlain as ServerCase).options));
    assert.equal(plain.includes(ANIMAL_RICH_LAST_CHECK_LINE), false);
    assert.equal(plain.includes("say it out loud like this? If it reads like a report, say it your own way."), true);
    // A call, a group or a Trial thread never goes rich, whatever the client says.
    for (const extra of [{call: true}, {groupLines: ["You are in a group."]}, {aboutTrial: true}] satisfies Partial<AskPromptOptions>[]) {
        const prompt = buildAskStreamingSystemPrompt({...webOptions((fixture.prompts.publicRich44 as ServerCase).options), ...extra});
        assert.equal(prompt.includes(fixture.lead), false, JSON.stringify(extra));
        assert.equal(prompt.includes(ANIMAL_RICH_LAST_CHECK_LINE), false, JSON.stringify(extra));
    }
});

test("speakableText says what the server says", () => {
    for (const pair of fixture.speakableText) {
        assert.equal(speakableText(pair.input), pair.output, JSON.stringify(pair.input));
    }
});
