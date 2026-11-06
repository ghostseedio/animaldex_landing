import assert from "node:assert/strict";
import test from "node:test";
import {cameraRollServerPayload, checkCameraRollPhoto, exifDateToIso, readJpegExif} from "@/lib/camera-roll-photo-checks";

// A JPEG built by hand: SOI, one APP1 Exif segment, then EOI. Enough for the
// checks, which read only the EXIF.
function jpegWithExif(options: {
    make?: string; model?: string; software?: string; dateTimeOriginal?: string; offsetTimeOriginal?: string; userComment?: string;
    gps?: {latitude: number; longitude: number};
}): Uint8Array {
    type Entry = {tag: number; type: number; count: number; data: Uint8Array};
    const asciiEntry = (tag: number, text: string): Entry => ({tag, type: 2, count: text.length + 1, data: new TextEncoder().encode(text + "\0")});
    const rationalsEntry = (tag: number, values: number[]): Entry => {
        const data = new Uint8Array(values.length * 8);
        const view = new DataView(data.buffer);
        values.forEach((value, index) => {
            view.setUint32(index * 8, Math.round(value * 10_000));
            view.setUint32(index * 8 + 4, 10_000);
        });
        return {tag, type: 5, count: values.length, data};
    };
    const dms = (value: number) => {
        const abs = Math.abs(value);
        const d = Math.floor(abs);
        const m = Math.floor((abs - d) * 60);
        const s = ((abs - d) * 60 - m) * 60;
        return [d, m, s];
    };

    const ifd0: Entry[] = [];
    if (options.make) ifd0.push(asciiEntry(0x010f, options.make));
    if (options.model) ifd0.push(asciiEntry(0x0110, options.model));
    if (options.software) ifd0.push(asciiEntry(0x0131, options.software));
    const exif: Entry[] = [];
    if (options.dateTimeOriginal) exif.push(asciiEntry(0x9003, options.dateTimeOriginal));
    if (options.offsetTimeOriginal) exif.push(asciiEntry(0x9011, options.offsetTimeOriginal));
    if (options.userComment) exif.push({tag: 0x9286, type: 7, count: 8 + options.userComment.length, data: new TextEncoder().encode("ASCII\0\0\0" + options.userComment)});
    const gps: Entry[] = [];
    if (options.gps) {
        gps.push(asciiEntry(1, options.gps.latitude < 0 ? "S" : "N"));
        gps.push(rationalsEntry(2, dms(options.gps.latitude)));
        gps.push(asciiEntry(3, options.gps.longitude < 0 ? "W" : "E"));
        gps.push(rationalsEntry(4, dms(options.gps.longitude)));
    }

    // Layout (big-endian): header 8 | IFD0 | Exif IFD | GPS IFD | data blobs.
    const ifd0Count = ifd0.length + (exif.length ? 1 : 0) + (gps.length ? 1 : 0);
    const ifd0At = 8;
    const exifAt = ifd0At + 2 + ifd0Count * 12 + 4;
    const gpsAt = exifAt + (exif.length ? 2 + exif.length * 12 + 4 : 0);
    let dataAt = gpsAt + (gps.length ? 2 + gps.length * 12 + 4 : 0);
    const blobs: Array<{at: number; data: Uint8Array}> = [];
    const place = (entry: Entry): number => {
        if (entry.data.length <= 4) return -1;
        const at = dataAt;
        blobs.push({at, data: entry.data});
        dataAt += entry.data.length + (entry.data.length % 2);
        return at;
    };
    const size = dataAt + [...ifd0, ...exif, ...gps].reduce((sum, entry) => sum + entry.data.length + 1, 0) + 64;
    const tiff = new Uint8Array(size);
    const view = new DataView(tiff.buffer);
    tiff.set([0x4d, 0x4d, 0x00, 0x2a]);
    view.setUint32(4, ifd0At);
    const writeIfd = (at: number, entries: Entry[], pointers: Array<{tag: number; to: number}>) => {
        const all = [...entries.map((entry) => ({entry, pointerTo: -1})), ...pointers.map((p) => ({entry: {tag: p.tag, type: 4, count: 1, data: new Uint8Array(0)}, pointerTo: p.to}))]
            .sort((a, b) => a.entry.tag - b.entry.tag);
        view.setUint16(at, all.length);
        all.forEach(({entry, pointerTo}, index) => {
            const e = at + 2 + index * 12;
            view.setUint16(e, entry.tag);
            view.setUint16(e + 2, entry.type);
            view.setUint32(e + 4, entry.count);
            if (pointerTo >= 0) {
                view.setUint32(e + 8, pointerTo);
            } else if (entry.data.length <= 4) {
                tiff.set(entry.data, e + 8);
            } else {
                view.setUint32(e + 8, place(entry));
            }
        });
        view.setUint32(at + 2 + all.length * 12, 0);
    };
    const pointers: Array<{tag: number; to: number}> = [];
    if (exif.length) pointers.push({tag: 0x8769, to: exifAt});
    if (gps.length) pointers.push({tag: 0x8825, to: gpsAt});
    writeIfd(ifd0At, ifd0, pointers);
    if (exif.length) writeIfd(exifAt, exif, []);
    if (gps.length) writeIfd(gpsAt, gps, []);
    blobs.forEach((blob) => tiff.set(blob.data, blob.at));
    const body = tiff.subarray(0, dataAt);

    const app1 = new Uint8Array(2 + 2 + 6 + body.length);
    app1.set([0xff, 0xe1]);
    new DataView(app1.buffer).setUint16(2, app1.length - 2);
    app1.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], 4);
    app1.set(body, 10);
    const file = new Uint8Array(2 + app1.length + 2);
    file.set([0xff, 0xd8]);
    file.set(app1, 2);
    file.set([0xff, 0xd9], 2 + app1.length);
    return file;
}

test("a phone photo with a camera and a date passes, with its claims and its pin", () => {
    const bytes = jpegWithExif({make: "Apple", model: "iPhone 17 Pro", software: "iOS 26.1", dateTimeOriginal: "2026:10:17 09:41:02", offsetTimeOriginal: "+02:00", gps: {latitude: 51.5074, longitude: -0.1278}});
    const verdict = checkCameraRollPhoto(bytes);
    assert.equal(verdict.ok, true);
    if (!verdict.ok) return;
    assert.equal(verdict.metadata.cameraMake, "Apple");
    assert.equal(verdict.metadata.cameraModel, "iPhone 17 Pro");
    assert.equal(verdict.metadata.software, "iOS 26.1");
    assert.equal(verdict.metadata.takenAt, "2026-10-17T09:41:02+02:00");
    assert.equal(verdict.metadata.hadEmbeddedLocation, true);
    assert.ok(verdict.coordinate);
    assert.ok(Math.abs(verdict.coordinate!.latitude - 51.5074) < 0.001);
    assert.ok(Math.abs(verdict.coordinate!.longitude + 0.1278) < 0.001);
});

test("a screenshot is turned away by its own comment", () => {
    const bytes = jpegWithExif({make: "Apple", model: "iPhone", dateTimeOriginal: "2026:10:17 09:41:02", userComment: "Screenshot"});
    assert.deepEqual(checkCameraRollPhoto(bytes), {ok: false, rejection: "screenshot"});
});

test("no camera and no date means it has been through something that stripped it", () => {
    assert.deepEqual(checkCameraRollPhoto(jpegWithExif({})), {ok: false, rejection: "no_camera_information"});
    assert.deepEqual(checkCameraRollPhoto(jpegWithExif({make: "Canon"})), {ok: false, rejection: "no_camera_information"});
    assert.deepEqual(checkCameraRollPhoto(jpegWithExif({dateTimeOriginal: "2026:10:17 09:41:02"})), {ok: false, rejection: "no_camera_information"});
    // A bare JPEG with no EXIF segment at all.
    assert.deepEqual(checkCameraRollPhoto(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])), {ok: false, rejection: "no_camera_information"});
});

test("a PNG or WebP carries no camera information; junk is unreadable", () => {
    assert.deepEqual(checkCameraRollPhoto(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), {ok: false, rejection: "no_camera_information"});
    const webp = new Uint8Array(16);
    webp.set([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    assert.deepEqual(checkCameraRollPhoto(webp), {ok: false, rejection: "no_camera_information"});
    assert.deepEqual(checkCameraRollPhoto(new Uint8Array([1, 2, 3])), {ok: false, rejection: "unreadable"});
    assert.deepEqual(checkCameraRollPhoto(new Uint8Array()), {ok: false, rejection: "unreadable"});
});

test("a photo with no GPS passes without a pin", () => {
    const verdict = checkCameraRollPhoto(jpegWithExif({make: "Sony", model: "ILCE-7M4", dateTimeOriginal: "2026:09:01 06:12:00"}));
    assert.equal(verdict.ok, true);
    if (!verdict.ok) return;
    assert.equal(verdict.coordinate, null);
    assert.equal(verdict.metadata.hadEmbeddedLocation, false);
    assert.equal(verdict.metadata.takenAt, "2026-09-01T06:12:00Z");
});

test("EXIF dates are ISO 8601 or nothing", () => {
    assert.equal(exifDateToIso("2026:10:17 09:41:02", null), "2026-10-17T09:41:02Z");
    assert.equal(exifDateToIso("2026:10:17 09:41:02", "-05:00"), "2026-10-17T09:41:02-05:00");
    assert.equal(exifDateToIso("    :  :     :  :  ", null), null);
    assert.equal(exifDateToIso("2026:13:40 09:41:02", null), null);
    assert.equal(exifDateToIso(null, null), null);
});

test("the server payload uses the apps' keys and caps each claim at 80 characters", () => {
    const payload = cameraRollServerPayload({takenAt: "2026-10-17T09:41:02Z", cameraMake: "A".repeat(100), cameraModel: "iPhone", software: null, hadEmbeddedLocation: true});
    assert.deepEqual(Object.keys(payload).sort(), ["camera_make", "camera_model", "had_embedded_location", "taken_at"]);
    assert.equal(payload.camera_make.length, 80);
    assert.equal(payload.had_embedded_location, "true");
    assert.equal(cameraRollServerPayload({takenAt: null, cameraMake: null, cameraModel: null, software: null, hadEmbeddedLocation: false}).had_embedded_location, "false");
});

test("a little-endian TIFF header is read too", () => {
    const big = jpegWithExif({make: "Nikon", model: "Z8", dateTimeOriginal: "2026:10:17 09:41:02"});
    const exif = readJpegExif(big);
    assert.equal(exif?.make, "Nikon");
    assert.equal(exif?.model, "Z8");
});
