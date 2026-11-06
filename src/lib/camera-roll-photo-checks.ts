/**
 * Turns away library files that plainly are not someone's own camera photo,
 * before anything is uploaded: screenshots, and files with no camera
 * information at all (downloads, saved social posts, most AI-generated
 * images). A first line only; the server screens every camera-roll upload
 * regardless, because anything on this side can be edited.
 *
 * Port of iOS `CameraRollPhotoImporter.prepare` (the same three rejections,
 * the same wording) over the JPEG's own EXIF. Pure: bytes in, verdict out.
 */
export type CameraRollPhotoMetadata = {
    takenAt: string | null;
    cameraMake: string | null;
    cameraModel: string | null;
    software: string | null;
    hadEmbeddedLocation: boolean;
};

export type CameraRollRejection = "unreadable" | "screenshot" | "no_camera_information";

export type CameraRollCheck =
    | {ok: true; metadata: CameraRollPhotoMetadata; coordinate: {latitude: number; longitude: number} | null}
    | {ok: false; rejection: CameraRollRejection};

export const CAMERA_ROLL_REJECTION_MESSAGES: Record<CameraRollRejection, string> = {
    unreadable: "This photo couldn't be read. Try a different one.",
    screenshot: "Screenshots can't be uploaded. Upload the original photo you took of the animal.",
    no_camera_information: "This photo has no camera information, so it doesn't look like one you took. Downloaded, saved or AI-generated images can't be uploaded."
};

/** What the capture route hands `mark_capture_camera_roll_v1`, with iOS's keys. */
export function cameraRollServerPayload(metadata: CameraRollPhotoMetadata): Record<string, string> {
    const payload: Record<string, string> = {had_embedded_location: metadata.hadEmbeddedLocation ? "true" : "false"};
    if (metadata.takenAt) payload.taken_at = metadata.takenAt;
    if (metadata.cameraMake) payload.camera_make = metadata.cameraMake.slice(0, 80);
    if (metadata.cameraModel) payload.camera_model = metadata.cameraModel.slice(0, 80);
    if (metadata.software) payload.software = metadata.software.slice(0, 80);
    return payload;
}

type Tags = Map<number, {type: number; count: number; valueOffset: number}>;

function readIfd(view: DataView, tiffStart: number, offset: number, little: boolean): Tags {
    const tags: Tags = new Map();
    if (offset + 2 > view.byteLength) return tags;
    const count = view.getUint16(tiffStart + offset, little);
    for (let index = 0; index < count; index++) {
        const entry = tiffStart + offset + 2 + index * 12;
        if (entry + 12 > view.byteLength) break;
        tags.set(view.getUint16(entry, little), {
            type: view.getUint16(entry + 2, little),
            count: view.getUint32(entry + 4, little),
            valueOffset: entry + 8
        });
    }
    return tags;
}

function ascii(view: DataView, tiffStart: number, tag: {type: number; count: number; valueOffset: number} | undefined, little: boolean): string | null {
    if (!tag || (tag.type !== 2 && tag.type !== 7)) return null;
    const start = tag.count <= 4 ? tag.valueOffset : tiffStart + view.getUint32(tag.valueOffset, little);
    if (start + tag.count > view.byteLength) return null;
    // EXIF UserComment (type 7) opens with an 8-byte character code
    // ("ASCII\0\0\0"), which is skipped; an ASCII tag ends at its first NUL.
    const skip = tag.type === 7 && tag.count >= 8 ? 8 : 0;
    let text = "";
    for (let index = skip; index < tag.count; index++) {
        const byte = view.getUint8(start + index);
        if (byte === 0 && tag.type === 2) break;
        if (byte !== 0) text += String.fromCharCode(byte);
    }
    const trimmed = text.trim();
    return trimmed.length ? trimmed : null;
}

function pointer(view: DataView, tag: {type: number; count: number; valueOffset: number} | undefined, little: boolean): number | null {
    if (!tag || tag.type !== 4 || tag.count !== 1) return null;
    return view.getUint32(tag.valueOffset, little);
}

function rationals(view: DataView, tiffStart: number, tag: {type: number; count: number; valueOffset: number} | undefined, little: boolean): number[] | null {
    if (!tag || tag.type !== 5) return null;
    const start = tiffStart + view.getUint32(tag.valueOffset, little);
    const values: number[] = [];
    for (let index = 0; index < tag.count; index++) {
        const at = start + index * 8;
        if (at + 8 > view.byteLength) return null;
        const numerator = view.getUint32(at, little);
        const denominator = view.getUint32(at + 4, little);
        values.push(denominator === 0 ? 0 : numerator / denominator);
    }
    return values;
}

function degrees(parts: number[] | null, ref: string | null, negativeRef: string): number | null {
    if (!parts || parts.length < 2) return null;
    const value = parts[0] + parts[1] / 60 + (parts[2] ?? 0) / 3600;
    if (!Number.isFinite(value)) return null;
    return ref?.toUpperCase().startsWith(negativeRef) ? -value : value;
}

/** "2026:10:17 09:41:02" (+ "+02:00") → ISO 8601, or null when it is not a date. */
export function exifDateToIso(value: string | null, offset: string | null): string | null {
    if (!value) return null;
    const match = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value.trim());
    if (!match) return null;
    const [, year, month, day, hour, minute, second] = match;
    if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > 31) return null;
    const zone = offset && /^[+-]\d{2}:\d{2}$/.test(offset.trim()) ? offset.trim() : "Z";
    const iso = `${year}-${month}-${day}T${hour}:${minute}:${second}${zone}`;
    return Number.isNaN(Date.parse(iso)) ? null : iso;
}

/** The EXIF the JPEG carries: make, model, software, taken-at, user comment, GPS. */
export function readJpegExif(bytes: Uint8Array): {
    make: string | null; model: string | null; software: string | null;
    dateTimeOriginal: string | null; offsetTimeOriginal: string | null; userComment: string | null;
    coordinate: {latitude: number; longitude: number} | null;
} | null {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let at = 2;
    while (at + 4 <= bytes.length) {
        if (bytes[at] !== 0xff) return null;
        const marker = bytes[at + 1];
        if (marker === 0xda || marker === 0xd9) break;
        const length = view.getUint16(at + 2);
        if (marker === 0xe1 && at + 10 <= bytes.length && bytes[at + 4] === 0x45 && bytes[at + 5] === 0x78 && bytes[at + 6] === 0x69 && bytes[at + 7] === 0x66) {
            const tiffStart = at + 10;
            if (tiffStart + 8 > bytes.length) return null;
            const order = view.getUint16(tiffStart);
            const little = order === 0x4949;
            if (!little && order !== 0x4d4d) return null;
            const ifd0Offset = view.getUint32(tiffStart + 4, little);
            const ifd0 = readIfd(view, tiffStart, ifd0Offset, little);
            const exifOffset = pointer(view, ifd0.get(0x8769), little);
            const exif = exifOffset === null ? new Map() : readIfd(view, tiffStart, exifOffset, little);
            const gpsOffset = pointer(view, ifd0.get(0x8825), little);
            const gps = gpsOffset === null ? new Map() : readIfd(view, tiffStart, gpsOffset, little);
            const latitude = degrees(rationals(view, tiffStart, gps.get(2), little), ascii(view, tiffStart, gps.get(1), little), "S");
            const longitude = degrees(rationals(view, tiffStart, gps.get(4), little), ascii(view, tiffStart, gps.get(3), little), "W");
            return {
                make: ascii(view, tiffStart, ifd0.get(0x010f), little),
                model: ascii(view, tiffStart, ifd0.get(0x0110), little),
                software: ascii(view, tiffStart, ifd0.get(0x0131), little),
                dateTimeOriginal: ascii(view, tiffStart, exif.get(0x9003), little),
                offsetTimeOriginal: ascii(view, tiffStart, exif.get(0x9011), little),
                userComment: ascii(view, tiffStart, exif.get(0x9286), little),
                coordinate: latitude !== null && longitude !== null && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && (latitude !== 0 || longitude !== 0)
                    ? {latitude, longitude}
                    : null
            };
        }
        at += 2 + length;
    }
    // A JPEG with no EXIF segment at all.
    return {make: null, model: null, software: null, dateTimeOriginal: null, offsetTimeOriginal: null, userComment: null, coordinate: null};
}

/**
 * The same three verdicts as the apps. A file that is not a JPEG (a PNG
 * screenshot, a WebP download) carries no camera information by
 * definition, which is the apps' verdict for it too.
 */
export function checkCameraRollPhoto(bytes: Uint8Array): CameraRollCheck {
    if (!bytes.length) return {ok: false, rejection: "unreadable"};
    const exif = readJpegExif(bytes);
    if (!exif) {
        const isPng = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
        const isWebp = bytes.length > 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
        return {ok: false, rejection: isPng || isWebp ? "no_camera_information" : "unreadable"};
    }
    // iOS writes this into every screenshot it saves.
    if (exif.userComment && exif.userComment.toLowerCase() === "screenshot") return {ok: false, rejection: "screenshot"};
    const takenAt = exifDateToIso(exif.dateTimeOriginal, exif.offsetTimeOriginal);
    // A photo straight off a phone or camera names the device that took it.
    // One with no camera and no capture time has been through something that
    // stripped it: a download, a messaging app, a generator.
    if ((!exif.make && !exif.model) || !takenAt) return {ok: false, rejection: "no_camera_information"};
    return {
        ok: true,
        metadata: {takenAt, cameraMake: exif.make, cameraModel: exif.model, software: exif.software, hadEmbeddedLocation: exif.coordinate !== null},
        coordinate: exif.coordinate
    };
}
