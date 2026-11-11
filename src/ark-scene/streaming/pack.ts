/**
 * The far-model pack (Part B, docs/ark/streaming.md §6): one file per tier holding the starting view's kinds' far
 * models, each a GLB with its `ark.json` inside (`extras.ark`) and its skin already fitted to the tier, so the
 * starting view is one request instead of ~240. Built by `scripts/ark-model-pack.mjs`; read by `ModelLibrary`.
 *
 * Layout (little-endian): "ARKP", u32 version (1), u32 header length, the header (UTF-8 JSON, padded to 4 bytes with
 * spaces), then the GLBs at the header's offsets (from the end of the header).
 *
 *   header: {tier, far, entries: [{slug, version, offset, length}]}
 */

export type ArkPackEntry = {slug: string; version: string; offset: number; length: number};
export type ArkPackHeader = {tier: string; far: number; entries: ArkPackEntry[]};

export const ARK_PACK_MAGIC = 0x504b5241; // "ARKP"
export const ARK_PACK_VERSION = 1;

export type ArkPack = {
    header: ArkPackHeader;
    /** A kind's GLB, or null if the pack has none for that version. */
    glb(slug: string, version: string): ArrayBuffer | null;
};

export function parseArkPack(buffer: ArrayBuffer): ArkPack {
    const view = new DataView(buffer);
    if (buffer.byteLength < 12 || view.getUint32(0, true) !== ARK_PACK_MAGIC) throw new Error("not an ark pack");
    if (view.getUint32(4, true) !== ARK_PACK_VERSION) throw new Error(`ark pack version ${view.getUint32(4, true)}`);
    const headerLength = view.getUint32(8, true);
    const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 12, headerLength))) as ArkPackHeader;
    const base = 12 + headerLength;
    const bySlug = new Map(header.entries.map((entry) => [entry.slug, entry]));
    return {
        header,
        glb(slug, version) {
            const entry = bySlug.get(slug);
            if (!entry || entry.version !== version) return null;
            if (base + entry.offset + entry.length > buffer.byteLength) return null;
            return buffer.slice(base + entry.offset, base + entry.offset + entry.length);
        }
    };
}

/** Write a pack (the builder's side; also the tests'). */
export function writeArkPack(tier: string, far: number, files: Array<{slug: string; version: string; glb: Uint8Array}>): Uint8Array {
    const entries: ArkPackEntry[] = [];
    let offset = 0;
    for (const file of files) {
        entries.push({slug: file.slug, version: file.version, offset, length: file.glb.byteLength});
        offset += Math.ceil(file.glb.byteLength / 4) * 4;
    }
    let json = JSON.stringify({tier, far, entries} satisfies ArkPackHeader);
    while (new TextEncoder().encode(json).byteLength % 4) json += " ";
    const head = new TextEncoder().encode(json);
    const out = new Uint8Array(12 + head.byteLength + offset);
    const view = new DataView(out.buffer);
    view.setUint32(0, ARK_PACK_MAGIC, true);
    view.setUint32(4, ARK_PACK_VERSION, true);
    view.setUint32(8, head.byteLength, true);
    out.set(head, 12);
    files.forEach((file, i) => out.set(file.glb, 12 + head.byteLength + entries[i].offset));
    return out;
}
