import "server-only";
import {randomUUID} from "crypto";
import type Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import {extractDocxText} from "@/lib/blog-generator/docx-text";
import {extensionOf, MATERIAL_LIMITS, materialBatchProblem, materialKind} from "@/lib/blog-generator/material-types";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

// Reference material an editor attaches to a custom article: pasted text,
// PDFs, Word files, plain-text formats and images. The browser uploads each
// file straight to a private Storage bucket through a signed URL, so large
// files never pass through the site's own proxy (nginx caps request bodies).
// The job downloads them, turns them into Claude content blocks, and deletes
// them when it finishes.

const BUCKET = "blog-generator-materials";

export type MaterialRef = {path: string; name: string; size: number};

/** A file already in memory (the dry-run script reads local files this way). */
export type MaterialFile = {name: string; data: Buffer};

function storage() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase storage is not configured");
    return {url, key};
}

async function ensureBucket() {
    const {url, key} = storage();
    const response = await fetch(`${url}/storage/v1/bucket`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
        body: JSON.stringify({id: BUCKET, name: BUCKET, public: false, file_size_limit: MATERIAL_LIMITS.fileBytes})
    });
    if (response.ok) return;
    const reason = await response.text();
    if (response.status !== 409 && !/already exists|duplicate/i.test(reason)) {
        throw new Error(`Material bucket setup failed (${response.status}): ${reason}`);
    }
}

/** Checks the batch and returns one signed upload URL per file. */
export async function createMaterialUploads(files: Array<{name: string; size: number}>) {
    if (!files.length) return [];
    const problem = materialBatchProblem(files);
    if (problem) throw new Error(problem);

    await ensureBucket();
    const {url, key} = storage();
    const batch = randomUUID();
    return Promise.all(files.map(async (file, index) => {
        const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(-80) || `file.${extensionOf(file.name)}`;
        const path = `${batch}/${index + 1}-${safeName}`;
        const response = await fetch(`${url}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
            body: JSON.stringify({})
        });
        if (!response.ok) throw new Error(`Could not prepare the upload for ${file.name} (${response.status}): ${await response.text()}`);
        const body = await response.json() as {url?: string};
        if (!body.url) throw new Error(`Storage returned no upload URL for ${file.name}`);
        return {path, name: file.name, size: file.size, uploadUrl: `${url}/storage/v1${body.url}`};
    }));
}

async function download(ref: MaterialRef): Promise<MaterialFile> {
    if (!/^[0-9a-f-]{36}\/[\w.-]+$/.test(ref.path)) throw new Error(`Invalid material path: ${ref.path}`);
    const {url, key} = storage();
    const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${ref.path}`, {headers: getSupabaseHeaders(key)});
    if (!response.ok) throw new Error(`${ref.name} could not be read back from storage (${response.status}); upload it again`);
    return {name: ref.name, data: Buffer.from(await response.arrayBuffer())};
}

export async function deleteMaterials(refs: MaterialRef[]) {
    if (!refs.length) return;
    const {url, key} = storage();
    await fetch(`${url}/storage/v1/object/${BUCKET}`, {
        method: "DELETE",
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
        body: JSON.stringify({prefixes: refs.map((ref) => ref.path)})
    }).catch(() => undefined);
}

function htmlToText(html: string) {
    return html
        .replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, " ")
        .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article)>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/[ \t]+/g, " ")
        .replace(/\n\s*\n\s*/g, "\n\n")
        .trim();
}

function textBlock(name: string, text: string): Anthropic.Beta.BetaContentBlockParam {
    if (text.length > MATERIAL_LIMITS.textChars) {
        throw new Error(`${name} has ${text.length.toLocaleString()} characters; the limit is ${MATERIAL_LIMITS.textChars.toLocaleString()}. Split it or attach the most relevant part.`);
    }
    if (!text.trim()) throw new Error(`${name} has no readable text`);
    return {type: "document", title: name, source: {type: "text", media_type: "text/plain", data: text}};
}

async function toBlocks(file: MaterialFile): Promise<Anthropic.Beta.BetaContentBlockParam[]> {
    switch (materialKind(file.name)) {
        case "pdf":
            return [{type: "document", title: file.name, source: {type: "base64", media_type: "application/pdf", data: file.data.toString("base64")}}];
        case "docx":
            return [textBlock(file.name, extractDocxText(file.data))];
        case "text":
            return [textBlock(file.name, file.data.toString("utf8"))];
        case "html":
            return [textBlock(file.name, htmlToText(file.data.toString("utf8")))];
        case "image": {
            // Downscaled: plenty to read a chart or a page, far fewer tokens.
            const jpeg = await sharp(file.data, {failOn: "none"}).rotate().resize(1600, 1600, {fit: "inside", withoutEnlargement: true}).jpeg({quality: 82}).toBuffer();
            return [
                {type: "text", text: `Attached image: ${file.name}`},
                {type: "image", source: {type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64")}}
            ];
        }
        default:
            throw new Error(`${file.name}: unsupported file type`);
    }
}

export type LoadedMaterials = {blocks: Anthropic.Beta.BetaContentBlockParam[]; names: string[]};

/** Downloads (or takes) the files and turns each into Claude content blocks. */
export async function loadMaterials(refs: MaterialRef[], files: MaterialFile[] = []): Promise<LoadedMaterials> {
    const all = [...files, ...await Promise.all(refs.map(download))];
    const blocks = (await Promise.all(all.map(toBlocks))).flat();
    return {blocks, names: all.map((file) => file.name)};
}
