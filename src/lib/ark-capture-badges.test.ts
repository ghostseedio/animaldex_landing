/**
 * The Ark card's battle tier chip and hearts (owner 2026-11-21: "the tiers can we show that chip also on the animal ark
 * card"; hearts on every card). THE RULE: both are the server's (`capture_tier_for_capture`, `challenge_health`), added
 * to the life story by /api/ark/life, and only for an animal that arrived with a capture of its own: one born on the
 * Ark shows neither (never its parent's). The card never works a tier out from stats.
 */

import assert from "node:assert/strict";
import {readdirSync, readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import React, {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {ArkCaptureBadges} from "@/app/[locale]/(composited)/ark/ark-capture-badges";
import {decodeArkCaptureTier, decodeArkLife} from "./ark-life";
import type {ArkWords} from "./ark-words";

(globalThis as {React?: typeof React}).React = React;

const en = JSON.parse(readFileSync(path.join(process.cwd(), "src/data/locales/en.json"), "utf8")).ark as ArkWords;
const source = (...parts: string[]) => readFileSync(path.join(process.cwd(), "src", ...parts), "utf8");
const render = (raw: Record<string, unknown>) => renderToStaticMarkup(createElement(ArkCaptureBadges, {life: decodeArkLife(raw), words: en}));

test("a founder that came aboard with a capture shows the server's tier chip and its hearts", () => {
    const html = render({id: "a1", origin: {kind: "arrived", source: "capture"}, capture_tier: "A", capture_hearts: 2});
    assert.match(html, /data-testid="ark-card-tier"/);
    assert.match(html, /data-tier="A"/);
    assert.match(html, /Tier A: battle power grade of the photo that brought it aboard/);
    assert.match(html, /rounded-md/, "square corners, like the card's index chip");
    assert.match(html, /data-testid="ark-card-hearts" data-hearts="2"/);
    assert.match(html, /2 of 3 hearts/);
});

test("an animal born on the Ark shows no chip and no hearts, even if a parent's were sent", () => {
    const life = decodeArkLife({id: "b1", origin: {kind: "born", born_to: [{label: "Voyager 2"}]}, capture_tier: "S", capture_hearts: 3});
    assert.equal(life?.capture_tier, null);
    assert.equal(life?.capture_hearts, null);
    assert.equal(render({id: "b1", origin: {kind: "born"}, capture_tier: "S", capture_hearts: 3}), "");
});

test("no tier from the server, no chip; hearts alone still show; nonsense is dropped", () => {
    assert.equal(render({id: "a2", origin: {kind: "arrived"}}), "");
    assert.doesNotMatch(render({id: "a3", origin: {kind: "arrived"}, capture_hearts: 0}), /ark-card-tier/);
    assert.match(render({id: "a3", origin: {kind: "arrived"}, capture_hearts: 0}), /data-hearts="0"/);
    assert.equal(decodeArkCaptureTier("F"), null);
    assert.equal(decodeArkCaptureTier(52), null);
    assert.equal(decodeArkLife({id: "a4", origin: {kind: "arrived"}, capture_hearts: 7})?.capture_hearts, null);
});

test("the card's path never works a tier out from stats: it reads the server's letter", () => {
    for (const file of [
        ["app", "[locale]", "(composited)", "ark", "ark-capture-badges.tsx"],
        ["app", "[locale]", "(composited)", "ark", "ark-animal-card.tsx"],
        ["lib", "ark-capture-tier-read.ts"]
    ]) {
        const text = source(...file);
        assert.doesNotMatch(text, /capture-battle-tier|getBattleTier|getBattlePower|captureBattleTierFromPower|lib\/battle-tier"/, file.join("/"));
    }
    assert.match(source("lib", "ark-capture-tier-read.ts"), /rpc\("capture_tier_for_capture"/);
    assert.match(source("app", "api", "ark", "life", "[id]", "route.ts"), /readArkCaptureFacts/);
});

test("every Ark language has the chip's and the life row's words", () => {
    const dir = path.join(process.cwd(), "src/data/locales");
    const files = [path.join(dir, "en.json"), path.join(dir, "id.json"), ...readdirSync(path.join(dir, "ark")).map((f) => path.join(dir, "ark", f))];
    assert.equal(files.length, 45);
    for (const file of files) {
        const json = JSON.parse(readFileSync(file, "utf8"));
        const ark = (json.ark?.simple ? json.ark : json) as ArkWords;
        assert.ok(ark.simple?.tier && ark.simple.tierHint?.includes("{tier}"), file);
        for (const key of ["button", "bar", "now", "end", "heart"] as const) assert.ok(ark.lifeHelp?.[key], `${file} lifeHelp.${key}`);
    }
});

test("on the owner's own card the hearts show once, in the header, from their own (current) count", () => {
    const html = renderToStaticMarkup(createElement(ArkCaptureBadges, {life: decodeArkLife({id: "a5", origin: {kind: "arrived"}, capture_tier: "B", capture_hearts: 1}), words: en, ownHearts: 3}));
    assert.match(html, /data-hearts="3"/, "the owner's count wins (a restore shows at once)");
    assert.equal((html.match(/data-testid="ark-card-hearts"/g) ?? []).length, 1);
    const card = source("app", "[locale]", "(composited)", "ark", "ark-animal-card.tsx");
    assert.match(card, /<ArkLivesRow [^>]*heartsInHeader \/>/, "the lives row below keeps only Recovering and the restore");
    assert.match(source("app", "[locale]", "(composited)", "ark", "ark-lives.tsx"), /heartsInHeader \? null :/);
});
