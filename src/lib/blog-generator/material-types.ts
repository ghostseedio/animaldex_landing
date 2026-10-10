// Shared by the admin page (to check files before uploading) and the server.

export const MATERIAL_LIMITS = {
    files: 12,
    fileBytes: 15 * 1024 * 1024,
    // The whole research request has to stay under the API's 32 MB limit after base64.
    totalBytes: 20 * 1024 * 1024,
    textChars: 800_000
};

export type MaterialKind = "pdf" | "docx" | "text" | "html" | "image";

const KIND_BY_EXTENSION: Record<string, MaterialKind> = {
    pdf: "pdf",
    docx: "docx",
    txt: "text", md: "text", markdown: "text", csv: "text", tsv: "text", json: "text", xml: "text", srt: "text", vtt: "text",
    html: "html", htm: "html",
    png: "image", jpg: "image", jpeg: "image", webp: "image", gif: "image"
};

export const ACCEPTED_MATERIAL_EXTENSIONS = Object.keys(KIND_BY_EXTENSION);

export function extensionOf(name: string) {
    return name.split(".").pop()?.toLowerCase() ?? "";
}

export function materialKind(name: string): MaterialKind | null {
    return KIND_BY_EXTENSION[extensionOf(name)] ?? null;
}

/** Why this batch can't be uploaded, or null. */
export function materialBatchProblem(files: Array<{name: string; size: number}>): string | null {
    if (files.length > MATERIAL_LIMITS.files) return `Attach at most ${MATERIAL_LIMITS.files} files`;
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (total > MATERIAL_LIMITS.totalBytes) return `Attachments total ${(total / 1048576).toFixed(1)} MB; the limit is ${MATERIAL_LIMITS.totalBytes / 1048576} MB`;
    for (const file of files) {
        if (!materialKind(file.name)) return `${file.name}: unsupported file type. Use PDF, Word (.docx), text, Markdown, CSV, HTML, JSON or an image.`;
        if (file.size > MATERIAL_LIMITS.fileBytes) return `${file.name} is over ${MATERIAL_LIMITS.fileBytes / 1048576} MB`;
    }
    return null;
}
