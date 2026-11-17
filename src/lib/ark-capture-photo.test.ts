import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import path from "node:path";
import {arkAsksForPhoto, arkPhotoAspect, arkPhotoIsAncestors, arkPhotoObject, decodeArkCapturePhoto} from "./ark-capture-photo";

const id = "8c0e7a10-1b2c-4d3e-8f90-0a1b2c3d4e5f";
const answer = {
    animal_id: id,
    thumb: {width: 640, height: 480, path: `/api/ark/photo/${id}/thumb`},
    large: {width: 1200, height: 900, path: `/api/ark/photo/${id}/large`}
};

test("the server's answer: both sizes on this site's route for this animal", () => {
    // The older read (no relation) is the animal's own photo.
    assert.deepEqual(decodeArkCapturePhoto(answer, id), {thumb: answer.thumb, large: answer.large, relation: "self", generation: 0, brought_by: null});
    assert.equal(decodeArkCapturePhoto(null, id), null);
    assert.equal(decodeArkCapturePhoto(answer, "8c0e7a10-1b2c-4d3e-8f90-000000000000"), null);
});

test("anything off the contract is no photo: another path, a storage URL, a missing size", () => {
    assert.equal(decodeArkCapturePhoto({...answer, thumb: {...answer.thumb, path: "https://x.supabase.co/storage/v1/object/sign/captures/a.jpg"}}, id), null);
    assert.equal(decodeArkCapturePhoto({...answer, large: undefined}, id), null);
    assert.deepEqual(decodeArkCapturePhoto({...answer, thumb: {...answer.thumb, width: -3, height: "9"}}, id)?.thumb, {width: null, height: null, path: answer.thumb.path});
});

const IMG = "3f848bf7-0268-4478-bac6-1a439018fb51";
const dir = "9000f268-a0fe-43d8-895f-9c691cf58b25/73b77658-aa24-4ed1-b382-bda272dbf8e7";
const derived = {
    thumb: {bucket: "captures", path: `${dir}/derived/${IMG}/card_640.jpg`},
    large: {bucket: "captures", path: `${dir}/derived/${IMG}/feed_1200.jpg`}
};
const original = {bucket: "captures", path: `${dir}/primary.jpg`};

test("the signing route signs only a capture bucket and a server-made derivative's path", () => {
    assert.deepEqual(arkPhotoObject(derived, "thumb"), derived.thumb);
    assert.deepEqual(arkPhotoObject(derived, "large"), derived.large);
    assert.equal(arkPhotoObject({...derived, large: {bucket: "avatars", path: derived.large.path}}, "large")?.path, derived.thumb.path, "a wrong bucket is not signed; the thumb stands in");
    assert.equal(arkPhotoObject({thumb: {bucket: "captures", path: `${dir}/derived/../secret/card_640.jpg`}}, "thumb"), null);
    assert.equal(arkPhotoObject({thumb: {bucket: "captures", path: `${dir}//derived/${IMG}/card_640.jpg`}}, "thumb"), null);
    assert.equal(arkPhotoObject(null, "thumb"), null);
});

test("an original is never signed: it carries whatever metadata its upload had", () => {
    assert.equal(arkPhotoObject({thumb: original, large: original}, "thumb"), null);
    assert.equal(arkPhotoObject({thumb: original, large: original}, "large"), null, "both originals: no photo");
    assert.equal(arkPhotoObject({thumb: original, large: derived.large}, "thumb"), null);
    // a derivative must be under derived/<image id>/ and named for its size
    assert.equal(arkPhotoObject({thumb: {bucket: "captures", path: `${dir}/derived/${IMG}/feed_1200.jpg`}}, "thumb"), null, "the 1200 px file is not the thumb");
    assert.equal(arkPhotoObject({thumb: {bucket: "captures", path: `${dir}/derived/not-an-id/card_640.jpg`}}, "thumb"), null);
    assert.equal(arkPhotoObject({thumb: {bucket: "captures", path: `${dir}/card_640.jpg`}}, "thumb"), null);
    assert.equal(arkPhotoObject({thumb: {bucket: "captures", path: `${dir}/derived/${IMG}/card_640.jpg.png`}}, "thumb"), null);
    assert.equal(arkPhotoObject({thumb: {bucket: "captures", path: `${dir}/derived/${IMG}/card_640.jpg/x`}}, "thumb"), null);
});

test("a large that is only the original gives way to the 640 px derivative, never to the original", () => {
    assert.deepEqual(arkPhotoObject({thumb: derived.thumb, large: original}, "large"), derived.thumb);
    assert.deepEqual(arkPhotoObject({thumb: derived.thumb, large: original}, "thumb"), derived.thumb);
    assert.equal(arkPhotoObject({thumb: derived.thumb, large: {bucket: "captures", path: "../x"}}, "large")?.path, derived.thumb.path);
    assert.equal(arkPhotoObject({thumb: derived.thumb}, "large")?.path, derived.thumb.path, "no large at all");
});

test("its box: the photo's shape, 4:3 without dimensions, never extreme", () => {
    assert.equal(arkPhotoAspect({width: 640, height: 480}), 640 / 480);
    assert.equal(arkPhotoAspect({width: null, height: null}), 4 / 3);
    assert.equal(arkPhotoAspect({width: 5000, height: 100}), 2);
});

const parent = {...answer, relation: "parent", generation: 1, brought_by: {display_name: "Ada L", handle: "ada", avatar_url: null}};

test("an animal born on the Ark: its recorded ancestor's photo, with the relation and the ancestor's bringer", () => {
    const photo = decodeArkCapturePhoto(parent, id);
    assert.equal(photo?.relation, "parent");
    assert.equal(photo?.generation, 1);
    assert.deepEqual(photo?.brought_by, {display_name: "Ada L", handle: "ada", avatar_url: null});
    assert.equal(arkPhotoIsAncestors(photo!), true);
    assert.equal(arkPhotoIsAncestors(decodeArkCapturePhoto(answer, id)!), false);
    // A decoded photo decodes to itself: ark-view decodes the route's answer again.
    assert.deepEqual(decodeArkCapturePhoto({...photo, animal_id: id}, id), photo);
    assert.equal(decodeArkCapturePhoto({...parent, relation: "grandparent", generation: 2}, id)?.relation, "grandparent");
    assert.equal(decodeArkCapturePhoto({...parent, relation: "great_grandparent", generation: 3}, id)?.relation, "great_grandparent");
    assert.equal(decodeArkCapturePhoto({...parent, relation: "self", generation: 0, brought_by: null}, id)?.relation, "self");
});

test("a photo that cannot be labelled is no photo: no bringer, a gendered or unknown relation, a generation that disagrees", () => {
    assert.equal(decodeArkCapturePhoto({...parent, brought_by: null}, id), null);
    assert.equal(decodeArkCapturePhoto({...parent, brought_by: {display_name: "x", handle: "!!"}}, id), null);
    assert.equal(decodeArkCapturePhoto({...parent, relation: "mother"}, id), null);
    assert.equal(decodeArkCapturePhoto({...parent, relation: "sibling", generation: 1}, id), null);
    assert.equal(decodeArkCapturePhoto({...parent, generation: 2}, id), null);
    assert.equal(decodeArkCapturePhoto({...parent, relation: "self"}, id), null, "a self photo with generation 1 disagrees");
    assert.equal(decodeArkCapturePhoto({...parent, relation: "self", generation: 0}, id)?.relation, "self", "a self photo ignores a stray bringer");
    assert.equal(decodeArkCapturePhoto({...parent, relation: "self", generation: 0}, id)?.brought_by, null);
});

test("nothing but this animal's own id and this site's paths: an ancestor's id in a path is no photo", () => {
    const other = "11111111-2222-4333-8444-555555555555";
    assert.equal(decodeArkCapturePhoto({...parent, thumb: {...parent.thumb, path: `/api/ark/photo/${other}/thumb`}}, id), null);
});

test("a Human that arrived by capture shows its capture photo like any animal; one born aboard asks nothing", () => {
    const human = {origin: "arrived" as const, model_slug: "human", scientific_name: "Homo sapiens"};
    assert.equal(arkAsksForPhoto(human), true, "a captured Human asks the route, which gates it as for any animal");
    assert.equal(arkAsksForPhoto({...human, origin: undefined}), true, "an older snapshot without an origin is an arrival");
    assert.equal(arkAsksForPhoto({model_slug: "human"}), true);
    assert.equal(arkAsksForPhoto({scientific_name: "Homo sapiens"}), true);
    assert.equal(arkAsksForPhoto({...human, origin: "born"}), false, "born aboard: no photo, no request");
    assert.equal(arkAsksForPhoto({origin: "born", scientific_name: "Homo sapiens sapiens"}), false);
    assert.equal(arkAsksForPhoto({origin: "born", model_slug: "zebra", scientific_name: "Equus quagga"}), true, "an animal born aboard still asks for its ancestor's photo");
    assert.equal(arkAsksForPhoto({origin: "arrived", model_slug: "chimpanzee", scientific_name: "Pan troglodytes"}), true);
    // The route's answer for a captured Human is the same decoded shape as for an animal: its own photo, this site's paths.
    const body = {...answer, relation: "self", generation: 0, brought_by: null};
    assert.equal(decodeArkCapturePhoto(body, id)?.relation, "self");
});

test("the tap card has no species exception: ark-view decides through arkAsksForPhoto, never a Human check of its own", () => {
    const source = readFileSync(path.join(__dirname, "..", "app", "[locale]", "(composited)", "ark", "ark-view.tsx"), "utf8");
    assert.ok(source.includes("arkAsksForPhoto(selected)"), "the photo effect asks the helper");
    assert.ok(!/model_slug\s*===\s*["']human["']/.test(source), "no human skip in the view");
});
