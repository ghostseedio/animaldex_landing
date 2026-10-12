"use client";

import Image from "next/image";
import {ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState} from "react";
import {CheckCircle, Copy, Gallery, Magnifer, TrashBinMinimalistic, Upload} from "solar-icon-set";
import {AdminPage, Alert, Badge, Button, buttonVariants, cn, EmptyState, fieldClass, PageHeader, Skeleton, Spinner} from "@/components/admin/ui";

type Asset = {
    path: string;
    url: string;
    filename: string;
    createdAt?: string;
    source?: "Uploads" | "Website";
    metadata?: {size?: number; mimetype?: string};
};

function formatBytes(bytes?: number) {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AdminAssetLibrary() {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [mutatingPath, setMutatingPath] = useState("");
    const [copied, setCopied] = useState("");
    const [error, setError] = useState("");
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    const loadingRef = useRef(false);

    const readJson = useCallback(async (response: Response) => {
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
            throw new Error(response.ok ? "Asset API returned a non-JSON response" : `Asset API failed (${response.status})`);
        }
        return response.json();
    }, []);

    const loadAssets = useCallback(async (requestedPage = 1, replace = false, search = query) => {
        if (loadingRef.current && requestedPage > 1) return;
        loadingRef.current = true;
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({page: String(requestedPage), limit: "30"});
            if (search.trim()) params.set("query", search.trim());
            const response = await fetch(`/api/admin/assets?${params.toString()}`, {cache: "no-store"});
            const body = await readJson(response);
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load assets");
            setAssets((current) => replace ? (body.assets ?? []) : [...current, ...(body.assets ?? []).filter((asset: Asset) => !current.some((item) => item.path === asset.path))]);
            setPage(requestedPage);
            setTotal(body.pagination?.total ?? 0);
            setHasMore(Boolean(body.pagination?.hasMore));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load assets");
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    }, [query, readJson]);

    useEffect(() => {
        const timeout = window.setTimeout(() => loadAssets(1, true, query), 250);
        return () => window.clearTimeout(timeout);
    }, [loadAssets, query]);

    useEffect(() => {
        const target = loadMoreRef.current;
        if (!target) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0]?.isIntersecting && hasMore && !loading) loadAssets(page + 1);
        }, {rootMargin: "500px"});
        observer.observe(target);
        return () => observer.disconnect();
    }, [hasMore, loading, page, loadAssets]);

    async function uploadFiles(files: File[]) {
        const images = files.filter((file) => file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(file.name));
        if (!images.length) return;
        setUploading(true);
        setUploadProgress("");
        setError("");
        const failures: string[] = [];
        try {
            for (let index = 0; index < images.length; index += 1) {
                const file = images[index];
                setUploadProgress(`${index + 1}/${images.length}`);
                const form = new FormData();
                form.set("file", file);
                const response = await fetch("/api/admin/assets", {method: "POST", body: form});
                const body = await readJson(response).catch((caught) => ({ok: false, error: caught instanceof Error ? caught.message : "Upload failed"}));
                if (!response.ok || !body.ok) {
                    failures.push(`${file.name}: ${body.error || "Upload failed"}`);
                }
            }
            await loadAssets(1, true);
            if (failures.length) setError(`Uploaded ${images.length - failures.length} of ${images.length}. ${failures.slice(0, 3).join(" ")}`);
        } finally {
            setUploadProgress("");
            setUploading(false);
        }
    }

    async function upload(event: ChangeEvent<HTMLInputElement>) {
        const files = Array.from(event.target.files ?? []);
        if (!files.length) return;
        try {
            await uploadFiles(files);
        } finally {
            event.target.value = "";
        }
    }

    function handleDragOver(event: DragEvent<HTMLElement>) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setIsDragging(true);
    }

    function handleDragLeave(event: DragEvent<HTMLElement>) {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setIsDragging(false);
    }

    function handleDrop(event: DragEvent<HTMLElement>) {
        event.preventDefault();
        setIsDragging(false);
        void uploadFiles(Array.from(event.dataTransfer.files));
    }

    async function replaceAsset(asset: Asset, event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        setMutatingPath(asset.path);
        setError("");
        try {
            const form = new FormData();
            form.set("file", file);
            form.set("path", asset.path);
            const response = await fetch("/api/admin/assets", {method: "PUT", body: form});
            const body = await readJson(response);
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to replace image");
            await loadAssets(1, true);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to replace image");
        } finally {
            event.target.value = "";
            setMutatingPath("");
        }
    }

    async function deleteAsset(asset: Asset) {
        if (!window.confirm(`Delete “${asset.filename}”? Pages using this URL may show a broken image.`)) return;
        setMutatingPath(asset.path);
        setError("");
        try {
            const response = await fetch("/api/admin/assets", {
                method: "DELETE",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({path: asset.path})
            });
            const body = await readJson(response);
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to delete image");
            setAssets((current) => current.filter((item) => item.path !== asset.path));
            setTotal((current) => Math.max(0, current - 1));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to delete image");
        } finally {
            setMutatingPath("");
        }
    }

    async function copyUrl(asset: Asset) {
        await navigator.clipboard.writeText(asset.url);
        setCopied(asset.path);
        window.setTimeout(() => setCopied((current) => current === asset.path ? "" : current), 1800);
    }

    return (
        <AdminPage width="wide">
            <PageHeader
                eyebrow="Content"
                title="Asset library"
                description="Upload images once, reuse them across pages, or copy their public URLs into rendered HTML and code blocks."
                actions={
                    <label className={cn(buttonVariants({variant: "primary", size: "lg"}), "cursor-pointer", uploading && "pointer-events-none opacity-70")} aria-busy={uploading || undefined}>
                        {uploading ? <Spinner /> : <Upload size={18} />}{uploading ? `Uploading ${uploadProgress}` : "Upload images"}
                        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif,.avif" multiple disabled={uploading} onChange={upload} className="hidden" />
                    </label>
                }
            />

            {error && <Alert tone="bad" className="mt-6">{error}</Alert>}

            <section className="mt-6" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                <label className={`mb-6 flex cursor-pointer flex-col items-center justify-center border border-dashed px-4 py-8 text-center transition ${isDragging ? "border-primary-300 bg-primary-500/15" : "border-line-300 bg-surface-900 hover:border-primary-400/60"}`}>
                    {uploading ? <Spinner size={26} className="text-primary-300" /> : <Upload size={26} className={isDragging ? "text-primary-100" : "text-ink-400"} />}
                    <span className="mt-3 text-sm font-black text-white">{uploading ? `Uploading ${uploadProgress}` : "Drop multiple images here"}</span>
                    <span className="mt-1 max-w-xl text-xs leading-5 text-ink-500">or click to select images. JPG, PNG, WebP, GIF, SVG, or AVIF up to 15 MB. JPG, PNG and WebP are compressed to WebP automatically.</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,image/avif,.avif" multiple disabled={uploading} onChange={upload} className="hidden" />
                </label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full max-w-xl"><Magnifer size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search filenames or paths…" className={cn(fieldClass, "pl-9")} /></div>
                    <p className="flex items-center gap-2 text-xs font-bold tabular-nums text-ink-500">{loading && assets.length ? <Spinner size={12} /> : null}{assets.length} of {total} assets loaded</p>
                </div>

                {loading && !assets.length ? (
                    <div role="status" aria-label="Loading asset library" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {Array.from({length: 10}, (_, index) => (
                            <div key={index} aria-hidden="true" className="border border-line-300 bg-surface-900">
                                <Skeleton className="aspect-[4/3] w-full" />
                                <div className="p-3">
                                    <Skeleton className="h-3 w-3/4" />
                                    <Skeleton className="mt-2 h-2.5 w-1/3" />
                                    <Skeleton className="mt-3 h-8 w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : assets.length ? (
                    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {assets.map((asset) => (
                            <article key={asset.path} className={cn("group overflow-hidden border border-line-300 bg-surface-900 transition hover:border-primary-400/50", mutatingPath === asset.path && "opacity-60")}>
                                <a href={asset.url} target="_blank" rel="noreferrer" className="relative block aspect-[4/3] overflow-hidden border-b border-line-300 bg-canvas-950">
                                    <Image src={asset.url} alt="" fill unoptimized sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                                    <span className="absolute right-2 top-2 bg-canvas-950/90 px-2 py-1 text-[9px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100">Open full size ↗</span>
                                </a>
                                <div className="p-3">
                                    <div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-xs font-bold text-white" title={asset.filename}>{asset.filename}</p><Badge tone={asset.source === "Uploads" ? "good" : "ios"} className="shrink-0">{asset.source || "Asset"}</Badge></div>
                                    <div className="mt-1 flex justify-between gap-2 text-[10px] tabular-nums text-ink-500"><span>{formatBytes(asset.metadata?.size)}</span><span>{asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : ""}</span></div>
                                    <Button size="sm" variant={copied === asset.path ? "ghost" : "outline"} onClick={() => copyUrl(asset)} className={cn("mt-3 w-full", copied === asset.path && "bg-primary-500/15 text-primary-100")}>
                                        {copied === asset.path ? <CheckCircle size={15} iconStyle="Bold" /> : <Copy size={15} />}
                                        {copied === asset.path ? "URL copied" : "Copy public URL"}
                                    </Button>
                                    {asset.source === "Uploads" ? <div className="mt-2 grid grid-cols-2 gap-2">
                                        <label className={cn(buttonVariants({size: "sm"}), "cursor-pointer gap-1 px-2 text-[11px]", mutatingPath && "pointer-events-none opacity-50")}>{mutatingPath === asset.path ? <Spinner size={12} /> : <Upload size={13} />}{mutatingPath === asset.path ? "Working…" : "Replace"}<input type="file" accept="image/*" disabled={Boolean(mutatingPath)} onChange={(event) => replaceAsset(asset, event)} className="hidden" /></label>
                                        <Button size="sm" variant="danger" onClick={() => deleteAsset(asset)} disabled={Boolean(mutatingPath)} className="gap-1 px-2 text-[11px]"><TrashBinMinimalistic size={13} />Delete</Button>
                                    </div> : <p className="mt-2 text-center text-[10px] leading-4 text-ink-600">Version-controlled website asset</p>}
                                </div>
                            </article>
                        ))}
                    </div>
                ) : <EmptyState className="mt-4 min-h-[22rem]" icon={<Gallery size={22} />} title="No matching assets" description="Upload an image or change your search." />}
                <div ref={loadMoreRef} className="flex h-20 items-center justify-center gap-2 text-xs text-ink-500">{loading && assets.length ? <><Spinner size={12} />Loading more assets…</> : hasMore ? "Scroll to load more" : assets.length ? "All assets loaded" : ""}</div>
            </section>
        </AdminPage>
    );
}
