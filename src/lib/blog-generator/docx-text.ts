import {inflateRawSync} from "zlib";

// Plain text out of a Word .docx, which Claude cannot read directly. A .docx
// is a ZIP; the body is word/document.xml. This reads just enough of the ZIP
// format (central directory → local header → stored or deflated data) to get
// that one file, so no parser dependency is needed for reference uploads.

function readZipEntry(zip: Buffer, wanted: string): Buffer | null {
    // End of central directory: signature 0x06054b50, within the last 64 KiB.
    let eocd = -1;
    for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 65_557); offset -= 1) {
        if (zip.readUInt32LE(offset) === 0x06054b50) {
            eocd = offset;
            break;
        }
    }
    if (eocd < 0) throw new Error("not a ZIP file");
    const entries = zip.readUInt16LE(eocd + 10);
    let cursor = zip.readUInt32LE(eocd + 16);

    for (let index = 0; index < entries; index += 1) {
        if (zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error("corrupt ZIP directory");
        const method = zip.readUInt16LE(cursor + 10);
        const compressedSize = zip.readUInt32LE(cursor + 20);
        const nameLength = zip.readUInt16LE(cursor + 28);
        const extraLength = zip.readUInt16LE(cursor + 30);
        const commentLength = zip.readUInt16LE(cursor + 32);
        const localOffset = zip.readUInt32LE(cursor + 42);
        const name = zip.toString("utf8", cursor + 46, cursor + 46 + nameLength);
        cursor += 46 + nameLength + extraLength + commentLength;
        if (name !== wanted) continue;

        if (zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("corrupt ZIP entry");
        const dataStart = localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
        const data = zip.subarray(dataStart, dataStart + compressedSize);
        if (method === 0) return data;
        if (method === 8) return inflateRawSync(data);
        throw new Error(`unsupported ZIP compression ${method}`);
    }
    return null;
}

function decodeEntities(value: string) {
    return value
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&amp;/g, "&");
}

/** Paragraphs become lines, table cells are tab-separated, formatting is dropped. */
export function documentXmlToText(xml: string) {
    return decodeEntities(
        xml
            .replace(/<w:tab\/>/g, "\t")
            .replace(/<w:(br|cr)\b[^>]*\/>/g, "\n")
            .replace(/<\/w:tc>/g, "\t")
            .replace(/<\/w:(p|tr)>/g, "\n")
            .replace(/<[^>]+>/g, "")
    )
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

export function extractDocxText(docx: Buffer) {
    const xml = readZipEntry(docx, "word/document.xml");
    if (!xml) throw new Error("no word/document.xml inside the .docx");
    return documentXmlToText(xml.toString("utf8"));
}
