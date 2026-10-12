"use client";

import {useEffect, useState} from "react";
import {fillTemplate, getNotificationTemplate} from "@/lib/notification-templates";
import {Alert, Button, Field, fieldClass} from "@/components/admin/ui";

/**
 * Offer the member an explanation at the moment their capture changed.
 *
 * A merge is not reversible from their side, a regrade moves a number they may
 * have looked at, and indexing an animal turns captures they had written off
 * into a collected entry. All three are worth a word — but sending it meant
 * leaving the panel, finding the person again in /admin/notifications and
 * retyping what had just happened.
 *
 * Deliberately a confirmation rather than an automatic send: the operator reads
 * the wording before a member does, and can decline. A wrong merge should not
 * announce itself before it is noticed.
 */

export type NotifyRecipient = {
    userId: string;
    /** How the person is named in the heading, so the operator can see who this reaches. */
    label: string;
    /** Deep link target: their own capture, so each person lands on their own card. */
    captureId?: string;
};

export type NotifyRequest = {
    templateId: "merged" | "regraded" | "indexed";
    recipients: NotifyRecipient[];
    animalName: string | null;
    /** How many captures were folded in, for the merge summary line. */
    count?: number;
    grade?: number;
    /** Shown above the message when there is something the operator should know. */
    note?: string;
};

type Props = {
    request: NotifyRequest;
    onClose: () => void;
    onSent: (message: string) => void;
};

const HEADINGS: Record<NotifyRequest["templateId"], string> = {
    merged: "Captures merged",
    regraded: "Grade adjusted",
    indexed: "Animal indexed"
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

    const recipients = request.recipients;
    const audience = recipients.length === 1
        ? recipients[0].label
        : `${recipients.length} members`;

    async function send() {
        setBusy(true);
        setError(null);

        const failed: string[] = [];
        let sent = 0;

        for (const recipient of recipients) {
            try {
                const response = await fetch("/api/admin/notifications/send", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        mode: "user",
                        userId: recipient.userId,
                        title,
                        body,
                        // The edge function refuses a capture belonging to
                        // somebody else, so each person gets their own.
                        captureId: recipient.captureId
                    })
                });
                const payload = await response.json();
                if (!response.ok || !payload.ok) throw new Error(payload.error || "Send failed");
                sent += 1;
            } catch (caught) {
                failed.push(`${recipient.label}: ${caught instanceof Error ? caught.message : "failed"}`);
            }
        }

        setBusy(false);

        if (failed.length) {
            setError(`${failed.length} of ${recipients.length} did not send — ${failed.join(" · ")}`);
            if (!sent) return;
        }

        onSent(`Notified ${sent} member${sent === 1 ? "" : "s"}.`);
        if (!failed.length) onClose();
    }

    return (
        <div role="dialog" aria-modal="true" aria-label="Notify the capture owner"
             className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/80 p-3 sm:p-8"
             onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
            <div className="w-full max-w-xl overflow-hidden border border-line-300 bg-surface-900 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-line-300 px-5 py-4">
                    <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-[.16em] text-primary-200">{HEADINGS[request.templateId]}</p>
                        <h2 className="mt-1 truncate font-display text-xl text-white">Tell {audience}?</h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close without sending" className="shrink-0">✕</Button>
                </div>

                <div className="space-y-4 p-5">
                    {error && <Alert tone="bad">{error}</Alert>}

                    <p className="text-xs leading-5 text-ink-400">
                        {request.note ?? (request.templateId === "merged"
                            ? `${request.count ?? 1} capture${(request.count ?? 1) === 1 ? "" : "s"} folded into one card. The message links to the card that survived.`
                            : "The message links to the capture it is about.")}
                        {" "}Category mutes can stop the push, but the message still appears in their notification list.
                    </p>

                    {recipients.length > 1 && (
                        <details className="border border-line-300 px-3 py-2.5">
                            <summary className="cursor-pointer text-[11px] font-black uppercase tracking-[.12em] text-ink-400 hover:text-white">Who gets this ({recipients.length})</summary>
                            <ul className="mt-2 space-y-1">
                                {recipients.map((recipient) => (
                                    <li key={recipient.userId} className="text-xs text-ink-400">{recipient.label}</li>
                                ))}
                            </ul>
                        </details>
                    )}

                    <Field label="Title">
                        <input value={title} onChange={(event) => setTitle(event.target.value)}
                               className={fieldClass} />
                    </Field>

                    <Field label="Message">
                        <textarea value={body} rows={4} onChange={(event) => setBody(event.target.value)}
                                  className={fieldClass} />
                    </Field>

                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line-300 pt-4">
                        <Button variant="ghost" onClick={onClose} disabled={busy}>
                            Don&apos;t send
                        </Button>
                        <Button variant="primary" onClick={() => void send()} disabled={!title.trim() || !body.trim() || !recipients.length} loading={busy}>
                            {busy ? "Sending…" : `Send to ${recipients.length === 1 ? "this member" : `${recipients.length} members`}`}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
