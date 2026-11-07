"use client";

import {useCallback, useEffect, useState} from "react";
import type {ChatUseSummary} from "@/lib/chat-uses";
import {AdminPage, Alert, EmptyState, ListSkeleton, PageHeader, RefreshButton, Section, Segmented, Stat, StatGrid, Table, TD, TH} from "@/components/admin/ui";

/**
 * What people use the animal chat for. Each finished conversation (3 hours
 * quiet) gets one label from a small model reading the person's first few
 * messages; "Wants follow-through" counts the ones where they asked for
 * something later: a reminder, a date, a check-in. Admin only.
 */

type Payload = {ok: boolean; error?: string; summary: ChatUseSummary};
type Range = "7" | "14" | "30" | "90";

const LABELS: Record<string, {name: string; hint: string}> = {
    curiosity: {name: "Curiosity", hint: "Asking the animal about itself, its life, what it is like to be it"},
    learning: {name: "Learning", hint: "Facts and explanations about animals, nature or science"},
    problem: {name: "Personal problem", hint: "Something going wrong in their life"},
    decision_or_idea: {name: "Decision or idea", hint: "Choosing between options, or something they want to start"},
    company: {name: "Company", hint: "Chatting, sharing their day, affection"},
    play: {name: "Play", hint: "Role-play, jokes, testing the AI"},
    app_question: {name: "App question", hint: "Credits, Pro, how the app works"},
    hello_only: {name: "Hello only", hint: "A greeting and nothing else"},
    other: {name: "Other", hint: "None of these"},
};

function pct(part: number, whole: number) {
    return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—";
}

function ago(iso: string | null) {
    if (!iso) return "never";
    const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;
    return `${Math.round(minutes / 1440)}d ago`;
}

export default function AdminChatUsesClient() {
    const [range, setRange] = useState<Range>("30");
    const [data, setData] = useState<ChatUseSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/admin/chat-uses?days=${range}`, {cache: "no-store"});
            const payload = (await response.json()) as Payload;
            if (!response.ok || !payload.ok) throw new Error(payload.error || `Request failed (${response.status})`);
            setData(payload.summary);
            setError(null);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not load chat uses");
        } finally {
            setLoading(false);
        }
    }, [range]);

    useEffect(() => {
        void load();
    }, [load]);

    const total = data?.conversations ?? 0;
    const max = Math.max(1, ...(data?.by_label ?? []).map((row) => row.conversations));

    return (
        <AdminPage>
            <PageHeader
                eyebrow="Growth"
                title="Chat uses"
                description="What people talk to the animals for. One label per finished conversation, read from the person's first few messages; no words are stored. Conversations kept on this device only are not counted."
                meta={data ? `Last labelled ${ago(data.newest_labelled_at)} · labels run hourly, 3 hours after a conversation goes quiet` : null}
                actions={
                    <>
                        <Segmented label="Range" value={range} onChange={setRange} options={[{value: "7", label: "7 days"}, {value: "14", label: "14 days"}, {value: "30", label: "30 days"}, {value: "90", label: "90 days"}]} />
                        <RefreshButton loading={loading} onClick={() => void load()} />
                    </>
                }
            />

            {error ? <Alert tone="bad" title="Could not load" className="mt-6">{error}</Alert> : null}

            <Section>
                <StatGrid>
                    <Stat label="Conversations" value={total} loading={loading && !data} />
                    <Stat label="People" value={data?.people ?? 0} loading={loading && !data} />
                    <Stat
                        label="Wants follow-through"
                        value={data ? pct(data.wants_follow_through, total) : "—"}
                        hint={data ? `${data.wants_follow_through} conversations, ${data.wants_follow_through_people} people asked for a reminder, a date or a check-in` : undefined}
                        info="The measure behind building reminders and calendar events: how often people ask for something to happen later."
                        loading={loading && !data}
                    />
                    <Stat label="Top use" value={data?.by_label[0] ? LABELS[data.by_label[0].label]?.name ?? data.by_label[0].label : "—"} hint={data?.by_label[0] ? pct(data.by_label[0].conversations, total) : undefined} loading={loading && !data} />
                </StatGrid>
            </Section>

            <Section title="By use" description="Share of conversations, with who and where.">
                {loading && !data ? (
                    <ListSkeleton rows={6} />
                ) : !data || data.by_label.length === 0 ? (
                    <EmptyState title="No labelled conversations yet" description="Labels appear an hour or so after a conversation has been quiet for 3 hours." />
                ) : (
                    <Table minWidth={760}>
                        <thead>
                            <tr>
                                <TH>Use</TH>
                                <TH className="w-[30%]">Share</TH>
                                <TH numeric>Conversations</TH>
                                <TH numeric>People</TH>
                                <TH numeric>Avg messages</TH>
                                <TH numeric>Follow-through</TH>
                                <TH numeric>App / web</TH>
                                <TH numeric>Front door</TH>
                            </tr>
                        </thead>
                        <tbody>
                            {data.by_label.map((row) => (
                                <tr key={row.label}>
                                    <TD>
                                        <p className="font-bold text-white">{LABELS[row.label]?.name ?? row.label}</p>
                                        <p className="text-[11px] text-ink-500">{LABELS[row.label]?.hint}</p>
                                    </TD>
                                    <TD>
                                        <div className="flex items-center gap-2">
                                            <div className="h-2 flex-1 bg-white/[.04]">
                                                <div className="h-2 bg-primary-400" style={{width: `${(row.conversations / max) * 100}%`}} />
                                            </div>
                                            <span className="w-10 text-right text-xs tabular-nums text-ink-300">{pct(row.conversations, total)}</span>
                                        </div>
                                    </TD>
                                    <TD numeric>{row.conversations}</TD>
                                    <TD numeric>{row.people}</TD>
                                    <TD numeric>{row.avg_messages}</TD>
                                    <TD numeric>{row.wants_follow_through}</TD>
                                    <TD numeric>{row.app} / {row.web}</TD>
                                    <TD numeric>{row.front_door}</TD>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                )}
            </Section>

            {data && data.by_day.length > 0 ? (
                <Section title="By day" description="Conversations started each day (UTC), by use.">
                    <Table minWidth={640}>
                        <thead>
                            <tr>
                                <TH>Day</TH>
                                {data.by_label.map((row) => <TH key={row.label} numeric>{LABELS[row.label]?.name ?? row.label}</TH>)}
                            </tr>
                        </thead>
                        <tbody>
                            {[...data.by_day].reverse().map((day) => (
                                <tr key={day.day}>
                                    <TD className="tabular-nums">{day.day}</TD>
                                    {data.by_label.map((row) => <TD key={row.label} numeric>{day.labels[row.label] ?? 0}</TD>)}
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Section>
            ) : null}
        </AdminPage>
    );
}
