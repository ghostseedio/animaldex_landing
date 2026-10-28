"use client";

import {useCallback, useEffect, useState} from "react";
import {MagicStick3, Refresh, Share, TrashBinMinimalistic} from "solar-icon-set";
import {armLabel, type Dimension, type Experiment, HOOK_STYLES, TEXT_FORMATS} from "@/lib/social-lab/arms";
import {SOURCE_LABELS, sourcePath} from "@/lib/content-video/source-paths";
import type {CarouselSpec, SocialContentRow, TextSpec} from "@/lib/social-content/types";
import {SOCIAL_PLATFORM_LABELS, type SocialPlatform} from "@/lib/social/types";
import {Alert, Badge, Button, EmptyState, Section, Skeleton, Table, TD, TH} from "@/components/admin/ui";

// The growth engine's two panels on /admin/story-videos:
// - Hook lab: which hook styles, lengths, endings and openers are winning,
//   from every post's own numbers (3-second hold, completion, views), and the
//   latest numbers per post. "Sync stats now" re-reads every platform.
// - Carousels & text posts: what the generator made, where each went, and
//   "Make one now", "Share now" and "Archive".

type LabArm = {arm: string; label: string; items: number; mean: number | null; chanceBest: number};
type LabPayload = {
    report: {dimensions: Array<{kind: string; dimension: Dimension; arms: LabArm[]}>; judgedItems: number};
    recent: Array<{id: string; platform: SocialPlatform; kind: string; title: string; url: string | null; createdAt: string; views: number | null; likes: number | null; shares: number | null; hold3s: number | null; completion: number | null; avgViewPct: number | null}>;
    lastSync: string | null;
};

type ContentItem = SocialContentRow & {slideUrls: string[]; shares: Array<{platform: SocialPlatform; status: string; url: string | null; error: string | null}>};

const DIMENSION_TITLES: Record<Dimension, string> = {hookStyle: "Hook style", length: "Length", ending: "Ending", opener: "Opener", textFormat: "Format"};

async function api<T>(input: string, init?: RequestInit): Promise<T> {
    const response = await fetch(input, {cache: "no-store", ...init});
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || `Request failed (${response.status})`);
    return body as T;
}

function when(iso: string | null) {
    return iso ? new Date(iso).toLocaleString(undefined, {month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"}) : "never";
}

const percent = (value: number | null, digits = 0) => (value === null || value === undefined ? "—" : `${(value * 100).toFixed(digits)}%`);
const count = (value: number | null) => (value === null || value === undefined ? "—" : value.toLocaleString());

function experimentLabels(experiment: Experiment | null) {
    if (!experiment) return [];
    return (Object.keys(DIMENSION_TITLES) as Dimension[]).flatMap((dimension) => {
        const arm = experiment[dimension];
        return arm ? [`${DIMENSION_TITLES[dimension]}: ${armLabel(dimension, arm)}`] : [];
    });
}

function shareTone(status: string): "good" | "bad" | "warn" {
    return status === "published" ? "good" : status === "failed" ? "bad" : "warn";
}

export function AdminHookLab() {
    const [data, setData] = useState<LabPayload | null>(null);
    const [error, setError] = useState("");
    const [syncing, setSyncing] = useState(false);
    const [notice, setNotice] = useState("");

    const load = useCallback(async () => setData(await api<LabPayload>("/api/admin/social/lab")), []);
    useEffect(() => {
        load().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load the hook lab"));
    }, [load]);

    async function sync() {
        setSyncing(true);
        setError("");
        setNotice("");
        try {
            const result = await api<{synced: number; notes: Record<string, string>}>("/api/admin/social/lab", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "sync"})});
            setNotice(`${result.synced} posts read. ${Object.entries(result.notes).map(([platform, note]) => `${SOCIAL_PLATFORM_LABELS[platform as SocialPlatform] ?? platform}: ${note}`).join(" · ")}`);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Sync failed");
        } finally {
            setSyncing(false);
        }
    }

    return (
        <Section
            title="Hook lab"
            description="Every new video, carousel and text post tests one option per dimension. Each post is ranked against the same platform's other posts (3-second hold, completion, views), and options that win get picked more often; 15% of picks stay random so new ideas keep getting tried."
            className="mt-6"
        >
            {error ? <Alert tone="bad" className="mb-3">{error}</Alert> : null}
            {notice ? <Alert tone="good" className="mb-3 break-words text-xs">{notice}</Alert> : null}
            <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-ink-400">
                <span>{data ? <><span className="tabular-nums text-ink-200">{data.report.judgedItems}</span> items judged (posts older than 36 hours)</> : "Loading…"}</span>
                <span>Stats last read {when(data?.lastSync ?? null)}; the auto-share reads them every 6 hours.</span>
                <Button size="sm" className="ml-auto" loading={syncing} onClick={sync}>{syncing ? null : <Refresh size={14} />}Sync stats now</Button>
            </div>
            {!data ? (
                <div className="grid gap-3 lg:grid-cols-3"><Skeleton className="h-48" /><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {data.report.dimensions.map((group) => (
                        <article key={`${group.kind}-${group.dimension}`} className="flex flex-col gap-2 border border-line-300 bg-surface-900 p-4">
                            <p className="text-sm font-bold text-white">{group.kind} · {DIMENSION_TITLES[group.dimension]}</p>
                            <ul className="flex flex-col gap-1.5">
                                {group.arms.map((arm) => (
                                    <li key={arm.arm} className="grid grid-cols-[1fr_auto] items-center gap-x-3 text-xs">
                                        <span className="truncate text-ink-200">{arm.label}</span>
                                        <span className="tabular-nums text-ink-400">{arm.items} · {arm.mean === null ? "—" : Math.round(arm.mean * 100)}</span>
                                        <span className="col-span-2 h-1.5 bg-white/[.06]"><span className="block h-full bg-primary-400/80" style={{width: `${Math.round(arm.chanceBest * 100)}%`}} /></span>
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-auto text-[11px] text-ink-500">Bar: chance it is the best option. Numbers: items judged · average score (50 = a typical post).</p>
                        </article>
                    ))}
                </div>
            )}
            {data?.recent.length ? (
                <div className="mt-4">
                    <Table minWidth={760}>
                        <thead>
                            <tr><TH>Platform</TH><TH>Post</TH><TH numeric>Views</TH><TH numeric>3 s hold</TH><TH numeric>Completion / watched</TH><TH numeric>Likes</TH><TH numeric>Shares</TH></tr>
                        </thead>
                        <tbody>
                            {data.recent.slice(0, 40).map((post) => (
                                <tr key={post.id}>
                                    <TD className="whitespace-nowrap">{SOCIAL_PLATFORM_LABELS[post.platform]}</TD>
                                    <TD className="max-w-[340px] truncate">{post.url ? <a href={post.url} target="_blank" rel="noreferrer" className="text-white hover:underline">{post.title}</a> : post.title}<span className="block text-[11px] text-ink-500">{when(post.createdAt)} · {post.kind.replace("_", " ")}</span></TD>
                                    <TD numeric>{count(post.views)}</TD>
                                    <TD numeric>{percent(post.hold3s)}</TD>
                                    <TD numeric>{post.completion !== null ? percent(post.completion, 1) : post.avgViewPct !== null ? `${Math.round(post.avgViewPct)}%` : "—"}</TD>
                                    <TD numeric>{count(post.likes)}</TD>
                                    <TD numeric>{count(post.shares)}</TD>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            ) : null}
        </Section>
    );
}

export function AdminSocialContent() {
    const [items, setItems] = useState<ContentItem[] | null>(null);
    const [generating, setGenerating] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const load = useCallback(async () => {
        const body = await api<{items: ContentItem[]; generating: string | null}>("/api/admin/social/content");
        setItems(body.items);
        setGenerating(body.generating);
    }, []);

    useEffect(() => {
        load().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load carousels and text posts"));
    }, [load]);

    // While something is being made or posted, keep the list fresh.
    const pending = Boolean(generating) || Boolean(items?.some((item) => item.shares.some((share) => share.status === "queued" || share.status === "processing")));
    useEffect(() => {
        if (!pending) return;
        const timer = window.setInterval(() => load().catch(() => undefined), 10_000);
        return () => window.clearInterval(timer);
    }, [pending, load]);

    async function act(key: string, run: () => Promise<string | void>) {
        setBusy(key);
        setError("");
        setNotice("");
        try {
            const message = await run();
            if (message) setNotice(message);
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Request failed");
        } finally {
            setBusy(null);
        }
    }

    const generate = (kind: "carousel" | "text") => act(`generate-${kind}`, async () => {
        const body = await api<{started: string}>("/api/admin/social/content", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "generate", kind})});
        return `Making ${body.started}. It takes a minute or two; this list updates by itself.`;
    });
    const shareNow = (item: ContentItem) => act(`share-${item.id}`, async () => {
        const body = await api<{queued: SocialPlatform[]; skipped: Record<string, string>}>("/api/admin/social/content", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "share", id: item.id})});
        const skipped = Object.entries(body.skipped).map(([platform, reason]) => `${SOCIAL_PLATFORM_LABELS[platform as SocialPlatform] ?? platform}: ${reason}`).join(" · ");
        return body.queued.length ? `Posting to ${body.queued.map((platform) => SOCIAL_PLATFORM_LABELS[platform]).join(", ")}.${skipped ? ` Skipped: ${skipped}` : ""}` : `Nothing to post. ${skipped}`;
    });
    const archive = (item: ContentItem) => act(`archive-${item.id}`, async () => {
        if (!window.confirm("Archive this? The auto-share will never post it.")) return;
        await api(`/api/admin/social/content?id=${item.id}`, {method: "DELETE"});
    });

    return (
        <Section
            title="Carousels & text posts"
            description="Swipeable carousels (Instagram, TikTok photo mode, Facebook, X, Threads, Bluesky, Pinterest) and text posts (X, Threads, Bluesky, Facebook) made from our pages. The auto-share posts one per run alongside the video; the video timer keeps a few waiting."
            className="mt-6"
        >
            {error ? <Alert tone="bad" className="mb-3">{error}</Alert> : null}
            {notice ? <Alert tone="good" className="mb-3 break-words text-xs">{notice}</Alert> : null}
            <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="primary" loading={busy === "generate-carousel"} disabled={Boolean(generating)} onClick={() => generate("carousel")}><MagicStick3 size={14} />Make a carousel</Button>
                <Button size="sm" loading={busy === "generate-text"} disabled={Boolean(generating)} onClick={() => generate("text")}><MagicStick3 size={14} />Make text posts</Button>
                {generating ? <Badge tone="warn">Making {generating}…</Badge> : null}
            </div>
            {!items ? (
                <div className="grid gap-3 lg:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
            ) : !items.length ? (
                <EmptyState title="Nothing yet" description="The video timer makes the first carousel and text posts on its next run, or make one now." />
            ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                    {items.map((item) => {
                        const carousel = item.kind === "carousel" ? item.spec as CarouselSpec : null;
                        const text = item.kind === "text" ? item.spec as TextSpec : null;
                        return (
                            <article key={item.id} className="flex min-w-0 flex-col gap-3 border border-line-300 bg-surface-900 p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge>{carousel ? `Carousel · ${carousel.template.replace("_", " ")}` : `Text · ${text ? TEXT_FORMATS[text.format]?.label ?? text.format : ""}`}</Badge>
                                    {item.experiment?.hookStyle ? <Badge tone="neutral">{HOOK_STYLES[item.experiment.hookStyle]?.label}</Badge> : null}
                                    <a href={sourcePath(item.source_type, item.source_slug)} target="_blank" rel="noreferrer" className="min-w-0 truncate text-xs text-ink-400 hover:text-white">{SOURCE_LABELS[item.source_type]}: {item.source_title}</a>
                                </div>
                                {carousel ? (
                                    <div className="flex gap-2 overflow-x-auto pb-1">
                                        {item.slideUrls.map((url, index) => (
                                            <a key={url} href={url} target="_blank" rel="noreferrer" className="shrink-0" title={carousel.slides[index]?.title}>
                                                {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of a public slide */}
                                                <img src={url} alt={carousel.slides[index]?.title ?? `Slide ${index + 1}`} width={108} height={135} loading="lazy" className="h-[135px] w-[108px] border border-line-300 object-cover" />
                                            </a>
                                        ))}
                                    </div>
                                ) : text ? (
                                    <div className="flex flex-col gap-2">
                                        <p className="whitespace-pre-wrap text-sm text-white">{text.text}</p>
                                        {text.poll ? <ul className="flex flex-wrap gap-2">{text.poll.map((option) => <li key={option} className="border border-line-300 px-2 py-1 text-xs text-ink-200">{option}</li>)}</ul> : null}
                                    </div>
                                ) : null}
                                <div className="flex flex-wrap gap-1.5">
                                    {item.shares.length ? item.shares.map((share, index) => (
                                        share.url
                                            ? <a key={index} href={share.url} target="_blank" rel="noreferrer"><Badge tone={shareTone(share.status)}>{SOCIAL_PLATFORM_LABELS[share.platform]}</Badge></a>
                                            : <span key={index} title={share.error ?? share.status}><Badge tone={shareTone(share.status)}>{SOCIAL_PLATFORM_LABELS[share.platform]}{share.status === "failed" ? " ✕" : share.status !== "published" ? " …" : ""}</Badge></span>
                                    )) : <span className="text-xs text-ink-500">Not posted yet</span>}
                                </div>
                                <div className="mt-auto flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] text-ink-500">{when(item.created_at)} · ${Number(item.estimated_usd).toFixed(2)}{experimentLabels(item.experiment).length ? ` · ${experimentLabels(item.experiment).join(" · ")}` : ""}</span>
                                    <Button size="sm" className="ml-auto" loading={busy === `share-${item.id}`} onClick={() => shareNow(item)}><Share size={14} />Share now</Button>
                                    <Button size="sm" variant="danger" loading={busy === `archive-${item.id}`} onClick={() => archive(item)}><TrashBinMinimalistic size={14} />Archive</Button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </Section>
    );
}
