import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {animalAskedLast, smallTalkByWords} from "./ask-animaldex/small-talk";
import {prestartAnswerSource} from "./ask-animaldex/answer-prestart";

// The small-talk shortcut (2026-11-07): the same table as the apps'
// supabase/functions/_shared/animal-small-talk.test.ts.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const readCode = (...parts: string[]) => readFileSync(join(repoRoot, ...parts), "utf8");

const names = ["Luna", "Gray Wolf"];

const ROUTED_BY_WORDS: string[] = [
    "hi", "Hi!", "hiii", "hey", "heyyy 👋", "hello", "hello there", "yo", "gm", "good morning", "Good morning Luna!",
    "morning", "hola", "hi luna", "hey wolf", "hi gray wolf",
    "thanks", "thank you", "Thanks Luna", "thanks again", "thx", "ty", "tysm", "cheers",
    "lol", "lmao", "haha", "hahaha", "hehe", "nice", "cool", "wow", "aww", "omg",
    "bye", "goodbye", "bye bye", "good night", "night", "gn", "good night luna", "see you", "see ya", "later", "brb",
    "ok", "okay", "k", "alright", "got it", "sounds good"
];

const WAITS_FOR_THE_VERDICT: string[] = [
    "hi, my boss…",
    "hi, my boss keeps ignoring me",
    "hey can I ask you something",
    "hi?", "ok?", "thanks?", "how are you?",
    "night, so sad", "bye, so lonely", "hi i'm stuck", "should i", "help",
    "good morning my dear luna", "thanks for nothing", "bye forever", "goodbye world", "good night forever",
    "yes", "no", "sure", "maybe", "why", "what", "luna", "👋", "", "   ",
    "hello hello hello hello hello hello hello hello hello hello hello hello"
];

test("whole small-talk phrases route by their words", () => {
    for (const message of ROUTED_BY_WORDS) assert.equal(smallTalkByWords({message, names}), true, message);
});

test("anything else waits for the verdict, as before", () => {
    for (const message of WAITS_FOR_THE_VERDICT) assert.equal(smallTalkByWords({message, names}), false, message);
});

test("an ok after the animal asked something may be a yes: it waits", () => {
    const asked = "Want me to tell you what a wolf would do? 🐺";
    for (const message of ["ok", "okay", "alright", "sounds good"]) {
        assert.equal(smallTalkByWords({message, names, lastAnimalMessage: asked}), false, message);
        assert.equal(smallTalkByWords({message, names, lastAnimalMessage: "The pack moves at dawn."}), true, message);
    }
    assert.equal(smallTalkByWords({message: "thanks", names, lastAnimalMessage: asked}), true);
    assert.equal(smallTalkByWords({message: "good night", names, lastAnimalMessage: asked}), true);
});

test("the animal's last line asked something, past trailing emoji, quotes and markdown", () => {
    assert.equal(animalAskedLast("Who is in your pack right now?"), true);
    assert.equal(animalAskedLast("Who is in your pack right now? 🐺 "), true);
    assert.equal(animalAskedLast("**What would you do?**"), true);
    assert.equal(animalAskedLast("Start at first light."), false);
    assert.equal(animalAskedLast("Is it? No. It is not."), false);
    assert.equal(animalAskedLast(null), false);
});

test("names are only the animal's: a nickname that is a problem word still waits", () => {
    assert.equal(smallTalkByWords({message: "hi sad", names: ["Sad"]}), false);
    assert.equal(smallTalkByWords({message: "hi pip", names: ["Pip"]}), true);
    assert.equal(smallTalkByWords({message: "hi pip", names: []}), false);
});

test("a prestarted reply hands over what arrived early, then the rest; a failure is thrown where it is read", async () => {
    const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
    const source = prestartAnswerSource(async (emit) => {
        emit("Hey");
        await tick();
        emit(" there.");
    });
    await tick();
    const said: string[] = [];
    await source((delta) => said.push(delta));
    assert.equal(said.join(""), "Hey there.");
    const failing = prestartAnswerSource(() => Promise.reject(new Error("model_down")));
    await tick();
    await assert.rejects(() => failing(() => undefined), /model_down/);
});

test("the stream route: small talk skips the verdict, every typed turn reads the crisis check first, and a small-talk reply starts beside it", () => {
    const route = readCode("src/app/api/ask/stream/route.ts");
    assert.ok(route.includes("const smallTalk = !isGreeting && !stepReportId && !subject.trialContext && !isCall && smallTalkByWords({"));
    assert.ok(route.includes("const turnRead = smallTalk ? null : await kindVerdict;"));
    assert.ok(route.includes("if (!isGreeting && !deferCrisis) {\n        const crisis = await crisisFor();\n        if (crisis.crisis) return await crisisResponse(crisis);"));
    assert.ok(route.includes("const prestarted = earlySource ? prestartAnswerSource(earlySource) : null;"));
    assert.ok(route.includes("early.abort();\n            return await crisisResponse(crisis);"));
    assert.ok(route.includes("const source = prestarted && provider === earlyProvider ? prestarted : sourceFor(provider);"));
});

test("the web's router and prestart are the apps' files, word for word", () => {
    const strip = (text: string) => text.split("\n").slice(1).join("\n");
    const router = readCode("src/lib/ask-animaldex/small-talk.ts");
    assert.ok(router.startsWith("/* Ported from the apps' supabase/functions/_shared/animal-small-talk.ts"));
    assert.ok(strip(router).includes('import { heuristicTurnKind } from "./turn-kind";'));
});
