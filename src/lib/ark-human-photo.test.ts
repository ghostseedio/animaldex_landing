/**
 * A Human's own capture photo in the Ark tap card (owner decision 419, 2026-11-20: "Public as-is"; docs/ark/DECISIONS.md
 * 419 and 419a, docs/ark/CAPTURE-MEDIA-CONTRACT.md 2.8). THE RULE is the animals' own: the server answers a photo only
 * when the capture is public as Discover shows it (a private, hidden, removed, reported, deleted-account capture never
 * shows; hiding the capture in the app removes it at the next read), and the web has no rule of its own for a Human:
 * it asks the same route, draws the same block, and shows nothing more of the person than an animal's card does.
 *
 * The images here are never a real person's: a Human's panel is drawn from a fixture answer, and the server's gate is
 * proved by its own tests (AnimalDex docs/ark/audits/humans/photos-test.sh).
 */

import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import React, {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import ArkCardPhoto from "@/app/[locale]/(composited)/ark/ark-card-photo";
import {arkAsksForPhoto, decodeArkCapturePhoto, type ArkCapturePhoto} from "./ark-capture-photo";
import {arkPhotoShownOn} from "./ark-photo-label";
import type {ArkWords} from "./ark-words";

// The card's photo block is written for the automatic JSX runtime (Next); the test runner compiles JSX to React.createElement.
(globalThis as {React?: typeof React}).React = React;

const id = "5a5a5a5a-0000-4000-8000-000000000001";
const thumbPath = `/api/ark/photo/${id}/thumb`;
const own = decodeArkCapturePhoto({
    animal_id: id,
    thumb: {width: 640, height: 480, path: thumbPath},
    large: {width: 1200, height: 900, path: `/api/ark/photo/${id}/large`}
}, id) as ArkCapturePhoto;
const human = {origin: "arrived" as const, model_slug: "human", scientific_name: "Homo sapiens"};
const en = JSON.parse(readFileSync(path.join(process.cwd(), "src/data/locales/en.json"), "utf8")).ark as ArkWords;
const source = (...parts: string[]) => readFileSync(path.join(process.cwd(), "src", ...parts), "utf8");

test("a captured Human's panel draws its photo like any animal's: the thumb, lazy, with its alt text, nothing else of the person", () => {
    assert.equal(arkAsksForPhoto(human), true);
    const shown = arkPhotoShownOn(own, false);
    assert.ok(shown, "an arrived Human's own photo is the one its card may show");
    const html = renderToStaticMarkup(createElement(ArkCardPhoto, {part: "thumb", photo: shown, species: "Human", words: en}));
    assert.match(html, new RegExp(`<img src="${thumbPath}"`), "this site's route for this animal");
    assert.match(html, /loading="lazy"/);
    assert.match(html, /alt="Photo that brought this Human aboard"/);
    assert.match(html, /data-testid="ark-card-photo"/);
    // No name, no user id and no link to a profile come with the photo (the card's own "Brought by" line is the animals').
    assert.doesNotMatch(html, /<a[\s>]/, "no link");
    assert.doesNotMatch(html, /href=/);
    assert.doesNotMatch(html, /@|\/u\//, "no handle, no profile path");
    assert.equal(renderToStaticMarkup(createElement(ArkCardPhoto, {part: "line", photo: shown, species: "Human", words: en})), "", "an own photo has no 'whose photo' line to draw");
});

test("a Human whose capture is not public draws no photo at all: the server's null is the whole answer", () => {
    // The route answers {photo: null} for a private, hidden, removed, reported or deleted-account capture (server tests), and
    // the card keeps no block, no frame, no spinner for it.
    assert.equal(decodeArkCapturePhoto(null, id), null);
    assert.equal(arkPhotoShownOn(decodeArkCapturePhoto(null, id), false), null);
    const card = source("app", "[locale]", "(composited)", "ark", "ark-animal-card.tsx");
    assert.ok(/\{shownPhoto \? <Suspense fallback=\{null\}><ArkCardPhoto key=\{animal\.id\} part="thumb"/.test(card), "the thumb is drawn only for a photo the card may show");
});

test("only a Human's own photo is ever shown on a Human: an ancestor's, or any photo on one born aboard, is dropped", () => {
    const ancestor = decodeArkCapturePhoto({
        animal_id: id,
        relation: "parent",
        generation: 1,
        brought_by: {display_name: "Ada L", handle: "ada", avatar_url: null},
        thumb: {width: 640, height: 480, path: thumbPath},
        large: {width: 1200, height: 900, path: `/api/ark/photo/${id}/large`}
    }, id) as ArkCapturePhoto;
    assert.equal(arkPhotoShownOn(ancestor, false), null, "an arrived Human never shows another person's photo as its own");
    assert.equal(arkPhotoShownOn(own, true), null, "a Human born aboard shows no photo of its own");
    assert.equal(arkAsksForPhoto({...human, origin: "born"}), false, "a Human born aboard asks nothing (the server answers null for it too)");
});

test("no rule of its own for a Human: the routes and the card ask the animals' reads and name no Human, person or capture owner", () => {
    for (const file of [["app", "api", "ark", "photo", "[id]", "route.ts"], ["app", "api", "ark", "photo", "[id]", "[size]", "route.ts"]]) {
        const text = source(...file);
        const code = text.replace(/\/\*[\s\S]*?\*\//g, "");
        assert.ok(/voyage_animal_(photo|capture)/.test(code), `${file.join("/")} asks the animals' photo reads`);
        assert.doesNotMatch(code, /human|homo|person|identity_is_person|is_discoverable|user_id|capture_id/i, `${file.join("/")} has no filter or identifier of its own`);
    }
    const view = source("app", "[locale]", "(composited)", "ark", "ark-view.tsx");
    assert.ok(view.includes("arkAsksForPhoto(selected)") && !/model_slug\s*===\s*["']human["']/.test(view), "the view decides through arkAsksForPhoto only");
});
