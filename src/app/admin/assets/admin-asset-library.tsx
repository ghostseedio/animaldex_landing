"use client";

import Link from "next/link";
import {ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState} from "react";
import {ArrowLeft, CheckCircle, Copy, Gallery, Magnifer, TrashBinMinimalistic, Upload} from "solar-icon-set";

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

    const loadAssets = useCallback(async (requestedPage = 1, replace = false, search = query) => {
        if (loading && requestedPage > 1) return;
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams({page: String(requestedPage), limit: "30"});
            if (search.trim()) params.set("query", search.trim());
            const response = await fetch(`/api/admin/assets?${params.toString()}`, {cache: "no-store"});
            const body = await response.json();
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load assets");
            setAssets((current) => replace ? (body.assets ?? []) : [...current, ...(body.assets ?? []).filter((asset: Asset) => !current.some((item) => item.path === asset.path))]);
            setPage(requestedPage);
            setTotal(body.pagination?.total ?? 0);
            setHasMore(Boolean(body.pagination?.hasMore));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load assets");
        } finally {
            setLoading(false);
        }
    }, [loading, query]);

    useEffect(() => {
        const timeout = window.setTimeout(() => loadAssets(1, true, query), 250);
        return () => window.clearTimeout(timeout);
    }, [query]);

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
        const images = files.filter((file) => file.type.startsWith("image/"));
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
                const body = await response.json();
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
            const body = await response.json();
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
            const body = await response.json();
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
        <main className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,rgba(27,196,81,.12),transparent_28%)] px-4 py-6 text-ink-100 sm:px-7 lg:px-10">
            <div className="mx-auto w-full max-w-[100rem]">
                <header className="flex flex-col gap-5 border-b border-line-300 pb-6 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-ink-400 hover:text-white"><ArrowLeft size={18} />Dashboard</Link>
                        <p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-primary-200">Media workspace</p>
                        <h1 className="mt-2 font-display text-4xl text-white sm:text-5xl">Asset library</h1>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-300">Upload images once, reuse them across pages, or copy their public URLs into rendered HTML and code blocks.</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-500 px-5 py-3 text-sm font-black text-canvas-950">
                        <Upload size={18} />{uploading ? `Uploading ${uploadProgress}` : "Upload images"}
                        <input type="file" accept="image/*" multiple disabled={uploading} onChange={upload} className="hidden" />
                    </label>
                </header>

                {error && <div className="mt-5 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

                <section className="mt-6" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                    <label className={`mb-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-10 text-center transition ${isDragging ? "border-primary-300 bg-primary-500/15" : "border-line-300 bg-surface-900/55 hover:border-primary-400/60"}`}>
                        <Upload size={30} className={isDragging ? "text-primary-100" : "text-ink-400"} />
                        <span className="mt-3 text-sm font-black text-white">{uploading ? `Uploading ${uploadProgress}` : "Drop multiple images here"}</span>
                        <span className="mt-1 text-xs text-ink-500">or click to select images. JPG, PNG and WebP are compressed to WebP automatically.</span>
                        <input type="file" accept="image/*" multiple disabled={uploading} onChange={upload} className="hidden" />
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="relative w-full max-w-xl"><Magnifer size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search filenames or paths…" className="w-full rounded-xl border border-line-300 bg-surface-900 py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-primary-300" /></div>
                        <p className="text-xs font-bold text-ink-500">{assets.length} of {total} assets loaded</p>
                    </div>

                    {loading && !assets.length ? <div className="grid min-h-[22rem] place-items-center text-sm text-ink-400">Loading asset library…</div> : assets.length ? (
                        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                            {assets.map((asset) => (
                                <article key={asset.path} className="group overflow-hidden rounded-2xl border border-line-300 bg-surface-900">
                                    <a href={asset.url} target="_blank" rel="noreferrer" className="relative block aspect-[4/3] overflow-hidden bg-black/20">
                                        <img src={asset.url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                                        <span className="absolute right-2 top-2 rounded-md bg-canvas-950/80 px-2 py-1 text-[9px] font-bold text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">Open full size ↗</span>
                                    </a>
                                    <div className="p-3">
                                        <div className="flex items-center gap-2"><p className="min-w-0 flex-1 truncate text-xs font-bold text-white" title={asset.filename}>{asset.filename}</p><span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase ${asset.source === "Uploads" ? "bg-primary-500/15 text-primary-100" : "bg-sky-400/15 text-sky-200"}`}>{asset.source || "Asset"}</span></div>
                                        <div className="mt-1 flex justify-between gap-2 text-[10px] text-ink-500"><span>{formatBytes(asset.metadata?.size)}</span><span>{asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : ""}</span></div>
                                        <button onClick={() => copyUrl(asset)} className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition ${copied === asset.path ? "bg-primary-500/15 text-primary-100" : "border border-line-300 text-white hover:border-primary-300"}`}>
                                            {copied === asset.path ? <CheckCircle size={15} iconStyle="Bold" /> : <Copy size={15} />}
                                            {copied === asset.path ? "URL copied" : "Copy public URL"}
                                        </button>
                                        {asset.source === "Uploads" ? <div className="mt-2 grid grid-cols-2 gap-2">
                                            <label className="inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-line-300 px-2 py-2 text-[10px] font-bold text-white hover:border-primary-300"><Upload size={13} />{mutatingPath === asset.path ? "Working…" : "Replace"}<input type="file" accept="image/*" disabled={Boolean(mutatingPath)} onChange={(event) => replaceAsset(asset, event)} className="hidden" /></label>
                                            <button onClick={() => deleteAsset(asset)} disabled={Boolean(mutatingPath)} className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-400/20 px-2 py-2 text-[10px] font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50"><TrashBinMinimalistic size={13} />Delete</button>
                                        </div> : <p className="mt-2 text-center text-[9px] leading-4 text-ink-600">Version-controlled website asset</p>}
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : <div className="mt-5 grid min-h-[22rem] place-items-center rounded-2xl border border-dashed border-line-300 text-center"><div><Gallery size={38} className="mx-auto text-ink-500" /><p className="mt-3 font-bold text-white">No matching assets</p><p className="mt-1 text-sm text-ink-500">Upload an image or change your search.</p></div></div>}
                    <div ref={loadMoreRef} className="grid h-20 place-items-center text-xs text-ink-500">{loading && assets.length ? "Loading more assets…" : hasMore ? "Scroll to load more" : assets.length ? "All assets loaded" : ""}</div>
                </section>
            </div>
        </main>
    );
}
