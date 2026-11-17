import assert from "node:assert/strict";
import test from "node:test";
import {arkPhotoAspect, arkPhotoIsAncestors, arkPhotoObject, decodeArkCapturePhoto} from "./ark-capture-photo";

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

test("the signing route signs only a capture bucket and a plain path", () => {
    const media = {thumb: {bucket: "captures", path: "u/c/derived/i/card_640.jpg"}, large: {bucket: "avatars", path: "x.jpg"}};
    assert.deepEqual(arkPhotoObject(media, "thumb"), {bucket: "captures", path: "u/c/derived/i/card_640.jpg"});
    assert.equal(arkPhotoObject(media, "large"), null);
    assert.equal(arkPhotoObject({thumb: {bucket: "captures", path: "../secret"}}, "thumb"), null);
    assert.equal(arkPhotoObject(null, "thumb"), null);
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
