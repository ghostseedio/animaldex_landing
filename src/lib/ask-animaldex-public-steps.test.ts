import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {ANIMAL_PUBLIC_CHAT_RULES, ANIMAL_PUBLIC_STEP_RULES, PUBLIC_STEP_OUTPUT_LINES, buildAskStreamingSystemPrompt} from "@/lib/ask-animaldex/prompt";
import {extractCompanionLines} from "@/lib/ask-animaldex/companion-focus";
import {isEmptyCompanionEvent, normalizeCompanionEvent, parseCompanionUpdate} from "@/lib/ask-animaldex/companion-loop";
import {askPublicReplySpecials} from "@/lib/ask-animaldex/special-messages";
import {ASK_FOLLOW_UP_SENTINEL} from "@/lib/ask-animaldex/prompt";

const readRepo = (file: string) => readFileSync(join(process.cwd(), file), "utf8");
const base = {scope: "species" as const, animalName: "Red Fox", mode: "auto" as const, supportedVisuals: [], publicChat: true};

// Web only (owner, 2026-11-01): a public chat's animal may set a step, taken on in the app.

test("a public chat with steps on gets the step rules and the hidden TRIAL line, not the apps' no-steps line", () => {
    const prompt = buildAskStreamingSystemPrompt({...base, publicSteps: true});
    assert.ok(prompt.includes(ANIMAL_PUBLIC_STEP_RULES.join("\n")));
    assert.ok(prompt.includes(PUBLIC_STEP_OUTPUT_LINES.join("\n")));
    assert.ok(!prompt.includes(ANIMAL_PUBLIC_CHAT_RULES[1]), "the apps' 'set no steps' line is replaced");
    // Still no Warmup, debates or cards, and never small talk or a first reply.
    assert.match(prompt, /Offer no Warmup or debates and send no cards/);
    assert.match(prompt, /Never in small talk, never in your first reply/);
});

test("without steps on, on a call, with steps turned off or in training, the apps' public rules stand", () => {
    for (const options of [
        {...base},
        {...base, publicSteps: true, call: true},
        {...base, publicSteps: true, suggestSteps: false},
        {...base, publicSteps: true, mode: "training" as const}
    ]) {
        const prompt = buildAskStreamingSystemPrompt(options);
        assert.ok(!prompt.includes(PUBLIC_STEP_OUTPUT_LINES[1]), JSON.stringify(options));
        assert.ok(!prompt.includes(ANIMAL_PUBLIC_STEP_RULES[2]), JSON.stringify(options));
    }
});

test("the hidden TRIAL line is taken out of the reply and comes back as a preview step", () => {
    const raw = `Try asking her for ten minutes on Friday.\n${ASK_FOLLOW_UP_SENTINEL}\nWhat if she says no?\nTRIAL: Ask your manager for ten minutes on Friday | 3`;
    const hidden = extractCompanionLines(raw);
    assert.ok(!hidden.raw.includes("TRIAL:"));
    assert.equal(hidden.lines.trial?.step, "Ask your manager for ten minutes on Friday");

    const update = parseCompanionUpdate({trial_preview: {step: hidden.lines.trial?.step}});
    assert.deepEqual(update?.event.stepPreview, {step: "Ask your manager for ten minutes on Friday"});
    assert.equal(isEmptyCompanionEvent(update?.event), false);
    // Kept with the thread in this browser, and read back.
    assert.deepEqual(normalizeCompanionEvent(JSON.parse(JSON.stringify(update?.event))), {stepPreview: {step: "Ask your manager for ten minutes on Friday"}});
    assert.equal(normalizeCompanionEvent({stepPreview: {step: "  "}}), null);
});

test("only a finished reply that set a step shows it", () => {
    const companionEvent = {stepPreview: {step: "Ask for ten minutes on Friday"}};
    assert.deepEqual(askPublicReplySpecials({role: "assistant", status: "complete", companionEvent}), [{kind: "stepPreview", step: "Ask for ten minutes on Friday"}]);
    assert.deepEqual(askPublicReplySpecials({role: "assistant", status: "streaming", companionEvent}), []);
    assert.deepEqual(askPublicReplySpecials({role: "user", status: "complete", companionEvent}), []);
    assert.deepEqual(askPublicReplySpecials({role: "assistant", status: "complete"}), []);
});

test("the route sets public steps only off a call and a greeting, with a kill switch, and saves nothing", () => {
    const route = readRepo("src/app/api/ask/stream/route.ts");
    assert.match(route, /const publicSteps = publicChat && !isCall && !isGreeting && process\.env\.ASK_PUBLIC_STEPS !== "off"/);
    assert.match(route, /trial_preview: \{step: lines\.trial\.step\}/);
    // I'll do it on a public step goes to the app, counted as its own placement.
    const chat = readRepo("src/components/ask-animaldex/ask-conversation.tsx");
    assert.match(chat, /rememberStorePlacement\("page_talk_step"\)/);
    assert.match(chat, /fillWords\(talkWords\.capStepNote/);
});

test("the public chat never says a step needs a capture: steps are offered right there, only debates need the app (Nov 2026)", () => {
    const chips = readRepo("src/components/ask-animaldex/talk-capabilities.tsx");
    assert.match(chips, /words\.capStepHere/);
    assert.match(chips, /words\.capDebatesInApp/);
    assert.doesNotMatch(chips, /capInAppNote|label=\{words\.capInApp\}/);
    for (const locale of ["en", "id"]) {
        const words = JSON.parse(readRepo(`src/data/locales/${locale}.json`)).talkPage;
        for (const key of ["capStepHere", "capStepNote", "signUpForMore", "capDebatesInApp"]) assert.equal(typeof words[key], "string", `${locale} ${key}`);
    }
    const en = JSON.parse(readRepo("src/data/locales/en.json")).talkPage;
    for (const key of ["capStepHere", "capStepNote", "signUpForMore"]) {
        assert.doesNotMatch(en[key], /capture one in the app to start|to set steps/i, key);
    }
    assert.doesNotMatch(readRepo("public/llms.txt"), /Your step, Powers and debates need an account/);
});
