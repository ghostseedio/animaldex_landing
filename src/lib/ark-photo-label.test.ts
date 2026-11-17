import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {decodeArkCapturePhoto, type ArkCapturePhoto} from "./ark-capture-photo";
import {arkPhotoFromTemplate, arkPhotoLabel, arkPhotoShownOn} from "./ark-photo-label";
import type {ArkWords} from "./ark-words";

const id = "8c0e7a10-1b2c-4d3e-8f90-0a1b2c3d4e5f";
const base = {
    animal_id: id,
    thumb: {width: 640, height: 480, path: `/api/ark/photo/${id}/thumb`},
    large: {width: 1200, height: 900, path: `/api/ark/photo/${id}/large`}
};
const own = decodeArkCapturePhoto(base, id) as ArkCapturePhoto;
const ancestor = (relation: string, generation: number) =>
    decodeArkCapturePhoto({...base, relation, generation, brought_by: {display_name: "Ada L", handle: "ada", avatar_url: null}}, id) as ArkCapturePhoto;

const en = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src/data/locales/en.json"), "utf8")).ark as ArkWords;

test("the line says whose photo it is, with the ancestor's bringer, and never a sex", () => {
    assert.equal(arkPhotoLabel(en, ancestor("parent", 1)), "Born on the Ark · Photo of its parent, brought aboard by @ada");
    assert.equal(arkPhotoLabel(en, ancestor("grandparent", 2)), "Born on the Ark · Photo of its grandparent, brought aboard by @ada");
    assert.equal(arkPhotoLabel(en, ancestor("great_grandparent", 3)), "Born on the Ark · Photo of its great-grandparent, brought aboard by @ada");
    assert.equal(arkPhotoLabel(en, own), null, "the animal's own photo needs no line");
    assert.equal(arkPhotoFromTemplate(en, "self"), null);
    for (const relation of ["parent", "grandparent", "great_grandparent"] as const) assert.doesNotMatch(arkPhotoFromTemplate(en, relation) ?? "", /mother|father|dam|sire/i);
});

test("a bundle without the keys still says it, in English", () => {
    const bare = {life: en.life, photo: {alt: "a", open: "o", close: "c"}} as ArkWords;
    assert.match(arkPhotoFromTemplate(bare, "parent") ?? "", /Photo of its parent/);
    assert.match(arkPhotoLabel(bare, ancestor("grandparent", 2)) ?? "", /@ada/);
});

test("the card shows an ancestor's photo only on an animal born on the Ark, its own only on one that arrived", () => {
    assert.equal(arkPhotoShownOn(own, false), own);
    assert.equal(arkPhotoShownOn(own, true), null, "a born animal never shows 'the photo that brought it aboard'");
    const parent = ancestor("parent", 1);
    assert.equal(arkPhotoShownOn(parent, true), parent);
    assert.equal(arkPhotoShownOn(parent, false), null, "an arrived animal never shows another animal's photo");
    assert.equal(arkPhotoShownOn(null, true), null);
    assert.equal(arkPhotoShownOn({...parent, brought_by: null}, true), null, "no bringer to name, no photo");
});

test("every Ark language has the three lines, each with {name}, and each is listed for review", () => {
    const root = process.cwd();
    const locales: Record<string, string> = {en: "src/data/locales/en.json", id: "src/data/locales/id.json"};
    for (const file of fs.readdirSync(path.join(root, "src/data/locales/ark"))) locales[file.replace(/\.json$/, "")] = `src/data/locales/ark/${file}`;
    assert.equal(Object.keys(locales).length, 45);
    const review = JSON.parse(fs.readFileSync(path.join(root, "docs/ark/photo-label-translations-needs-review.json"), "utf8")) as {status: string; languages: string[]};
    assert.equal(review.status, "needs_review");
    assert.deepEqual([...review.languages].sort(), Object.keys(locales).filter((code) => code !== "en").sort());
    for (const [code, file] of Object.entries(locales)) {
        const photo = (JSON.parse(fs.readFileSync(path.join(root, file), "utf8")) as {ark: ArkWords}).ark.photo;
        const lines = [photo.fromParent, photo.fromGrandparent, photo.fromGreatGrandparent];
        for (const line of lines) assert.ok(typeof line === "string" && line.includes("{name}") && !/\{(species|animal)\}/.test(line), `${code}: ${line}`);
        assert.equal(new Set(lines).size, 3, `${code}: the three relations read differently`);
        if (code !== "en") assert.notEqual(lines[0], en.photo.fromParent, `${code}: not just English`);
    }
});
