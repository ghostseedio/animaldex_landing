"use client";

import {useEffect, useState} from "react";
import {fillTemplate, getNotificationTemplate} from "@/lib/notification-templates";

/**
 * Offer the member an explanation at the moment their capture changed.
 *
 * A merge is not reversible from their side and a regrade moves a number they
 * may have looked at, so both are worth a word — but sending it meant leaving
 * maintenance, finding the person again in /admin/notifications and retyping
 * what just happened. This carries that context over.
 *
 * Deliberately a confirmation rather than an automatic send: the operator sees
 * the wording before a member does, and can decline. A wrong merge should not
 * announce itself before it is noticed.
 */

export type NotifyRequest = {
    templateId: "merged" | "regraded";
    userId: string;
    /** For the heading only, so the operator can see who this reaches. */
    recipientLabel: string;
    animalName: string | null;
    /** Deep link target: the capture that survived, or the one regraded. */
    captureId: string;
    /** How many captures were folded in, for the merge summary line. */
    count?: number;
    grade?: number;
};

type Props = {
    request: NotifyRequest;
    onClose: () => void;
    onSent: (message: string) => void;
};

export default function NotifyOwnerDialog({request, onClose, onSent}: Props) {
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const template = getNotificationTemplate(request.templateId);
        const values = {animal: request.animalName, grade: request.grade, count: request.count};
        setTitle(fillTemplate(template?.title ?? "", values));
        setBody(fillTemplate(template?.body ?? "", values));
    }, [request]);

    async function send() {
        setBusy(true);
        setError(null);
        try {
            const response = await fetch("/api/admin/notifications/send", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    mode: "user",
                    userId: request.userId,
                    title,
                    body,
                    // Opens the surviving capture rather than the app's home, so
                    // the member lands on the thing the message is about.
                    captureId: request.captureId
                })
            });
            const payload = await response.json();
            if (!response.ok || !payload.ok) throw new Error(payload.error || "Send failed");
            onSent(`Notified ${request.recipientLabel}.`);
            onClose();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Send failed");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div role="dialog" aria-modal="true" aria-label="Notify the capture owner"
             className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/90 p-3 backdrop-blur-sm sm:p-8"
             onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-line-300 bg-canvas-950 shadow-2xl">
                <div className="flex items-center justify-between gap-4 border-b border-line-300 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[.16em] text-primary-200">
                            {request.templateId === "merged" ? "Captures merged" : "Grade adjusted"}
                        </p>
                        <h2 className="truncate font-display text-2xl text-white">Tell {request.recipientLabel}?</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Close without sending"
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line-300 text-xl text-white hover:border-primary-300">×</button>
                </div>

                <div className="space-y-4 p-5">
                    {error && <p className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}

                    <p className="text-xs leading-5 text-ink-400">
                        {request.templateId === "merged"
                            ? `${request.count ?? 1} capture${(request.count ?? 1) === 1 ? "" : "s"} folded into one card. The message links to the card that survived.`
                            : "The message links to the capture whose grade changed."}
                        {" "}Category mutes can stop the push, but the message still appears in their notification list.
                    </p>

                    <label className="block">
                        <span className="text-xs font-black uppercase tracking-[.14em] text-ink-500">Title</span>
                        <input value={title} onChange={(event) => setTitle(event.target.value)}
                               className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-300" />
                    </label>

                    <label className="block">
                        <span className="text-xs font-black uppercase tracking-[.14em] text-ink-500">Message</span>
                        <textarea value={body} rows={4} onChange={(event) => setBody(event.target.value)}
                                  className="mt-1 w-full rounded-xl border border-line-300 bg-canvas-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-300" />
                    </label>

                    <div className="flex flex-wrap items-center gap-2">
                        <button type="button" onClick={() => void send()} disabled={busy || !title.trim() || !body.trim()}
                                className="rounded-xl bg-primary-500 px-5 py-3 text-sm font-black text-canvas-950 disabled:opacity-40">
                            {busy ? "Sending…" : "Send notification"}
                        </button>
                        <button type="button" onClick={onClose} disabled={busy}
                                className="rounded-xl border border-line-300 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">
                            Don&apos;t send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
