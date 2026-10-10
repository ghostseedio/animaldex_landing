"use client";

import Link from "next/link";
import {useCallback, useEffect, useRef, useState} from "react";
import {ArrowLeft, CheckCircle, CloseCircle, DangerTriangle, MagicStick3, Paperclip, Pen, Refresh} from "solar-icon-set";
import {ACCEPTED_MATERIAL_EXTENSIONS, MATERIAL_LIMITS, materialBatchProblem} from "@/lib/blog-generator/material-types";
import BlogEditPanel from "@/app/admin/blog-generator/blog-edit-panel";
import DepthPicker, {type ResearchDepth} from "@/app/admin/blog-generator/depth-picker";

type Mode = "news" | "catalog" | "custom";

type TopicIdea = {
    title: string;
    angle: string;
    hook: string;
    primaryKeyword: string;
    format: string;
    whyNow: string;
    sources: Array<{label: string; url: string}>;
    shareLine?: string;
    viralLever?: string;
    viralScore?: number;
};

type GenerateResult = {
    slug: string;
    path: string;
    title: string;
    published: boolean;
    wordCount: number;
    images: number;
    embeds: string[];
    editorScore: number | null;
    cost?: {totalUsd: number};
    problems: string[];
    warnings: string[];
};

type EditResult = {
    slug: string;
    path: string;
    title: string;
    applied: boolean;
    revisionPath: string | null;
    changeSummary: string[];
    wordCount: number;
    editorScore: number | null;
    newImages: number;
    problems: string[];
    warnings: string[];
    cost?: {totalUsd: number};
};

type Job = {
    id: string;
    kind: "topics" | "generate" | "edit";
    status: "running" | "done" | "failed";
    startedAt: string;
    finishedAt?: string;
    log: string[];
    error?: string;
    topics?: TopicIdea[];
    result?: GenerateResult;
    editResult?: EditResult;
};

const MODES: Array<{id: Mode; label: string; hint: string; placeholder: string}> = [
    {id: "news", label: "Latest news", hint: "Claude searches the last two weeks of wildlife, conservation and biomimicry news and pitches stories with a news peg.", placeholder: "Optional focus, e.g. ocean animals, new species, biomimicry"},
    {id: "catalog", label: "From our catalog", hint: "Evergreen articles built around our species, comparisons, tier lists, hybrids and location guides, so each one links deep into the site.", placeholder: "Optional focus, e.g. animals of Australia, fastest predators"},
    {id: "custom", label: "My own topic", hint: "Describe the article, attach material for Claude to work from, or both. Claude researches it on the web and writes it.", placeholder: "e.g. Why octopuses might be the closest thing to aliens on Earth"}
];

const STORAGE_KEY = "animaldex-blog-generator-job";
const PASTED_NAME = "pasted-text.txt";

function formatBytes(bytes: number) {
    return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

type Upload = {path: string; name: string; size: number; uploadUrl: string};

async function api<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, {cache: "no-store", ...init});
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Request failed (${response.status})`);
    return body as T;
}

function elapsed(job: Job) {
    const end = job.finishedAt ? Date.parse(job.finishedAt) : Date.now();
    const seconds = Math.max(0, Math.round((end - Date.parse(job.startedAt)) / 1000));
    return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export default function AdminBlogGenerator() {
    const [mode, setMode] = useState<Mode>("news");
    const [focus, setFocus] = useState("");
    const [publish, setPublish] = useState(true);
    const [depth, setDepth] = useState<ResearchDepth>("light");
    const [configured, setConfigured] = useState<boolean | null>(null);
    const [topicsJob, setTopicsJob] = useState<Job | null>(null);
    const [generateJob, setGenerateJob] = useState<Job | null>(null);
    const [error, setError] = useState("");
    const [pasted, setPasted] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState("");
    const [dragging, setDragging] = useState(false);
    const [task, setTask] = useState<"new" | "edit">("new");
    const [notice, setNotice] = useState("");
    const [historyKey, setHistoryKey] = useState(0);
    const [undoing, setUndoing] = useState(false);
    const logRef = useRef<HTMLOListElement>(null);

    const active = MODES.find((entry) => entry.id === mode)!;
    const busy = topicsJob?.status === "running" || generateJob?.status === "running" || Boolean(uploading);
    const hasMaterials = Boolean(pasted.trim()) || files.length > 0;

    function addFiles(list: FileList | null) {
        if (!list?.length) return;
        const next = [...files, ...Array.from(list)].filter((file, index, all) => all.findIndex((other) => other.name === file.name && other.size === file.size) === index);
        const problem = materialBatchProblem(next.map((file) => ({name: file.name, size: file.size})));
        if (problem) {
            setError(problem);
            return;
        }
        setError("");
        setFiles(next);
    }

    /** Sends each file straight to Storage through a signed URL, never through our server. */
    async function uploadMaterials() {
        const batch = [...files, ...(pasted.trim() ? [new File([pasted], PASTED_NAME, {type: "text/plain"})] : [])];
        if (!batch.length) return [];
        if (pasted.length > MATERIAL_LIMITS.textChars) throw new Error(`Pasted text is ${pasted.length.toLocaleString()} characters; the limit is ${MATERIAL_LIMITS.textChars.toLocaleString()}.`);
        const problem = materialBatchProblem(batch.map((file) => ({name: file.name, size: file.size})));
        if (problem) throw new Error(problem);
        const {uploads} = await api<{uploads: Upload[]}>("/api/admin/blog-generator", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({action: "upload", files: batch.map((file) => ({name: file.name, size: file.size}))})
        });
        for (let index = 0; index < uploads.length; index += 1) {
            const upload = uploads[index];
            setUploading(`Uploading ${index + 1}/${uploads.length}: ${upload.name}`);
            const response = await fetch(upload.uploadUrl, {
                method: "PUT",
                headers: {"Content-Type": batch[index].type || "application/octet-stream", "x-upsert": "true"},
                body: batch[index]
            });
            if (!response.ok) throw new Error(`Uploading ${upload.name} failed (${response.status}): ${(await response.text()).slice(0, 200)}`);
        }
        return uploads.map(({path, name, size}) => ({path, name, size}));
    }

    useEffect(() => {
        api<{configured: boolean}>("/api/admin/blog-generator").then((body) => setConfigured(body.configured)).catch((caught) => setError(caught.message));
        try {
            const saved = window.sessionStorage.getItem(STORAGE_KEY);
            if (saved) api<{job: Job}>(`/api/admin/blog-generator?job=${encodeURIComponent(saved)}`).then((body) => setGenerateJob(body.job)).catch(() => window.sessionStorage.removeItem(STORAGE_KEY));
        } catch {
            // storage blocked
        }
    }, []);

    const poll = useCallback(async (job: Job, set: (job: Job) => void) => {
        try {
            const body = await api<{job: Job}>(`/api/admin/blog-generator?job=${job.id}`);
            set(body.job);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Lost track of the job");
            set({...job, status: "failed", error: "Lost track of the job"});
        }
    }, []);

    useEffect(() => {
        const running = [topicsJob, generateJob].filter((job): job is Job => job?.status === "running");
        if (!running.length) return;
        const interval = window.setInterval(() => {
            if (topicsJob?.status === "running") poll(topicsJob, setTopicsJob);
            if (generateJob?.status === "running") poll(generateJob, setGenerateJob);
        }, 2500);
        return () => window.clearInterval(interval);
    }, [topicsJob, generateJob, poll]);

    useEffect(() => {
        logRef.current?.lastElementChild?.scrollIntoView({block: "nearest"});
    }, [generateJob?.log.length]);

    async function findTopics() {
        setError("");
        try {
            const body = await api<{job: Job}>("/api/admin/blog-generator", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "topics", mode, focus})
            });
            setTopicsJob(body.job);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to start");
        }
    }

    async function generate(idea?: TopicIdea) {
        setError("");
        if (mode === "custom" && !focus.trim() && !hasMaterials) {
            setError("Describe the article you want, or attach material to build it from.");
            return;
        }
        try {
            const materials = mode === "custom" ? await uploadMaterials() : [];
            setUploading("");
            const body = await api<{job: Job}>("/api/admin/blog-generator", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "generate", mode, focus, idea, publish, materials, depth})
            });
            setGenerateJob(body.job);
            try {
                window.sessionStorage.setItem(STORAGE_KEY, body.job.id);
            } catch {
                // storage blocked
            }
        } catch (caught) {
            setUploading("");
            setError(caught instanceof Error ? caught.message : "Unable to start");
        }
    }

    const result = generateJob?.result;
    const editResult = generateJob?.editResult;

    // A finished edit changes the post list and its history.
    useEffect(() => {
        if (generateJob?.kind === "edit" && generateJob.status !== "running") setHistoryKey((key) => key + 1);
    }, [generateJob?.kind, generateJob?.status]);

    const startEdit = useCallback(async (body: {slug: string; instructions: string; research: boolean; depth: ResearchDepth; publish: boolean}) => {
        setError("");
        setNotice("");
        try {
            const started = await api<{job: Job}>("/api/admin/blog-generator", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "edit", ...body})});
            setGenerateJob(started.job);
            try {
                window.sessionStorage.setItem(STORAGE_KEY, started.job.id);
            } catch {
                // storage blocked
            }
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to start");
        }
    }, []);

    async function applyEditRevision(path: string, label: string) {
        if (!window.confirm(`${label}? It goes live now, and the current version is backed up first.`)) return;
        setUndoing(true);
        try {
            await api("/api/admin/blog-generator", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "apply-revision", path})});
            setNotice(label === "Undo this edit" ? "Edit undone: the previous version is live again." : "Edit applied and live.");
            setHistoryKey((key) => key + 1);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not apply that version");
        } finally {
            setUndoing(false);
        }
    }

    return (
        <main className="bg-[radial-gradient(circle_at_20%_0%,rgba(33,192,94,.12),transparent_28%)] px-4 py-6 text-ink-100 sm:px-7 lg:px-10">
            <div className="mx-auto w-full max-w-[84rem]">
                <header className="border-b border-line-300 pb-6">
                    <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-bold text-ink-400 hover:text-white"><ArrowLeft size={18} />Dashboard</Link>
                    <p className="mt-7 text-xs font-black uppercase tracking-[.2em] text-primary-200">Content</p>
                    <h1 className="mt-2 font-display text-4xl text-white sm:text-5xl">Blog generator</h1>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-300">
                        Claude researches a topic on the web, writes a full article with photos, charts and interactive quizzes, links it into our species and comparison pages, and publishes it to the blog, or edits a post that’s already live. Every source link and internal link is checked first; if a check fails, nothing goes live. A new article takes about 12–16 minutes; an edit, 5–15.
                    </p>
                </header>

                {configured === false ? (
                    <p className="mt-6 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"><DangerTriangle size={18} />CLAUDE_API_KEY is not set on this server, so generation is unavailable.</p>
                ) : null}
                {error ? <p className="mt-6 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-100">{error}</p> : null}
                {notice ? <p className="mt-6 rounded-xl border border-primary-400/40 bg-primary-500/10 px-4 py-3 text-sm text-primary-100">{notice}</p> : null}

                <div role="tablist" aria-label="Task" className="mt-8 inline-flex gap-1 rounded-xl border border-line-300 p-1">
                    {([["new", "New article"], ["edit", "Edit a post"]] as const).map(([id, label]) => (
                        <button key={id} role="tab" aria-selected={task === id} onClick={() => setTask(id)} className={`rounded-lg px-4 py-2 text-sm font-black ${task === id ? "bg-primary-500/20 text-white" : "text-ink-400 hover:text-white"}`}>{label}</button>
                    ))}
                </div>

                <section className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                    <div className="flex flex-col gap-5 rounded-2xl border border-line-300 bg-surface-900/60 p-5 sm:p-6">
                        {task === "edit" ? (
                            <BlogEditPanel api={api} busy={busy} disabled={configured === false} onStart={startEdit} onError={setError} onNotice={setNotice} refreshKey={historyKey} />
                        ) : (
                        <>
                        <div role="tablist" aria-label="Article source" className="grid grid-cols-3 gap-1 rounded-xl border border-line-300 p-1">
                            {MODES.map((entry) => (
                                <button
                                    key={entry.id}
                                    role="tab"
                                    aria-selected={mode === entry.id}
                                    onClick={() => setMode(entry.id)}
                                    className={`rounded-lg px-2 py-2.5 text-xs font-black sm:text-sm ${mode === entry.id ? "bg-primary-500/20 text-white" : "text-ink-400 hover:text-white"}`}
                                >
                                    {entry.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-sm leading-6 text-ink-300">{active.hint}</p>
                        <label className="flex flex-col gap-2 text-xs font-black uppercase tracking-[.16em] text-ink-400">
                            {mode === "custom" ? (hasMaterials ? "Topic (optional with material)" : "Topic") : "Focus"}
                            <textarea
                                value={focus}
                                onChange={(event) => setFocus(event.target.value)}
                                rows={mode === "custom" ? 4 : 2}
                                maxLength={600}
                                placeholder={active.placeholder}
                                className="resize-y rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-sm font-normal normal-case tracking-normal text-white placeholder:text-ink-500 focus:border-primary-300 focus:outline-none"
                            />
                        </label>
                        {mode === "custom" ? (
                            <div className="flex flex-col gap-3">
                                <p className="text-xs font-black uppercase tracking-[.16em] text-ink-400">Reference material <span className="font-normal normal-case tracking-normal text-ink-500">(optional)</span></p>
                                <p className="-mt-1 text-xs leading-5 text-ink-400">Claude reads this as a primary source, then checks and adds to it from the web. Leave the topic empty to let it find the best story in the material.</p>
                                <textarea
                                    value={pasted}
                                    onChange={(event) => setPasted(event.target.value)}
                                    rows={7}
                                    placeholder="Paste notes, a press release, a transcript, a study abstract…"
                                    className="resize-y rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-sm text-white placeholder:text-ink-500 focus:border-primary-300 focus:outline-none"
                                />
                                {pasted ? <p className={`-mt-1 text-right text-[11px] ${pasted.length > MATERIAL_LIMITS.textChars ? "text-red-200" : "text-ink-500"}`}>{pasted.length.toLocaleString()} / {MATERIAL_LIMITS.textChars.toLocaleString()} characters</p> : null}
                                <label
                                    onDragOver={(event) => {
                                        event.preventDefault();
                                        setDragging(true);
                                    }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={(event) => {
                                        event.preventDefault();
                                        setDragging(false);
                                        addFiles(event.dataTransfer.files);
                                    }}
                                    className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed px-4 py-5 text-center text-sm transition-colors ${dragging ? "border-primary-300 bg-primary-500/10 text-white" : "border-line-300 text-ink-300 hover:border-primary-300"}`}
                                >
                                    <Paperclip size={20} />
                                    <span className="font-bold">Drop files or click to attach</span>
                                    <span className="text-xs text-ink-500">PDF, Word, text, Markdown, CSV, HTML, JSON or images · up to {MATERIAL_LIMITS.files} files, {MATERIAL_LIMITS.totalBytes / 1048576} MB total</span>
                                    <input
                                        type="file"
                                        multiple
                                        accept={ACCEPTED_MATERIAL_EXTENSIONS.map((extension) => `.${extension}`).join(",")}
                                        onChange={(event) => {
                                            addFiles(event.target.files);
                                            event.target.value = "";
                                        }}
                                        className="sr-only"
                                    />
                                </label>
                                {files.length ? (
                                    <ul className="flex flex-col gap-1.5">
                                        {files.map((file) => (
                                            <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 rounded-lg border border-line-300 bg-canvas-900/60 px-3 py-2 text-sm">
                                                <span className="min-w-0 truncate text-ink-100">{file.name}</span>
                                                <span className="flex shrink-0 items-center gap-2 text-xs text-ink-400">
                                                    {formatBytes(file.size)}
                                                    <button type="button" aria-label={`Remove ${file.name}`} onClick={() => setFiles(files.filter((other) => other !== file))} className="text-ink-400 hover:text-white"><CloseCircle size={16} /></button>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                            </div>
                        ) : null}
                        <DepthPicker value={depth} onChange={setDepth} />
                        <label className="flex items-start gap-3 text-sm text-ink-200">
                            <input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} className="mt-1 h-4 w-4 accent-[#a7f432]" />
                            <span>Publish live when every check passes<span className="block text-xs text-ink-400">Unchecked, the article is saved as a draft you can open in Content studio.</span></span>
                        </label>
                        <div className="flex flex-wrap gap-3">
                            {mode !== "custom" ? (
                                <button onClick={findTopics} disabled={busy || configured === false} className="inline-flex items-center gap-2 rounded-xl border border-line-300 px-5 py-3 text-sm font-black text-white hover:border-primary-300 disabled:opacity-50">
                                    <Refresh size={18} />Find topics
                                </button>
                            ) : null}
                            <button onClick={() => generate()} disabled={busy || configured === false} className="inline-flex items-center gap-2 rounded-xl bg-primary-400 px-5 py-3 text-sm font-black text-canvas-950 hover:bg-primary-300 disabled:opacity-50">
                                <MagicStick3 size={18} />{uploading || (mode === "custom" ? "Write article" : "Auto-pick and write")}
                            </button>
                        </div>

                        {topicsJob ? (
                            <div className="border-t border-line-300 pt-5">
                                {topicsJob.status === "running" ? (
                                    <p className="animate-pulse text-sm text-ink-300">{topicsJob.log.at(-1) ?? "Starting"} · {elapsed(topicsJob)}</p>
                                ) : topicsJob.status === "failed" ? (
                                    <p className="text-sm text-red-200">Topic search failed: {topicsJob.error}</p>
                                ) : (
                                    <ul className="flex flex-col gap-3">
                                        {(topicsJob.topics ?? []).map((idea) => (
                                            <li key={idea.title} className="rounded-xl border border-line-300 bg-canvas-900/60 p-4">
                                                <p className="flex flex-wrap items-center gap-x-2 text-[11px] font-black uppercase tracking-[.16em] text-primary-200">
                                                    {idea.viralScore ? <span className="rounded bg-primary-500/20 px-1.5 py-0.5 text-white">{idea.viralScore}/10</span> : null}
                                                    {idea.viralLever ? <span>{idea.viralLever}</span> : null}
                                                    <span className="text-ink-400">{idea.format} · {idea.primaryKeyword}</span>
                                                </p>
                                                <h3 className="mt-1.5 font-display text-lg text-white">{idea.title}</h3>
                                                <p className="mt-1.5 text-sm leading-6 text-ink-300">{idea.angle}</p>
                                                <p className="mt-1.5 text-sm text-ink-200"><span className="font-bold text-white">Hook:</span> {idea.hook}</p>
                                                {idea.shareLine ? <p className="mt-1.5 border-l-2 border-primary-400/60 pl-3 text-sm italic text-ink-100">“{idea.shareLine}”</p> : null}
                                                <p className="mt-1 text-xs text-ink-400">{idea.whyNow}</p>
                                                {idea.sources.length ? (
                                                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                                        {idea.sources.slice(0, 3).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="text-ink-400 underline hover:text-white">{source.label}</a>)}
                                                    </p>
                                                ) : null}
                                                <button onClick={() => generate(idea)} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-500/20 px-4 py-2 text-xs font-black text-white hover:bg-primary-500/30 disabled:opacity-50">
                                                    <Pen size={15} />Write this
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ) : null}
                                            </>
                        )}
                    </div>

                    <div className="flex min-h-[20rem] flex-col rounded-2xl border border-line-300 bg-surface-900/60 p-5 sm:p-6">
                        {!generateJob ? (
                            <div className="m-auto max-w-sm text-center text-sm leading-6 text-ink-400">
                                Start a new article or an edit. You can watch progress here, and leave the page while it runs.
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-black uppercase tracking-[.16em] text-ink-400">
                                        {generateJob.status === "running" ? (generateJob.kind === "edit" ? "Editing" : "Generating") : generateJob.status === "done" ? "Finished" : "Failed"} · {elapsed(generateJob)}
                                    </p>
                                    {generateJob.status === "running" ? <span className="h-2 w-2 animate-pulse rounded-full bg-primary-300" /> : null}
                                </div>

                                {result ? (
                                    <div className={`mt-4 rounded-xl border p-4 ${result.published ? "border-primary-400/50 bg-primary-500/10" : "border-amber-400/40 bg-amber-400/10"}`}>
                                        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-white">
                                            {result.published ? <CheckCircle size={16} /> : <DangerTriangle size={16} />}
                                            {result.published ? "Live" : "Saved as draft"}
                                        </p>
                                        <h2 className="mt-2 font-display text-xl text-white">{result.title}</h2>
                                        <p className="mt-1 text-sm text-ink-300">{result.editorScore !== null && result.editorScore !== undefined ? `Editor ${result.editorScore}/10 · ` : ""}{result.cost ? `$${result.cost.totalUsd.toFixed(2)} · ` : ""}{result.wordCount.toLocaleString()} words · {result.images} photo(s) · {result.embeds.length ? result.embeds.join(", ") : "no embeds"}</p>
                                        <div className="mt-3 flex flex-wrap gap-3 text-sm font-bold">
                                            {result.published ? <a href={result.path} target="_blank" rel="noreferrer" className="text-primary-200 underline">Open {result.path}</a> : null}
                                            <Link href="/admin/seo" className="text-ink-300 underline hover:text-white">Content studio</Link>
                                        </div>
                                        {result.problems.length ? (
                                            <ul className="mt-3 list-disc pl-5 text-sm text-amber-100">{result.problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>
                                        ) : null}
                                        {result.warnings.length ? (
                                            <details className="mt-3 text-xs text-ink-400">
                                                <summary className="cursor-pointer">{result.warnings.length} note(s) from the checks</summary>
                                                <ul className="mt-2 list-disc pl-5">{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                                            </details>
                                        ) : null}
                                    </div>
                                ) : null}
                                {editResult ? (
                                    <div className={`mt-4 rounded-xl border p-4 ${editResult.applied ? "border-primary-400/50 bg-primary-500/10" : "border-amber-400/40 bg-amber-400/10"}`}>
                                        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-white">
                                            {editResult.applied ? <CheckCircle size={16} /> : <DangerTriangle size={16} />}
                                            {editResult.applied ? "Edit is live" : "Saved as a proposal (live post unchanged)"}
                                        </p>
                                        <h2 className="mt-2 font-display text-xl text-white">{editResult.title}</h2>
                                        <p className="mt-1 text-sm text-ink-300">{editResult.editorScore !== null ? `Editor ${editResult.editorScore}/10 · ` : ""}{editResult.cost ? `$${editResult.cost.totalUsd.toFixed(2)} · ` : ""}{editResult.wordCount.toLocaleString()} words · {editResult.newImages} new photo(s)</p>
                                        {editResult.changeSummary.length ? (
                                            <ul className="mt-3 list-disc pl-5 text-sm text-ink-200">{editResult.changeSummary.map((line) => <li key={line}>{line}</li>)}</ul>
                                        ) : null}
                                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-bold">
                                            <a href={editResult.path} target="_blank" rel="noreferrer" className="text-primary-200 underline">Open {editResult.path}</a>
                                            {editResult.revisionPath ? (
                                                <button type="button" disabled={undoing} onClick={() => applyEditRevision(editResult.revisionPath!, editResult.applied ? "Undo this edit" : "Apply this edit")} className="rounded-lg border border-line-300 px-3 py-1.5 text-xs font-black text-white hover:border-primary-300 disabled:opacity-50">
                                                    {undoing ? "Working…" : editResult.applied ? "Undo this edit" : "Apply this edit anyway"}
                                                </button>
                                            ) : null}
                                        </div>
                                        {editResult.problems.length ? <ul className="mt-3 list-disc pl-5 text-sm text-amber-100">{editResult.problems.map((problem) => <li key={problem}>{problem}</li>)}</ul> : null}
                                        {editResult.warnings.length ? (
                                            <details className="mt-3 text-xs text-ink-400">
                                                <summary className="cursor-pointer">{editResult.warnings.length} note(s) from the checks</summary>
                                                <ul className="mt-2 list-disc pl-5">{editResult.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
                                            </details>
                                        ) : null}
                                    </div>
                                ) : null}
                                {generateJob.status === "failed" ? <p className="mt-4 text-sm text-red-200">{generateJob.error}</p> : null}

                                <ol ref={logRef} className="mt-4 max-h-[28rem] flex-1 overflow-y-auto rounded-xl bg-canvas-950/70 p-4 font-mono text-[12px] leading-5 text-ink-300">
                                    {generateJob.log.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}
                                </ol>
                            </>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}
