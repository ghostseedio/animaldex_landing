"use client";

import {useCallback, useEffect, useState} from "react";
import type {FeedbackPollResult} from "@/lib/feedback-polls";
import {AdminPage, Alert, Badge, EmptyState, ListSkeleton, PageHeader, RefreshButton, Section, Stat, StatGrid, Table, TD, TH} from "@/components/admin/ui";

/**
 * Feedback polls in Discover (AnimalDex 20261201100000): what people answered.
 * Polls are rows in public.feedback_polls, served once per feed session, at
 * most one new poll per person per 20 hours. Answers carry the user id only;
 * this page shows counts and the free text, never who wrote it. Admin only.
 */

type Payload = {ok?: boolean; error?: string; polls?: FeedbackPollResult[]};

const TOPICS: Record<string, string> = {
    build_next: "What to build next",
    broken: "What feels broken",
    favourite_animals: "Favourite animals",
    other: "Other"
};

const STATUS_TONE = {live: "good", scheduled: "warn", inactive: "neutral", closed: "neutral"} as const;

function pct(part: number, whole: number) {
    return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

function when(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("en-GB", {day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"});
}

function PollResults({poll}: {poll: FeedbackPollResult}) {
    return (
        <Section
            title={<span className="flex flex-wrap items-center gap-2">{poll.title} <Badge tone={STATUS_TONE[poll.status]}>{poll.status}</Badge></span>}
            description={`${TOPICS[poll.topic] ?? poll.topic} · ${poll.slug} · ${poll.surfaces.join(" + ")} · priority ${poll.priority}${poll.starts_at || poll.ends_at ? ` · ${when(poll.starts_at)} → ${when(poll.ends_at)}` : ""}${poll.languages.length ? ` · translated: ${poll.languages.join(", ")}` : " · English only"}`}
        >
            <StatGrid>
                <Stat label="Answers" value={poll.answers} hint={poll.last_answer_at ? `Last ${when(poll.last_answer_at)}` : undefined} />
                <Stat label="Shown to" value={poll.served} hint="People it was served to" />
                <Stat label="Answer rate" value={pct(poll.answers, poll.served)} />
                <Stat label="Not now" value={poll.dismissed} hint={pct(poll.dismissed, poll.served)} />
            </StatGrid>
            <div className="mt-4 flex flex-col gap-4">
                {poll.questions.map((question) => {
                    const max = Math.max(1, ...question.options.map((option) => option.count));
                    return (
                        <Table key={question.id} minWidth={560}>
                            <thead>
                                <tr>
                                    <TH>{question.prompt} <span className="font-medium normal-case tracking-normal text-ink-500">· {question.multiple ? "choose any" : "choose one"} · {question.answered} answered</span></TH>
                                    <TH className="w-[40%]">Share</TH>
                                    <TH numeric>Count</TH>
                                </tr>
                            </thead>
                            <tbody>
                                {question.options.map((option) => (
                                    <tr key={option.id}>
                                        <TD className="font-bold text-white">{option.label}</TD>
                                        <TD>
                                            <div className="flex items-center gap-2">
                                                <div className="h-2 flex-1 bg-white/[.04]">
                                                    <div className="h-2 bg-primary-400" style={{width: `${(option.count / max) * 100}%`}} />
                                                </div>
                                                <span className="w-10 text-right text-xs tabular-nums text-ink-300">{pct(option.count, question.answered)}</span>
                                            </div>
                                        </TD>
                                        <TD numeric>{option.count}</TD>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    );
                })}
                {poll.free_text_prompt ? (
                    <Table minWidth={560}>
                        <thead>
                            <tr>
                                <TH>{poll.free_text_prompt} <span className="font-medium normal-case tracking-normal text-ink-500">· {poll.free_text.length} written{poll.free_text.length >= 500 ? " (newest 500)" : ""}</span></TH>
                                <TH className="w-44">When</TH>
                            </tr>
                        </thead>
                        <tbody>
                            {poll.free_text.length === 0 ? (
                                <tr><TD className="text-ink-500">Nothing written yet.</TD><TD /></tr>
                            ) : poll.free_text.map((entry, index) => (
                                <tr key={`${entry.at}-${index}`}>
                                    <TD className="whitespace-pre-wrap break-words text-ink-100">{entry.text}</TD>
                                    <TD className="tabular-nums text-ink-400">{when(entry.at)}</TD>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                ) : null}
            </div>
        </Section>
    );
}

export default function AdminFeedbackPollsClient() {
    const [polls, setPolls] = useState<FeedbackPollResult[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/admin/feedback-polls", {cache: "no-store"});
            const payload = (await response.json()) as Payload;
            if (!response.ok || !payload.ok) throw new Error(payload.error || `Request failed (${response.status})`);
            setPolls(payload.polls ?? []);
            setError(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not load feedback polls");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const live = polls?.filter((poll) => poll.status === "live").length ?? 0;
    const answers = polls?.reduce((sum, poll) => sum + poll.answers, 0) ?? 0;

    return (
        <AdminPage>
            <PageHeader
                eyebrow="Growth"
                title="Feedback polls"
                description="Questions asked in Discover, at most one per feed session. Answers are stored with the account only (no device or location); this page shows counts and the written answers, never who wrote them. Polls start switched off: turn one on with an UPDATE on public.feedback_polls (is_active, optional starts_at / ends_at)."
                actions={<RefreshButton loading={loading} onClick={() => void load()} />}
            />

            {error ? <Alert tone="bad" title="Could not load" className="mt-6">{error}</Alert> : null}

            <Section>
                <StatGrid>
                    <Stat label="Polls" value={polls?.length ?? 0} loading={loading && !polls} />
                    <Stat label="Live now" value={live} tone={live ? "good" : undefined} loading={loading && !polls} />
                    <Stat label="Answers" value={answers} loading={loading && !polls} />
                </StatGrid>
            </Section>

            {loading && !polls ? (
                <Section><ListSkeleton rows={6} /></Section>
            ) : polls && polls.length === 0 ? (
                <Section><EmptyState title="No polls yet" description="Add a row to public.feedback_polls; it shows here straight away." /></Section>
            ) : (
                (polls ?? []).map((poll) => <PollResults key={poll.id} poll={poll} />)
            )}
        </AdminPage>
    );
}
