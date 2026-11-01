import assert from "node:assert/strict";
import test from "node:test";

// Talk on the web (docs/rich-chat/SPEC.md, sections 1 and 4): the pure half
// of the full-screen chat, the rich layout pieces and what a turn sends.
import {
    normalizeTalkThreadMetas,
    talkAnimalTitle,
    talkCapabilityAction,
    talkChatPath,
    talkDisagreePairs,
    talkRecentChats,
    talkRelativeTime,
    talkSearch,
    talkWords,
    TALK_WORDS_EN
} from "@/lib/ask-animaldex/talk";
import {askCopyText, askReplyIsRealProblem, askTextColumns, askTurnVisuals} from "@/lib/ask-animaldex/rich";
import {askHeadingParts, askPieceIsWide, askReplyPieces} from "@/lib/ask-animaldex/thread-layout";
import {askSubjectFromPath} from "@/lib/ask-animaldex/subject";
import {askThreadKey, type AskMessage} from "@/lib/ask-animaldex/thread";

const NOW = new Date("2026-10-31T15:00:00").getTime();
const at = (hoursAgo: number) => new Date(NOW - hoursAgo * 3600e3).toISOString();
const message = (role: "user" | "assistant", text: string, createdAt: string): AskMessage => ({
    id: `${role}-${createdAt}-${text.length}`, role, text, status: "complete", followUpPrompts: [], createdAt
});

// MARK: - Rich layout

test("a bubble that holds a table or a diagram widens; plain bubbles keep their width", () => {
    const reply = [
        "Take it, slowly.",
        "",
        "## 🧭 What I would do",
        "1. **Ask for a month** first.",
        "",
        "| Way | Gives |",
        "|---|---|",
        "| Wait | Time |",
        "",
        "```text",
        "THE FORK",
        "┌────┐",
        "```"
    ].join("\n");
    const pieces = askReplyPieces(reply, true);
    // The table stays with the heading's bubble (its own thought); the diagram is its own.
    assert.deepEqual(pieces.map(askPieceIsWide), [false, true, true]);
    // A diagram still arriving is wide already: its panel draws what has come.
    assert.equal(askPieceIsWide(askReplyPieces("```text\nTHE LOOP\n┌──", false)[0]), true);
});

test("a heading's emoji is drawn before its title, and a heading without one is all title", () => {
    assert.deepEqual(askHeadingParts("🌙 What I would do"), {emoji: "🌙", title: "What I would do"});
    assert.deepEqual(askHeadingParts("⚖️ The two ways"), {emoji: "⚖️", title: "The two ways"});
    assert.deepEqual(askHeadingParts("👨‍👩‍👧 Your pack"), {emoji: "👨‍👩‍👧", title: "Your pack"});
    assert.deepEqual(askHeadingParts("Where it fits"), {emoji: null, title: "Where it fits"});
    assert.deepEqual(askHeadingParts("🌙"), {emoji: null, title: "🌙"});
});

test("text_columns is the column over the advance of M, clamped as the server clamps it", () => {
    assert.equal(askTextColumns(562, 7.8), 72);
    assert.equal(askTextColumns(296, 7.8), 37);
    assert.equal(askTextColumns(100, 7.8), 28);
    assert.equal(askTextColumns(2000, 7.8), 80);
    // Before the font is measured: 13 px JetBrains Mono's advance.
    assert.equal(askTextColumns(343, null), 43);
});

test("every one-to-one turn says rich with its columns; calls never do", () => {
    assert.deepEqual(askTurnVisuals({ownerVisuals: ["step", "card", "debate"], richColumns: 44}), {supported_visuals: ["step", "card", "debate", "rich"], text_columns: 44});
    assert.deepEqual(askTurnVisuals({ownerVisuals: null, richColumns: 72}), {supported_visuals: ["rich"], text_columns: 72});
    assert.deepEqual(askTurnVisuals({ownerVisuals: ["step", "card", "debate"], richColumns: 44, call: true}), {supported_visuals: ["step", "card", "debate"]});
    // Not measured yet (or the site-wide assistant): as before.
    assert.deepEqual(askTurnVisuals({ownerVisuals: null, richColumns: null}), {});
});

test("a reply answered a real problem when it holds a heading or a numbered list, never in a hello", () => {
    assert.equal(askReplyIsRealProblem("Take it.\n\n## 🌙 What I would do\nWait a night."), true);
    assert.equal(askReplyIsRealProblem("Here is how:\n1. **Watch** first.\n2. Then go."), true);
    assert.equal(askReplyIsRealProblem("Evening. The snow is deep on the ridge today."), false);
    assert.equal(askReplyIsRealProblem("- **Wait**: the dark is mine\n- **Go**: the day is yours"), false);
    assert.equal(askReplyIsRealProblem("```text\n## NOT A HEADING\n1. inside a diagram\n```"), false);
});

// MARK: - The page

test("/talk is the Talk page; /talk/<slug> is that animal's thread, the one its species page uses", () => {
    assert.equal(askSubjectFromPath("/talk").kind, "talk");
    assert.equal(askSubjectFromPath("/talk").scope, "general");
    const chat = askSubjectFromPath("/id/talk/gray-wolf");
    assert.equal(chat.kind, "talk");
    assert.equal(chat.scope, "species");
    assert.equal(chat.slug, "gray-wolf");
    assert.equal(askThreadKey(chat), askThreadKey(askSubjectFromPath("/animals/gray-wolf")));
    // The drawer's Full screen keeps the key: the animal's chat, or the card's.
    assert.equal(talkChatPath({slug: "gray-wolf", captureId: null}), "/talk/gray-wolf");
    assert.equal(talkChatPath({slug: "gray-wolf", captureId: "00000000-0000-4000-8000-0000000000c1"}), "/talk/gray-wolf?card=00000000-0000-4000-8000-0000000000c1");
});

test("the title reads Talk to a or an {Animal}", () => {
    assert.equal(talkAnimalTitle("Gray Wolf", TALK_WORDS_EN), "Talk to a Gray Wolf");
    assert.equal(talkAnimalTitle("Owl", TALK_WORDS_EN), "Talk to an Owl");
    assert.equal(talkAnimalTitle("European Badger", TALK_WORDS_EN), "Talk to a European Badger");
    assert.equal(talkAnimalTitle("Indian Peafowl", TALK_WORDS_EN), "Talk to an Indian Peafowl");
    // Another language's words, with English for what it lacks.
    const id = talkWords({animalTitleA: "Bicara dengan {animal}", animalTitleAn: "Bicara dengan {animal}", newChat: ""});
    assert.equal(talkAnimalTitle("Owl", id), "Bicara dengan Owl");
    assert.equal(id.newChat, TALK_WORDS_EN.newChat);
});

test("Recent chats: every animal thread with a message, newest first, Today / Yesterday / Earlier", () => {
    const threads = {
        "species:gray-wolf": [message("assistant", "Hello again.", at(30)), message("user", "Should I take it?", at(2)), message("assistant", "## 🌙 What I would do\nWait a night.", at(1.9))],
        "species:red-fox": [message("assistant", "**Evening**. Who's there?", at(20))],
        "capture:00000000-0000-4000-8000-0000000000c1": [message("user", "I did it", at(50))],
        // A card's thread without its name kept cannot be opened: left out.
        "capture:00000000-0000-4000-8000-0000000000c2": [message("user", "Hi", at(1))],
        general: [message("user", "What is AnimalDex?", at(0.5))],
        "trial:wolf-mid": [message("user", "How?", at(0.5))],
        "species:koala": []
    };
    const metas = normalizeTalkThreadMetas({
        "species:gray-wolf": {slug: "gray-wolf", name: "Gray Wolf", captureId: null, nickname: null},
        "capture:00000000-0000-4000-8000-0000000000c1": {slug: "eurasian-otter", name: "Eurasian Otter", captureId: "00000000-0000-4000-8000-0000000000c1", nickname: "Pip"},
        "species:bad": {slug: "Not A Slug", name: "x"},
        general: {slug: "x", name: "y"}
    });
    assert.deepEqual(Object.keys(metas).sort(), ["capture:00000000-0000-4000-8000-0000000000c1", "species:gray-wolf"]);
    const groups = talkRecentChats(threads, metas, NOW);
    assert.deepEqual(groups.map((group) => [group.group, group.chats.map((chat) => chat.name)]), [
        ["today", ["Gray Wolf"]],
        ["yesterday", ["Red Fox"]],
        ["earlier", ["Pip"]]
    ]);
    const wolf = groups[0].chats[0];
    // The last message's first line, plain: no heading marks, no emoji left behind by them.
    assert.equal(wolf.preview, "🌙 What I would do");
    assert.equal(groups[1].chats[0].preview, "Evening. Who's there?");
    // Named from its slug when no name was kept.
    assert.equal(groups[1].chats[0].slug, "red-fox");
    assert.equal(groups[2].chats[0].captureId, "00000000-0000-4000-8000-0000000000c1");
    assert.equal(talkChatPath(groups[2].chats[0]), "/talk/eurasian-otter?card=00000000-0000-4000-8000-0000000000c1");
});

test("a chat's time: the clock today, Yesterday, then the date", () => {
    assert.equal(talkRelativeTime(NOW - 3600e3, {locale: "en", yesterday: "Yesterday", now: NOW}), "14:00");
    assert.equal(talkRelativeTime(NOW - 20 * 3600e3, {locale: "en", yesterday: "Yesterday", now: NOW}), "Yesterday");
    assert.match(talkRelativeTime(new Date("2026-10-12T09:00:00").getTime(), {locale: "en", yesterday: "Yesterday", now: NOW}), /12 Oct|Oct 12/);
});

test("the picker finds an animal by its common name: the name, its head noun, then its start, the better known first", () => {
    const animals = [
        {slug: "burrowing-owl", name: "Burrowing Owl", power: "Borrowed Shelter"},
        {slug: "owl", name: "Owl", power: null},
        {slug: "snowy-owl", name: "Snowy Owl", power: "Arctic Vigil"},
        {slug: "bowhead-whale", name: "Bowhead Whale", power: null},
        {slug: "gray-wolf", name: "Gray Wolf", power: "Pack Pursuit"}
    ];
    // Both end in "owl": the catalog's order (the better known first) decides between them.
    assert.deepEqual(talkSearch(animals, "owl").map((animal) => animal.slug), ["owl", "burrowing-owl", "snowy-owl"]);
    assert.deepEqual(talkSearch(animals, "  WOLF ").map((animal) => animal.slug), ["gray-wolf"]);
    assert.deepEqual(talkSearch(animals, ""), []);
    assert.equal(talkSearch(animals, "o", 2).length, 2);
});

test("They'll disagree: the catalog's own contrasts, best known first, each animal once", () => {
    const rows = [
        {landing_page_slug: "red-fox", display_name: "Red Fox", public_capture_count: 40, contrasting_species: [{display_name: "Koala"}, {display_name: "Llama"}]},
        {landing_page_slug: "koala", display_name: "Koala", public_capture_count: 30, contrasting_species: [{display_name: "Red Fox"}]},
        {landing_page_slug: "llama", display_name: "Llama", public_capture_count: 5, contrasting_species: []},
        {landing_page_slug: "barn-owl", display_name: "Barn Owl", public_capture_count: 20, contrasting_species: [{display_name: "Eagle"}, {display_name: "Peacock"}]},
        {landing_page_slug: "indian-peafowl", display_name: "Peacock", public_capture_count: 12, contrasting_species: null}
    ];
    assert.deepEqual(talkDisagreePairs(rows, 6), [["red-fox", "koala"], ["barn-owl", "indian-peafowl"]]);
    assert.deepEqual(talkDisagreePairs(rows, 1), [["red-fox", "koala"]]);
});

test("locked capabilities offer the app: an account alone unlocks neither steps, debates nor Trials (JRN-6)", () => {
    assert.equal(talkCapabilityAction("step", {signedIn: false}), "app");
    assert.equal(talkCapabilityAction("debates", {signedIn: false}), "app");
    assert.equal(talkCapabilityAction("trial", {signedIn: false}), "catch");
    assert.equal(talkCapabilityAction("step", {signedIn: true}), "app");
    assert.equal(talkCapabilityAction("debates", {signedIn: true}), "app");
    assert.equal(talkCapabilityAction("trial", {signedIn: true}), "catch");
});

test("Copy is the reply's own markdown, without the hidden cards or a drawing's JSON", () => {
    const raw = "Take it.\n\n## 🐺 What I would do\n| Way | Gives |\n|---|---|\n| Lead | Growth |\n\n```text\nTHE FORK\n┌──┐\n```\n\n```animaldex-card\n{\"kind\":\"debate\"}\n```";
    assert.equal(askCopyText(raw), "Take it.\n\n## 🐺 What I would do\n| Way | Gives |\n|---|---|\n| Lead | Growth |\n\n```text\nTHE FORK\n┌──┐\n```");
    assert.equal(askCopyText("Look:\n```animaldex-flow\n{\"steps\":[]}\n```\nDone."), "Look:\n\nDone.");
});
