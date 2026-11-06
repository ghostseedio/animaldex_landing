"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {captureFailurePresentation} from "@/lib/capture-failure";
import {CAPTURE_WORDS_EN, fillCaptureWords, type CaptureWords} from "@/lib/capture-words";

/**
 * The card's toolbar actions (iOS `ScanResultView.detailToolbar`):
 *
 * - your own card: "Card options" (ellipsis.circle, 44 pt) with Re-analyze
 *   (normally, or "Animal label is wrong") and Delete Card, and Share;
 * - someone else's: a ••• with Report Capture and Block User.
 *
 * Everything goes through routes the web already has or thin ones over the
 * apps' own RPCs and edge function: captures/[id]/analyze (`analyze-capture`),
 * captures/[id]/delete (`delete_own_capture`), profile/social
 * (`moderation_reports`, `user_blocks`). Customize Card (the card-frame
 * editor) has no web editor and is not offered.
 */

const NEON = "#A7F432";

function EllipsisCircle() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9.5" />
            <circle cx="8" cy="12" r="1.1" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
            <circle cx="16" cy="12" r="1.1" fill="currentColor" stroke="none" />
        </svg>
    );
}

function ShareIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" />
            <path d="m7.5 7.5 4.5-4.5 4.5 4.5" />
            <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
        </svg>
    );
}

type MenuItem = {key: string; label: string; destructive?: boolean; disabled?: boolean; action: () => void};

function Menu({label, items, busy = false, align = "left"}: {label: string; items: MenuItem[]; busy?: boolean; align?: "left" | "right"}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!open) return undefined;
        const onPointerDown = (event: PointerEvent) => {
            if (!ref.current?.contains(event.target as Node)) setOpen(false);
        };
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onPointerDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointerDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                disabled={busy}
                className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-white/[0.06] disabled:opacity-60"
                style={{color: NEON}}
            >
                {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-400/30 border-t-primary-400" /> : <EllipsisCircle />}
            </button>
            {open ? (
                <div role="menu" className={`absolute ${align === "right" ? "right-0" : "left-0"} z-40 mt-1 w-60 overflow-hidden border border-white/10 bg-[#141414] py-1 shadow-2xl`}>
                    {items.map((item, index) => (
                        <button
                            key={item.key}
                            type="button"
                            role="menuitem"
                            disabled={item.disabled}
                            onClick={() => {
                                setOpen(false);
                                item.action();
                            }}
                            className={`flex min-h-11 w-full items-center px-4 text-left text-sm font-semibold disabled:opacity-50 ${item.destructive ? "text-red-400" : "text-white"} ${item.destructive && index > 0 ? "border-t border-white/10" : ""}`}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}

/** A confirmation sheet, as iOS's confirmationDialog. */
function ConfirmSheet({
    title,
    message,
    actions,
    cancelLabel,
    onCancel
}: {
    title: string;
    message?: string | null;
    actions: Array<{label: string; destructive?: boolean; onSelect: () => void}>;
    cancelLabel: string;
    onCancel: () => void;
}) {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onCancel();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onCancel]);
    return (
        <div role="alertdialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[70] flex items-end justify-center bg-[#090909]/70 p-4 sm:items-center">
            <button type="button" aria-label={cancelLabel} className="absolute inset-0" onClick={onCancel} />
            <div className="relative w-full max-w-sm border border-white/10 bg-[#141414] p-5">
                <h3 className="text-base font-bold text-white">{title}</h3>
                {message ? <p className="mt-2 text-sm leading-6 text-white/60">{message}</p> : null}
                <div className="mt-5 flex flex-col gap-2">
                    {actions.map((action) => (
                        <button
                            key={action.label}
                            type="button"
                            onClick={action.onSelect}
                            className={`min-h-12 rounded-full text-sm font-black ${action.destructive ? "bg-red-500/90 text-white" : "bg-white/[0.08] text-white"}`}
                        >
                            {action.label}
                        </button>
                    ))}
                    <button type="button" onClick={onCancel} className="min-h-12 rounded-full border border-white/10 text-sm font-bold text-white/80">
                        {cancelLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

/** One line under the toolbar: what an action did, or why it did not. */
function Toast({text, onDone}: {text: string; onDone: () => void}) {
    useEffect(() => {
        const timer = window.setTimeout(onDone, 3600);
        return () => window.clearTimeout(timer);
    }, [onDone, text]);
    return (
        <p role="status" className="fixed inset-x-4 top-4 z-[75] mx-auto max-w-md border border-white/10 bg-[#141414] px-4 py-3 text-center text-sm font-semibold text-white shadow-2xl">
            {text}
        </p>
    );
}

const DELETE_REFUSALS: Record<string, keyof CaptureWords["card"]> = {
    locked_by_sealed_pack: "deleteLockedPack",
    locked_by_trade: "deleteLockedTrade",
    not_owned: "deleteNotOwned",
    not_authenticated: "deleteSignIn"
};

/** Your own card: Card options (Re-analyze, Delete Card). */
export function CaptureCardOptions({
    captureId,
    canReanalyze,
    words = CAPTURE_WORDS_EN
}: {
    captureId: string;
    canReanalyze: boolean;
    words?: CaptureWords;
}) {
    const router = useRouter();
    const card = words.card;
    const [sheet, setSheet] = useState<"reanalyze" | "delete" | null>(null);
    const [busy, setBusy] = useState<"reanalyzing" | "deleting" | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const clearToast = useCallback(() => setToast(null), []);

    const reanalyze = useCallback(async (identityCorrectionRequested: boolean) => {
        setSheet(null);
        setBusy("reanalyzing");
        try {
            const before = await fetch(`/api/app/captures/${encodeURIComponent(captureId)}`, {cache: "no-store"}).then((response) => response.ok ? response.json() : null).catch(() => null);
            const previousCompletedAt: string | null = before?.analysis?.completed_at ?? null;
            const response = await fetch(`/api/app/captures/${encodeURIComponent(captureId)}/analyze`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({identityCorrectionRequested})
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                setToast(captureFailurePresentation(body.failure_code, words.failures).title);
                return;
            }
            // The new answer lands when the analysis row's completion moves.
            for (let attempt = 0; attempt < 60; attempt += 1) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                const read = await fetch(`/api/app/captures/${encodeURIComponent(captureId)}`, {cache: "no-store"}).then((reply) => reply.ok ? reply.json() : null).catch(() => null);
                if (!read) continue;
                if (read.failure_code) {
                    setToast(captureFailurePresentation(read.failure_code, words.failures).title);
                    return;
                }
                const completedAt: string | null = read.analysis?.completed_at ?? null;
                if (completedAt && completedAt !== previousCompletedAt && read.status === "ready") break;
            }
            router.refresh();
        } catch {
            setToast(card.actionFailed);
        } finally {
            setBusy(null);
        }
    }, [captureId, card.actionFailed, router, words.failures]);

    const deleteCard = useCallback(async () => {
        setSheet(null);
        setBusy("deleting");
        try {
            const response = await fetch(`/api/app/captures/${encodeURIComponent(captureId)}/delete`, {method: "POST"});
            const body = await response.json().catch(() => ({}));
            if (!response.ok) {
                const key = DELETE_REFUSALS[String(body.error)];
                setToast(key ? card[key] : card.actionFailed);
                return;
            }
            router.replace("/app/collection");
            router.refresh();
        } catch {
            setToast(card.actionFailed);
        } finally {
            setBusy(null);
        }
    }, [captureId, card, router]);

    const items: MenuItem[] = [
        ...(canReanalyze ? [{key: "reanalyze", label: busy === "reanalyzing" ? card.reanalyzing : card.reanalyze, disabled: busy !== null, action: () => setSheet("reanalyze")}] : []),
        {key: "delete", label: busy === "deleting" ? card.deleting : card.deleteCard, destructive: true, disabled: busy !== null, action: () => setSheet("delete")}
    ];

    return (
        <>
            <Menu label={card.cardOptions} items={items} busy={busy !== null} />
            {sheet === "reanalyze" ? (
                <ConfirmSheet
                    title={card.reanalyzeTitle}
                    message={card.reanalyzeMessage}
                    cancelLabel={card.cancel}
                    onCancel={() => setSheet(null)}
                    actions={[
                        {label: card.reanalyzeNormally, onSelect: () => void reanalyze(false)},
                        {label: card.labelIsWrong, onSelect: () => void reanalyze(true)}
                    ]}
                />
            ) : null}
            {sheet === "delete" ? (
                <ConfirmSheet
                    title={card.deleteTitle}
                    cancelLabel={card.cancel}
                    onCancel={() => setSheet(null)}
                    actions={[{label: card.deleteCapture, destructive: true, onSelect: () => void deleteCard()}]}
                />
            ) : null}
            {busy === "reanalyzing" ? <p role="status" className="sr-only">{card.reanalyzing}</p> : null}
            {toast ? <Toast text={toast} onDone={clearToast} /> : null}
        </>
    );
}

/**
 * Share your own card: the photo with its name where the browser can share
 * files, else a link to the animal's page, copied where nothing can share.
 */
export async function shareCaptureCard(input: {animalName: string; speciesSlug: string; imageSrc: string; words: CaptureWords}): Promise<"shared" | "copied" | "none"> {
    const url = `${window.location.origin}/animals/${encodeURIComponent(input.speciesSlug)}`;
    const text = fillCaptureWords(input.words.card.shareText, {animal: input.animalName});
    try {
        if (typeof navigator.share === "function") {
            let files: File[] | undefined;
            try {
                const blob = await fetch(input.imageSrc).then((response) => response.ok ? response.blob() : null);
                if (blob) {
                    const file = new File([blob], `animaldex-${input.speciesSlug}.jpg`, {type: blob.type || "image/jpeg"});
                    if (navigator.canShare?.({files: [file]})) files = [file];
                }
            } catch {
                files = undefined;
            }
            await navigator.share(files ? {files, title: input.animalName, text, url} : {title: input.animalName, text, url});
            return "shared";
        }
        await navigator.clipboard?.writeText(url);
        return "copied";
    } catch {
        // Dismissed, or nothing to share with: nothing to say.
        return "none";
    }
}

export function CaptureShareButton({
    animalName,
    speciesSlug,
    imageSrc,
    words = CAPTURE_WORDS_EN
}: {
    animalName: string;
    speciesSlug: string;
    imageSrc: string;
    words?: CaptureWords;
}) {
    const card = words.card;
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const clearToast = useCallback(() => setToast(null), []);

    const share = useCallback(async () => {
        if (busy) return;
        setBusy(true);
        const outcome = await shareCaptureCard({animalName, speciesSlug, imageSrc, words});
        if (outcome === "copied") setToast(card.linkCopied);
        setBusy(false);
    }, [animalName, busy, card.linkCopied, imageSrc, speciesSlug, words]);

    return (
        <>
            <button
                type="button"
                onClick={() => void share()}
                disabled={busy}
                aria-label={card.share}
                title={card.share}
                className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-white/[0.06] disabled:opacity-60"
                style={{color: NEON}}
                data-testid="card-share"
            >
                <ShareIcon />
            </button>
            {toast ? <Toast text={toast} onDone={clearToast} /> : null}
        </>
    );
}

/** Someone else's card: Report Capture and Block User (iOS `reportPublicCapture`, `blockSpotter`). */
export function CaptureModerationMenu({
    captureId,
    ownerUserId,
    snapshot,
    words = CAPTURE_WORDS_EN
}: {
    captureId: string;
    ownerUserId: string;
    /** The card's name and scientific name, as iOS files them. */
    snapshot: string;
    words?: CaptureWords;
}) {
    const router = useRouter();
    const card = words.card;
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState<string | null>(null);
    const clearToast = useCallback(() => setToast(null), []);

    const send = useCallback(async (action: "report_capture" | "block") => {
        setBusy(true);
        try {
            const response = await fetch("/api/app/profile/social", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action, profileUserId: ownerUserId, captureId, snapshot, from: "capture"})
            });
            if (!response.ok) {
                setToast(card.actionFailed);
                return;
            }
            setToast(action === "block" ? card.blocked : card.reported);
            if (action === "block") {
                // Their content leaves the feed; so does their card.
                window.setTimeout(() => {
                    if (window.history.length > 1) router.back();
                    else router.push("/app");
                }, 1200);
            }
        } catch {
            setToast(card.actionFailed);
        } finally {
            setBusy(false);
        }
    }, [captureId, card.actionFailed, card.blocked, card.reported, ownerUserId, router, snapshot]);

    return (
        <>
            <Menu
                label={card.moreOptions}
                busy={busy}
                align="right"
                items={[
                    {key: "report", label: card.reportCapture, destructive: true, action: () => void send("report_capture")},
                    {key: "block", label: card.blockUser, destructive: true, action: () => void send("block")}
                ]}
            />
            {toast ? <Toast text={toast} onDone={clearToast} /> : null}
        </>
    );
}
