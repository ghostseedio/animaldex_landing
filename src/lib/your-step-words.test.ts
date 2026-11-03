import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {COMPANION_WORDS_EN, companionWords, fillWords} from "@/lib/companion-bond";
import {acceptingStep, decodeAnimalStep, reportingStep} from "@/lib/your-step";
import {trialFirstInstruction} from "@/lib/animal-trials";
import {
    stepDoneLabel,
    stepEarnedLine,
    stepPrimaryLabel,
    stepProblemText,
    stepReportStripText,
    trialPickedMessage,
    warmupOfferText,
    warmupQuestionLabel,
    warmupResultLine,
    warmupResultMessage
} from "@/lib/your-step-words";

const STEP = "5d6e7f80-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const indonesian = companionWords(JSON.parse(readFileSync(join(repoRoot, "src/data/locales/id.json"), "utf8")).companions);

test("the card's first button: I've done it, then Tell {name} again", () => {
    const offered = decodeAnimalStep({id: STEP, step: "Walk"})!;
    assert.equal(stepPrimaryLabel(offered, "Leo", COMPANION_WORDS_EN), "I've done it");
    assert.equal(stepPrimaryLabel(acceptingStep(offered), "Leo", COMPANION_WORDS_EN), "I've done it");
    assert.equal(stepPrimaryLabel(reportingStep(offered), "Leo", COMPANION_WORDS_EN), "Tell Leo more");
    assert.equal(stepPrimaryLabel(reportingStep(offered), "Leo", indonesian), "Ceritakan lagi kepada Leo");
    assert.equal(stepPrimaryLabel(offered, "Leo", indonesian), "Sudah saya lakukan");
});

test("what is sent to the animal is the person's own message, in their language", () => {
    assert.equal(trialPickedMessage("LOW", COMPANION_WORDS_EN), "I'll try your Easy Trial.");
    assert.equal(trialPickedMessage("high", indonesian), "Aku akan mencoba Uji Coba Sulit milikmu.");
    assert.equal(trialPickedMessage(null, COMPANION_WORDS_EN), null);
    assert.equal(warmupResultMessage({passed: true, correct: [true, true, true]}, COMPANION_WORDS_EN), "I got 3 of 3 on your warmup.");
    assert.equal(warmupResultMessage({passed: false, correct: [true, false, false]}, COMPANION_WORDS_EN), "I got 1 of 3 on your warmup.");
    assert.equal(warmupResultMessage({passed: false, correct: [false, false]}, indonesian), "Aku menjawab benar 0 dari 2 soal di pemanasanmu.");
    assert.equal(warmupOfferText("Sentinel Shift", 2, COMPANION_WORDS_EN), "Two quick questions on Sentinel Shift.");
    assert.equal(warmupOfferText("Sentinel Shift", 3, COMPANION_WORDS_EN), "3 quick questions on Sentinel Shift.");
    assert.equal(COMPANION_WORDS_EN.journey.step.otherMessage, "Can I have a different step?");
});

test("every refusal is said calmly, in the reader's language, never as a code or a lock", () => {
    assert.equal(stepProblemText("step_not_open", COMPANION_WORDS_EN), "That step isn't open any more.");
    assert.equal(stepProblemText("species_not_unlocked", COMPANION_WORDS_EN), "Capture this animal first to make one of its Trials your step.");
    assert.equal(stepProblemText("account_too_short", indonesian), "Tulis sedikit lagi: beberapa kata tentang apa yang terjadi.");
    assert.equal(stepProblemText("too_many_media", COMPANION_WORDS_EN), "Add one photo or video at most.");
    assert.equal(stepProblemText("media_path_not_owned", COMPANION_WORDS_EN), stepProblemText("upload_failed", COMPANION_WORDS_EN));
    assert.equal(stepProblemText("whatever", COMPANION_WORDS_EN), "That didn't go through. Try again in a moment.");
    for (const text of Object.values(COMPANION_WORDS_EN.journey.problems)) {
        assert.equal(/tomorrow|lock|_/.test(text), false, text);
    }
});

test("the inline words (docs/your-step/INLINE.md): the report strip, done, the Power earned and the Warmup, in en and id", () => {
    assert.equal(stepReportStripText("Leo", COMPANION_WORDS_EN), "Telling Leo how your step went");
    assert.equal(stepReportStripText("Leo", indonesian), "Menceritakan langkah Anda kepada Leo");
    assert.equal(fillWords(COMPANION_WORDS_EN.journey.report.placeholder, {name: "Leo"}), "Tell Leo how it went");
    assert.equal(stepDoneLabel(5, COMPANION_WORDS_EN), "Done together · +5 XP");
    assert.equal(stepDoneLabel(0, COMPANION_WORDS_EN), "Done together");
    assert.equal(stepDoneLabel(5, indonesian), "Selesai bersama · +5 XP");
    assert.equal(stepEarnedLine("Leo", COMPANION_WORDS_EN), "Leo's Power is yours · Earned in your own life");
    assert.equal(stepEarnedLine("Leo", indonesian), "Kekuatan Leo kini milik Anda · Didapatkan dalam hidup Anda sendiri");
    assert.equal(warmupQuestionLabel(1, 3, COMPANION_WORDS_EN), "Warmup · 1 of 3");
    assert.equal(warmupQuestionLabel(2, 2, indonesian), "Pemanasan · 2 dari 2");
    assert.equal(warmupResultLine({passed: true, rewardXP: 5, alreadyCompleted: false}, "Leo", COMPANION_WORDS_EN), "Warmup done · +5 XP");
    assert.equal(warmupResultLine({passed: true, rewardXP: 5, alreadyCompleted: true}, "Leo", COMPANION_WORDS_EN), "Warmup done");
    assert.equal(warmupResultLine({passed: false, rewardXP: 0, alreadyCompleted: false}, "Leo", COMPANION_WORDS_EN), "Not quite. Leo will tell you how its kind sees it.");
    assert.equal(warmupResultLine({passed: true, rewardXP: 5, alreadyCompleted: false}, "Leo", indonesian), "Pemanasan selesai · +5 XP");
});

test("the newcomer words (UX vet, 2026-10-30): what the chat is for and A different step, in en and id", () => {
    assert.equal(COMPANION_WORDS_EN.journey.step.other, "A different step");
    assert.equal(indonesian.journey.step.other, "Langkah yang lain");
    assert.equal(fillWords(COMPANION_WORDS_EN.journey.chat.placeholder, {name: "Leo"}), "Tell Leo what's on your mind…");
    assert.equal(fillWords(indonesian.journey.chat.placeholder, {name: "Leo"}), "Ceritakan kepada Leo apa yang sedang Anda pikirkan…");
    assert.equal(COMPANION_WORDS_EN.journey.chat.caption, "Bring it something real. It answers from how its kind lives and sets you one step. Do it, and its Power is yours.");
    assert.notEqual(indonesian.journey.chat.caption, COMPANION_WORDS_EN.journey.chat.caption);
    assert.equal(COMPANION_WORDS_EN.journey.chat.visitorHint, "Ask it about something in your own life.");
    assert.equal(indonesian.journey.chat.visitorHint, "Tanyakan tentang sesuatu dalam hidup Anda sendiri.");
});

test("a Trial reads at a glance: its first instruction, plainly, under its title", () => {
    assert.equal(trialFirstInstruction("1. Stand by a doorway. 2. Count to five."), "Stand by a doorway.");
    assert.equal(trialFirstInstruction("Step 1: Pick one tab to keep.\nStep 2: Close the rest."), "Pick one tab to keep.");
    assert.equal(trialFirstInstruction("\n- Say one sentence first\n- Then listen"), "Say one sentence first");
    assert.equal(trialFirstInstruction("Run a whole discussion: open it, steer it, close it."), "Run a whole discussion: open it, steer it, close it.");
    assert.equal(trialFirstInstruction(""), "");
    assert.ok(trialFirstInstruction(`${"word ".repeat(60)}end.`).endsWith("…"));
});
