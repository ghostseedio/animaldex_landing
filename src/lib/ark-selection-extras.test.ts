import assert from "node:assert/strict";
import test from "node:test";
import {arkSelectionExtras, arkTalkable, arkTalkHref} from "./ark-selection-extras";
import {bylineParts} from "@/ark-scene/selection-bars";

const zebra = {name: "Plains Zebra", model_slug: "plains-zebra", placeholder: false, origin: "arrived" as const};

test("a named founder: Brought by @handle, linked to the profile, in the reader's words", () => {
    const extras = arkSelectionExtras({animal: zebra, founder: {handle: "mayachen"}, words: {broughtBy: "Amené par {name}"}, locale: "fr"});
    assert.deepEqual(extras.byline, {kind: "founder", template: "Amené par {name}", handle: "mayachen", href: "/fr/u/mayachen"});
    assert.equal(arkSelectionExtras({animal: zebra, founder: {handle: "@mayachen"}}).byline?.kind, "founder");
});

test("a Voyager, an unknown founder or a bad handle: no line at all", () => {
    assert.equal(arkSelectionExtras({animal: zebra, founder: null}).byline, null);
    assert.equal(arkSelectionExtras({animal: zebra, founder: undefined}).byline, null);
    assert.equal(arkSelectionExtras({animal: zebra, founder: {handle: "a b/../x"}}).byline, null);
});

test("born aboard: Born on the Ark, even with a founder for its parents", () => {
    const extras = arkSelectionExtras({animal: {...zebra, origin: "born"}, founder: {handle: "mayachen"}, words: {bornAboard: "Lahir di Bahtera"}});
    assert.deepEqual(extras.byline, {kind: "text", text: "Lahir di Bahtera"});
});

test("Talk: any talkable species, founder or not; never the placeholder figure", () => {
    assert.deepEqual(arkSelectionExtras({animal: zebra, founder: null}).talk, {label: "Talk to a Plains Zebra", href: "/talk/plains-zebra"});
    assert.equal(arkSelectionExtras({animal: {...zebra, name: "Arctic Fox"}, founder: null, words: {talkAn: "Talk to an {animal}"}}).talk?.label, "Talk to an Arctic Fox");
    assert.equal(arkSelectionExtras({animal: {...zebra, placeholder: true}, founder: null}).talk, null);
    assert.equal(arkTalkable({model_slug: "placeholder--1234", placeholder: false}), false);
    assert.equal(arkTalkHref("plains-zebra", "id"), "/id/talk/plains-zebra");
    assert.equal(arkTalkHref("plains-zebra", "en"), "/talk/plains-zebra");
});

test("the byline template's parts around {name}, in any order a language puts it", () => {
    assert.deepEqual(bylineParts("Brought by {name}"), ["Brought by ", ""]);
    assert.deepEqual(bylineParts("{name}が連れてきた"), ["", "が連れてきた"]);
    assert.deepEqual(bylineParts("Brought by"), ["Brought by ", ""]);
});
