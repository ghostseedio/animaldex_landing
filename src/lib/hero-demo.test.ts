import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {describe, it} from "node:test";
import {fileURLToPath} from "node:url";
import {
    HERO_DEMO_ANIMAL,
    HERO_DEMO_CHIPS,
    HERO_DEMO_FOLLOW_UP_SENTINEL,
    HERO_DEMO_TALK_PATH,
    heroDemoFailureFor,
    heroDemoFollowUps,
    heroDemoRequestBody,
    heroDemoThreadText,
    heroDemoVisibleText,
    splitStreamFrames
} from "./hero-demo";
import {ASK_FOLLOW_UP_SENTINEL} from "./ask-animaldex/prompt";
import {askThreadKey} from "./ask-animaldex/thread";
import {askSubjectFromPath} from "./ask-animaldex/subject";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const readRepo = (...parts: string[]) => readFileSync(join(repoRoot, ...parts), "utf8");

describe("the home hero demo", () => {
    it("is mostly ideas and one problem, each with its words in both languages", () => {
        assert.deepEqual(HERO_DEMO_CHIPS.map((chip) => chip.kind), ["idea", "idea", "idea", "problem"]);
        for (const locale of ["en", "id"]) {
            const demo = JSON.parse(readRepo("src/data/locales", `${locale}.json`)).home.demo;
            for (const chip of HERO_DEMO_CHIPS) {
                const words = demo.chips[chip.id];
                assert.equal(typeof words.label, "string", `${locale} ${chip.id}`);
                assert.ok(words.message.length >= 3 && words.message.length <= 900, `${locale} ${chip.id} message`);
                assert.equal(words.usual.length, 3, `${locale} ${chip.id}: the usual answer is three lines`);
            }
        }
        const en = JSON.parse(readRepo("src/data/locales/en.json")).home.demo;
        assert.deepEqual(HERO_DEMO_CHIPS.map((chip) => en.chips[chip.id].label), ["Start a podcast", "Move abroad", "Quit sugar", "Three things due tomorrow"]);
    });

    it("never names another assistant or brand in the example, and never says guaranteed", () => {
        const copy = JSON.stringify(JSON.parse(readRepo("src/data/locales/en.json")).home.demo);
        assert.doesNotMatch(copy, /ChatGPT|Gemini|Claude|Copilot|Siri|Alexa|OpenAI|Google|Spotify|Apple Podcasts/i);
        assert.doesNotMatch(copy, /guarantee/i);
        assert.match(copy, /"exampleTag":"Example"/);
    });

    it("asks as the lion's own chat, so Keep talking continues the same thread", () => {
        const body = heroDemoRequestBody({message: "I want to start a podcast.", locale: "en", requestId: "11111111-2222-4333-8444-555555555555", utcOffsetMinutes: 420});
        assert.equal(body.question, "I want to start a podcast.");
        assert.deepEqual(body.history, []);
        assert.equal(body.subject.path, HERO_DEMO_TALK_PATH);
        assert.equal(HERO_DEMO_TALK_PATH, "/talk/african-lion");
        // The server rebuilds the subject from the path (resolveAskSubject): the lion, as on its Talk page.
        const subject = askSubjectFromPath(body.subject.path);
        assert.equal(subject.scope, "species");
        assert.equal(subject.kind, "talk");
        assert.equal(subject.slug, HERO_DEMO_ANIMAL.slug);
        assert.equal(askThreadKey(subject), "species:african-lion");
    });

    it("reads the stream frame by frame, keeping a half frame for later", () => {
        const first = splitStreamFrames(`data: {"persona":{"name":"x"}}\n\ndata: {"delta":"The roar"}\n\ndata: {"del`);
        assert.deepEqual(first.events, [{persona: {name: "x"}}, {delta: "The roar"}]);
        assert.equal(first.rest, `data: {"del`);
        const second = splitStreamFrames(`${first.rest}ta":" counts."}\r\n\r\ndata: not json\n\n: comment\n\n`);
        assert.deepEqual(second.events, [{delta: " counts."}]);
        assert.equal(second.rest, "");
    });

    it("shows the reply's words only: no follow-ups, no half sentinel, no drawn medium, no markdown", () => {
        assert.equal(HERO_DEMO_FOLLOW_UP_SENTINEL, ASK_FOLLOW_UP_SENTINEL);
        assert.equal(heroDemoVisibleText(`A pride hunts at dusk.\n${ASK_FOLLOW_UP_SENTINEL}\nWhat next?`), "A pride hunts at dusk.");
        assert.equal(heroDemoVisibleText("A pride hunts §§FOLL"), "A pride hunts");
        assert.equal(heroDemoVisibleText("**The roar** is an *honest* count.\n\n- Say it first"), "The roar is an honest count.\n\nSay it first");
        assert.equal(heroDemoVisibleText("Before\n```animaldex-flow\nA -> B\n```\nAfter"), "Before\n\nAfter");
        assert.equal(heroDemoVisibleText("Before\n```animaldex-scale\nhalf"), "Before");
        assert.equal(heroDemoVisibleText("See [the pride](/animals/lion)."), "See the pride.");
        assert.equal(heroDemoVisibleText("2 * 3 = 6"), "2 * 3 = 6");
    });

    it("carries the reply into the thread with its own markdown, and the offers the stream ended with", () => {
        assert.equal(heroDemoThreadText(`**The roar** counts.\n\n\`\`\`animaldex-flow\n{}\n\`\`\`\n${ASK_FOLLOW_UP_SENTINEL}\nNext?`), "**The roar** counts.\n\n```animaldex-flow\n{}\n```");
        assert.deepEqual(heroDemoFollowUps(["One", " ", 3, "Two", "Three", "Four"]), ["One", "Two", "Three"]);
        assert.deepEqual(heroDemoFollowUps(null), []);
    });

    it("says the day's free messages ran out on a 429, and that the lion could not answer otherwise", () => {
        assert.equal(heroDemoFailureFor(429), "limit");
        assert.equal(heroDemoFailureFor(503), "unavailable");
        assert.equal(heroDemoFailureFor(500), "unavailable");
    });
});
