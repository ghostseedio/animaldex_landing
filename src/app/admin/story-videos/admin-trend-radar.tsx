"use client";

import {useCallback, useEffect, useState} from "react";
import {Refresh} from "solar-icon-set";
import type {AutomationRun} from "@/lib/automation-runs";
import type {TrendTopicRow} from "@/lib/trend-radar/store";
import {Alert, Badge, Button, EmptyState, Section, Skeleton} from "@/components/admin/ui";
import {RunList} from "@/app/admin/story-videos/admin-automation";

// The trend radar: what is hot in animal news and searches right now, ranked
// by Claude every 6 hours from news feeds, Google Trends, Wikipedia, Google
// autocomplete and our rising Search Console queries. The blog writes the best
// ideas on its own; "Write now" jumps the queue, "Skip" drops one.

type Payload = {refreshing: boolean; topics: TrendTopicRow[]; runs: AutomationRun[]};

async function api<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, {cache: "no-store", ...init});
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Request failed (${response.status})`);
    return body as T;
}

const STATUS_TONE: Record<TrendTopicRow["status"], "good" | "warn" | "bad" | "neutral"> = {new: "neutral", writing: "warn", used: "good", skipped: "bad", expired: "bad"};

function ago(iso: string) {
    const hours = Math.round((Date.now() - Date.parse(iso)) / 3_600_000);
    return hours < 1 ? "just now" : hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

export default function AdminTrendRadar() {
    const [data, setData] = useState<Payload | null>(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [busy, setBusy] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);

    const load = useCallback(async () => setData(await api<Payload>("/api/admin/trend-radar")), []);
    useEffect(() => {
        load().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load the trend radar"));
    }, [load]);
    useEffect(() => {
        if (!data?.refreshing) return;
        const timer = window.setInterval(() => load().catch(() => undefined), 10_000);
        return () => window.clearInterval(timer);
    }, [data?.refreshing, load]);

    async function act(key: string, body: Record<string, string>, message?: string) {
        setBusy(key);
        setError("");
        setNotice("");
        try {
            const result = await api<{summary?: string}>("/api/admin/trend-radar", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
            setNotice(message ?? result.summary ?? "Done.");
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Request failed");
        } finally {
            setBusy(null);
        }
    }

    const open = (data?.topics ?? []).filter((topic) => topic.status === "new").sort((a, b) => b.score - a.score);
    const shown = showAll ? data?.topics ?? [] : open;

    return (
        <Section
            title="Trend radar"
            description="What is hot in animal news and searches right now: science and wildlife feeds, Google's trending searches, animals spiking on Wikipedia, what people type into Google, and our rising Search Console queries, ranked by Claude every 6 hours. The morning article takes the best news story, a story scoring 8.5+ is written as breaking news, and evergreen questions feed the evening slot."
            className="mt-6"
        >
            {error ? <Alert tone="bad" className="mb-3">{error}</Alert> : null}
            {notice ? <Alert tone="good" className="mb-3 break-words text-xs">{notice}</Alert> : null}
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-ink-400">{data ? `${open.length} open ideas` : "Loading…"}{data?.refreshing ? " · refreshing (a minute or two)…" : ""}</span>
                <Button size="sm" variant="ghost" onClick={() => setShowAll((value) => !value)}>{showAll ? "Open ideas only" : "Show written and skipped"}</Button>
                <Button size="sm" className="ml-auto" loading={busy === "refresh" || data?.refreshing} onClick={() => act("refresh", {action: "refresh"}, "Refreshing the radar. New ideas appear here in a minute or two.")}>{busy === "refresh" ? null : <Refresh size={14} />}Refresh now</Button>
            </div>
            {!data ? (
                <Skeleton className="h-48" />
            ) : !shown.length ? (
                <EmptyState title="No open ideas" description="The radar runs every 6 hours from the video timer, or refresh it now." />
            ) : (
                <ul className="flex flex-col divide-y divide-line-300/60 border border-line-300/60">
                    {shown.slice(0, 40).map((topic) => (
                        <li key={topic.id} className="flex flex-col gap-2 px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge tone={topic.kind === "news" ? "warn" : "neutral"}>{topic.kind === "news" ? "News" : "Evergreen"}</Badge>
                                <span className={`tabular-nums text-sm font-black ${topic.score >= 8.5 ? "text-primary-300" : "text-white"}`}>{topic.score.toFixed(1)}</span>
                                <span className="min-w-0 flex-1 text-sm font-bold text-white">{topic.title}</span>
                                {topic.status !== "new" ? <Badge tone={STATUS_TONE[topic.status]}>{topic.status}</Badge> : null}
                            </div>
                            <p className="text-xs leading-5 text-ink-300">{topic.idea.angle}</p>
                            <p className="text-[11px] text-ink-500">
                                Targets “{topic.primary_keyword}” · {topic.idea.whyNow} · {ago(topic.created_at)}
                                {topic.used_ref ? <> · {topic.used_ref.startsWith("/") ? <a href={topic.used_ref} target="_blank" rel="noreferrer" className="text-primary-200">{topic.used_ref}</a> : topic.used_ref}</> : null}
                            </p>
                            {topic.idea.sources.length ? (
                                <p className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                                    {topic.idea.sources.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="text-ink-400 underline hover:text-white">{source.label}</a>)}
                                </p>
                            ) : null}
                            {topic.status === "new" ? (
                                <div className="flex gap-2">
                                    <Button size="sm" variant="primary" loading={busy === `write-${topic.id}`} onClick={() => act(`write-${topic.id}`, {action: "write", id: topic.id})}>Write now</Button>
                                    <Button size="sm" variant="ghost" loading={busy === `skip-${topic.id}`} onClick={() => act(`skip-${topic.id}`, {action: "skip", id: topic.id}, "Skipped.")}>Skip</Button>
                                </div>
                            ) : null}
                        </li>
                    ))}
                </ul>
            )}
            {data?.runs.length ? <div className="mt-4"><RunList runs={data.runs} /></div> : null}
        </Section>
    );
}
