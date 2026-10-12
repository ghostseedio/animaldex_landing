"use client";

import {FormEvent, useEffect, useMemo, useState} from "react";
import {Alert, Badge, Button, Card, CardContent, cn, fieldClass, Skeleton} from "@/components/admin/ui";

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
            <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
                <header className="mb-2 border-b border-line-300 pb-5">
                    <p className="text-[11px] font-black uppercase tracking-[.16em] text-primary-200">AnimalDex Support</p>
                    <h1 className="mt-1 font-display text-2xl leading-tight text-white sm:text-3xl">Reply to support thread</h1>
                </header>

                {loading && (
                    <div role="status" aria-label="Loading support thread" className="flex flex-col gap-4">
                        <Card>
                            <CardContent className="grid gap-4 sm:grid-cols-2">
                                {[0, 1].map((index) => (
                                    <div key={index}>
                                        <Skeleton className="h-2.5 w-16" />
                                        <Skeleton className="mt-2.5 h-3.5 w-40" />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                        {[0, 1].map((index) => (
                            <Card key={index} style={{opacity: 1 - index * 0.25}}>
                                <CardContent>
                                    <Skeleton className="h-3 w-48" />
                                    <Skeleton className="mt-2 h-2.5 w-32" />
                                    <Skeleton className="mt-5 h-2.5 w-full" />
                                    <Skeleton className="mt-2 h-2.5 w-11/12" />
                                    <Skeleton className="mt-2 h-2.5 w-2/3" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {!loading && error && !thread && (
                    <Alert tone="bad" title="This link can’t be used">
                        {error}
                    </Alert>
                )}

                {thread && (
                    <>
                        <Card>
                            <CardContent>
                                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                                    <div className="min-w-0">
                                        <dt className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Subject</dt>
                                        <dd className="mt-1 break-words font-medium text-white">{thread.subject || "(no subject)"}</dd>
                                    </div>
                                    <div className="min-w-0">
                                        <dt className="text-[11px] font-black uppercase tracking-[.12em] text-ink-500">Customer</dt>
                                        <dd className="mt-1 break-words font-medium text-white">
                                            {thread.customerName ? `${thread.customerName} <${thread.customerEmail}>` : thread.customerEmail}
                                        </dd>
                                    </div>
                                </dl>
                            </CardContent>
                        </Card>

                        <section className="flex flex-col gap-3">
                            {thread.messages.map((item) => (
                                <article
                                    key={item.id}
                                    className={cn(
                                        "border border-line-300 bg-surface-900 p-4",
                                        item.direction === "outbound" && "border-l-[3px] border-l-primary-400"
                                    )}
                                >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="break-words text-sm font-bold text-white">
                                                {item.direction === "inbound" ? item.fromEmail : "AnimalDex Support"}
                                            </p>
                                            <p className="mt-0.5 text-xs text-ink-400">
                                                {formatDate(item.createdAt)}
                                            </p>
                                        </div>
                                        <Badge tone={item.direction === "inbound" ? "neutral" : "good"}>
                                            {item.direction === "inbound" ? "Inbound" : "Outbound"}
                                        </Badge>
                                    </div>
                                    <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink-200">{item.body}</p>
                                </article>
                            ))}
                        </section>

                        <form onSubmit={submitReply} className="border border-line-300 bg-surface-900 p-4">
                            <label htmlFor="support-reply" className="text-[11px] font-black uppercase tracking-[.12em] text-ink-400">
                                Response
                            </label>
                            <textarea
                                id="support-reply"
                                value={message}
                                onChange={(event) => setMessage(event.target.value)}
                                disabled={submitting || sent}
                                rows={8}
                                className={cn(fieldClass, "mt-2 block resize-y text-base leading-6 disabled:cursor-not-allowed")}
                            />

                            {error && <Alert tone="bad" className="mt-3">{error}</Alert>}
                            {sent && <Alert tone="good" className="mt-3">Reply sent. This link has been used.</Alert>}

                            <div className="mt-4 flex justify-end">
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    loading={submitting}
                                    disabled={!canSubmit}
                                >
                                    {submitting ? "Sending..." : "Send reply"}
                                </Button>
                            </div>
                        </form>
                    </>
                )}
            </div>
        </main>
    );
}
