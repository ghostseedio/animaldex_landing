"use client";

/**
 * A debate's page shows the step its chosen way became, while it is open
 * (owner, 2026-11-03; iOS d2eb6fa4): opened from the Diary or Debates, the
 * debate showed the chosen way and stopped, with the step's buttons only in
 * the chat. Here it is, as a special message from the animal whose chat
 * holds it (`debateStepOwner`), with the chat's buttons: [I've done it] opens
 * that chat with the message bar on the report; [A different step] drops it
 * and asks that animal for another, as the chat does.
 */

import {useCallback, useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {AskSpecialBubble} from "@/components/ask-animaldex/ask-messenger";
import {AskStepSection} from "@/components/ask-animaldex/ask-special";
import {dropStep, noteOpenStep} from "@/components/companions/use-steps";
import {debateFaceUrl} from "@/components/debates/debate-views";
import {useDebateUpdates} from "@/components/debates/use-debates";
import type {CompanionWords} from "@/lib/companion-bond";
import {debateOpenStepFor, debateStepOwner, type Debate} from "@/lib/debates";
import {decodeOpenSteps, type OpenStepRow} from "@/lib/your-step";
import {stepProblemText} from "@/lib/your-step-words";

/** The open steps across their animals (`animal_open_steps_v1`, through /api/app/steps). Empty when unreadable. */
async function loadOpenSteps(): Promise<OpenStepRow[]> {
    try {
        const response = await fetch("/api/app/steps", {headers: {Accept: "application/json"}, cache: "no-store"});
        const payload = await response.json().catch(() => null) as {steps?: unknown} | null;
        const rows = payload && Array.isArray(payload.steps) ? payload.steps as Array<Record<string, unknown>> : [];
        // The route answers the rows already read; read them again from the server's spelling.
        return decodeOpenSteps(rows.map((row) => ({
            id: row.id,
            step: row.step,
            set_at: row.setAt,
            accepted_at: row.acceptedAt,
            trial_frequency: row.trialFrequency,
            has_report: row.hasReport,
            species_profile_id: row.speciesProfileId,
            capture_id: row.captureId,
            animal: row.animal,
            nickname: row.nickname,
            slug: row.slug
        })));
    } catch {
        return [];
    }
}

export default function DebateOpenStep({debate: seed, words}: {debate: Debate; words: CompanionWords}) {
    const router = useRouter();
    const [debate, setDebate] = useState(seed);
    useDebateUpdates(seed.id, useCallback((next: Debate) => setDebate((current) => ({
        ...current,
        ...next,
        participants: next.participants.length > 0 ? next.participants : current.participants,
        chosenParticipantId: next.chosenParticipantId ?? current.chosenParticipantId
    })), []));
    const [step, setStep] = useState<OpenStepRow | null>(null);
    const [working, setWorking] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);
    const owner = debateStepOwner(debate);

    useEffect(() => {
        if (!debateStepOwner(debate)) {
            setStep(null);
            return;
        }
        let cancelled = false;
        void loadOpenSteps().then((steps) => {
            if (!cancelled) setStep(debateOpenStepFor(debate, steps));
        });
        return () => {
            cancelled = true;
        };
        // Read again when the way chosen changes, never on every copy of the debate.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debate.id, debate.chosenParticipantId]);

    if (!step || !owner) return null;
    const captureId = step.captureId ?? owner.captureId;
    const name = step.nickname?.trim() || step.animal || owner.animal;

    /** I've done it: that animal's chat, with the message bar on the report. */
    const report = () => {
        if (!captureId) return;
        router.push(`/app/capture/${encodeURIComponent(captureId)}?talk=1&step=report`);
    };
    /** A different step: the step goes, and they ask that animal for another in their own words, as the chat does. */
    const other = () => {
        if (working || !captureId) return;
        setWorking(true);
        setProblem(null);
        void dropStep(step).then((result) => {
            setWorking(false);
            // Already gone: asking for another is still right.
            if (!result.ok && result.code !== "step_not_found" && result.code !== "step_not_open") {
                setProblem(stepProblemText(result.code, words));
                return;
            }
            noteOpenStep(step.speciesProfileId, null);
            setStep(null);
            router.push(`/app/capture/${encodeURIComponent(captureId)}?talk=1&step=other`);
        });
    };

    return (
        <div data-testid="debate-open-step">
            <AskSpecialBubble avatarUrl={debateFaceUrl(owner)}>
                <AskStepSection
                    text={step.step}
                    // As its card shows it: nothing told yet, so "I've done it".
                    resolution={{kind: "live", step: {...step, hasReport: false}}}
                    trialFrequency={step.trialFrequency}
                    speciesProfileId={step.speciesProfileId}
                    name={name}
                    words={words}
                    busy={working}
                    problem={problem}
                    onPrimary={report}
                    onOther={other}
                />
            </AskSpecialBubble>
        </div>
    );
}
