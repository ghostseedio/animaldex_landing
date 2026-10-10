"use client";

import {useEffect, useMemo, useState} from "react";
import {History, MagicStick3, Pen} from "solar-icon-set";
import DepthPicker, {type ResearchDepth} from "@/app/admin/blog-generator/depth-picker";

export type EditablePost = {slug: string; title: string; source: "code" | "studio" | "code+studio"; published: boolean; updatedAt: string};
type Revision = {path: string; kind: "backup" | "proposed"; savedAt: string};

const SOURCE_LABELS: Record<EditablePost["source"], string> = {
    code: "Code",
    studio: "Studio",
    "code+studio": "Edited"
};

function savedLabel(savedAt: string) {
    // Stored as 2026-10-10T05-12-33-123Z (path-safe); show date and time.
    const match = savedAt.match(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})/);
    return match ? `${match[1]} ${match[2]}:${match[3]} UTC` : savedAt;
}

type Props = {
    api: <T>(input: string, init?: RequestInit) => Promise<T>;
    busy: boolean;
    disabled: boolean;
    onStart: (body: {slug: string; instructions: string; research: boolean; depth: ResearchDepth; publish: boolean}) => void;
    onError: (message: string) => void;
    onNotice: (message: string) => void;
    /** Bumped after an edit finishes, so the history reloads. */
    refreshKey: number;
};

export default function BlogEditPanel({api, busy, disabled, onStart, onError, onNotice, refreshKey}: Props) {
    const [posts, setPosts] = useState<EditablePost[] | null>(null);
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<EditablePost | null>(null);
    const [kind, setKind] = useState<"refresh" | "custom">("refresh");
    const [instructions, setInstructions] = useState("");
    const [research, setResearch] = useState(true);
    const [depth, setDepth] = useState<ResearchDepth>("light");
    const [publish, setPublish] = useState(true);
    const [revisions, setRevisions] = useState<Revision[]>([]);
    const [applying, setApplying] = useState("");

    useEffect(() => {
        api<{posts: EditablePost[]}>("/api/admin/blog-generator?posts=1").then((body) => setPosts(body.posts)).catch((error) => onError(error.message));
    }, [api, onError, refreshKey]);

    useEffect(() => {
        if (!selected) return setRevisions([]);
        api<{revisions: Revision[]}>(`/api/admin/blog-generator?revisions=${selected.slug}`).then((body) => setRevisions(body.revisions)).catch(() => setRevisions([]));
    }, [api, selected, refreshKey]);

    const matches = useMemo(() => {
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        return (posts ?? []).filter((post) => words.every((word) => `${post.title} ${post.slug}`.toLowerCase().includes(word))).slice(0, 40);
    }, [posts, query]);

    async function apply(revision: Revision) {
        const verb = revision.kind === "backup" ? "Restore this earlier version" : "Apply this proposed edit";
        if (!window.confirm(`${verb} of "${selected?.title}"? It goes live now, and the current version is backed up first.`)) return;
        setApplying(revision.path);
        try {
            await api("/api/admin/blog-generator", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "apply-revision", path: revision.path})});
            onNotice(revision.kind === "backup" ? "Earlier version restored." : "Edit applied.");
            const body = await api<{revisions: Revision[]}>(`/api/admin/blog-generator?revisions=${selected!.slug}`);
            setRevisions(body.revisions);
        } catch (error) {
            onError(error instanceof Error ? error.message : "Could not apply that version");
        } finally {
            setApplying("");
        }
    }

    return (
        <div className="flex flex-col gap-5">
            <label className="flex flex-col gap-2 text-xs font-black uppercase tracking-[.16em] text-ink-400">
                Post
                <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={posts ? `Search ${posts.length} posts by title or slug` : "Loading posts…"}
                    className="rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-sm font-normal normal-case tracking-normal text-white placeholder:text-ink-500 focus:border-primary-300 focus:outline-none"
                />
            </label>
            {selected ? (
                <div className="flex items-start justify-between gap-3 rounded-xl border border-primary-400/40 bg-primary-500/10 p-3">
                    <div className="min-w-0">
                        <p className="text-sm font-bold text-white">{selected.title}</p>
                        <p className="mt-0.5 truncate text-xs text-ink-400">/blog/{selected.slug} · {SOURCE_LABELS[selected.source]}{selected.published ? "" : " · draft"}</p>
                    </div>
                    <button type="button" onClick={() => setSelected(null)} className="shrink-0 text-xs font-bold text-ink-300 underline hover:text-white">Change</button>
                </div>
            ) : (
                <ul className="-mt-2 max-h-64 overflow-y-auto rounded-xl border border-line-300">
                    {matches.map((post) => (
                        <li key={post.slug} className="border-b border-line-300 last:border-b-0">
                            <button type="button" onClick={() => setSelected(post)} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-white/5">
                                <span className="min-w-0 truncate text-sm text-ink-100">{post.title}</span>
                                <span className="shrink-0 text-[10px] font-black uppercase tracking-[.12em] text-ink-500">{SOURCE_LABELS[post.source]}{post.published ? "" : " · draft"}</span>
                            </button>
                        </li>
                    ))}
                    {posts && !matches.length ? <li className="px-3 py-3 text-sm text-ink-400">No posts match.</li> : null}
                </ul>
            )}

            <div role="radiogroup" aria-label="Kind of edit" className="grid gap-2 sm:grid-cols-2">
                {([
                    ["refresh", "Full refresh", "Make it viral, fix outdated facts, add charts or a quiz. The editor scores it and rewrites if needed."],
                    ["custom", "Specific changes", "Tell Claude exactly what to change. Everything else stays as it is."]
                ] as const).map(([id, label, hint]) => (
                    <button key={id} type="button" role="radio" aria-checked={kind === id} onClick={() => setKind(id)} className={`rounded-xl border p-3 text-left ${kind === id ? "border-primary-300 bg-primary-500/10" : "border-line-300 hover:border-primary-300/60"}`}>
                        <span className="text-sm font-black text-white">{label}</span>
                        <span className="mt-1 block text-xs leading-5 text-ink-400">{hint}</span>
                    </button>
                ))}
            </div>
            {kind === "custom" ? (
                <textarea
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                    rows={5}
                    maxLength={4000}
                    placeholder={"e.g. Rewrite the headline to be punchier, add a quiz at the end, and replace the section on diet with the 2026 study on hunting.\nOr: Fix the claim about lifespan; it's 20 years, not 15."}
                    className="resize-y rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-sm text-white placeholder:text-ink-500 focus:border-primary-300 focus:outline-none"
                />
            ) : null}

            <label className="flex items-start gap-3 text-sm text-ink-200">
                <input type="checkbox" checked={research} onChange={(event) => setResearch(event.target.checked)} className="mt-1 h-4 w-4 accent-[#a7f432]" />
                <span>Research the web for new and corrected facts<span className="block text-xs text-ink-400">Off: Claude only rewrites what is already in the post. Faster and cheaper, but nothing new is added.</span></span>
            </label>
            {research ? <DepthPicker value={depth} onChange={setDepth} /> : null}
            <label className="flex items-start gap-3 text-sm text-ink-200">
                <input type="checkbox" checked={publish} onChange={(event) => setPublish(event.target.checked)} className="mt-1 h-4 w-4 accent-[#a7f432]" />
                <span>Apply live when every check passes<span className="block text-xs text-ink-400">Off, or if a check fails: saved as a proposal below, and the live post stays as it is.</span></span>
            </label>
            <button
                type="button"
                disabled={busy || disabled || !selected || (kind === "custom" && !instructions.trim())}
                onClick={() => selected && onStart({slug: selected.slug, instructions: kind === "custom" ? instructions : "", research, depth, publish})}
                className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-primary-400 px-5 py-3 text-sm font-black text-canvas-950 hover:bg-primary-300 disabled:opacity-50"
            >
                {kind === "refresh" ? <MagicStick3 size={18} /> : <Pen size={18} />}{kind === "refresh" ? "Refresh this post" : "Make these changes"}
            </button>

            {selected && revisions.length ? (
                <div className="border-t border-line-300 pt-4">
                    <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.16em] text-ink-400"><History size={15} />Edit history</p>
                    <ul className="mt-3 flex flex-col gap-2">
                        {revisions.map((revision) => (
                            <li key={revision.path} className="flex items-center justify-between gap-3 rounded-lg border border-line-300 px-3 py-2 text-sm">
                                <span className="text-ink-200">{revision.kind === "backup" ? "Version before an edit" : "Proposed edit (not live)"}<span className="block text-xs text-ink-500">{savedLabel(revision.savedAt)}</span></span>
                                <button type="button" disabled={Boolean(applying) || busy} onClick={() => apply(revision)} className="shrink-0 rounded-lg border border-line-300 px-3 py-1.5 text-xs font-black text-white hover:border-primary-300 disabled:opacity-50">
                                    {applying === revision.path ? "Applying…" : revision.kind === "backup" ? "Restore" : "Apply"}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}
