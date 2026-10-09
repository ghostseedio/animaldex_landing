// Reads frame rate, size and duration straight from an MP4's moov box, so the
// share job can tell whether a video meets the platforms' specs without
// shelling out. TikTok, Instagram Reels and Facebook Reels reject anything
// outside roughly 23–60 fps (story videos were first rendered at 15).

export type Mp4VideoInfo = {
    fps: number;
    width: number;
    height: number;
    durationSeconds: number;
    hasAudio: boolean;
};

type Box = {type: string; body: number; end: number};

function readBoxes(buf: Buffer, start: number, end: number): Box[] {
    const out: Box[] = [];
    let offset = start;
    while (offset + 8 <= end) {
        let size = buf.readUInt32BE(offset);
        const type = buf.toString("latin1", offset + 4, offset + 8);
        let header = 8;
        if (size === 1) {
            size = Number(buf.readBigUInt64BE(offset + 8));
            header = 16;
        } else if (size === 0) {
            size = end - offset;
        }
        if (size < header || offset + size > end) break;
        out.push({type, body: offset + header, end: offset + size});
        offset += size;
    }
    return out;
}

const child = (buf: Buffer, box: Box | undefined, type: string) => box ? readBoxes(buf, box.body, box.end).find((item) => item.type === type) : undefined;

/** Frame rate and size of the first video track, or null when the file cannot be read as MP4. */
export function readMp4VideoInfo(buf: Buffer): Mp4VideoInfo | null {
    try {
        const moov = readBoxes(buf, 0, buf.length).find((box) => box.type === "moov");
        if (!moov) return null;
        let video: Mp4VideoInfo | null = null;
        let hasAudio = false;
        for (const trak of readBoxes(buf, moov.body, moov.end).filter((box) => box.type === "trak")) {
            const mdia = child(buf, trak, "mdia");
            const hdlr = child(buf, mdia, "hdlr");
            const mdhd = child(buf, mdia, "mdhd");
            if (!hdlr || !mdhd) continue;
            const handler = buf.toString("latin1", hdlr.body + 8, hdlr.body + 12);
            if (handler === "soun") hasAudio = true;
            if (handler !== "vide" || video) continue;
            const version = buf[mdhd.body];
            const timescale = buf.readUInt32BE(mdhd.body + (version === 1 ? 20 : 12));
            const duration = version === 1 ? Number(buf.readBigUInt64BE(mdhd.body + 24)) : buf.readUInt32BE(mdhd.body + 16);
            const stbl = child(buf, child(buf, mdia, "minf"), "stbl");
            const stts = child(buf, stbl, "stts");
            const stsd = child(buf, stbl, "stsd");
            if (!stts || !stsd || !timescale || !duration) continue;
            let samples = 0;
            const entries = buf.readUInt32BE(stts.body + 4);
            for (let index = 0; index < entries; index += 1) samples += buf.readUInt32BE(stts.body + 8 + index * 8);
            // Visual sample entry: 8 (stsd header) + 8 (entry header) + 24 bytes, then width, height.
            const entry = stsd.body + 8;
            const durationSeconds = duration / timescale;
            video = {
                fps: samples / durationSeconds,
                width: buf.readUInt16BE(entry + 8 + 24),
                height: buf.readUInt16BE(entry + 8 + 26),
                durationSeconds,
                hasAudio: false
            };
        }
        return video ? {...video, hasAudio} : null;
    } catch {
        return null;
    }
}

/** TikTok's floor is 23 fps, Facebook Reels' 24; 60 is the common ceiling. */
export function needsFrameRateFix(info: Mp4VideoInfo | null) {
    return info !== null && (info.fps < 24 || info.fps > 60);
}
