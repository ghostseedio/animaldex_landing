"use client";

import Link from "next/link";
import {useCallback, useEffect, useRef, useState} from "react";
import {CheckCircle, CloseCircle, DangerTriangle, MagicStick3, Paperclip, Pen, Refresh} from "solar-icon-set";
import {ACCEPTED_MATERIAL_EXTENSIONS, MATERIAL_LIMITS, materialBatchProblem} from "@/lib/blog-generator/material-types";
import BlogEditPanel from "@/app/admin/blog-generator/blog-edit-panel";
import DepthPicker, {type ResearchDepth} from "@/app/admin/blog-generator/depth-picker";
import {AdminPage, Alert, Badge, Button, Card, CardContent, CardHeader, cn, EmptyState, fieldClass, PageHeader, Skeleton, Spinner} from "@/components/admin/ui";

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

    const generateStep = generateJob?.log.at(-1);

    return (
        <AdminPage width="wide">
            <PageHeader
                eyebrow="Content"
                title="Blog generator"
                description="Claude researches a topic on the web, writes a full article with photos, charts and interactive quizzes, links it into our species and comparison pages, and publishes it to the blog, or edits a post that’s already live. Every source link and internal link is checked first; if a check fails, nothing goes live. A new article takes about 12–16 minutes; an edit, 5–15."
                meta={configured === null ? <span className="inline-flex items-center gap-2"><Spinner size={12} />Checking the server</span> : null}
                actions={
                    <div role="tablist" aria-label="Task" className="inline-flex border border-line-300 bg-canvas-900 p-0.5">
                        {([["new", "New article"], ["edit", "Edit a post"]] as const).map(([id, label]) => (
                            <button key={id} role="tab" aria-selected={task === id} onClick={() => setTask(id)} className={cn("min-h-8 px-4 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300", task === id ? "bg-primary-400 text-canvas-950" : "text-ink-400 hover:text-white")}>{label}</button>
                        ))}
                    </div>
                }
            />

            {configured === false || error || notice ? (
                <div className="mt-6 flex flex-col gap-3">
                    {configured === false ? (
                        <Alert tone="warn" title="Generation is unavailable">CLAUDE_API_KEY is not set on this server, so generation is unavailable.</Alert>
                    ) : null}
                    {error ? <Alert tone="bad">{error}</Alert> : null}
                    {notice ? <Alert tone="good">{notice}</Alert> : null}
                </div>
            ) : null}

            <section className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                <Card>
                    <CardHeader
                        title={task === "edit" ? "Edit a post" : "New article"}
                        description={task === "edit" ? "Refresh a live post or make specific changes. The current version is always backed up first." : "Pick where the story comes from, then find topics or let Claude pick one and write it."}
                    />
                    <CardContent className="flex flex-col gap-5">
                        {task === "edit" ? (
                            <BlogEditPanel api={api} busy={busy} disabled={configured === false} onStart={startEdit} onError={setError} onNotice={setNotice} refreshKey={historyKey} />
                        ) : (
                        <>
                        <div role="tablist" aria-label="Article source" className="grid grid-cols-3 gap-0.5 border border-line-300 bg-canvas-900 p-0.5">
                            {MODES.map((entry) => (
                                <button
                                    key={entry.id}
                                    role="tab"
                                    aria-selected={mode === entry.id}
                                    onClick={() => setMode(entry.id)}
                                    className={cn("min-h-9 px-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300", mode === entry.id ? "bg-primary-400 text-canvas-950" : "text-ink-400 hover:text-white")}
                                >
                                    {entry.label}
                                </button>
                            ))}
                        </div>
                        <p className="-mt-2 text-sm leading-6 text-ink-300">{active.hint}</p>
                        <label className="flex flex-col gap-1.5 text-[11px] font-black uppercase tracking-[.12em] text-ink-500">
                            {mode === "custom" ? (hasMaterials ? "Topic (optional with material)" : "Topic") : "Focus"}
                            <textarea
                                value={focus}
                                onChange={(event) => setFocus(event.target.value)}
                                rows={mode === "custom" ? 4 : 2}
                                maxLength={600}
                                placeholder={active.placeholder}
                                className={cn(fieldClass, "resize-y font-normal normal-case tracking-normal")}
                            />
                        </label>
                        {mode === "custom" ? (
                            <div className="flex flex-col gap-3">
                                <p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Reference material <span className="font-normal normal-case tracking-normal text-ink-500">(optional)</span></p>
                                <p className="-mt-1 text-xs leading-5 text-ink-400">Claude reads this as a primary source, then checks and adds to it from the web. Leave the topic empty to let it find the best story in the material.</p>
                                <textarea
                                    value={pasted}
                                    onChange={(event) => setPasted(event.target.value)}
                                    rows={7}
                                    placeholder="Paste notes, a press release, a transcript, a study abstract…"
                                    className={cn(fieldClass, "resize-y")}
                                />
                                {pasted ? <p className={`-mt-1 text-right text-[11px] tabular-nums ${pasted.length > MATERIAL_LIMITS.textChars ? "text-red-200" : "text-ink-500"}`}>{pasted.length.toLocaleString()} / {MATERIAL_LIMITS.textChars.toLocaleString()} characters</p> : null}
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
                                    className={`flex cursor-pointer flex-col items-center gap-1 border border-dashed px-4 py-5 text-center text-sm transition-colors ${dragging ? "border-primary-300 bg-primary-500/10 text-white" : "border-line-300 bg-canvas-900 text-ink-300 hover:border-primary-300"}`}
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
                                    <ul className="divide-y divide-line-300 border border-line-300 bg-canvas-900">
                                        {files.map((file) => (
                                            <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                                                <span className="min-w-0 truncate text-ink-100">{file.name}</span>
                                                <span className="flex shrink-0 items-center gap-2 text-xs tabular-nums text-ink-400">
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
                        <div className="flex flex-wrap gap-2 border-t border-line-300 pt-4">
                            {mode !== "custom" ? (
                                <Button size="lg" onClick={findTopics} loading={topicsJob?.status === "running"} disabled={busy || configured === false}>
                                    {topicsJob?.status === "running" ? null : <Refresh size={18} />}Find topics
                                </Button>
                            ) : null}
                            <Button variant="primary" size="lg" onClick={() => generate()} loading={Boolean(uploading)} disabled={busy || configured === false}>
                                {uploading ? null : <MagicStick3 size={18} />}{uploading || (mode === "custom" ? "Write article" : "Auto-pick and write")}
                            </Button>
                        </div>

                        {topicsJob ? (
                            <div className="border-t border-line-300 pt-5">
                                {topicsJob.status === "running" ? (
                                    <div className="flex flex-col gap-3">
                                        <p role="status" className="flex items-center gap-2.5 text-sm font-bold text-ink-200">
                                            <Spinner className="text-primary-300" />
                                            <span className="min-w-0 flex-1 truncate">{topicsJob.log.at(-1) ?? "Starting"}</span>
                                            <span className="shrink-0 text-xs font-normal tabular-nums text-ink-500">{elapsed(topicsJob)}</span>
                                        </p>
                                        {Array.from({length: 3}, (_, index) => (
                                            <div key={index} aria-hidden="true" className="border border-line-300 bg-canvas-900 p-4" style={{opacity: 1 - index * 0.2}}>
                                                <Skeleton className="h-2.5 w-28" />
                                                <Skeleton className="mt-3 h-4 w-3/4" />
                                                <Skeleton className="mt-2.5 h-3 w-full" />
                                                <Skeleton className="mt-1.5 h-3 w-2/3" />
                                            </div>
                                        ))}
                                    </div>
                                ) : topicsJob.status === "failed" ? (
                                    <Alert tone="bad">Topic search failed: {topicsJob.error}</Alert>
                                ) : (
                                    <ul className="flex flex-col gap-3">
                                        {(topicsJob.topics ?? []).map((idea) => (
                                            <li key={idea.title} className="border border-line-300 bg-canvas-900 p-4">
                                                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-black uppercase tracking-[.12em] text-primary-200">
                                                    {idea.viralScore ? <Badge tone="good" className="tabular-nums">{idea.viralScore}/10</Badge> : null}
                                                    {idea.viralLever ? <span>{idea.viralLever}</span> : null}
                                                    <span className="text-ink-500">{idea.format} · {idea.primaryKeyword}</span>
                                                </p>
                                                <h3 className="mt-2 font-display text-lg text-white">{idea.title}</h3>
                                                <p className="mt-1.5 text-sm leading-6 text-ink-300">{idea.angle}</p>
                                                <p className="mt-1.5 text-sm text-ink-200"><span className="font-bold text-white">Hook:</span> {idea.hook}</p>
                                                {idea.shareLine ? <p className="mt-1.5 border-l-2 border-primary-400/60 pl-3 text-sm italic text-ink-100">“{idea.shareLine}”</p> : null}
                                                <p className="mt-1 text-xs text-ink-400">{idea.whyNow}</p>
                                                {idea.sources.length ? (
                                                    <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                                                        {idea.sources.slice(0, 3).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="text-ink-400 underline hover:text-white">{source.label}</a>)}
                                                    </p>
                                                ) : null}
                                                <Button size="sm" onClick={() => generate(idea)} disabled={busy} className="mt-3">
                                                    <Pen size={15} />Write this
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ) : null}
                                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="flex min-h-[20rem] flex-col">
                    <CardHeader
                        title="Progress"
                        action={
                            generateJob ? (
                                <span className="flex items-center gap-2">
                                    <Badge tone={generateJob.status === "running" ? "neutral" : generateJob.status === "done" ? "good" : "bad"}>
                                        {generateJob.status === "running" ? (generateJob.kind === "edit" ? "Editing" : "Generating") : generateJob.status === "done" ? "Finished" : "Failed"}
                                    </Badge>
                                    <span className="text-xs font-bold tabular-nums text-ink-400">{elapsed(generateJob)}</span>
                                </span>
                            ) : null
                        }
                    />
                    <CardContent className="flex flex-1 flex-col gap-4">
                        {!generateJob ? (
                            <EmptyState
                                className="m-auto w-full border-0"
                                icon={<MagicStick3 size={20} />}
                                title="Nothing running"
                                description="Start a new article or an edit. You can watch progress here, and leave the page while it runs."
                            />
                        ) : (
                            <>
                                {generateJob.status === "running" ? (
                                    <div role="status" className="flex items-start gap-3 border border-primary-400/25 bg-primary-500/[.06] px-4 py-3.5">
                                        <Spinner size={18} className="mt-0.5 text-primary-300" />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-black text-white">{generateJob.kind === "edit" ? "Editing the post" : "Writing the article"}</p>
                                            <p className="mt-0.5 truncate text-xs leading-5 text-ink-300">{generateStep ?? "Starting"}</p>
                                        </div>
                                        <span className="shrink-0 text-xs font-bold tabular-nums text-ink-400">{elapsed(generateJob)}</span>
                                    </div>
                                ) : null}

                                {result ? (
                                    <div className={`border p-4 ${result.published ? "border-primary-400/50 bg-primary-500/10" : "border-amber-400/40 bg-amber-400/10"}`}>
                                        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.12em] text-white">
                                            {result.published ? <CheckCircle size={16} /> : <DangerTriangle size={16} />}
                                            {result.published ? "Live" : "Saved as draft"}
                                        </p>
                                        <h2 className="mt-2 font-display text-xl text-white">{result.title}</h2>
                                        <p className="mt-1 text-sm tabular-nums text-ink-300">{result.editorScore !== null && result.editorScore !== undefined ? `Editor ${result.editorScore}/10 · ` : ""}{result.cost ? `$${result.cost.totalUsd.toFixed(2)} · ` : ""}{result.wordCount.toLocaleString()} words · {result.images} photo(s) · {result.embeds.length ? result.embeds.join(", ") : "no embeds"}</p>
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
                                    <div className={`border p-4 ${editResult.applied ? "border-primary-400/50 bg-primary-500/10" : "border-amber-400/40 bg-amber-400/10"}`}>
                                        <p className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[.12em] text-white">
                                            {editResult.applied ? <CheckCircle size={16} /> : <DangerTriangle size={16} />}
                                            {editResult.applied ? "Edit is live" : "Saved as a proposal (live post unchanged)"}
                                        </p>
                                        <h2 className="mt-2 font-display text-xl text-white">{editResult.title}</h2>
                                        <p className="mt-1 text-sm tabular-nums text-ink-300">{editResult.editorScore !== null ? `Editor ${editResult.editorScore}/10 · ` : ""}{editResult.cost ? `$${editResult.cost.totalUsd.toFixed(2)} · ` : ""}{editResult.wordCount.toLocaleString()} words · {editResult.newImages} new photo(s)</p>
                                        {editResult.changeSummary.length ? (
                                            <ul className="mt-3 list-disc pl-5 text-sm text-ink-200">{editResult.changeSummary.map((line) => <li key={line}>{line}</li>)}</ul>
                                        ) : null}
                                        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-bold">
                                            <a href={editResult.path} target="_blank" rel="noreferrer" className="text-primary-200 underline">Open {editResult.path}</a>
                                            {editResult.revisionPath ? (
                                                <Button size="sm" loading={undoing} onClick={() => applyEditRevision(editResult.revisionPath!, editResult.applied ? "Undo this edit" : "Apply this edit")}>
                                                    {undoing ? "Working…" : editResult.applied ? "Undo this edit" : "Apply this edit anyway"}
                                                </Button>
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
                                {generateJob.status === "failed" ? <Alert tone="bad" title={generateJob.kind === "edit" ? "The edit failed" : "Generation failed"}>{generateJob.error}</Alert> : null}

                                <p className="-mb-2 text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Log</p>
                                <ol ref={logRef} className="max-h-[28rem] flex-1 overflow-y-auto border border-line-300 bg-canvas-950 p-4 font-mono text-[12px] leading-5 text-ink-300">
                                    {generateJob.log.map((line, index) => <li key={`${index}-${line}`} className={index === generateJob.log.length - 1 && generateJob.status === "running" ? "text-white" : undefined}>{line}</li>)}
                                </ol>
                            </>
                        )}
                    </CardContent>
                </Card>
            </section>
        </AdminPage>
    );
}
