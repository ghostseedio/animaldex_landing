"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import Link from "@/app/[locale]/_components/link";

export type ComparisonGeneratingCopy = {
    eyebrow: string;
    title: string;
    description: string;
    steps: string[];
    elapsedLabel: string;
    errorTitle: string;
    errorDescription: string;
    rateLimitTitle: string;
    rateLimitDescription: string;
    retryLabel: string;
    browseLabel: string;
};

type ComparisonGeneratingProps = {
    /** Locale-prefixed `/comparisons` base, resolved on the server. */
    basePath: string;
    slug: string;
    animalAName: string;
    animalBName: string;
    animalAArtwork: string;
    animalBArtwork: string;
    copy: ComparisonGeneratingCopy;
};

const STEP_INTERVAL_MS = 9000;
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 4 * 60 * 1000;

export default function ComparisonGenerating({
    basePath,
    slug,
    animalAName,
    animalBName,
    animalAArtwork,
    animalBArtwork,
    copy
}: ComparisonGeneratingProps) {
    const router = useRouter();
    const [status, setStatus] = useState<"working" | "error" | "rate-limited">("working");
    const [stepIndex, setStepIndex] = useState(0);
    const [seconds, setSeconds] = useState(0);
    const [attempt, setAttempt] = useState(0);
    const startedRef = useRef(false);

    const finish = useCallback((readySlug: string) => {
        // The canonical row may live under the reversed pair slug.
        if (readySlug !== slug) {
            router.replace(`${basePath}/${readySlug}`);
            return;
        }

        // The row is ready but this view re-mounts on every refresh; stop after
        // a few attempts instead of looping against a stale cache.
        const refreshKey = `animaldex:comparison-refresh:${slug}`;
        const refreshes = Number.parseInt(window.sessionStorage.getItem(refreshKey) ?? "0", 10) || 0;
        if (refreshes >= 3) {
            window.sessionStorage.removeItem(refreshKey);
            setStatus("error");
            return;
        }
        window.sessionStorage.setItem(refreshKey, String(refreshes + 1));
        router.refresh();
    }, [basePath, router, slug]);

    const generate = useCallback(async () => {
        setStatus("working");
        setStepIndex(0);
        setSeconds(0);

        let settled = false;
        const startedAt = Date.now();

        // Generation can outlive the serverless function that kicked it off, so
        // the POST is a trigger and this poll is the source of truth.
        const poll = async (): Promise<boolean> => {
            try {
                const response = await fetch(
                    `/api/comparisons/generate?slug=${encodeURIComponent(slug)}`,
                    {cache: "no-store"}
                );
                if (!response.ok) return false;
                const payload = (await response.json()) as {status?: string; slug?: string};
                if (payload.status === "ready" && payload.slug) {
                    settled = true;
                    finish(payload.slug);
                    return true;
                }
            } catch {
                // Transient: the next tick tries again.
            }
            return false;
        };

        const pollTimer = window.setInterval(async () => {
            if (settled) {
                window.clearInterval(pollTimer);
                return;
            }
            if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
                window.clearInterval(pollTimer);
                if (!settled) {
                    settled = true;
                    setStatus("error");
                }
                return;
            }
            if (await poll()) window.clearInterval(pollTimer);
        }, POLL_INTERVAL_MS);

        try {
            const response = await fetch("/api/comparisons/generate", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({slug})
            });

            if (settled) return;

            if (response.status === 429) {
                settled = true;
                window.clearInterval(pollTimer);
                setStatus("rate-limited");
                return;
            }

            if (response.ok) {
                const payload = (await response.json()) as {status?: string; slug?: string};
                if (payload.status === "ready" && payload.slug) {
                    settled = true;
                    window.clearInterval(pollTimer);
                    finish(payload.slug);
                    return;
                }
            }

            // 4xx on the pair itself is terminal; anything else (timeout, 5xx,
            // gateway cut-off) may still be finishing upstream — keep polling.
            if (response.status >= 400 && response.status < 500) {
                settled = true;
                window.clearInterval(pollTimer);
                setStatus("error");
            }
        } catch {
            // Network drop or function timeout: the poll keeps watching.
        }
    }, [finish, slug]);

    useEffect(() => {
        // React 18 double-invokes effects in dev; only pay for one generation.
        if (startedRef.current && attempt === 0) return;
        startedRef.current = true;
        void generate();
    }, [attempt, generate]);

    useEffect(() => {
        if (status !== "working") return;
        const stepTimer = window.setInterval(() => {
            setStepIndex((index) => Math.min(index + 1, copy.steps.length - 1));
        }, STEP_INTERVAL_MS);
        const secondTimer = window.setInterval(() => setSeconds((value) => value + 1), 1000);
        return () => {
            window.clearInterval(stepTimer);
            window.clearInterval(secondTimer);
        };
    }, [copy.steps.length, status]);

    const failed = status === "error" || status === "rate-limited";

    return (
        <main className="mx-auto flex w-full max-w-[52rem] flex-col items-center px-4 py-20 text-center md:py-28">
            <div className="flex w-full items-center justify-center gap-4 md:gap-8">
                <figure className="flex flex-col items-center gap-3">
                    <span className={`relative h-24 w-24 overflow-hidden rounded-2xl border border-white/12 bg-surface-800/70 md:h-32 md:w-32 ${status === "working" ? "animate-pulse" : ""}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={animalAArtwork} alt="" className="h-full w-full object-cover" />
                    </span>
                    <figcaption className="max-w-[9rem] truncate text-sm font-bold text-white">{animalAName}</figcaption>
                </figure>

                <span className="font-display text-4xl font-black italic tracking-[-0.08em] text-primary-200 md:text-6xl" aria-hidden="true">VS</span>

                <figure className="flex flex-col items-center gap-3">
                    <span className={`relative h-24 w-24 overflow-hidden rounded-2xl border border-white/12 bg-surface-800/70 md:h-32 md:w-32 ${status === "working" ? "animate-pulse" : ""}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={animalBArtwork} alt="" className="h-full w-full object-cover" />
                    </span>
                    <figcaption className="max-w-[9rem] truncate text-sm font-bold text-white">{animalBName}</figcaption>
                </figure>
            </div>

            {failed ? (
                <>
                    <h1 className="mt-10 font-display text-3xl font-bold text-white md:text-4xl">
                        {status === "rate-limited" ? copy.rateLimitTitle : copy.errorTitle}
                    </h1>
                    <p className="mt-3 max-w-[34rem] text-base leading-7 text-ink-200">
                        {status === "rate-limited" ? copy.rateLimitDescription : copy.errorDescription}
                    </p>
                    <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                        {status === "error" ? (
                            <button
                                type="button"
                                onClick={() => setAttempt((value) => value + 1)}
                                className="rounded-full bg-primary-400 px-6 py-3 text-sm font-bold text-black transition hover:bg-primary-300"
                            >
                                {copy.retryLabel}
                            </button>
                        ) : null}
                        <Link
                            href="/comparisons"
                            className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-ink-200 transition hover:border-white/35 hover:text-white"
                        >
                            {copy.browseLabel}
                        </Link>
                    </div>
                </>
            ) : (
                <>
                    <p className="mt-10 text-xs font-bold uppercase tracking-[0.24em] text-primary-200">{copy.eyebrow}</p>
                    <h1 className="mt-3 font-display text-3xl font-bold text-white md:text-4xl">{copy.title}</h1>
                    <p className="mt-3 max-w-[34rem] text-base leading-7 text-ink-200">{copy.description}</p>

                    <div className="mt-9 w-full max-w-[26rem]" role="status" aria-live="polite">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                            <div className="h-full w-1/3 animate-[comparisonProgress_1.6s_ease-in-out_infinite] rounded-full bg-primary-400" />
                        </div>
                        <p className="mt-4 text-sm font-semibold text-white">{copy.steps[stepIndex]}</p>
                        <p className="mt-1 text-xs text-ink-400">{copy.elapsedLabel.replace("{seconds}", String(seconds))}</p>
                    </div>

                    <style>{"@keyframes comparisonProgress{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}"}</style>
                </>
            )}
        </main>
    );
}
