"use client";

import Image from "next/image";
import Link from "next/link";
import {FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState} from "react";
import SupportMessageBody from "@/app/[locale]/(composited)/support/_components/support-message-body";
import SupportArticlePicker from "@/app/admin/support/_components/support-article-picker";
import {Alert, AdminPage, Badge, Button, cn, EmptyState, fieldClass, PageHeader, RefreshButton, Segmented, Skeleton, Spinner} from "@/components/admin/ui";

type SupportAttachment = {
    id: string;
    filename: string;
    contentType: string;
    contentDisposition: string | null;
    contentId: string | null;
    size: number | null;
    url: string;
};

type SupportThreadSummary = {
    id: string;
    subject: string | null;
    customerEmail: string;
    customerName: string | null;
    customerAvatarUrl: string | null;
    status: string;
    category: "important" | "inbox" | "spam";
    isUnread: boolean;
    createdAt: string;
    updatedAt: string;
};

type SafeSupportMessage = {
    id: string;
    direction: "inbound" | "outbound";
    fromEmail: string;
    toEmail: string;
    subject: string | null;
    body: string;
    attachments: SupportAttachment[];
    remoteImages: Array<{url: string; alt: string}>;
    createdAt: string;
};

type SafeSupportThread = {
    id: string;
    subject: string | null;
    customerEmail: string;
    customerName: string | null;
    customerAvatarUrl: string | null;
    status: string;
    category: "important" | "inbox" | "spam";
    isUnread: boolean;
    messages: SafeSupportMessage[];
};

type InboxResponse = {
    ok: boolean;
    threads?: SupportThreadSummary[];
    hasMore?: boolean;
    thread?: SafeSupportThread | null;
    error?: string;
};

type ComposerAttachment = {
    id: string;
    filename: string;
    contentType: string;
    content: string;
    size: number;
    previewUrl: string | null;
    contentId?: string;
};

const THREADS_PAGE_SIZE = 20;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 18 * 1024 * 1024;
type InboxFilter = "all" | "important" | "inbox" | "unread" | "spam";
type SupportChannel = "email" | "in-app";

type InAppMessage = {
    id: string;
    body: string;
    createdAt: string;
    direction: "inbound" | "outbound";
};

type InAppThread = {
    id: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
    lastBody: string;
    lastCreatedAt: string;
    unreadCount: number;
    messages: InAppMessage[];
};

type InAppInboxResponse = {
    ok: boolean;
    threads?: Array<Omit<InAppThread, "messages">>;
    hasMore?: boolean;
    thread?: InAppThread | null;
    error?: string;
};

function buildThreadsPath(options?: {threadId?: string | null; offset?: number; includeThreads?: boolean}) {
    const params = new URLSearchParams();

    if (options?.threadId) params.set("threadId", options.threadId);

    if (options?.includeThreads === false) {
        params.set("includeThreads", "false");
    } else {
        params.set("limit", String(THREADS_PAGE_SIZE));
        params.set("offset", String(options?.offset ?? 0));
    }

    const query = params.toString();
    return `/api/admin/support/threads${query ? `?${query}` : ""}`;
}

function buildInAppPath(options?: {userId?: string | null; offset?: number; includeThreads?: boolean}) {
    const params = new URLSearchParams();

    if (options?.userId) params.set("userId", options.userId);

    if (options?.includeThreads === false) {
        params.set("includeThreads", "false");
    } else {
        params.set("limit", String(THREADS_PAGE_SIZE));
        params.set("offset", String(options?.offset ?? 0));
    }

    const query = params.toString();
    return `/api/admin/support/in-app${query ? `?${query}` : ""}`;
}

function absoluteDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat("en", {dateStyle: "medium", timeStyle: "short"}).format(date);
}

function relativeDate(value: string) {
    const date = new Date(value);
    const difference = date.getTime() - Date.now();

    if (Number.isNaN(difference)) return value;

    const formatter = new Intl.RelativeTimeFormat("en", {numeric: "auto"});
    const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
        ["year", 365 * 24 * 60 * 60 * 1000],
        ["month", 30 * 24 * 60 * 60 * 1000],
        ["week", 7 * 24 * 60 * 60 * 1000],
        ["day", 24 * 60 * 60 * 1000],
        ["hour", 60 * 60 * 1000],
        ["minute", 60 * 1000]
    ];

    for (const [unit, milliseconds] of ranges) {
        if (Math.abs(difference) >= milliseconds) {
            return formatter.format(Math.round(difference / milliseconds), unit);
        }
    }

    return "just now";
}

function formatBytes(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getCustomerLabel(thread: Pick<SupportThreadSummary | SafeSupportThread, "customerEmail" | "customerName">) {
    return thread.customerName || thread.customerEmail;
}

function initials(name: string) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function Avatar({name, src, size = "md"}: {name: string; src?: string | null; size?: "sm" | "md" | "lg"}) {
    const dimensions = size === "lg" ? "h-12 w-12 text-sm" : size === "sm" ? "h-8 w-8 text-[10px]" : "h-10 w-10 text-xs";
    const imageSize = size === "lg" ? "48px" : size === "sm" ? "32px" : "40px";

    return (
        <span className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary-500/15 font-bold text-primary-100 ring-1 ring-primary-400/20 ${dimensions}`}>
            {initials(name)}
            {src ? (
                <Image
                    src={src}
                    alt=""
                    fill
                    unoptimized
                    sizes={imageSize}
                    className="object-cover"
                    onError={(event) => { event.currentTarget.style.display = "none"; }}
                />
            ) : null}
        </span>
    );
}

function linkify(text: string) {
    const pattern = /(https?:\/\/[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi;
    const parts: ReactNode[] = [];
    let cursor = 0;

    for (const match of Array.from(text.matchAll(pattern))) {
        const index = match.index ?? 0;
        if (index > cursor) parts.push(text.slice(cursor, index));
        const value = match[0];
        const isEmail = !value.toLowerCase().startsWith("http");
        const cleanValue = value.replace(/[),.;!?]+$/, "");
        const suffix = value.slice(cleanValue.length);

        parts.push(
            <a
                key={`${index}-${value}`}
                href={isEmail ? `mailto:${cleanValue}` : cleanValue}
                target={isEmail ? undefined : "_blank"}
                rel={isEmail ? undefined : "noopener noreferrer"}
                className="break-all text-primary-200 underline decoration-primary-400/50 underline-offset-2 hover:text-primary-100"
            >
                {cleanValue}
            </a>
        );
        if (suffix) parts.push(suffix);
        cursor = index + value.length;
    }

    if (cursor < text.length) parts.push(text.slice(cursor));
    return parts;
}

function splitSignature(body: string) {
    const markers = [/\n-- ?\n/, /\n(?:Best|Regards|Kind regards|Thanks|Thank you),?\s*\n/i, /\nAnimalDex Support\s*$/i, /\nSent from my /i];
    let signatureIndex = -1;

    for (const marker of markers) {
        const match = marker.exec(body);
        if (match && match.index > body.length * 0.35 && (signatureIndex < 0 || match.index < signatureIndex)) {
            signatureIndex = match.index;
        }
    }

    return signatureIndex >= 0
        ? {content: body.slice(0, signatureIndex).trim(), signature: body.slice(signatureIndex).trim()}
        : {content: body.trim(), signature: ""};
}

function MessageBody({body}: {body: string}) {
    if (body.includes("[[adex-article:")) {
        return <SupportMessageBody body={body} readLabel="Read article" />;
    }

    const {content, signature} = splitSignature(body);

    return (
        <div className="min-w-0 max-w-full overflow-hidden">
            <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-ink-100 [overflow-wrap:anywhere]">{linkify(content)}</p>
            {signature ? (
                <div className="mt-5 border-t border-line-300/70 pt-4 text-sm leading-6 text-ink-400 [overflow-wrap:anywhere]">
                    <p className="whitespace-pre-wrap">{linkify(signature)}</p>
                </div>
            ) : null}
        </div>
    );
}

function CategoryBadge({category, className}: {category: SupportThreadSummary["category"]; className?: string}) {
    return (
        <Badge tone={category === "important" ? "warn" : category === "spam" ? "bad" : "good"} className={className}>
            {category}
        </Badge>
    );
}

/** First-load placeholder for the conversation list, shaped like its rows. */
function ThreadListSkeleton() {
    return (
        <div role="status" aria-label="Loading inbox" className="divide-y divide-line-300/60">
            {Array.from({length: 7}, (_, row) => (
                <div key={row} className="flex gap-3 px-4 py-4" style={{opacity: 1 - row * 0.11}}>
                    <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex justify-between gap-3">
                            <Skeleton className="h-3 w-1/2" />
                            <Skeleton className="h-2.5 w-10" />
                        </div>
                        <Skeleton className="h-3 w-3/4" />
                        <Skeleton className="h-2.5 w-1/3" />
                    </div>
                </div>
            ))}
        </div>
    );
}

/** Placeholder for the reading pane while a conversation is on its way. */
function ThreadDetailSkeleton() {
    return (
        <div role="status" aria-label="Loading conversation" className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-3 border-b border-line-300 bg-surface-900 px-4 py-4 sm:px-6">
                <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                </div>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-hidden px-3 py-5 sm:px-6 lg:px-8">
                {[0, 1].map((index) => (
                    <div key={index} className={cn("w-full max-w-4xl border border-line-300 bg-surface-900 p-4 sm:p-5", index === 1 && "ml-auto opacity-70")}>
                        <div className="flex items-center gap-3 border-b border-line-300/70 pb-4">
                            <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-3 w-40" />
                                <Skeleton className="h-2.5 w-56" />
                            </div>
                        </div>
                        <div className="mt-5 space-y-2.5">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-11/12" />
                            <Skeleton className="h-3 w-3/5" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function fileToBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

export default function SupportInboxClient() {
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [password, setPassword] = useState("");
    const [threads, setThreads] = useState<SupportThreadSummary[]>([]);
    const [selectedThread, setSelectedThread] = useState<SafeSupportThread | null>(null);
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
    const [channel, setChannel] = useState<SupportChannel>("email");
    const [inAppThreads, setInAppThreads] = useState<Array<Omit<InAppThread, "messages">>>([]);
    const [selectedInAppThread, setSelectedInAppThread] = useState<InAppThread | null>(null);
    const [inboxFilter, setInboxFilter] = useState<InboxFilter>("inbox");
    const [reply, setReply] = useState("");
    const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingThread, setLoadingThread] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMoreThreads, setHasMoreThreads] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const messageListRef = useRef<HTMLDivElement>(null);

    const canSend = useMemo(() => {
        if (submitting) return false;
        if (channel === "in-app") return Boolean(selectedInAppThread && reply.trim());
        return Boolean(selectedThread && (reply.trim() || attachments.length));
    }, [attachments.length, channel, reply, selectedInAppThread, selectedThread, submitting]);
    const unreadCount = channel === "in-app"
        ? inAppThreads.reduce((sum, thread) => sum + thread.unreadCount, 0)
        : threads.filter((thread) => thread.isUnread).length;
    const filterCounts: Record<InboxFilter, number> = {
        all: threads.length,
        important: threads.filter((thread) => thread.category === "important").length,
        inbox: threads.filter((thread) => thread.category === "inbox").length,
        unread: unreadCount,
        spam: threads.filter((thread) => thread.category === "spam").length
    };
    const filteredThreads = threads.filter((thread) => {
        if (inboxFilter === "all") return true;
        if (inboxFilter === "unread") return thread.isUnread;
        return thread.category === inboxFilter;
    });

    const loadInAppInbox = useCallback(async (userId?: string | null) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(buildInAppPath({userId, offset: 0}), {cache: "no-store"});
            const body = await response.json() as InAppInboxResponse;

            if (response.status === 401) {
                setAuthorized(false);
                setInAppThreads([]);
                setSelectedInAppThread(null);
                return;
            }

            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load in-app inbox.");

            const nextThreads = body.threads ?? [];
            const nextThread = body.thread ?? null;
            setAuthorized(true);
            setInAppThreads(nextThreads);
            setHasMoreThreads(Boolean(body.hasMore));
            setSelectedInAppThread(nextThread);
            setSelectedThreadId(nextThread?.id ?? nextThreads[0]?.id ?? null);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load in-app inbox.");
        } finally {
            setLoading(false);
        }
    }, []);

    const loadInbox = useCallback(async (threadId?: string | null) => {
        if (channel === "in-app") {
            await loadInAppInbox(threadId);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(buildThreadsPath({threadId, offset: 0}), {cache: "no-store"});
            const body = await response.json() as InboxResponse;

            if (response.status === 401) {
                setAuthorized(false);
                setThreads([]);
                setSelectedThread(null);
                return;
            }

            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load support inbox.");

            const nextThreads = body.threads ?? [];
            const nextThread = body.thread ?? null;
            setAuthorized(true);
            setThreads(nextThreads);
            setHasMoreThreads(Boolean(body.hasMore));
            setSelectedThread(nextThread);
            setSelectedThreadId(nextThread?.id ?? nextThreads[0]?.id ?? null);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load support inbox.");
        } finally {
            setLoading(false);
        }
    }, [channel, loadInAppInbox]);

    async function loadThreadDetail(threadId: string) {
        setLoadingThread(true);
        setError(null);

        try {
            if (channel === "in-app") {
                const response = await fetch(buildInAppPath({userId: threadId, includeThreads: false}), {cache: "no-store"});
                const body = await response.json() as InAppInboxResponse;
                if (response.status === 401) {
                    setAuthorized(false);
                    return;
                }
                if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load conversation.");
                setSelectedInAppThread(body.thread ?? null);
                setInAppThreads((current) => current.map((thread) => thread.id === threadId ? {...thread, unreadCount: 0} : thread));
                requestAnimationFrame(() => messageListRef.current?.scrollTo({top: messageListRef.current.scrollHeight}));
                return;
            }

            const response = await fetch(buildThreadsPath({threadId, includeThreads: false}), {cache: "no-store"});
            const body = await response.json() as InboxResponse;

            if (response.status === 401) {
                setAuthorized(false);
                return;
            }

            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load support thread.");

            setSelectedThread(body.thread ?? null);
            setThreads((current) => current.map((thread) => thread.id === threadId ? {...thread, isUnread: false} : thread));
            requestAnimationFrame(() => messageListRef.current?.scrollTo({top: messageListRef.current.scrollHeight}));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load support thread.");
        } finally {
            setLoadingThread(false);
        }
    }

    async function loadMoreThreads() {
        if (!hasMoreThreads || loadingMore) return;
        setLoadingMore(true);

        try {
            if (channel === "in-app") {
                const response = await fetch(buildInAppPath({offset: inAppThreads.length}), {cache: "no-store"});
                const body = await response.json() as InAppInboxResponse;
                if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load more conversations.");
                setInAppThreads((current) => [...current, ...(body.threads ?? [])]);
                setHasMoreThreads(Boolean(body.hasMore));
                return;
            }

            const response = await fetch(buildThreadsPath({offset: threads.length}), {cache: "no-store"});
            const body = await response.json() as InboxResponse;
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to load more threads.");
            setThreads((current) => [...current, ...(body.threads ?? [])]);
            setHasMoreThreads(Boolean(body.hasMore));
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load more threads.");
        } finally {
            setLoadingMore(false);
        }
    }

    useEffect(() => {
        setSelectedThreadId(null);
        setSelectedThread(null);
        setSelectedInAppThread(null);
        setReply("");
        setAttachments([]);
        void loadInbox();
    }, [channel, loadInbox]);
    async function submitLogin(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch("/api/admin/support/login", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({password})
            });
            const body = await response.json() as {ok: boolean; error?: string};
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to sign in.");
            setPassword("");
            await loadInbox();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to sign in.");
        } finally {
            setSubmitting(false);
        }
    }

    async function addFiles(fileList: FileList | null, inline: boolean) {
        if (!fileList?.length) return;
        const files = Array.from(fileList);
        const currentBytes = attachments.reduce((sum, attachment) => sum + attachment.size, 0);

        if (files.some((file) => file.size > MAX_FILE_BYTES)) {
            setError("Each attachment must be 10 MB or smaller.");
            return;
        }
        if (currentBytes + files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) {
            setError("Attachments must total 18 MB or less.");
            return;
        }

        setError(null);
        const additions = await Promise.all(files.map(async (file, index): Promise<ComposerAttachment> => ({
            id: `${Date.now()}-${index}-${file.name}`,
            filename: file.name,
            contentType: file.type || "application/octet-stream",
            content: await fileToBase64(file),
            size: file.size,
            previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
            ...(inline && file.type.startsWith("image/") ? {contentId: `inline-${Date.now()}-${index}`} : {})
        })));
        setAttachments((current) => [...current, ...additions]);
    }

    function removeAttachment(id: string) {
        setAttachments((current) => {
            const removed = current.find((attachment) => attachment.id === id);
            if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            return current.filter((attachment) => attachment.id !== id);
        });
    }

    async function submitReply(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        let request: {url: string; body: Record<string, unknown>; refreshId: string};
        if (channel === "in-app") {
            if (!selectedInAppThread || !canSend) return;
            request = {
                url: "/api/admin/support/in-app-reply",
                body: {userId: selectedInAppThread.id, message: reply},
                refreshId: selectedInAppThread.id
            };
        } else {
            if (!selectedThread || !canSend) return;
            request = {
                url: "/api/admin/support/reply",
                body: {
                    threadId: selectedThread.id,
                    message: reply,
                    attachments: attachments.map(({filename, contentType, content, contentId}) => ({
                        filename,
                        contentType,
                        content,
                        contentId
                    }))
                },
                refreshId: selectedThread.id
            };
        }

        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch(request.url, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(request.body)
            });
            const body = await response.json() as {ok: boolean; error?: string};
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to send reply.");

            attachments.forEach((attachment) => attachment.previewUrl && URL.revokeObjectURL(attachment.previewUrl));
            setReply("");
            setAttachments([]);
            await loadInbox(request.refreshId);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to send reply.");
        } finally {
            setSubmitting(false);
        }
    }

    async function syncFromResend() {
        setSyncing(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/support/sync", {method: "POST"});
            const body = await response.json() as {ok: boolean; error?: string};
            if (!response.ok || !body.ok) throw new Error(body.error || "Unable to sync from Resend.");
            await loadInbox(selectedThreadId);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to sync from Resend.");
        } finally {
            setSyncing(false);
        }
    }

    async function logout() {
        await fetch("/api/admin/support/logout", {method: "POST"});
        setAuthorized(false);
        setThreads([]);
        setSelectedThread(null);
        setSelectedThreadId(null);
    }

    if (authorized === false) {
        return (
            <main className="grid min-h-[70vh] place-items-center px-4 text-ink-100">
                <form onSubmit={submitLogin} className="flex w-full max-w-sm flex-col gap-5 border border-line-300 bg-surface-900 p-6 shadow-2xl">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[.16em] text-primary-200">AnimalDex operations</p>
                        <h1 className="mt-1 font-display text-2xl text-white sm:text-3xl">Support Admin</h1>
                    </div>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-black uppercase tracking-[.12em] text-ink-400">Password</span>
                        <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={cn(fieldClass, "py-2.5 text-base")} autoComplete="current-password" />
                    </label>
                    {error && <Alert tone="bad">{error}</Alert>}
                    <Button type="submit" variant="primary" size="lg" loading={submitting} disabled={!password}>
                        {submitting ? "Signing in…" : "Sign in"}
                    </Button>
                </form>
            </main>
        );
    }

    const firstLoad = loading && (channel === "in-app" ? !inAppThreads.length : !threads.length);

    return (
        <AdminPage width="wide">
            <PageHeader
                eyebrow="Operations"
                title={
                    <span className="inline-flex items-center gap-3">
                        Support Inbox
                        {unreadCount > 0 && <span className="rounded-full bg-primary-400 px-2 py-0.5 font-sans text-[11px] font-black tabular-nums text-canvas-950">{unreadCount}</span>}
                    </span>
                }
                description={channel === "in-app" ? "In-app Messages with AnimalDex" : "Customer email conversations"}
                actions={
                    <>
                        {channel === "email" ? (
                            <Button size="sm" onClick={syncFromResend} loading={syncing}>
                                {syncing ? "Syncing…" : "Sync"}
                            </Button>
                        ) : null}
                        <RefreshButton loading={loading} onClick={() => loadInbox(selectedThreadId)} />
                        <Button size="sm" variant="ghost" onClick={logout}>Sign out</Button>
                    </>
                }
            />

            {error && <Alert tone="bad" className="mt-6">{error}</Alert>}

            <div className="mt-6 grid h-[calc(100dvh-15rem)] min-h-[34rem] grid-cols-1 overflow-hidden border border-line-300 bg-surface-900 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
                <aside className={`${mobileThreadOpen ? "hidden lg:block" : "block"} min-h-0 overflow-y-auto border-line-300 lg:border-r`}>
                    <div className="sticky top-0 z-10 space-y-3 border-b border-line-300 bg-surface-900 px-3 py-3">
                        <div className="flex items-center justify-between gap-2 px-1">
                            <p className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Conversations</p>
                            {loading && !firstLoad ? <Spinner size={12} className="text-ink-400" /> : null}
                        </div>
                        <Segmented
                            label="Support channel"
                            value={channel}
                            onChange={setChannel}
                            options={[{value: "email", label: "Email"}, {value: "in-app", label: "In-app"}]}
                        />
                        {channel === "email" ? (
                            <Segmented
                                label="Filter support conversations"
                                value={inboxFilter}
                                onChange={setInboxFilter}
                                className="flex w-full"
                                options={(["inbox", "important", "unread", "spam", "all"] as InboxFilter[]).map((filter) => ({
                                    value: filter,
                                    label: <span className="capitalize">{filter}</span>,
                                    count: filterCounts[filter]
                                }))}
                            />
                        ) : null}
                    </div>
                    {channel === "in-app" ? (
                        <>
                            {loading && !inAppThreads.length ? <ThreadListSkeleton /> : null}
                            {!loading && !inAppThreads.length ? <EmptyState title="No in-app messages yet." className="m-4" /> : null}
                            <div className="divide-y divide-line-300/60">
                                {inAppThreads.map((thread) => {
                                    const selected = thread.id === selectedThreadId;
                                    const unread = thread.unreadCount > 0;
                                    return (
                                        <button
                                            key={thread.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedThreadId(thread.id);
                                                setMobileThreadOpen(true);
                                                loadThreadDetail(thread.id);
                                            }}
                                            className={`flex w-full gap-3 border-l-[3px] px-4 py-4 text-left transition ${selected ? "border-l-primary-400 bg-primary-500/[0.07]" : "border-l-transparent hover:bg-white/[.03]"}`}
                                        >
                                            <div className="relative">
                                                <Avatar name={thread.displayName} src={thread.avatarUrl} />
                                                {unread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary-300 ring-2 ring-surface-900" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`truncate text-sm ${unread ? "font-black text-white" : "font-semibold text-ink-200"}`}>{thread.displayName}</p>
                                                    <time className="shrink-0 text-[11px] tabular-nums text-ink-500" title={absoluteDate(thread.lastCreatedAt)}>{relativeDate(thread.lastCreatedAt)}</time>
                                                </div>
                                                <p className={`mt-1 truncate text-sm ${unread ? "font-bold text-ink-100" : "text-ink-300"}`}>{thread.lastBody}</p>
                                                <p className="mt-2 truncate text-xs text-ink-500">{thread.username ? `@${thread.username}` : thread.id}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    ) : (
                        <>
                            {loading && !threads.length ? <ThreadListSkeleton /> : null}
                            {!loading && !threads.length ? <EmptyState title="No support emails yet." className="m-4" /> : null}
                            {!loading && threads.length > 0 && !filteredThreads.length ? <EmptyState title={`No ${inboxFilter} conversations.`} className="m-4" /> : null}
                            <div className="divide-y divide-line-300/60">
                                {filteredThreads.map((thread) => {
                                    const selected = thread.id === selectedThreadId;
                                    const customerLabel = getCustomerLabel(thread);
                                    return (
                                        <button
                                            key={thread.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedThreadId(thread.id);
                                                setMobileThreadOpen(true);
                                                loadThreadDetail(thread.id);
                                            }}
                                            className={`flex w-full gap-3 border-l-[3px] px-4 py-4 text-left transition ${selected ? "border-l-primary-400 bg-primary-500/[0.07]" : "border-l-transparent hover:bg-white/[.03]"}`}
                                        >
                                            <div className="relative">
                                                <Avatar name={customerLabel} src={thread.customerAvatarUrl} />
                                                {thread.isUnread && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary-300 ring-2 ring-surface-900" />}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className={`truncate text-sm ${thread.isUnread ? "font-black text-white" : "font-semibold text-ink-200"}`}>{customerLabel}</p>
                                                    <time className="shrink-0 text-[11px] tabular-nums text-ink-500" title={absoluteDate(thread.updatedAt)}>{relativeDate(thread.updatedAt)}</time>
                                                </div>
                                                <p className={`mt-1 truncate text-sm ${thread.isUnread ? "font-bold text-ink-100" : "text-ink-300"}`}>{thread.subject || "(no subject)"}</p>
                                                <div className="mt-2 flex items-center gap-2">
                                                    <span className="truncate text-xs text-ink-500">{thread.customerEmail}</span>
                                                    <CategoryBadge category={thread.category} className="ml-auto shrink-0" />
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                    {hasMoreThreads && (
                        <div className="p-4">
                            <Button onClick={loadMoreThreads} loading={loadingMore} className="w-full">
                                {loadingMore ? "Loading…" : "Load older threads"}
                            </Button>
                        </div>
                    )}
                </aside>

                <section className={`${mobileThreadOpen ? "flex" : "hidden lg:flex"} min-h-0 min-w-0 flex-col overflow-hidden bg-canvas-950`}>
                    {channel === "in-app" ? (
                        !selectedInAppThread ? (
                            loading || loadingThread ? <ThreadDetailSkeleton /> : (
                                <div className="grid flex-1 place-items-center p-6">
                                    <EmptyState title="Select an in-app conversation." className="w-full max-w-md border-none" />
                                </div>
                            )
                        ) : (
                        <>
                            <div className="shrink-0 border-b border-line-300 bg-surface-900 px-4 py-4 sm:px-6">
                                <div className="flex min-w-0 items-center gap-3">
                                    <Button size="sm" onClick={() => setMobileThreadOpen(false)} className="h-9 w-9 shrink-0 px-0 lg:hidden" aria-label="Back to inbox">←</Button>
                                    <Avatar name={selectedInAppThread.displayName} src={selectedInAppThread.avatarUrl} size="lg" />
                                    <div className="min-w-0 flex-1">
                                        <h2 className="truncate font-display text-xl text-white sm:text-2xl">{selectedInAppThread.displayName}</h2>
                                        <p className="mt-1 truncate text-sm text-ink-300">
                                            {selectedInAppThread.username ? `@${selectedInAppThread.username}` : "In-app collector"}
                                            {" · "}
                                            <Link href={`/admin/users?userId=${encodeURIComponent(selectedInAppThread.id)}`} className="text-primary-200 hover:text-primary-100">Open user</Link>
                                        </p>
                                    </div>
                                    <Badge tone="good" className="hidden shrink-0 sm:inline-flex">In-app</Badge>
                                    {loadingThread && <Spinner className="text-ink-400" />}
                                </div>
                            </div>

                            <div ref={messageListRef} className={cn("min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-3 py-5 transition-opacity sm:px-6 lg:px-8", loadingThread && "opacity-60")}>
                                {selectedInAppThread.messages.map((message) => {
                                    const inbound = message.direction === "inbound";
                                    return (
                                        <article key={message.id} className={`min-w-0 overflow-hidden border p-4 sm:p-5 ${inbound ? "mr-auto w-full max-w-4xl border-line-300 bg-surface-900" : "ml-auto w-full max-w-4xl border-primary-500/25 border-l-[3px] border-l-primary-400 bg-primary-500/[0.055]"}`}>
                                            <div className="flex min-w-0 items-start gap-3 border-b border-line-300/70 pb-4">
                                                <Avatar name={inbound ? selectedInAppThread.displayName : "AnimalDex"} src={inbound ? selectedInAppThread.avatarUrl : "/images/logo.webp"} size="sm" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                                        <p className="truncate text-sm font-bold text-white">{inbound ? selectedInAppThread.displayName : "AnimalDex"}</p>
                                                        <time className="text-xs tabular-nums text-ink-500" title={absoluteDate(message.createdAt)}>{relativeDate(message.createdAt)}</time>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-5"><MessageBody body={message.body} /></div>
                                        </article>
                                    );
                                })}
                            </div>

                            <form onSubmit={submitReply} className="shrink-0 border-t border-line-300 bg-surface-900 px-3 py-3 sm:px-6 sm:py-4">
                                <div className="border border-line-300 bg-canvas-900 transition focus-within:border-primary-300">
                                    <textarea
                                        value={reply}
                                        onChange={(event) => setReply(event.target.value.slice(0, 1000))}
                                        rows={4}
                                        maxLength={1000}
                                        placeholder={`Reply to ${selectedInAppThread.displayName}…`}
                                        className="block max-h-56 min-h-[96px] w-full resize-y bg-transparent px-4 py-3 text-[15px] leading-6 text-white outline-none placeholder:text-ink-500"
                                    />
                                    <div className="flex flex-wrap items-center gap-2 border-t border-line-300/70 px-3 py-2">
                                        <SupportArticlePicker onAttach={(token) => setReply((current) => (current.trim() ? `${token}\n\n${current}` : token))} />
                                        <p className="text-[11px] tabular-nums text-ink-500">{reply.trim().length}/1000 · Replies appear as AnimalDex in the app</p>
                                        <Button type="submit" variant="primary" disabled={!canSend} loading={submitting} className="ml-auto px-5">
                                            {submitting ? "Sending…" : "Send reply"}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </>
                        )
                    ) : !selectedThread ? (
                        loading || loadingThread ? <ThreadDetailSkeleton /> : (
                            <div className="grid flex-1 place-items-center p-6">
                                <EmptyState title="Select a support thread." className="w-full max-w-md border-none" />
                            </div>
                        )
                    ) : (
                        <>
                            <div className="shrink-0 border-b border-line-300 bg-surface-900 px-4 py-4 sm:px-6">
                                <div className="flex min-w-0 items-center gap-3">
                                    <Button size="sm" onClick={() => setMobileThreadOpen(false)} className="h-9 w-9 shrink-0 px-0 lg:hidden" aria-label="Back to inbox">←</Button>
                                    <Avatar name={getCustomerLabel(selectedThread)} src={selectedThread.customerAvatarUrl} size="lg" />
                                    <div className="min-w-0 flex-1">
                                        <h2 className="truncate font-display text-xl text-white sm:text-2xl">{selectedThread.subject || "(no subject)"}</h2>
                                        <p className="mt-1 truncate text-sm text-ink-300">
                                            {selectedThread.customerName ? `${selectedThread.customerName} · ` : ""}<a href={`mailto:${selectedThread.customerEmail}`} className="hover:text-primary-100">{selectedThread.customerEmail}</a>
                                        </p>
                                    </div>
                                    <CategoryBadge category={selectedThread.category} className="hidden shrink-0 sm:inline-flex" />
                                    {loadingThread && <Spinner className="text-ink-400" />}
                                </div>
                            </div>

                            <div ref={messageListRef} className={cn("min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto px-3 py-5 transition-opacity sm:px-6 lg:px-8", loadingThread && "opacity-60")}>
                                {selectedThread.messages.map((message) => {
                                    const inbound = message.direction === "inbound";
                                    const imageAttachments = message.attachments.filter((attachment) => attachment.contentType.startsWith("image/"));
                                    const fileAttachments = message.attachments.filter((attachment) => !attachment.contentType.startsWith("image/"));

                                    return (
                                        <article key={message.id} className={`min-w-0 overflow-hidden border p-4 sm:p-5 ${inbound ? "mr-auto w-full max-w-4xl border-line-300 bg-surface-900" : "ml-auto w-full max-w-4xl border-primary-500/25 border-l-[3px] border-l-primary-400 bg-primary-500/[0.055]"}`}>
                                            <div className="flex min-w-0 items-start gap-3 border-b border-line-300/70 pb-4">
                                                <Avatar name={inbound ? message.fromEmail : "AnimalDex Support"} src={inbound ? selectedThread.customerAvatarUrl : "/images/logo.webp"} size="sm" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                                                        <p className="truncate text-sm font-bold text-white">{inbound ? (selectedThread.customerName || message.fromEmail) : "AnimalDex Support"}</p>
                                                        <time className="text-xs tabular-nums text-ink-500" title={absoluteDate(message.createdAt)}>{relativeDate(message.createdAt)}</time>
                                                    </div>
                                                    <p className="mt-1 truncate text-xs text-ink-400">
                                                        {message.subject || selectedThread.subject || "(no subject)"}
                                                    </p>
                                                    <p className="mt-1 truncate text-[11px] text-ink-500">
                                                        {message.fromEmail} → {message.toEmail}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="mt-5"><MessageBody body={message.body} /></div>

                                            {imageAttachments.length > 0 && (
                                                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                                    {imageAttachments.map((attachment) => (
                                                        <a key={attachment.id} href={attachment.url} target="_blank" rel="noopener noreferrer" className="group overflow-hidden border border-line-300 bg-canvas-900 transition hover:border-primary-300">
                                                            <span className="relative block max-h-[32rem] min-h-[12rem] w-full bg-canvas-900">
                                                                <Image src={attachment.url} alt={attachment.filename} fill unoptimized sizes="(min-width: 640px) 50vw, 100vw" className="object-contain transition group-hover:scale-[1.01]" />
                                                            </span>
                                                            <span className="block truncate border-t border-line-300 px-3 py-2 text-xs text-ink-300">{attachment.filename}</span>
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                            {message.remoteImages.length > 0 && (
                                                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                                    {message.remoteImages.map((image, index) => (
                                                        <a key={`${image.url}-${index}`} href={image.url} target="_blank" rel="noopener noreferrer" className="group overflow-hidden border border-line-300 bg-white transition hover:border-primary-300">
                                                            <span className="relative block max-h-[32rem] min-h-[12rem] w-full bg-white">
                                                                <Image src={image.url} alt={image.alt} fill unoptimized sizes="(min-width: 640px) 50vw, 100vw" className="object-contain transition group-hover:scale-[1.01]" referrerPolicy="no-referrer" />
                                                            </span>
                                                            <span className="block truncate border-t border-line-300 bg-canvas-900 px-3 py-2 text-xs text-ink-300">{image.alt}</span>
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                            {fileAttachments.length > 0 && (
                                                <div className="mt-5 flex flex-wrap gap-2">
                                                    {fileAttachments.map((attachment) => (
                                                        <a key={attachment.id} href={attachment.url} target="_blank" rel="noopener noreferrer" className="flex max-w-full items-center gap-2 border border-line-300 bg-canvas-900 px-3 py-2 text-xs text-ink-200 transition hover:border-primary-300 hover:text-primary-100">
                                                            <span aria-hidden="true">📎</span><span className="truncate">{attachment.filename}</span>{attachment.size ? <span className="shrink-0 tabular-nums text-ink-500">{formatBytes(attachment.size)}</span> : null}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>

                            <form onSubmit={submitReply} className="shrink-0 border-t border-line-300 bg-surface-900 px-3 py-3 sm:px-6 sm:py-4">
                                <div className="border border-line-300 bg-canvas-900 transition focus-within:border-primary-300">
                                    <textarea
                                        id="admin-support-reply"
                                        value={reply}
                                        onChange={(event) => setReply(event.target.value)}
                                        rows={4}
                                        placeholder={`Reply to ${selectedThread.customerName || selectedThread.customerEmail}…`}
                                        className="block max-h-56 min-h-[96px] w-full resize-y bg-transparent px-4 py-3 text-[15px] leading-6 text-white outline-none placeholder:text-ink-500"
                                    />
                                    {attachments.length > 0 && (
                                        <div className="grid gap-2 border-t border-line-300/70 p-3 sm:grid-cols-2 lg:grid-cols-3">
                                            {attachments.map((attachment) => (
                                                <div key={attachment.id} className="flex min-w-0 items-center gap-2 border border-line-300 bg-surface-900 p-2">
                                                    {attachment.previewUrl ? <span className="relative h-10 w-10 shrink-0 overflow-hidden"><Image src={attachment.previewUrl} alt="" fill unoptimized sizes="40px" className="object-cover" /></span> : <span className="grid h-10 w-10 shrink-0 place-items-center bg-white/5">📎</span>}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-xs font-semibold text-white">{attachment.filename}</p>
                                                        <p className="text-[10px] tabular-nums text-ink-500">{attachment.contentId ? "Inline image" : formatBytes(attachment.size)}</p>
                                                    </div>
                                                    <Button variant="ghost" size="sm" onClick={() => removeAttachment(attachment.id)} className="h-7 min-h-7 w-7 shrink-0 px-0 text-ink-400" aria-label={`Remove ${attachment.filename}`}>×</Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex flex-wrap items-center gap-2 border-t border-line-300/70 px-3 py-2">
                                        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => { addFiles(event.target.files, false); event.target.value = ""; }} />
                                        <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(event) => { addFiles(event.target.files, true); event.target.value = ""; }} />
                                        <SupportArticlePicker onAttach={(token) => setReply((current) => (current.trim() ? `${token}\n\n${current}` : token))} />
                                        <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>📎 Attach files</Button>
                                        <Button variant="ghost" size="sm" onClick={() => imageInputRef.current?.click()}>▧ Insert images</Button>
                                        <p className="hidden text-[11px] text-ink-500 xl:block">Links become clickable · AnimalDex signature added automatically</p>
                                        <Button type="submit" variant="primary" disabled={!canSend} loading={submitting} className="ml-auto px-5">
                                            {submitting ? "Sending…" : "Send reply"}
                                        </Button>
                                    </div>
                                </div>
                            </form>
                        </>
                    )}
                </section>
            </div>
        </AdminPage>
    );
}
