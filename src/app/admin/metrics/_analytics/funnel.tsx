"use client";

import { Badge, Card, CardContent, CardHeader, InfoTip, TD, TH, Table } from "@/components/admin/ui";
import type { WebFunnelChipKind, WebFunnelStep } from "@/lib/web-funnel";
import { num, pct, share } from "./format";
import type { AnalyticsResponse } from "./types";

const STEP_LABELS: Record<WebFunnelStep["event"], { label: string; info: string }> = {
  demo_start: { label: "Started talking", info: "Sent a first message to an animal: a hero chip, or their own words in a chat." },
  demo_reply: { label: "Got a reply", info: "The first reply came back." },
  second_message: { label: "Second message", info: "Sent a second message, in the demo's chat or any other." },
  share_take: { label: "Shared a take", info: "Shared an animal's reply." },
  signup: { label: "Signed up", info: "Made an account on the web (Google or Apple sign-in) within half an hour of the callback." },
  store_click: { label: "Tapped a store link", info: "Went to the App Store or Google Play from any page." },
};

const START_LABELS: Record<WebFunnelChipKind, string> = { idea: "Idea chips", problem: "Problem chip", typed: "Own words", suggested: "A suggestion" };

/** The CMO's two-week test (agent-reports/cmo-reframe.md): what "validated" looks like. */
const GOALS = { lift: 1.5, ideaShare: 40, shareOfReplies: 5 };

function lift(a: number | null, b: number | null) {
  if (a === null || b === null || a === 0) return "—";
  return `×${Math.round((b / a) * 100) / 100}`;
}

/** The home hero A/B test, by variant, on the Acquisition tab. */
export function HeroFunnel({ funnel }: { funnel: AnalyticsResponse["funnel"] }) {
  const [a, b] = funnel.variants;
  const starts = (kind: WebFunnelChipKind) => b.starts[kind];
  const bStarts = (["idea", "problem", "typed", "suggested"] as const).reduce((sum, kind) => sum + starts(kind), 0);
  const ideaShare = share(starts("idea"), bStarts);
  return (
    <Card>
      <CardHeader
        title="Hero test · front-door funnel"
        description={`Home visitors by hero: A is the talking octopus, B the split card with the lion's live take. People, not events: each step counts a visitor once, after they first saw that hero in this range. New visitors get B ${funnel.splitB}% of the time (HERO_VARIANT_SPLIT). At about 1,000 visitors per arm, trust a difference of 50% or more.`}
        action={
          funnel.note ? null : (
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={funnel.demoStartLift !== null && funnel.demoStartLift >= GOALS.lift ? "good" : "neutral"}>
                Start lift {funnel.demoStartLift === null ? "—" : `×${funnel.demoStartLift}`} · goal ×{GOALS.lift}
              </Badge>
              <Badge tone={ideaShare !== null && ideaShare >= GOALS.ideaShare ? "good" : "neutral"}>
                Ideas {pct(ideaShare)} of B starts · goal {GOALS.ideaShare}%
              </Badge>
              <Badge tone={b.shareOfReplies !== null && b.shareOfReplies >= GOALS.shareOfReplies ? "good" : "neutral"}>
                B shares {pct(b.shareOfReplies)} of replies · goal {GOALS.shareOfReplies}%
              </Badge>
            </div>
          )
        }
      />
      {funnel.note ? (
        <CardContent>
          <p className="text-sm text-ink-400">{funnel.note}</p>
        </CardContent>
      ) : (
        <Table minWidth={720}>
          <thead>
            <tr>
              <TH>Step</TH>
              <TH numeric>A · current hero</TH>
              <TH numeric>of A&apos;s viewers</TH>
              <TH numeric>B · split card</TH>
              <TH numeric>of B&apos;s viewers</TH>
              <TH numeric>B vs A</TH>
            </tr>
          </thead>
          <tbody>
            <tr className="hover:bg-white/[.02]">
              <TD className="font-bold text-white">Saw the hero</TD>
              <TD numeric className="font-bold text-white">{num(a.viewers)}</TD>
              <TD numeric className="text-ink-400">—</TD>
              <TD numeric className="font-bold text-white">{num(b.viewers)}</TD>
              <TD numeric className="text-ink-400">—</TD>
              <TD numeric className="text-ink-400">{a.viewers + b.viewers > 0 ? `${pct(share(b.viewers, a.viewers + b.viewers))} B` : "—"}</TD>
            </tr>
            {a.steps.map((stepA, index) => {
              const stepB = b.steps[index];
              const words = STEP_LABELS[stepA.event];
              return (
                <tr key={stepA.event} className="hover:bg-white/[.02]">
                  <TD>
                    <span className="inline-flex items-center gap-1.5 font-bold text-white">
                      {words.label}
                      <InfoTip>{words.info}</InfoTip>
                    </span>
                  </TD>
                  <TD numeric>{num(stepA.visitors)}</TD>
                  <TD numeric className="text-ink-300">{pct(stepA.rate)}</TD>
                  <TD numeric>{num(stepB.visitors)}</TD>
                  <TD numeric className="text-ink-300">{pct(stepB.rate)}</TD>
                  <TD numeric className="text-ink-300">{lift(stepA.rate, stepB.rate)}</TD>
                </tr>
              );
            })}
            <tr>
              <TD className="text-ink-300">What started it</TD>
              {[a, b].map((variant) => {
                const total = (["idea", "problem", "typed", "suggested"] as const).reduce((sum, kind) => sum + variant.starts[kind], 0);
                return (
                  <TD key={variant.variant} colSpan={2} numeric className="text-xs text-ink-400">
                    {total === 0
                      ? "—"
                      : (["idea", "problem", "typed", "suggested"] as const)
                          .filter((kind) => variant.starts[kind] > 0)
                          .map((kind) => `${START_LABELS[kind]} ${pct(share(variant.starts[kind], total))}`)
                          .join(" · ")}
                  </TD>
                );
              })}
              <TD />
            </tr>
          </tbody>
        </Table>
      )}
    </Card>
  );
}
