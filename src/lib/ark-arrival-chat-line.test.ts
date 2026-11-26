/**
 * "See it in the Ark": the server writes "I've arrived in the Ark!" in English (`animal_messages` kind `arrival`,
 * migration 20261127190000). The web chat and the Companions row show it in the reader's language, as the apps do
 * (iOS `AnimalInboxMessage.displayText`); every other message stays as the animal wrote it.
 */

import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";

import {ARK_ARRIVAL_LINE_EN, askAnimalMessageDisplayText} from "@/lib/ask-animaldex/animal-messages";
import {COMPANION_WORDS_EN, companionWords} from "@/lib/companion-bond";
import {buildCompanionRows, type AnimalConversation} from "@/lib/companion-rows";

const dir = path.join(process.cwd(), "src/data/locales");
const read = (file: string) => JSON.parse(readFileSync(file, "utf8"));

test("the arrival line shows in the reader's language; anything else as written", () => {
    assert.equal(COMPANION_WORDS_EN.ark.arrivedLine, ARK_ARRIVAL_LINE_EN);
    assert.equal(askAnimalMessageDisplayText("  I've arrived in the Ark! ", "Ich bin in der Ark angekommen!"), "Ich bin in der Ark angekommen!");
    assert.equal(askAnimalMessageDisplayText("I've arrived in the Ark! Come see.", "Ich bin in der Ark angekommen!"), "I've arrived in the Ark! Come see.");
    assert.equal(askAnimalMessageDisplayText("The current turned today.", "x"), "The current turned today.");
    assert.equal(askAnimalMessageDisplayText(ARK_ARRIVAL_LINE_EN, "  "), ARK_ARRIVAL_LINE_EN, "no words, the English stands");
});

test("every web language has its own arrival line", () => {
    const files = [path.join(dir, "en.json"), path.join(dir, "id.json"), ...readdirSync(path.join(dir, "ark")).map((f) => path.join(dir, "ark", f))];
    assert.equal(files.length, 45);
    for (const file of files) {
        const line = read(file).companions?.ark?.arrivedLine;
        assert.ok(typeof line === "string" && line.trim(), file);
        if (!file.endsWith("en.json")) assert.notEqual(line, ARK_ARRIVAL_LINE_EN, file);
    }
});

test("the Companions row's last line is the translated arrival line", () => {
    const words = companionWords(read(path.join(dir, "ark", "de.json")).companions);
    const conversation: AnimalConversation = {
        speciesProfileId: "11111111-1111-4111-8111-111111111111",
        captureId: "22222222-2222-4222-8222-222222222222",
        animalName: "Red Fox",
        nickname: null,
        lastMessageBody: ARK_ARRIVAL_LINE_EN,
        lastMessageAt: "2026-11-26T08:00:00Z",
        lastTalkedAt: null,
        unreadCount: 1,
        muted: false
    } as AnimalConversation;
    const rows = buildCompanionRows({companions: [], conversations: [conversation], cards: [], words});
    assert.equal(rows[0]?.lastMessage?.text, "Ich bin in der Ark angekommen!");
});

test("the chat thread maps the arrival line when the animal's messages join it", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/ask-animaldex/ask-conversation.tsx"), "utf8");
    assert.match(source, /createAskMessage\("assistant", askAnimalMessageDisplayText\(message\.body, words\.ark\.arrivedLine\)/);
});
