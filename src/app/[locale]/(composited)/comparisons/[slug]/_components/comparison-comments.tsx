"use client";

import {useCallback, useMemo, useState} from "react";
import Link from "@/app/[locale]/_components/link";
import type {ComparisonComment} from "@/data/comparison-engagement";
import {useHeaderAuth} from "@/app/[locale]/(composited)/_components/header-auth-provider";

export type ComparisonCommentsCopy = {
    eyebrow: string;
    title: string;
    description: string;
    placeholder: string;
    submit: string;
    submitting: string;
    signedOutPrompt: string;
    signIn: string;
    empty: string;
    delete: string;
    report: string;
    reported: string;
    errorMessage: string;
    rateLimitMessage: string;
    tooShort: string;
    remaining: string;
    linksStrippedHint: string;
};

type ComparisonCommentsProps = {
    slug: string;
    signInHref: string;
    isSignedIn: boolean;
    initialComments: ComparisonComment[];
    maxLength: number;
    copy: ComparisonCommentsCopy;
};

function initialsFor(name: string) {
    return name.trim().charAt(0).toUpperCase() || "A";
}

export default function ComparisonComments({
    slug,
    signInHref,
    isSignedIn,
    initialComments,
    maxLength,
    copy
}: ComparisonCommentsProps) {
    const {session} = useHeaderAuth();
    const signedIn = isSignedIn || Boolean(session.user);
    const [comments, setComments] = useState(initialComments);
    const [draft, setDraft] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [reported, setReported] = useState<string[]>([]);

    const remaining = useMemo(() => maxLength - draft.length, [draft.length, maxLength]);

    const submit = useCallback(async () => {
        const body = draft.trim();
        if (body.length < 2) {
            setError(copy.tooShort);
            return;
        }

        setBusy(true);
        setError(null);

        try {
            const response = await fetch("/api/comparisons/comments", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({slug, body})
            });

            if (!response.ok) {
                setError(response.status === 429 ? copy.rateLimitMessage : copy.errorMessage);
                return;
            }

            const payload = (await response.json()) as {comments?: ComparisonComment[]};
            if (payload.comments) setComments(payload.comments);
            setDraft("");
        } catch {
            setError(copy.errorMessage);
        } finally {
            setBusy(false);
        }
    }, [copy.errorMessage, copy.rateLimitMessage, copy.tooShort, draft, slug]);

    const remove = useCallback(async (id: string) => {
        setBusy(true);
        try {
            const response = await fetch(
                `/api/comparisons/comments?id=${encodeURIComponent(id)}&slug=${encodeURIComponent(slug)}`,
                {method: "DELETE"}
            );
            if (!response.ok) {
                setError(copy.errorMessage);
                return;
            }
            const payload = (await response.json()) as {comments?: ComparisonComment[]};
            if (payload.comments) setComments(payload.comments);
        } catch {
            setError(copy.errorMessage);
        } finally {
            setBusy(false);
        }
    }, [copy.errorMessage, slug]);

    const report = useCallback(async (id: string) => {
        setReported((current) => [...current, id]);
        try {
            await fetch("/api/comparisons/comments/report", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({commentId: id})
            });
        } catch {
            // The optimistic "reported" state is good enough here.
        }
    }, []);

    return (
        <section id="comments" className="scroll-mt-28 space-y-6">
            <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-primary-200">{copy.eyebrow}</p>
                <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-5xl">{copy.title}</h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-ink-200">{copy.description}</p>
            </div>

            {signedIn ? (
                <div className="rounded-3xl border border-line-300 bg-surface-900/60 p-5 md:p-6">
                    <label className="block">
                        <span className="sr-only">{copy.placeholder}</span>
                        <textarea
                            value={draft}
                            onChange={(event) => setDraft(event.target.value.slice(0, maxLength))}
                            placeholder={copy.placeholder}
                            rows={4}
                            className="w-full resize-y rounded-2xl border border-white/10 bg-black/25 p-4 text-base leading-6 text-white outline-none placeholder:text-ink-400 focus:border-primary-400/60"
                        />
                    </label>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-ink-400">
                            {copy.remaining.replace("{count}", String(remaining))} · {copy.linksStrippedHint}
                        </span>
                        <button
                            type="button"
                            onClick={submit}
                            disabled={busy || draft.trim().length < 2}
                            className="rounded-full bg-primary-400 px-6 py-2.5 text-sm font-bold text-black transition hover:bg-primary-300 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                            {busy ? copy.submitting : copy.submit}
                        </button>
                    </div>
                    {error ? <p className="mt-3 text-sm font-semibold text-amber-300">{error}</p> : null}
                </div>
            ) : (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line-300 bg-surface-900/60 p-5 md:p-6">
                    <p className="text-base text-ink-200">{copy.signedOutPrompt}</p>
                    <Link
                        href={signInHref}
                        className="rounded-full bg-primary-400 px-6 py-2.5 text-sm font-bold text-black transition hover:bg-primary-300"
                    >
                        {copy.signIn}
                    </Link>
                </div>
            )}

            {comments.length ? (
                <ol className="space-y-4">
                    {comments.map((comment) => (
                        <li key={comment.id} className="rounded-3xl border border-line-300 bg-white/[0.025] p-5">
                            <div className="flex items-start gap-3">
                                {comment.authorAvatarUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={comment.authorAvatarUrl}
                                        alt=""
                                        loading="lazy"
                                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                                    />
                                ) : (
                                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-400/20 font-bold text-primary-100">
                                        {initialsFor(comment.authorName)}
                                    </span>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-baseline gap-x-2">
                                        {comment.authorUsername ? (
                                            <Link
                                                href={`/u/${comment.authorUsername}`}
                                                className="font-bold text-white hover:text-primary-100"
                                            >
                                                {comment.authorName}
                                            </Link>
                                        ) : (
                                            <span className="font-bold text-white">{comment.authorName}</span>
                                        )}
                                        <time dateTime={comment.createdAt} className="text-xs text-ink-400">
                                            {new Date(comment.createdAt).toLocaleDateString()}
                                        </time>
                                    </div>
                                    <p className="mt-2 whitespace-pre-line text-base leading-7 text-ink-200">{comment.body}</p>
                                    <div className="mt-3 flex gap-4 text-xs font-semibold">
                                        {comment.isOwn || Boolean(session.username && comment.authorUsername === session.username) ? (
                                            <button
                                                type="button"
                                                onClick={() => remove(comment.id)}
                                                disabled={busy}
                                                className="text-ink-400 transition hover:text-amber-300 disabled:opacity-50"
                                            >
                                                {copy.delete}
                                            </button>
                                        ) : signedIn ? (
                                            <button
                                                type="button"
                                                onClick={() => report(comment.id)}
                                                disabled={reported.includes(comment.id)}
                                                className="text-ink-500 transition hover:text-amber-300 disabled:text-ink-500"
                                            >
                                                {reported.includes(comment.id) ? copy.reported : copy.report}
                                            </button>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="rounded-3xl border border-line-300 bg-white/[0.02] px-6 py-10 text-center text-ink-300">
                    {copy.empty}
                </p>
            )}
        </section>
    );
}
