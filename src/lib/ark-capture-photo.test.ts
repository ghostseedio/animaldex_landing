import assert from "node:assert/strict";
import test from "node:test";
import {arkPhotoAspect, arkPhotoObject, decodeArkCapturePhoto} from "./ark-capture-photo";

const id = "8c0e7a10-1b2c-4d3e-8f90-0a1b2c3d4e5f";
const answer = {
    animal_id: id,
    thumb: {width: 640, height: 480, path: `/api/ark/photo/${id}/thumb`},
    large: {width: 1200, height: 900, path: `/api/ark/photo/${id}/large`}
};

test("the server's answer: both sizes on this site's route for this animal", () => {
    assert.deepEqual(decodeArkCapturePhoto(answer, id), {thumb: answer.thumb, large: answer.large});
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
