"use client";

/**
 * The native visual mediums an answer can contain.
 *
 * Ported from `AssistantVisualView` and friends on iOS. Each one replaces the
 * prose that would have described it, which is why they are laid out to be read
 * at a glance rather than studied: a flow is the mechanism, a scale is the
 * too-little / too-much range, the photo is the reader's own picture with one
 * line pointing into it.
 */

import Image from "next/image";
import {askVisualSpokenSummary, type AskVisual} from "@/lib/ask-animaldex/visuals";
import AskVisualChart from "@/components/ask-animaldex/ask-visual-chart";

function VisualFrame({title, summary, children}: {
    title: string | null;
    summary: string;
    children: React.ReactNode;
}) {
    return (
        <figure
            className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
            role="group"
            aria-label={summary}
        >
            {title ? (
                <figcaption className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-300">
                    {title}
                </figcaption>
            ) : null}
            {children}
        </figure>
    );
}

function FlowVisual({spec, summary}: {spec: Extract<AskVisual, {kind: "flow"}>["spec"]; summary: string}) {
    return (
        <VisualFrame title={spec.title} summary={summary}>
            <ol className="flex flex-col">
                {spec.steps.map((step, index) => {
                    const isLast = index === spec.steps.length - 1;
                    return (
                        <li key={`${index}-${step.label}`} className="flex gap-3">
                            <div className="flex w-5 shrink-0 flex-col items-center" aria-hidden="true">
                                <span className="grid h-5 w-5 place-items-center rounded-full border border-primary-400/45 bg-primary-400/12 text-[10px] font-bold text-primary-200">
                                    {index + 1}
                                </span>
                                {!isLast || spec.loops ? (
                                    <span className="my-1 w-px flex-1 bg-gradient-to-b from-primary-400/40 to-primary-400/10" />
                                ) : null}
                            </div>
                            <div className={isLast && !spec.loops ? "pb-0" : "pb-4"}>
                                <p className="text-[14px] font-semibold leading-6 text-white">{step.label}</p>
                                {step.detail ? (
                                    <p className="mt-0.5 text-[13px] leading-5 text-ink-300">{step.detail}</p>
                                ) : null}
                            </div>
                        </li>
                    );
                })}
                {spec.loops ? (
                    <li className="flex items-center gap-3 text-[12px] font-semibold text-primary-200">
                        <span
                            aria-hidden="true"
                            className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-primary-400/45 bg-primary-400/12 text-[11px]"
                        >
                            ↻
                        </span>
                        and the first step starts again
                    </li>
                ) : null}
            </ol>
        </VisualFrame>
    );
}

const SCALE_ZONES = ["low", "balanced", "high"] as const;
const SCALE_LABELS: Record<(typeof SCALE_ZONES)[number], string> = {
    low: "Too little",
    balanced: "Balanced",
    high: "Too much"
};

function ScaleVisual({spec, summary}: {spec: Extract<AskVisual, {kind: "scale"}>["spec"]; summary: string}) {
    return (
        <VisualFrame title={spec.title} summary={summary}>
            <div className="flex flex-col gap-2">
                {SCALE_ZONES.map((zone) => {
                    const isMarked = spec.marker === zone;
                    return (
                        <div
                            key={zone}
                            className={`rounded-xl border px-3 py-2.5 ${
                                isMarked
                                    ? "border-primary-400/45 bg-primary-400/[0.10]"
                                    : "border-white/10 bg-white/[0.02]"
                            }`}
                        >
                            <p
                                className={`text-[10px] font-bold uppercase tracking-[0.16em] ${
                                    isMarked ? "text-primary-200" : "text-ink-400"
                                }`}
                            >
                                {SCALE_LABELS[zone]}
                                {isMarked ? " · this answer" : ""}
                            </p>
                            <p className="mt-1 text-[14px] leading-6 text-ink-100">{spec[zone]}</p>
                        </div>
                    );
                })}
            </div>
        </VisualFrame>
    );
}

/**
 * The reader's own photo, with one line pointing into it.
 *
 * The only image this assistant can honestly show. Nothing is generated: the
 * page supplies the picture and the model supplies only the callout, so it can
 * direct attention but can never invent anatomy the field guide contradicts. No
 * photo on screen means the medium was never offered, so this is a guard rather
 * than a fallback.
 */
function PhotoVisual({callout, photoUrl, photoAlt, summary}: {
    callout: string;
    photoUrl: string | null;
    photoAlt: string;
    summary: string;
}) {
    if (!photoUrl) {
        return (
            <p className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-[14px] leading-6 text-ink-200">
                <span className="mr-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-400">
                    In your photo
                </span>
                {callout}
            </p>
        );
    }

    return (
        <figure className="overflow-hidden rounded-2xl border border-white/10 bg-black/30" aria-label={summary}>
            <div className="relative aspect-[4/3] w-full">
                <Image src={photoUrl} alt={photoAlt} fill sizes="(max-width: 768px) 92vw, 420px" className="object-cover" />
            </div>
            <figcaption className="border-t border-white/10 px-3.5 py-2.5 text-[13px] leading-6 text-ink-100">
                <span className="mr-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-primary-200">
                    Look for
                </span>
                {callout}
            </figcaption>
        </figure>
    );
}

export default function AskVisualView({visual, photoUrl, photoAlt}: {
    visual: AskVisual;
    photoUrl: string | null;
    photoAlt: string;
}) {
    const summary = askVisualSpokenSummary(visual);

    switch (visual.kind) {
        case "flow":
            return <FlowVisual spec={visual.spec} summary={summary} />;
        case "scale":
            return <ScaleVisual spec={visual.spec} summary={summary} />;
        case "chart":
            return <AskVisualChart spec={visual.spec} summary={summary} />;
        case "photo":
            return (
                <PhotoVisual
                    callout={visual.spec.callout}
                    photoUrl={photoUrl}
                    photoAlt={photoAlt}
                    summary={summary}
                />
            );
    }
}
