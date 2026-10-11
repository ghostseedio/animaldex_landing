"use client";

import {useCallback, useEffect, useState} from "react";
import Link from "@/app/[locale]/_components/link";

type FollowEntry = {
    userId: string;
    displayName: string | null;
    username: string | null;
    avatarUrl: string | null;
    isPro: boolean;
    viewerFollows: boolean;
};

/** iOS `ProfileFollowListView`: Followers or Following, 50 a page; a row opens that profile. */
export default function ProfileFollowListSheet({
    userId,
    kind,
    onClose
}: {
    userId: string;
    kind: "followers" | "following";
    onClose: () => void;
}) {
    const [entries, setEntries] = useState<FollowEntry[]>([]);
    const [viewerId, setViewerId] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (offset: number) => {
        setLoading(true);
        try {
            const response = await fetch(`/api/app/profile/follows?userId=${encodeURIComponent(userId)}&kind=${kind}&offset=${offset}`, {cache: "no-store"});
            const payload = await response.json().catch(() => ({})) as {entries?: FollowEntry[]; viewerId?: string; hasMore?: boolean; error?: string};
            if (!response.ok) throw new Error(payload.error ?? "Couldn't load this list.");
            setViewerId(payload.viewerId ?? null);
            setHasMore(Boolean(payload.hasMore));
            setEntries((current) => {
                const seen = new Set(current.map((entry) => entry.userId));
                return [...current, ...(payload.entries ?? []).filter((entry) => !seen.has(entry.userId))];
            });
            setError(null);
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Couldn't load this list.");
        } finally {
            setLoading(false);
        }
    }, [kind, userId]);

    useEffect(() => {
        void load(0);
    }, [load]);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const title = kind === "followers" ? "Followers" : "Following";

    return (
        <div className="theme-dark fixed inset-0 z-50 flex items-end justify-center bg-black/70 md:items-center" role="dialog" aria-modal="true" aria-label={title}>
            <button type="button" aria-label="Done" className="absolute inset-0" onClick={onClose} />
            <div className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-[1.5rem] border border-white/10 bg-[#0b0b0b] md:rounded-[1.5rem]">
                <header className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3.5">
                    <h2 className="text-[17px] font-bold text-white">{title}</h2>
                    <button type="button" onClick={onClose} aria-label="Done" className="grid h-9 w-9 place-items-center rounded-full text-primary-200 hover:bg-white/[0.06]">
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                    </button>
                </header>
                <div className="flex-1 overflow-y-auto">
                    {entries.map((entry) => {
                        const name = entry.displayName ?? entry.username ?? "Collector";
                        const row = (
                            <>
                                {entry.avatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={entry.avatarUrl} alt="" className="h-[38px] w-[38px] shrink-0 rounded-full object-cover" />
                                ) : (
                                    <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full bg-white/[0.08] text-sm font-bold text-primary-100">{name.slice(0, 1).toUpperCase()}</span>
                                )}
                                <span className="min-w-0 flex-1">
                                    <span className="flex items-center gap-1 truncate text-[15px] font-semibold text-white">
                                        {name}
                                        {entry.isPro ? <span aria-label="Pro" className="text-[12px] text-primary-300">✔︎</span> : null}
                                    </span>
                                    {entry.username ? <span className="block truncate text-xs text-white/45">@{entry.username}</span> : null}
                                </span>
                                {entry.viewerFollows && entry.userId !== viewerId ? (
                                    <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-bold text-white/60">Following</span>
                                ) : null}
                            </>
                        );
                        const className = "flex items-center gap-3 border-b border-white/[0.06] px-4 py-3 transition hover:bg-white/[0.04]";
                        return entry.username ? (
                            <Link key={entry.userId} href={`/u/${encodeURIComponent(entry.username)}`} className={className} onClick={onClose}>{row}</Link>
                        ) : (
                            <div key={entry.userId} className={className}>{row}</div>
                        );
                    })}
                    {!loading && !error && entries.length === 0 ? (
                        <p className="px-6 py-10 text-center text-sm text-white/55">
                            {kind === "followers" ? "No one is following this profile yet." : "This profile isn't following anyone yet."}
                        </p>
                    ) : null}
                    {error && entries.length === 0 ? <p className="px-6 py-10 text-center text-sm text-white/55">{error}</p> : null}
                    {loading ? (
                        <div className="flex justify-center py-5"><span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" /></div>
                    ) : hasMore ? (
                        <button type="button" onClick={() => void load(entries.length)} className="w-full py-4 text-sm font-bold text-primary-200">Load more</button>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
