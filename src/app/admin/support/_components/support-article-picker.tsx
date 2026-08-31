"use client";

import {useEffect, useState} from "react";
import {buildSupportArticleMessage} from "@/lib/support-article-messages";

type ArticleHit = {
    id: string;
    title: string;
    categoryTitle: string;
    summary: string;
    href: string;
};

export default function SupportArticlePicker({
    onAttach
}: {
    onAttach: (messageToken: string, preview: ArticleHit) => void;
}) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<ArticleHit[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!open) return;
        const handle = window.setTimeout(async () => {
            setLoading(true);
            try {
                const params = new URLSearchParams({q: query, limit: "6"});
                const response = await fetch(`/api/admin/support/articles/search?${params.toString()}`);
                const payload = await response.json() as {results?: ArticleHit[]};
                setResults(payload.results ?? []);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 180);
        return () => window.clearTimeout(handle);
    }, [open, query]);

    function attach(hit: ArticleHit) {
        onAttach(buildSupportArticleMessage(hit.id), hit);
        setOpen(false);
        setQuery("");
    }

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="rounded-lg border border-line-300 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-primary-100 hover:border-primary-300"
            >
                + Attach help article
            </button>
            {open ? (
                <div className="absolute bottom-full left-0 z-20 mb-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line-300 bg-surface-900 shadow-2xl">
                    <div className="border-b border-line-300 px-3 py-2">
                        <input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search help articles…"
                            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-ink-500"
                        />
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                        {loading ? <p className="px-3 py-4 text-xs text-ink-500">Searching…</p> : null}
                        {!loading && results.length === 0 ? <p className="px-3 py-4 text-xs text-ink-500">No published articles found.</p> : null}
                        {results.map((hit) => (
                            <button
                                key={hit.id}
                                type="button"
                                onClick={() => attach(hit)}
                                className="block w-full border-b border-line-300/70 px-3 py-3 text-left hover:bg-canvas-900"
                            >
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary-200">{hit.categoryTitle}</p>
                                <p className="mt-1 text-sm font-bold text-white">{hit.title}</p>
                                <p className="mt-1 line-clamp-2 text-xs text-ink-400">{hit.summary}</p>
                            </button>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
