import assert from "node:assert/strict";
import test from "node:test";

// A reply's own pictures (the owner, 2026-11-07): the animal's Trial loop and
// pictures AnimalDex already has, as fenced blocks the model may choose. The
// web port of the apps' AnimalChatBlocksTests and the server's
// "a loop and an image are described only to a build that draws them".
import {
    askChatBlockVisuals,
    askIsSpeciesArt,
    askSpeciesArtSlug,
    askVisualIdentity,
    askVisualSpokenSummary,
    decodeAskVisual
} from "@/lib/ask-animaldex/visuals";
import {askCopyText, askTurnVisuals} from "@/lib/ask-animaldex/rich";
import {askReplyPieces} from "@/lib/ask-animaldex/thread-layout";
import {askMarkdownPlainText} from "@/lib/ask-animaldex/markdown";
import {buildAskStreamingSystemPrompt, type AskPromptOptions, type AskVisualMedium} from "@/lib/ask-animaldex/prompt";

// MARK: - Decoding

test("a loop names one of the animal's own Trials", () => {
    assert.deepEqual(decodeAskVisual("animaldex-loop", '{"frequency":"mid","caption":"Two jobs open."}'), {
        kind: "loop",
        spec: {frequency: "MID", caption: "Two jobs open."}
    });
    // Freehand spellings the model may use.
    assert.deepEqual(decodeAskVisual("animaldex-loop", '{"trial":"HIGH","text":"Watch the first step."}'), {
        kind: "loop",
        spec: {frequency: "HIGH", caption: "Watch the first step."}
    });
    assert.deepEqual(decodeAskVisual("animaldex-loop", '{"freq":" low ","label":"Slow."}'), {kind: "loop", spec: {frequency: "LOW", caption: "Slow."}});
    assert.deepEqual(decodeAskVisual("animaldex-loop", '{"level":"Mid"}'), {kind: "loop", spec: {frequency: "MID", caption: null}});
    // A frequency the animal does not have, or none, is no loop.
    assert.equal(decodeAskVisual("animaldex-loop", '{"frequency":"EXTREME"}'), null);
    assert.equal(decodeAskVisual("animaldex-loop", '{"frequency":2}'), null);
    assert.equal(decodeAskVisual("animaldex-loop", '{"caption":"No Trial named."}'), null);
    assert.equal(decodeAskVisual("animaldex-loop", "not json"), null);
});

test("an image is the animal's Power or a contrasting species, and nothing else", () => {
    assert.deepEqual(decodeAskVisual("animaldex-image", '{"of":"power"}'), {kind: "image", spec: {of: "power", caption: null}});
    assert.deepEqual(decodeAskVisual("animaldex-image", '{"show":"Power","label":"Everyone knows their piece."}'), {
        kind: "image",
        spec: {of: "power", caption: "Everyone knows their piece."}
    });
    assert.deepEqual(decodeAskVisual("animaldex-image", '{"kind":"species","animal":"Red Fox","caption":"Alone, by surprise."}'), {
        kind: "image",
        spec: {of: "species", name: "Red Fox", caption: "Alone, by surprise."}
    });
    assert.deepEqual(decodeAskVisual("animaldex-image", '{"type":"species","species_name":"  Spotted Hyena ","text":"Loud."}'), {
        kind: "image",
        spec: {of: "species", name: "Spotted Hyena", caption: "Loud."}
    });
    // The spellings iOS reads for the same two things.
    assert.deepEqual(decodeAskVisual("animaldex-image", '{"of":"icon"}'), {kind: "image", spec: {of: "power", caption: null}});
    assert.deepEqual(decodeAskVisual("animaldex-image", '{"of":"animal","name":"Koala"}'), {kind: "image", spec: {of: "species", name: "Koala", caption: null}});
    // No name, or anything that is not ours to show: nothing.
    assert.equal(decodeAskVisual("animaldex-image", '{"of":"species"}'), null);
    assert.equal(decodeAskVisual("animaldex-image", '{"of":"species","name":"   "}'), null);
    assert.equal(decodeAskVisual("animaldex-image", '{"of":"photo_of_someone"}'), null);
    assert.equal(decodeAskVisual("animaldex-image", '{"name":"Red Fox"}'), null);
    assert.equal(decodeAskVisual("animaldex-image", '["power"]'), null);
});

test("each is a drawing the thread draws on its own, and an undrawable one is dropped", () => {
    const reply = "Close all but two.\n\n```animaldex-loop\n{\"frequency\":\"MID\"}\n```\n\nWrite the two down tonight.";
    const pieces = askReplyPieces(reply, true);
    assert.deepEqual(pieces.map((piece) => piece.kind), ["bubble", "visual", "bubble"]);
    const broken = "Look.\n\n```animaldex-image\n{\"of\":\"selfie\"}\n```";
    assert.deepEqual(askReplyPieces(broken, true).map((piece) => piece.kind), ["bubble"]);
    // Still arriving: the placeholder holds its place.
    assert.deepEqual(askReplyPieces("Look.\n\n```animaldex-image\n{\"of\":", false).map((piece) => piece.kind), ["bubble", "visual"]);
});

test("copied, spoken and keyed like the other drawings", () => {
    const reply = "Name who owns each piece.\n\n```animaldex-image\n{\"of\":\"species\",\"name\":\"Red Fox\",\"caption\":\"The fox hunts alone.\"}\n```";
    assert.equal(askCopyText(reply), "Name who owns each piece.");
    assert.equal(askMarkdownPlainText(reply), "Name who owns each piece. Red Fox: The fox hunts alone.");
    const loop = decodeAskVisual("animaldex-loop", '{"frequency":"MID","caption":"Two jobs open."}');
    const power = decodeAskVisual("animaldex-image", '{"of":"power"}');
    assert.ok(loop && power);
    assert.equal(askVisualSpokenSummary(loop), "Two jobs open.");
    assert.equal(askVisualSpokenSummary(power), "");
    assert.equal(askVisualIdentity(loop), "loop-MID");
    assert.equal(askVisualIdentity(power), "image-power");
});

test("a species named in an image finds its art by slug, and the stand-in is not art", () => {
    assert.equal(askSpeciesArtSlug("Red Fox"), "red-fox");
    assert.equal(askSpeciesArtSlug("Harris's Hawk"), "harriss-hawk");
    assert.equal(askSpeciesArtSlug("  Pallas’s Cat "), "pallass-cat");
    assert.equal(askSpeciesArtSlug("Gálapagos  Tortoise!"), "galapagos-tortoise");
    assert.equal(askSpeciesArtSlug("!!"), null);
    assert.equal(askIsSpeciesArt(250, 250), true);
    assert.equal(askIsSpeciesArt(1200, 900), false);
    assert.equal(askIsSpeciesArt(0, 0), false);
});

// MARK: - What a turn says it draws

test("a chat says loop and image only when it draws them; rich stays last; never on a call", () => {
    const owner = {ownerVisuals: ["step", "card", "debate"], richColumns: 44};
    // Off by default: as before.
    assert.deepEqual(askTurnVisuals(owner), {supported_visuals: ["step", "card", "debate", "rich"], text_columns: 44});
    assert.deepEqual(askTurnVisuals({...owner, chatBlocks: false}), {supported_visuals: ["step", "card", "debate", "rich"], text_columns: 44});
    const drawn = askTurnVisuals({...owner, chatBlocks: true}).supported_visuals ?? [];
    assert.deepEqual(drawn, ["step", "card", "debate", "loop", "image", "rich"]);
    assert.equal(drawn[drawn.length - 1], "rich");
    assert.ok(drawn.length <= 8);
    // A public chat, not yet measured.
    assert.deepEqual(askTurnVisuals({ownerVisuals: null, richColumns: null, chatBlocks: true}), {supported_visuals: ["step", "loop", "image"]});
    // A call never draws them.
    assert.deepEqual(askTurnVisuals({...owner, call: true, chatBlocks: true}), {supported_visuals: ["step", "card", "debate"]});
});

test("the route passes on only the chat drawings a request advertised", () => {
    assert.deepEqual(askChatBlockVisuals([]), []);
    assert.deepEqual(askChatBlockVisuals(["step", "card", "rich"]), []);
    assert.deepEqual(askChatBlockVisuals(["image", "rich", "loop"]), ["loop", "image"]);
    assert.deepEqual(askChatBlockVisuals(["loop", 3, null, "LOOP"]), ["loop"]);
});

// MARK: - The prompt

/** The apps' two medium descriptions (`ASSISTANT_VISUAL_MEDIUMS.loop` and `.image`), line for line. */
const LOOP_LINES = [
    "- Your kind doing it is a LOOP: a short looping animation of you doing one of your Trials, the real act. Show it",
    "  when you tell them how your kind does the thing your point comes from, or when you name one of your Trials:",
    "  ```animaldex-loop",
    '  {"frequency":"MID","caption":"optional: one short line on what to watch"}',
    "  ```",
    "  frequency is one of your Trials listed in available_content (LOW, MID or HIGH). It is a drawing, not an offer:",
    "  no button, never in place of a card, never in small talk."
];
const IMAGE_LINES = [
    "- A picture AnimalDex already has is an IMAGE: your Power's icon, or the art of an animal you compare yourself",
    "  with (only one named in animal_record.power.contrasting_species):",
    "  ```animaldex-image",
    '  {"of":"power"}',
    "  ```",
    '  or {"of":"species","name":"its common name, as your record gives it","caption":"optional, one short line"}.',
    "  Only when the picture says something the words do not, never as decoration."
];

function ownerPrompt(supportedVisuals: AskVisualMedium[], rich: boolean): string {
    const options: AskPromptOptions = {
        scope: "species",
        animalName: "Gray Wolf",
        mode: "auto",
        companionLoop: {offersSteps: true, debates: true},
        suggestSteps: true,
        stories: true,
        supportedVisuals,
        rich: rich ? {columns: 72} : null
    };
    return buildAskStreamingSystemPrompt(options);
}

test("a loop and an image are described only to a chat that draws them, word for word, and nothing else moves", () => {
    for (const rich of [true, false]) {
        const without = ownerPrompt(["flow", "scale", "chart", "card", "debate"], rich);
        assert.equal(without.includes("animaldex-loop"), false);
        assert.equal(without.includes("animaldex-image"), false);

        const drawn = ownerPrompt(["flow", "scale", "chart", "loop", "image", "card", "debate"], rich);
        const lines = drawn.split("\n");
        const loopAt = lines.indexOf(LOOP_LINES[0]);
        assert.ok(loopAt > 0, "the loop is described");
        assert.deepEqual(lines.slice(loopAt, loopAt + LOOP_LINES.length), LOOP_LINES);
        assert.deepEqual(lines.slice(loopAt + LOOP_LINES.length, loopAt + LOOP_LINES.length + IMAGE_LINES.length), IMAGE_LINES);
        // Each is a drawing: the one-drawing rule covers it.
        assert.ok(drawn.indexOf("- At most ONE drawing") < drawn.indexOf("```animaldex-loop"));
        // Take the fourteen lines out and the prompt is the one it was.
        const rest = [...lines.slice(0, loopAt), ...lines.slice(loopAt + LOOP_LINES.length + IMAGE_LINES.length)].join("\n");
        assert.equal(rest, without);
    }
});

test("a call and the site-wide assistant are never described a loop or an image they were not given", () => {
    const call = buildAskStreamingSystemPrompt({scope: "species", animalName: "Gray Wolf", mode: "auto", call: true, supportedVisuals: []});
    assert.equal(call.includes("animaldex-loop"), false);
    const general = buildAskStreamingSystemPrompt({scope: "general", supportedVisuals: ["flow", "scale", "chart"]});
    assert.equal(general.includes("animaldex-image"), false);
});
