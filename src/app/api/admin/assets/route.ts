import {randomUUID} from "crypto";
import {readdir, stat} from "fs/promises";
import path from "path";
import {NextRequest, NextResponse} from "next/server";
import sharp from "sharp";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

const MAX_ASSET_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif"]);
const WEBP_CONVERTIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_OPTIMIZED_DIMENSION = 2400;
const WEBP_QUALITY = 84;

type OptimizedUpload = {
    buffer: Buffer;
    contentType: string;
    extension: string;
    size: number;
    width?: number;
    height?: number;
    optimized: boolean;
};

async function optimizeUpload(file: File): Promise<OptimizedUpload> {
    const input = Buffer.from(await file.arrayBuffer());
    if (!WEBP_CONVERTIBLE_TYPES.has(file.type)) {
        return {
            buffer: input,
            contentType: file.type,
            extension: file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin",
            size: file.size,
            optimized: false
        };
    }

    try {
        const image = sharp(input, {animated: false, failOn: "none"});
        const metadata = await image.metadata();
        const optimized = await image
            .rotate()
            .resize({
                width: MAX_OPTIMIZED_DIMENSION,
                height: MAX_OPTIMIZED_DIMENSION,
                fit: "inside",
                withoutEnlargement: true
            })
            .webp({quality: WEBP_QUALITY, effort: 5})
            .toBuffer({resolveWithObject: true});

        return {
            buffer: optimized.data,
            contentType: "image/webp",
            extension: "webp",
            size: optimized.data.length,
            width: optimized.info.width ?? metadata.width,
            height: optimized.info.height ?? metadata.height,
            optimized: true
        };
    } catch {
        return {
            buffer: input,
            contentType: file.type,
            extension: file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin",
            size: file.size,
            optimized: false
        };
    }
}

async function listPublicImages() {
    const publicRoot = path.join(process.cwd(), "public");
    const imageRoot = path.join(publicRoot, "images");
    const assets: Array<Record<string, unknown>> = [];

    async function visit(directory: string) {
        const entries = await readdir(directory, {withFileTypes: true});
        await Promise.all(entries.map(async (entry) => {
            const absolutePath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                await visit(absolutePath);
                return;
            }
            if (!entry.isFile() || !IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) return;
            const fileStat = await stat(absolutePath);
            const relativePath = path.relative(publicRoot, absolutePath).split(path.sep).join("/");
            assets.push({
                path: `public/${relativePath}`,
                url: `/${relativePath.split("/").map(encodeURIComponent).join("/")}`,
                filename: entry.name,
                createdAt: fileStat.mtime.toISOString(),
                source: "Website",
                metadata: {size: fileStat.size, mimetype: `image/${path.extname(entry.name).slice(1).toLowerCase()}`}
            });
        }));
    }

    try {
        await visit(imageRoot);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return assets;
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const supabaseUrl = getSupabaseUrl();
        const serviceKey = getSupabaseServiceKey();
        if (!supabaseUrl || !serviceKey) throw new Error("Supabase asset storage is not configured");

        const list = async (prefix: string) => {
            const response = await fetch(`${supabaseUrl}/storage/v1/object/list/admin-assets`, {
                method: "POST",
                headers: getSupabaseHeaders(serviceKey, {"Content-Type": "application/json"}),
                body: JSON.stringify({prefix, limit: 1000, offset: 0, sortBy: {column: "created_at", order: "desc"}})
            });
            if (!response.ok) throw new Error(`Asset library failed (${response.status}): ${await response.text()}`);
            return response.json() as Promise<Array<{name: string; id?: string | null; created_at?: string; metadata?: Record<string, unknown> | null}>>;
        };

        const root = await list("blog");
        const folders = root.filter((item) => !item.id && !item.metadata);
        const filesAtRoot = root.filter((item) => item.id || item.metadata).map((item) => ({...item, path: `blog/${item.name}`}));
        const nested = (await Promise.all(folders.map(async (folder) =>
            (await list(`blog/${folder.name}`))
                .filter((item) => item.id || item.metadata)
                .map((item) => ({...item, path: `blog/${folder.name}/${item.name}`}))
        ))).flat();
        const uploadedAssets = [...filesAtRoot, ...nested]
            .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
            .map((item) => ({
                path: item.path,
                url: `${supabaseUrl}/storage/v1/object/public/admin-assets/${item.path}`,
                filename: item.name,
                createdAt: item.created_at,
                source: "Uploads",
                metadata: item.metadata
            }));
        const publicAssets = await listPublicImages();
        const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") || "1", 10));
        const limit = Math.min(60, Math.max(12, Number.parseInt(request.nextUrl.searchParams.get("limit") || "30", 10)));
        const query = (request.nextUrl.searchParams.get("query") || "").trim().toLowerCase();
        const matchingAssets = [...uploadedAssets, ...publicAssets]
            .filter((asset) => !query || `${asset.filename} ${asset.path}`.toLowerCase().includes(query));
        const start = (page - 1) * limit;
        const assets = matchingAssets.slice(start, start + limit);

        return NextResponse.json({
            ok: true,
            assets,
            pagination: {
                page,
                limit,
                total: matchingAssets.length,
                hasMore: start + assets.length < matchingAssets.length
            }
        });
    } catch (error) {
        return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Unable to load assets"}, {status: 500});
    }
}

export async function PUT(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }
    try {
        const form = await request.formData();
        const file = form.get("file");
        const assetPath = String(form.get("path") || "");
        if (!assetPath.startsWith("blog/") || assetPath.includes("..")) {
            return NextResponse.json({ok: false, error: "Only uploaded assets can be replaced"}, {status: 400});
        }
        if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size > MAX_ASSET_BYTES) {
            return NextResponse.json({ok: false, error: "Choose a JPG, PNG, WebP, GIF, or SVG up to 15 MB"}, {status: 400});
        }
        const supabaseUrl = getSupabaseUrl();
        const serviceKey = getSupabaseServiceKey();
        if (!supabaseUrl || !serviceKey) throw new Error("Supabase asset storage is not configured");
        const optimized = await optimizeUpload(file);
        const response = await fetch(`${supabaseUrl}/storage/v1/object/admin-assets/${assetPath}`, {
            method: "POST",
            headers: getSupabaseHeaders(serviceKey, {
                "Content-Type": optimized.contentType,
                "x-upsert": "true",
                "cache-control": "no-cache"
            }),
            body: optimized.buffer
        });
        if (!response.ok) throw new Error(`Asset replacement failed (${response.status}): ${await response.text()}`);
        return NextResponse.json({
            ok: true,
            asset: {
                path: assetPath,
                url: `${supabaseUrl}/storage/v1/object/public/admin-assets/${assetPath}`,
                filename: path.basename(assetPath),
                contentType: optimized.contentType,
                size: optimized.size,
                width: optimized.width,
                height: optimized.height,
                optimized: optimized.optimized
            }
        });
    } catch (error) {
        return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Unable to replace asset"}, {status: 500});
    }
}

export async function DELETE(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }
    try {
        const {path: assetPath} = await request.json();
        if (typeof assetPath !== "string" || !assetPath.startsWith("blog/") || assetPath.includes("..")) {
            return NextResponse.json({ok: false, error: "Only uploaded assets can be deleted"}, {status: 400});
        }
        const supabaseUrl = getSupabaseUrl();
        const serviceKey = getSupabaseServiceKey();
        if (!supabaseUrl || !serviceKey) throw new Error("Supabase asset storage is not configured");
        const response = await fetch(`${supabaseUrl}/storage/v1/object/admin-assets/${assetPath}`, {
            method: "DELETE",
            headers: getSupabaseHeaders(serviceKey)
        });
        if (!response.ok) throw new Error(`Asset deletion failed (${response.status}): ${await response.text()}`);
        return NextResponse.json({ok: true});
    } catch (error) {
        return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Unable to delete asset"}, {status: 500});
    }
}

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const form = await request.formData();
        const file = form.get("file");

        if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size > MAX_ASSET_BYTES) {
            return NextResponse.json({ok: false, error: "Choose a JPG, PNG, WebP, GIF, or SVG up to 15 MB"}, {status: 400});
        }

        const supabaseUrl = getSupabaseUrl();
        const serviceKey = getSupabaseServiceKey();
        if (!supabaseUrl || !serviceKey) throw new Error("Supabase asset storage is not configured");

        const optimized = await optimizeUpload(file);
        const stem = file.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "asset";
        const path = `blog/${new Date().toISOString().slice(0, 10)}/${stem}-${randomUUID()}.${optimized.extension}`;
        const response = await fetch(`${supabaseUrl}/storage/v1/object/admin-assets/${path}`, {
            method: "POST",
            headers: getSupabaseHeaders(serviceKey, {
                "Content-Type": optimized.contentType,
                "x-upsert": "false"
            }),
            body: optimized.buffer
        });

        if (!response.ok) {
            throw new Error(`Asset upload failed (${response.status}): ${await response.text()}`);
        }

        return NextResponse.json({
            ok: true,
            asset: {
                path,
                url: `${supabaseUrl}/storage/v1/object/public/admin-assets/${path}`,
                filename: `${stem}.${optimized.extension}`,
                contentType: optimized.contentType,
                size: optimized.size,
                originalSize: file.size,
                width: optimized.width,
                height: optimized.height,
                optimized: optimized.optimized
            }
        });
    } catch (error) {
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to upload asset"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
