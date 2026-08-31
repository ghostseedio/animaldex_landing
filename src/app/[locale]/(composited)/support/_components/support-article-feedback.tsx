"use client";

import {useState} from "react";
import {
    CheckCircleIcon,
    HelpCircleIcon,
    LifeBuoyIcon,
    MessageCircleIcon,
    ThumbsDownIcon,
    ThumbsUpIcon
} from "@/app/[locale]/_components/icons";

type FeedbackStats = {
    helpfulCount: number;
    unhelpfulCount: number;
    helpfulnessPercent: number | null;
};

type SupportArticleFeedbackProps = {
    articleId: string;
    yesLabel: string;
    noLabel: string;
    prompt: string;
    thanksYes: string;
    thanksNo: string;
    stillStuckLabel: string;
    escalationDescription: string;
    talkToSupportLabel: string;
    talkToSupportHref: string;
    statsSummaryTemplate: string;
    statsFirstLabel: string;
    initialStats: FeedbackStats;
};

function formatStatsSummary(template: string, helpful: number, total: number) {
    return template.replace("{helpful}", helpful.toLocaleString()).replace("{total}", total.toLocaleString());
}

export default function SupportArticleFeedback({
    articleId,
    yesLabel,
    noLabel,
    prompt,
    thanksYes,
    thanksNo,
    stillStuckLabel,
    escalationDescription,
    talkToSupportLabel,
    talkToSupportHref,
    statsSummaryTemplate,
    statsFirstLabel,
    initialStats
}: SupportArticleFeedbackProps) {
    const [state, setState] = useState<"idle" | "yes" | "no" | "submitting">("idle");
    const [stats, setStats] = useState(initialStats);
    const highlightEscalation = state === "no";
    const totalVotes = stats.helpfulCount + stats.unhelpfulCount;
    const helpfulPercent = stats.helpfulnessPercent ?? 0;

    async function submit(helpful: boolean) {
        if (state !== "idle") return;
        setState("submitting");

        try {
            const response = await fetch("/api/support/feedback", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({articleId, helpful, source: "article-page"})
            });

            const payload = await response.json() as {
                ok?: boolean;
                stats?: FeedbackStats;
            };

            if (!response.ok || !payload.ok) throw new Error("Feedback failed");

            if (payload.stats) {
                setStats(payload.stats);
            }

            setState(helpful ? "yes" : "no");
        } catch {
            setState("idle");
        }
    }

    return (
        <section aria-labelledby="article-feedback-title" className="overflow-hidden rounded-[1.35rem] border border-white/[0.07] bg-[#071B0F]/85">
            <div className="border-b border-white/[0.06] px-5 py-6 md:px-7 md:py-7">
                <div className="flex items-start gap-4">
                    <span
                        aria-hidden="true"
                        className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary-200/25 bg-primary-400/8 text-primary-200"
                    >
                        <HelpCircleIcon size={22} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 id="article-feedback-title" className="font-display text-xl font-bold uppercase tracking-[0.04em] text-white md:text-2xl">
                            {prompt}
                        </h2>

                        <div className="mt-2 space-y-2">
                            {totalVotes > 0 ? (
                                <>
                                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-300">
                                        <ThumbsUpIcon size={15} className="shrink-0 text-primary-200/80" aria-hidden="true" />
                                        <span>{formatStatsSummary(statsSummaryTemplate, stats.helpfulCount, totalVotes)}</span>
                                        {stats.helpfulnessPercent !== null ? (
                                            <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-primary-200">
                                                {stats.helpfulnessPercent}%
                                            </span>
                                        ) : null}
                                    </p>
                                    <div
                                        aria-hidden="true"
                                        className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"
                                    >
                                        <div
                                            className="h-full rounded-full bg-primary-400/80 transition-[width] duration-500"
                                            style={{width: `${helpfulPercent}%`}}
                                        />
                                    </div>
                                </>
                            ) : (
                                <p className="text-sm text-ink-400">{statsFirstLabel}</p>
                            )}
                        </div>

                        {state === "idle" || state === "submitting" ? (
                            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    disabled={state === "submitting"}
                                    onClick={() => void submit(true)}
                                    className="group flex min-h-[3.25rem] items-center justify-center gap-2.5 rounded-2xl border border-primary-200/30 bg-primary-400/6 px-5 font-display text-xs font-bold uppercase tracking-[0.12em] text-primary-200 transition-[background-color,border-color,transform] hover:border-primary-200/55 hover:bg-primary-400/12 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200 disabled:opacity-60"
                                >
                                    <ThumbsUpIcon size={18} className="shrink-0 transition-transform group-hover:-translate-y-0.5" />
                                    {yesLabel}
                                </button>
                                <button
                                    type="button"
                                    disabled={state === "submitting"}
                                    onClick={() => void submit(false)}
                                    className="group flex min-h-[3.25rem] items-center justify-center gap-2.5 rounded-2xl border border-white/[0.1] bg-white/[0.02] px-5 font-display text-xs font-bold uppercase tracking-[0.12em] text-ink-200 transition-[background-color,border-color] hover:border-white/[0.18] hover:bg-white/[0.04] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200 disabled:opacity-60"
                                >
                                    <ThumbsDownIcon size={18} className="shrink-0 transition-transform group-hover:translate-y-0.5" />
                                    {noLabel}
                                </button>
                            </div>
                        ) : (
                            <div
                                className={`mt-5 flex items-start gap-3 rounded-2xl border px-4 py-4 ${
                                    state === "yes"
                                        ? "border-primary-200/25 bg-primary-400/8"
                                        : "border-white/[0.08] bg-white/[0.02]"
                                }`}
                                role="status"
                            >
                                <span
                                    aria-hidden="true"
                                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                        state === "yes" ? "bg-primary-400/15 text-primary-200" : "bg-white/[0.06] text-ink-300"
                                    }`}
                                >
                                    <CheckCircleIcon size={18} />
                                </span>
                                <p className="pt-1 text-base leading-relaxed text-ink-100">{state === "yes" ? thanksYes : thanksNo}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div
                className={`relative px-5 py-6 md:px-7 md:py-7 ${
                    highlightEscalation
                        ? "bg-[radial-gradient(ellipse_80%_120%_at_0%_50%,rgba(33,192,94,0.12),transparent_70%)]"
                        : "bg-[#0A2112]/60"
                }`}
            >
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-4 left-0 w-px bg-gradient-to-b from-transparent via-primary-200/35 to-transparent"
                />

                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-4 sm:max-w-[62%]">
                        <span
                            aria-hidden="true"
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
                                highlightEscalation
                                    ? "border-primary-200/35 bg-primary-400/12 text-primary-200 shadow-[0_0_24px_rgba(33,192,94,0.12)]"
                                    : "border-white/[0.08] bg-[#071B0F]/80 text-primary-200/90"
                            }`}
                        >
                            <LifeBuoyIcon size={22} />
                        </span>
                        <div className="space-y-1.5">
                            <h3 className="font-display text-lg font-bold uppercase tracking-[0.04em] text-white md:text-xl">
                                {stillStuckLabel}
                            </h3>
                            <p className="text-sm leading-relaxed text-ink-300 md:text-base">{escalationDescription}</p>
                        </div>
                    </div>

                    <a
                        href={talkToSupportHref}
                        className={`group inline-flex min-h-[3.1rem] shrink-0 items-center justify-center gap-2.5 rounded-full px-6 font-display text-xs font-bold uppercase tracking-[0.12em] transition-[background-color,border-color,transform] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200 sm:min-w-[15rem] ${
                            highlightEscalation
                                ? "bg-primary-400 text-canvas-950 hover:bg-primary-200"
                                : "border border-primary-200/30 bg-primary-400/10 text-primary-200 hover:border-primary-200/50 hover:bg-primary-400/16 hover:text-white"
                        }`}
                    >
                        <MessageCircleIcon size={18} className="shrink-0" />
                        <span>{talkToSupportLabel}</span>
                        <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">→</span>
                    </a>
                </div>
            </div>
        </section>
    );
}
