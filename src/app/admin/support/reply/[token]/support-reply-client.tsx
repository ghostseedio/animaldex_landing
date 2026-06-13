"use client";

import {FormEvent, useEffect, useMemo, useState} from "react";

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

type ThreadResponse = {
    ok: boolean;
    thread?: SafeSupportThread;
    error?: string;
};

type SupportReplyClientProps = {
    token: string;
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

export default function SupportReplyClient({token}: SupportReplyClientProps) {
    const [thread, setThread] = useState<SafeSupportThread | null>(null);
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const canSubmit = useMemo(() => message.trim().length > 0 && !submitting && !sent, [message, submitting, sent]);

    useEffect(() => {
        let cancelled = false;

        async function loadThread() {
            try {
                const response = await fetch(`/api/support/thread?token=${encodeURIComponent(token)}`, {
                    cache: "no-store"
                });
                const body = await response.json() as ThreadResponse;

                if (cancelled) {
                    return;
                }

                if (!response.ok || !body.ok || !body.thread) {
                    setError(body.error || "Unable to load this support thread.");
                    return;
                }

                setThread(body.thread);
            } catch {
                if (!cancelled) {
                    setError("Unable to load this support thread.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadThread();

        return () => {
            cancelled = true;
        };
    }, [token]);

    async function submitReply(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!canSubmit) {
            return;
        }

        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch("/api/support/reply", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    token,
                    message
                })
            });
            const body = await response.json() as {ok: boolean; error?: string};

            if (!response.ok || !body.ok) {
                setError(body.error || "Unable to send reply.");
                return;
            }

            setSent(true);
            setMessage("");
        } catch {
            setError("Unable to send reply.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="min-h-screen bg-canvas-950 px-4 py-8 text-ink-100 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
                <header className="border-b border-line-300 pb-5">
                    <p className="text-sm font-medium uppercase tracking-[0.16em] text-primary-200">AnimalDex Support</p>
                    <h1 className="mt-3 font-display text-3xl text-white sm:text-4xl">Reply to support thread</h1>
                </header>

                {loading && (
                    <section className="rounded-lg border border-line-300 bg-surface-900 p-5 text-ink-200">
                        Loading support thread...
                    </section>
                )}

                {!loading && error && !thread && (
                    <section className="rounded-lg border border-line-300 bg-surface-900 p-5 text-ink-200">
                        {error}
                    </section>
                )}

                {thread && (
                    <>
                        <section className="rounded-lg border border-line-300 bg-surface-900 p-5">
                            <dl className="grid gap-4 text-sm sm:grid-cols-2">
                                <div>
                                    <dt className="text-ink-400">Subject</dt>
                                    <dd className="mt-1 font-medium text-white">{thread.subject || "(no subject)"}</dd>
                                </div>
                                <div>
                                    <dt className="text-ink-400">Customer</dt>
                                    <dd className="mt-1 font-medium text-white">
                                        {thread.customerName ? `${thread.customerName} <${thread.customerEmail}>` : thread.customerEmail}
                                    </dd>
                                </div>
                            </dl>
                        </section>

                        <section className="flex flex-col gap-3">
                            {thread.messages.map((item) => (
                                <article
                                    key={item.id}
                                    className="rounded-lg border border-line-300 bg-surface-900 p-5"
                                >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-white">
                                                {item.direction === "inbound" ? item.fromEmail : "AnimalDex Support"}
                                            </p>
                                            <p className="text-xs text-ink-400">
                                                {item.direction === "inbound" ? "Inbound" : "Outbound"} · {formatDate(item.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink-200">{item.body}</p>
                                </article>
                            ))}
                        </section>

                        <form onSubmit={submitReply} className="rounded-lg border border-line-300 bg-surface-900 p-5">
                            <label htmlFor="support-reply" className="text-sm font-medium text-white">
                                Response
                            </label>
                            <textarea
                                id="support-reply"
                                value={message}
                                onChange={(event) => setMessage(event.target.value)}
                                disabled={submitting || sent}
                                rows={8}
                                className="mt-3 block w-full resize-y rounded-lg border border-line-300 bg-canvas-900 px-4 py-3 text-base text-white outline-none transition focus:border-primary-200 disabled:cursor-not-allowed disabled:opacity-60"
                            />

                            {error && <p className="mt-3 text-sm text-primary-200">{error}</p>}
                            {sent && <p className="mt-3 text-sm text-primary-200">Reply sent. This link has been used.</p>}

                            <div className="mt-4 flex justify-end">
                                <button
                                    type="submit"
                                    disabled={!canSubmit}
                                    className="rounded-md bg-primary-500 px-5 py-3 text-sm font-bold text-canvas-950 transition hover:bg-primary-200 disabled:cursor-not-allowed disabled:bg-line-300 disabled:text-ink-400"
                                >
                                    {submitting ? "Sending..." : "Send reply"}
                                </button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </main>
    );
}
