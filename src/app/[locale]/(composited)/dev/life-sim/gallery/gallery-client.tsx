"use client";

import {useMemo, useState, type ReactNode} from "react";
import {AskReplyBubbles, AskUserBubble} from "@/components/ask-animaldex/ask-messenger";
import {AskDoneSection, AskEarnedSection, AskStepSection} from "@/components/ask-animaldex/ask-special";
import {StepReportComposer} from "@/components/companions/step-views";
import {
    ArkBarsPanel,
    ArkRevealMessages,
    ArkRevisionCard,
    ArkScoreCard,
    ArkStepsPowersTiles
} from "@/components/ark/ark-views";
import {arkMoneyFormatter} from "@/components/ark/use-ark";
import ProfileWeeklyStatsCard from "@/app/[locale]/(composited)/u/[handle]/profile-weekly-stats-card";
import {ProfileDiaryTab} from "@/app/[locale]/(composited)/u/[handle]/profile-diary";
import {decodeArkChange, decodeArkStats, type ArkChange, type ArkStats} from "@/lib/ark";
import {decodeAnimalStep, type AnimalStep} from "@/lib/your-step";
import {PROBLEM_DIARY_WORDS_EN, decodeProblemDiary} from "@/lib/problem-diary";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import type {CompanionWords} from "@/lib/companion-bond";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const STEP = id(1);
const FOCUS = id(2);
const SPECIES = id(3);
const FACE = getSpeciesArtworkRoute("komodo-dragon");
const POWER = "Strike First";
/** A Power icon as the icon route answers it (line art in the text colour). */
const POWER_ICON_SVG = '<svg viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="none" stroke="currentColor"/></svg>';

/** A Lesson (contract section 8): the story mentions the real £600; the balance moves by a share. */
const LESSON_ROW = {
    id: id(10),
    kind: "lesson",
    source: "tap",
    step_id: STEP,
    focus_id: FOCUS,
    species_profile_id: SPECIES,
    animal: "Komodo dragon",
    size: "medium",
    changes: [
        {stat: "reputation", before: 22, after: 26, delta: 4},
        {stat: "energy", before: 31, after: 29, delta: -2}
    ],
    money: {before_cents: 120000, after_cents: 114000, delta_cents: -6000},
    experience_delta: 2,
    ark_score: {before: 141, after: 144},
    reaction: "Bold. Let's see what those materials are worth.",
    story: [
        "You buy the lot before anyone else can. The £600 leaves your account by noon.",
        "The boxes fill the hallway. Nothing sells yet, but you're the one who moved first."
    ],
    created_at: "2026-11-09T10:00:00Z"
};

const EARNED_ROW = {
    id: id(11),
    kind: "earned",
    source: "tap",
    step_id: id(4),
    focus_id: id(5),
    species_profile_id: id(6),
    animal: "Javan rhino",
    size: "small",
    changes: [
        {stat: "relationships", before: 24, after: 26, delta: 2},
        {stat: "energy", before: 29, after: 31, delta: 2}
    ],
    money: {before_cents: 114000, after_cents: 116280, delta_cents: 2280},
    experience_delta: 0,
    ark_score: {before: 144, after: 149},
    reaction: "Slow is still forward. I like it.",
    story: ["You ask your sister to lunch, no agenda.", "She talks about her week; you mostly listen."],
    created_at: "2026-11-08T10:00:00Z"
};

const BETTER_ROW = {
    id: id(12),
    kind: "revised",
    source: "chat",
    parent_id: id(10),
    step_id: STEP,
    focus_id: FOCUS,
    species_profile_id: SPECIES,
    animal: "Komodo dragon",
    changes: [],
    money: {before_cents: 114000, after_cents: 117420, delta_cents: 3420},
    experience_delta: 0,
    ark_score: {before: 144, after: 145},
    statement: "I actually got them for £400.",
    chat_message_ref: id(500),
    created_at: "2026-11-10T10:00:00Z"
};

const WORSE_ROW = {
    ...BETTER_ROW,
    id: id(13),
    changes: [{stat: "reputation", before: 26, after: 24, delta: -2}],
    money: {before_cents: 117420, after_cents: 111549, delta_cents: -5871},
    experience_delta: 3,
    ark_score: {before: 145, after: 142},
    statement: "Nobody is buying my candles.",
    created_at: "2026-11-16T10:00:00Z"
};

const SELF_STATS = {
    ark_score: 142,
    is_self: true,
    bars_visible: true,
    bars: {money: {bar: 60, balance_cents: 111549}, relationships: 26, energy: 31, reputation: 24, experience: 5},
    last_changes: {money: {delta: -1, at: "2026-11-16T10:00:00Z"}, reputation: {delta: -2, at: "2026-11-16T10:00:00Z"}, experience: {delta: 3, at: "2026-11-16T10:00:00Z"}},
    steps: {total: 6, worked: 3, partly: 2, didnt_work: 1},
    powers_earned: 4
};

const OTHER_STATS = {...SELF_STATS, is_self: false, bars_visible: false, bars: {money: null, relationships: null, energy: null, reputation: null, experience: 5}};

const DIARY = [
    {
        key: `focus:${FOCUS}`,
        focus_id: FOCUS,
        problem: "Should I spend £600 on materials for my candle business?",
        status: "working",
        started_at: "2026-11-09T09:00:00Z",
        last_at: "2026-11-16T10:00:00Z",
        species_profile_id: SPECIES,
        animal: "Komodo dragon",
        slug: "komodo-dragon",
        steps: [{id: STEP, step: "Buy the materials today", status: "open", set_at: "2026-11-09T09:30:00Z"}],
        ark: {state: "revised", changes: [LESSON_ROW, BETTER_ROW, WORSE_ROW]},
        sensitive: false
    },
    {
        key: `focus:${id(5)}`,
        problem: "My sister and I keep missing each other",
        status: "done",
        started_at: "2026-11-07T09:00:00Z",
        last_at: "2026-11-08T10:00:00Z",
        species_profile_id: id(6),
        animal: "Javan rhino",
        slug: "javan-rhino",
        steps: [{id: id(4), step: "Ask her to lunch, no agenda", status: "done", outcome: "worked", set_at: "2026-11-07T10:00:00Z", done_at: "2026-11-08T10:00:00Z", account: "We went for lunch on Sunday."}],
        ark: {state: "earned", changes: [EARNED_ROW]},
        sensitive: false
    },
    {
        key: `focus:${id(7)}`,
        problem: "Since my dad died I can't focus on anything",
        status: "working",
        last_at: "2026-11-05T10:00:00Z",
        species_profile_id: id(8),
        animal: "Asian elephant",
        slug: "asian-elephant",
        steps: [],
        ark: {state: null, changes: []},
        sensitive: true
    }
];

let installed = false;
let teenMode = false;
/** The Diary's and the Ark's calls, answered from fixtures (this page only, in development). */
function installGalleryFetch() {
    if (installed || typeof window === "undefined") return;
    installed = true;
    const real = window.fetch.bind(window);
    const json = (payload: unknown) => new Response(JSON.stringify(payload), {status: 200, headers: {"Content-Type": "application/json"}});
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        // The route answers decoded entries.
        if (url.includes("/api/animal-power-icons")) {
            const ids = new URL(url, window.location.origin).searchParams.get("ids")?.split(",") ?? [];
            return json({icons: Object.fromEntries(ids.map((one) => [one, POWER_ICON_SVG]))});
        }
        if (url.includes("/api/app/diary")) return json({entries: decodeProblemDiary(DIARY), visibility: teenMode ? "private" : "public", teen: teenMode, ark: true});
        if (url.includes("/api/app/ark") && init?.method === "POST") {
            const body = JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>;
            await new Promise((resolve) => setTimeout(resolve, 350));
            if (body.action === "undo") return json({ok: true, change: {...WORSE_ROW, undone_at: new Date().toISOString()}});
            return json({ok: true, visibility: body.visibility});
        }
        return real(input, init);
    };
}

function Frame({title, width, children}: {title: string; width: number; children: ReactNode}) {
    return (
        <section className="flex flex-col gap-2" data-testid={`gallery-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
            <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-ink-400">{title}</h2>
            <div className="border border-white/10 bg-canvas-950 px-4 py-4" style={{width}}>{children}</div>
        </section>
    );
}

/**
 * The real step card with ONE button (owner, 2026-11-09): "I've done it"
 * sends a report; the animal's reply finishes the step (its done or Power
 * earned section), the step card goes quiet, and the reveal arrives under
 * that reply, headed by the Power.
 */
function LiveStep({words, money, locale, reveal, earnsPower}: {
    words: CompanionWords;
    money: (usd: number) => string;
    locale: string;
    reveal: ArkChange;
    earnsPower: boolean;
}) {
    const offered = decodeAnimalStep({id: STEP, step: "Buy the materials today, before the price goes up."}) as AnimalStep;
    const [state, setState] = useState<"live" | "done" | "closed">("live");
    const [busy, setBusy] = useState(false);
    const [run, setRun] = useState(0);
    const done = () => {
        setBusy(true);
        window.setTimeout(() => {
            setBusy(false);
            setState("done");
            setRun((current) => current + 1);
        }, 400);
    };
    return (
        <div className="flex flex-col">
            <AskReplyBubbles
                plain
                text="Strike while the price is low. Komodos don't wait for the herd to notice the carcass."
                isLive={false}
                avatarUrl={FACE}
                speakerName="Komodo dragon"
                photoUrl={null}
                photoAlt=""
                special={(
                    <AskStepSection
                        text={offered.step}
                        resolution={state === "live" ? {kind: "live", step: offered} : {kind: state}}
                        trialFrequency={null}
                        speciesProfileId={null}
                        name="Komodo dragon"
                        words={words}
                        busy={busy}
                        problem={null}
                        onPrimary={done}
                        onOther={() => setState("closed")}
                        onStartDebate={() => undefined}
                        onAskAnother={{label: "Ask another animal", onClick: () => undefined}}
                    />
                )}
            />
            {state === "done" ? (
                <>
                    <div className="pt-3.5"><AskUserBubble text="Bought the lot this morning. The boxes are in the hallway." label="You" /></div>
                    <div className="pt-3.5">
                        <AskReplyBubbles
                            plain
                            text="You moved before the herd. That is the whole of it."
                            isLive={false}
                            avatarUrl={FACE}
                            speakerName="Komodo dragon"
                            photoUrl={null}
                            photoAlt=""
                            special={earnsPower ? (
                                <AskEarnedSection powerName={POWER} speciesProfileId={SPECIES} name="Komodo dragon" xp={10} words={words} report={null} burst={false} onBurstEnd={() => undefined} shareLabel="Share" onShare={() => undefined} />
                            ) : (
                                <AskDoneSection xp={10} step={offered.step} words={words} shareLabel="Share" onShare={() => undefined} />
                            )}
                        />
                    </div>
                    <ArkRevealMessages
                        key={run}
                        reveal={reveal}
                        power={{name: POWER, speciesProfileId: SPECIES, earnedHere: earnsPower}}
                        fresh
                        reducedMotion={false}
                        faceUrl={FACE}
                        speakerName="Komodo dragon"
                        words={words}
                        money={money}
                        locale={locale}
                    />
                </>
            ) : null}
            {state !== "live" ? (
                <button type="button" className="mt-3 self-start text-[11px] font-bold text-white/50 underline" onClick={() => setState("live")}>
                    reset
                </button>
            ) : null}
        </div>
    );
}

/** The report sheet (the chat's on a narrow screen, the Bond tab's): its proof line says it is optional. */
function ReportSheetButton({words}: {words: CompanionWords}) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" data-testid="open-report-sheet" className="self-start rounded-full border border-white/20 px-4 py-2 text-xs font-bold text-white" onClick={() => setOpen(true)}>
                Open the report sheet
            </button>
            {open ? (
                <StepReportComposer
                    name="Komodo dragon"
                    words={words}
                    sendingLabel="…"
                    closeLabel="Close"
                    onCancel={() => setOpen(false)}
                    onSubmit={async () => {
                        setOpen(false);
                        return null;
                    }}
                />
            ) : null}
        </>
    );
}

export default function LifeSimGalleryClient({words, locale, currency, teen}: {words: CompanionWords; locale: string; currency: string; teen: boolean}) {
    teenMode = teen;
    installGalleryFetch();
    const money = useMemo(() => arkMoneyFormatter(currency, locale), [currency, locale]);
    const lesson = decodeArkChange(LESSON_ROW) as ArkChange;
    const earned = decodeArkChange(EARNED_ROW) as ArkChange;
    const better = decodeArkChange(BETTER_ROW) as ArkChange;
    const worse = decodeArkChange(WORSE_ROW) as ArkChange;
    const self = decodeArkStats(SELF_STATS) as ArkStats;
    const other = decodeArkStats(OTHER_STATS) as ArkStats;
    const [replay, setReplay] = useState(0);
    return (
        <div className="flex flex-col gap-10 px-6 py-8">
            <h1 className="font-display text-3xl text-white">Life Sim gallery</h1>

            <div className="flex flex-wrap items-start gap-8">
                <Frame title="Step, one button (I've done it: Power earned)" width={416}>
                    <LiveStep words={words} money={money} locale={locale} reveal={earned} earnsPower />
                </Frame>
                <Frame title="Step, one button (I've done it: a later step)" width={416}>
                    <LiveStep words={words} money={money} locale={locale} reveal={earned} earnsPower={false} />
                </Frame>
                <Frame title="Step, one button (I've done it: a Lesson)" width={416}>
                    <LiveStep words={words} money={money} locale={locale} reveal={lesson} earnsPower={false} />
                </Frame>
                <Frame title="Report sheet" width={416}>
                    <ReportSheetButton words={words} />
                </Frame>
            </div>

            <div className="flex flex-wrap items-start gap-8">
                <Frame title="Reveal, Lesson, playing" width={416}>
                    <button type="button" className="mb-2 text-[11px] font-bold text-white/50 underline" onClick={() => setReplay((n) => n + 1)}>replay</button>
                    <ArkRevealMessages key={replay} reveal={lesson} power={{name: POWER, speciesProfileId: SPECIES, earnedHere: false}} fresh reducedMotion={false} faceUrl={FACE} speakerName="Komodo dragon" words={words} money={money} locale={locale} />
                </Frame>
                <Frame title="Reveal, Earned, thread reopened" width={416}>
                    <ArkRevealMessages reveal={earned} power={{name: "Slow Charge", speciesProfileId: id(6), earnedHere: true}} fresh={false} reducedMotion={false} faceUrl={getSpeciesArtworkRoute("javan-rhino")} speakerName="Javan rhino" words={words} money={money} locale={locale} />
                </Frame>
                <Frame title="Reveal, numbers alone (no story yet)" width={416}>
                    <ArkRevealMessages reveal={{...earned, story: [], reaction: null}} power={{name: POWER, speciesProfileId: SPECIES, earnedHere: false}} fresh={false} reducedMotion={false} faceUrl={FACE} speakerName="Komodo dragon" words={words} money={money} locale={locale} />
                </Frame>
            </div>

            <div className="flex flex-wrap items-start gap-8">
                <Frame title="Revision under the message, better" width={416}>
                    <AskUserBubble text="I actually got them for £400." label="You" />
                    <ArkRevisionCard revision={better} animate words={words} money={money} locale={locale} />
                </Frame>
                <Frame title="Revision under the message, worse" width={416}>
                    <AskUserBubble text="Nobody is buying my candles." label="You" />
                    <ArkRevisionCard revision={worse} animate words={words} money={money} locale={locale} />
                </Frame>
                <Frame title="Revision, undone" width={416}>
                    <AskUserBubble text="Nobody is buying my candles." label="You" />
                    <ArkRevisionCard revision={{...worse, undoneAt: "2026-11-17T00:00:00Z"}} animate={false} words={words} money={money} locale={locale} />
                </Frame>
            </div>

            <div className="flex flex-wrap items-start gap-8">
                <Frame title="Profile Stats, your own" width={416}>
                    <div className="-mx-4 -my-4">
                        <ArkScoreCard stats={self} words={words.ark} locale={locale} />
                        <ArkBarsPanel stats={self} words={words.ark} money={money} locale={locale} />
                        <ArkStepsPowersTiles steps={self.steps} powersEarned={self.powersEarned} words={words.ark} locale={locale} onOpenDiary={() => undefined} />
                        <ProfileWeeklyStatsCard
                            arkWords={words.ark}
                            week={{
                                currentStart: "2026-11-10",
                                currentEnd: "2026-11-16",
                                captures: 3,
                                newSpecies: 1,
                                collectorPoints: 0,
                                previousCaptures: 2,
                                previousNewSpecies: 0,
                                daily: [],
                                ark: {steps: 3, previousSteps: null, arkScoreChange: -2, powers: 1, previousPowers: null}
                            }}
                        />
                    </div>
                </Frame>
                <Frame title="Profile Stats, someone else, private diary" width={416}>
                    <div className="-mx-4 -my-4">
                        <ArkScoreCard stats={other} words={words.ark} locale={locale} />
                        <ArkBarsPanel stats={other} words={words.ark} money={money} locale={locale} />
                        <ArkStepsPowersTiles steps={other.steps} powersEarned={other.powersEarned} words={words.ark} locale={locale} />
                    </div>
                </Frame>
                <Frame title={teen ? "Diary, teen" : "Diary, your own"} width={416}>
                    <div className="-mx-4 -my-4">
                        <ProfileDiaryTab words={PROBLEM_DIARY_WORDS_EN} companionWords={words} locale={locale} displayCurrency={currency} />
                    </div>
                </Frame>
            </div>
        </div>
    );
}
