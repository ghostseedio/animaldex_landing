"use client";

import {FormEvent, useEffect, useMemo, useState} from "react";

type SupportThreadSummary = {
    id: string;
    subject: string | null;
    customerEmail: string;
    customerName: string | null;
    status: string;
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
    createdAt: string;
};

type SafeSupportThread = {
    id: string;
    subject: string | null;
    customerEmail: string;
    customerName: string | null;
    status: string;
    messages: SafeSupportMessage[];
};

type InboxResponse = {
    ok: boolean;
    threads?: SupportThreadSummary[];
    thread?: SafeSupportThread | null;
    error?: string;
};

function formatDate(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return new Intl.DateTimeFormat("en", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}

function getCustomerLabel(thread: Pick<SupportThreadSummary | SafeSupportThread, "customerEmail" | "customerName">) {
    return thread.customerName ? `${thread.customerName} <${thread.customerEmail}>` : thread.customerEmail;
}

export default function SupportInboxClient() {
    const [authorized, setAuthorized] = useState<boolean | null>(null);
    const [password, setPassword] = useState("");
    const [threads, setThreads] = useState<SupportThreadSummary[]>([]);
    const [selectedThread, setSelectedThread] = useState<SafeSupportThread | null>(null);
    const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
    const [reply, setReply] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const canSend = useMemo(
        () => Boolean(selectedThread && reply.trim() && !submitting),
        [reply, selectedThread, submitting]
    );

    async function loadInbox(threadId?: string | null) {
        setLoading(true);
        setError(null);

        try {
            const path = threadId
                ? `/api/admin/support/threads?threadId=${encodeURIComponent(threadId)}`
                : "/api/admin/support/threads";
            const response = await fetch(path, {cache: "no-store"});
            const body = await response.json() as InboxResponse;

            if (response.status === 401) {
                setAuthorized(false);
                setThreads([]);
                setSelectedThread(null);
                return;
            }

            if (!response.ok || !body.ok) {
                setError(body.error || "Unable to load support inbox.");
                return;
            }

            const nextThreads = body.threads ?? [];
            const nextThread = body.thread ?? null;
            setAuthorized(true);
            setThreads(nextThreads);
            setSelectedThread(nextThread);
            setSelectedThreadId(nextThread?.id ?? nextThreads[0]?.id ?? null);
        } catch {
            setError("Unable to load support inbox.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadInbox();
    }, []);

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

            if (!response.ok || !body.ok) {
                setError(body.error || "Unable to sign in.");
                return;
            }

            setPassword("");
            await loadInbox();
        } catch {
            setError("Unable to sign in.");
        } finally {
            setSubmitting(false);
        }
    }

    async function submitReply(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!selectedThread || !canSend) {
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch("/api/admin/support/reply", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    threadId: selectedThread.id,
                    message: reply
                })
            });
            const body = await response.json() as {ok: boolean; error?: string};

            if (!response.ok || !body.ok) {
                setError(body.error || "Unable to send reply.");
                return;
            }

            setReply("");
            await loadInbox(selectedThread.id);
        } catch {
            setError("Unable to send reply.");
        } finally {
            setSubmitting(false);
        }
    }

    async function syncFromResend() {
        setSyncing(true);
        setError(null);

        try {
            const response = await fetch("/api/admin/support/sync", {method: "POST"});
            const body = await response.json() as {
                ok: boolean;
                imported?: number;
                skipped?: number;
                scanned?: number;
                error?: string;
            };

            if (!response.ok || !body.ok) {
                setError(body.error || "Unable to sync received emails from Resend.");
                return;
            }

            await loadInbox(selectedThreadId);
        } catch {
            setError("Unable to sync received emails from Resend.");
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
            <main className="min-h-screen bg-canvas-950 px-4 py-10 text-ink-100 sm:px-6">
                <form
                    onSubmit={submitLogin}
                    className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-lg border border-line-300 bg-surface-900 p-6"
                >
                    <div>
                        <p className="text-sm font-medium uppercase tracking-[0.16em] text-primary-200">AnimalDex</p>
                        <h1 className="mt-2 font-display text-3xl text-white">Support Admin</h1>
                    </div>
                    <label className="flex flex-col gap-2 text-sm font-medium text-white">
                        Password
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            className="rounded-md border border-line-300 bg-canvas-900 px-3 py-3 text-base text-white outline-none focus:border-primary-200"
                            autoComplete="current-password"
                        />
                    </label>
                    {error && <p className="text-sm text-primary-200">{error}</p>}
                    <button
                        type="submit"
                        disabled={submitting || !password}
                        className="rounded-md bg-primary-500 px-4 py-3 text-sm font-bold text-canvas-950 transition hover:bg-primary-200 disabled:cursor-not-allowed disabled:bg-line-300 disabled:text-ink-400"
                    >
                        {submitting ? "Signing in..." : "Sign in"}
                    </button>
                </form>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-canvas-950 text-ink-100">
            <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col">
                <header className="flex flex-col gap-3 border-b border-line-300 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <div>
                        <p className="text-sm font-medium uppercase tracking-[0.16em] text-primary-200">AnimalDex</p>
                        <h1 className="mt-1 font-display text-3xl text-white">Support Inbox</h1>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={syncFromResend}
                            disabled={syncing}
                            className="rounded-md border border-line-300 px-4 py-2 text-sm font-bold text-white transition hover:border-primary-200 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {syncing ? "Syncing..." : "Sync from Resend"}
                        </button>
                        <button
                            type="button"
                            onClick={() => loadInbox(selectedThreadId)}
                            className="rounded-md border border-line-300 px-4 py-2 text-sm font-bold text-white transition hover:border-primary-200"
                        >
                            Refresh
                        </button>
                        <button
                            type="button"
                            onClick={logout}
                            className="rounded-md border border-line-300 px-4 py-2 text-sm font-bold text-white transition hover:border-primary-200"
                        >
                            Sign out
                        </button>
                    </div>
                </header>

                {error && (
                    <div className="border-b border-line-300 bg-surface-900 px-4 py-3 text-sm text-primary-200 sm:px-6">
                        {error}
                    </div>
                )}

                <div className="grid flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
                    <aside className="border-b border-line-300 lg:border-b-0 lg:border-r">
                        {loading && threads.length === 0 && (
                            <div className="p-4 text-sm text-ink-300">Loading inbox...</div>
                        )}
                        {!loading && threads.length === 0 && (
                            <div className="p-4 text-sm text-ink-300">No support emails yet.</div>
                        )}
                        <div className="divide-y divide-line-300">
                            {threads.map((thread) => {
                                const selected = thread.id === selectedThreadId;

                                return (
                                    <button
                                        key={thread.id}
                                        type="button"
                                        onClick={() => {
                                            setSelectedThreadId(thread.id);
                                            loadInbox(thread.id);
                                        }}
                                        className={`block w-full px-4 py-4 text-left transition ${selected ? "bg-surface-900" : "hover:bg-surface-900/60"}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <p className="line-clamp-1 text-sm font-bold text-white">
                                                {thread.subject || "(no subject)"}
                                            </p>
                                            <span className="shrink-0 rounded border border-line-300 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-ink-300">
                                                {thread.status}
                                            </span>
                                        </div>
                                        <p className="mt-2 line-clamp-1 text-sm text-ink-300">{getCustomerLabel(thread)}</p>
                                        <p className="mt-2 text-xs text-ink-500">{formatDate(thread.updatedAt)}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>

                    <section className="flex min-h-[60vh] flex-col">
                        {!selectedThread && (
                            <div className="flex flex-1 items-center justify-center p-8 text-sm text-ink-300">
                                Select a support thread.
                            </div>
                        )}

                        {selectedThread && (
                            <>
                                <div className="border-b border-line-300 px-4 py-5 sm:px-6">
                                    <h2 className="font-display text-2xl text-white">{selectedThread.subject || "(no subject)"}</h2>
                                    <p className="mt-2 text-sm text-ink-300">{getCustomerLabel(selectedThread)}</p>
                                </div>

                                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
                                    {selectedThread.messages.map((message) => (
                                        <article
                                            key={message.id}
                                            className={`rounded-lg border border-line-300 p-4 ${message.direction === "inbound" ? "bg-surface-900" : "bg-canvas-900"}`}
                                        >
                                            <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                                <div>
                                                    <p className="text-sm font-bold text-white">
                                                        {message.direction === "inbound" ? message.fromEmail : "AnimalDex Support"}
                                                    </p>
                                                    <p className="text-xs text-ink-400">
                                                        {message.direction === "inbound" ? "Inbound" : "Outbound"}
                                                    </p>
                                                </div>
                                                <p className="text-xs text-ink-500">{formatDate(message.createdAt)}</p>
                                            </div>
                                            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink-200">{message.body}</p>
                                        </article>
                                    ))}
                                </div>

                                <form onSubmit={submitReply} className="border-t border-line-300 bg-surface-900 px-4 py-5 sm:px-6">
                                    <label htmlFor="admin-support-reply" className="text-sm font-bold text-white">
                                        Reply
                                    </label>
                                    <textarea
                                        id="admin-support-reply"
                                        value={reply}
                                        onChange={(event) => setReply(event.target.value)}
                                        rows={5}
                                        className="mt-3 block w-full resize-y rounded-lg border border-line-300 bg-canvas-900 px-4 py-3 text-base text-white outline-none transition focus:border-primary-200"
                                    />
                                    <div className="mt-4 flex justify-end">
                                        <button
                                            type="submit"
                                            disabled={!canSend}
                                            className="rounded-md bg-primary-500 px-5 py-3 text-sm font-bold text-canvas-950 transition hover:bg-primary-200 disabled:cursor-not-allowed disabled:bg-line-300 disabled:text-ink-400"
                                        >
                                            {submitting ? "Sending..." : "Send reply"}
                                        </button>
                                    </div>
                                </form>
                            </>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
}
