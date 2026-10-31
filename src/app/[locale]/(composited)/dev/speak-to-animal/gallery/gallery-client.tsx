"use client";

import {useEffect, useState, type ReactNode} from "react";
import {AskReplyBubbles, AskSpecialBubble, AskTypingBubble} from "@/components/ask-animaldex/ask-messenger";
import {AskDebateOfferSection} from "@/components/ask-animaldex/ask-special";
import DebateSetup from "@/components/debates/debate-sheet";
import {DebateQuietSection, DebateReportSections, DebateTurnMessage} from "@/components/debates/debate-views";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {decodeDebate, type Debate} from "@/lib/debates";
import type {CompanionWords} from "@/lib/companion-bond";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const HOST = id(1);
const LONE_HOST = id(2);
const WOLF = getSpeciesImageRoute("gray-wolf");

/** A rich answer, as the rules lay it out: verdict, emoji headings, steps, a table and one diagram. */
export const RICH_SAMPLE = [
    "Take it, but not the way they offered it. A wolf doesn't lead by being handed the front; it leads by **moving first and being right**.",
    "",
    "## 🐺 What I would do",
    "1. **Ask for a trial month** before you say yes, so you lead on probation, not on faith.",
    "2. **Pick one person to learn from**: a lead you trust, once a week.",
    "3. **Keep one design task** of your own, so you don't lose the craft.",
    "",
    "## ⚖️ The two ways",
    "| Way | Gives | Costs |",
    "|---|---|---|",
    "| **Stay a designer** | Calm, mastery | The bigger say |",
    "| **Lead the team** | Direction, growth | Your quiet hours |",
    "",
    "```text",
    "THE FORK",
    "┌─────────────┐     ┌──────────────┐",
    "│ STAY        │     │ LEAD         │",
    "│ safe, quiet │ ←─→ │ scary, yours │",
    "└─────────────┘     └──────────────┘",
    "        ↓ a month on trial ↓",
    "     you find out which it is",
    "```",
    "",
    "Scared is how the front of the pack feels. It doesn't mean **go back**."
].join("\n");

function candidates(visibility: string, host: string) {
    const own = [
        {capture_id: id(11), owner_is_me: true, slug: "european-hedgehog", animal: "European Hedgehog", nickname: "Pip", power_name: "Curl and Wait", fits: true, hearts: 3},
        {capture_id: id(12), owner_is_me: true, slug: "cheetah", animal: "Cheetah", power_name: "Spring-Loaded Spine", fits: true, hearts: 3},
        {capture_id: id(13), owner_is_me: true, slug: "groundhog", animal: "Groundhog", power_name: "Burrow First", fits: false, hearts: 3},
        ...Array.from({length: 7}, (_, index) => ({capture_id: id(30 + index), owner_is_me: true, slug: ["red-fox", "koala", "barn-owl", "common-octopus", "gray-wolf", "honey-badger", "bottlenose-dolphin"][index], animal: ["Red Fox", "Koala", "Barn Owl", "Common Octopus", "Gray Wolf", "Honey Badger", "Bottlenose Dolphin"][index], power_name: ["Cunning", "Eucalyptus Selectivity", "Acoustic Precision", "Distributed Mind", "Pack Pursuit", "Fearless Persistence", "Echo Bonds"][index], fits: false, hearts: 3}))
    ];
    const others = [
        {capture_id: id(21), owner_is_me: false, slug: "komodo-dragon", animal: "Komodo Dragon", power_name: "Patient Venom", fits: true, hearts: 3},
        {capture_id: id(22), owner_is_me: false, slug: "western-honey-bee", animal: "Western Honey Bee", power_name: "Hive Mind", fits: false, hearts: 3}
    ];
    if (visibility === "public") return host === LONE_HOST ? own.slice(0, 3) : [...own.slice(0, 3), ...others];
    return own;
}

let installed = false;
/** The debate calls the setup makes, answered from fixtures (this page only, in development). */
function installGalleryFetch() {
    if (installed || typeof window === "undefined") return;
    installed = true;
    const real = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("/api/app/debates") && init?.method === "POST") {
            const body = JSON.parse(String(init.body ?? "{}")) as Record<string, string>;
            const payload = body.action === "candidates" ? {ok: true, candidates: candidates(body.visibility, body.hostCaptureId)} : {ok: true};
            return new Response(JSON.stringify(payload), {status: 200, headers: {"Content-Type": "application/json"}});
        }
        return real(input, init);
    };
}

const participants = [
    {participant_id: id(101), capture_id: HOST, seat: 0, slug: "gray-wolf", animal_name: "Gray Wolf", nickname: "Luna", power_name: "Pack Pursuit", is_asker_owned: true, owner_is_me: true, votes: 4},
    {participant_id: id(102), capture_id: id(11), seat: 1, slug: "european-hedgehog", animal_name: "European Hedgehog", nickname: "Pip", power_name: "Curl and Wait", is_asker_owned: true, owner_is_me: true, votes: 2},
    {participant_id: id(103), seat: 2, slug: "komodo-dragon", animal_name: "Komodo Dragon", power_name: "Patient Venom", votes: 5}
];
const report = {
    problem: "Take the team lead role, or stay a designer?",
    try_first: "Ask for a one-month trial as lead before you decide.",
    ways: [
        {participant_id: id(101), way: "Take it, and lead from the front by moving first.", lesson: "A pack follows the one who moves first and is right.", fits_when: "you want the say over where the work goes", costs: "your quiet design hours"},
        {participant_id: id(102), way: "Stay put until you know the ground.", lesson: "Curling up keeps you safe while danger passes.", fits_when: "the role came too fast to judge", costs: "the chance may go to someone else"},
        {participant_id: id(103), way: "Wait, watch, then strike once.", lesson: "One sure bite beats ten quick ones.", fits_when: "you can watch the team for a month first", costs: "time, and patience others may lack"}
    ]
};
const debate = (raw: Record<string, unknown>) => decodeDebate({id: id(900), visibility: "private", status: "private_done", is_asker: true, host_capture_id: HOST, participants, ...raw}) as Debate;

function Frame({title, width, children}: {title: string; width: number; children: ReactNode}) {
    return (
        <section className="flex flex-col gap-2" data-testid={`gallery-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
            <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-ink-400">{title}</h2>
            <div className="border border-white/10 bg-canvas-950 px-4 py-4" style={{width}}>{children}</div>
        </section>
    );
}

export default function TalkGalleryClient({words}: {words: CompanionWords; locale: string}) {
    installGalleryFetch();
    const [theme, setTheme] = useState<string | null>(null);
    useEffect(() => {
        const wanted = new URLSearchParams(window.location.search).get("theme");
        if (wanted) document.documentElement.setAttribute("data-theme", wanted);
        setTheme(wanted);
    }, []);
    const host = {captureId: HOST, name: "Luna", speciesProfileId: null, powerEarned: true, hearts: 3};
    const setup = (extra: Partial<Parameters<typeof DebateSetup>[0]> = {}) => (
        <AskSpecialBubble avatarUrl={WOLF}>
            <DebateSetup
                layout="section"
                host={host}
                problem="Should I take the team lead role, or stay a designer?"
                words={words}
                closeLabel="Close"
                optedIn
                onStarted={() => undefined}
                onClose={() => undefined}
                onEdit={() => undefined}
                {...extra}
            />
        </AskSpecialBubble>
    );
    const quiet = debate({status: "debating"});
    const publicVoting = debate({visibility: "public", status: "voting", report, voting_deadline_at: new Date(Date.now() + 5 * 3600e3).toISOString(), vote_counts: {[id(101)]: 4, [id(102)]: 2, [id(103)]: 5}, total_votes: 11});
    return (
        <div className="flex flex-col gap-10 px-6 py-8" data-theme-applied={theme ?? "dark"}>
            <h1 className="font-display text-3xl text-white">Rich chat and debates gallery</h1>

            <div className="flex flex-wrap items-start gap-8">
                <Frame title="Rich answer, drawer" width={416}>
                    <AskReplyBubbles text={RICH_SAMPLE} isLive={false} avatarUrl={WOLF} speakerName="Luna" photoUrl={null} photoAlt="" />
                </Frame>
                <Frame title="Rich answer, Talk page" width={760}>
                    <AskReplyBubbles text={RICH_SAMPLE} isLive={false} avatarUrl={WOLF} speakerName="Luna" photoUrl={null} photoAlt="" />
                </Frame>
                <Frame title="Rich answer, arriving" width={416}>
                    <AskReplyBubbles text={RICH_SAMPLE.slice(0, RICH_SAMPLE.indexOf("│ safe"))} isLive avatarUrl={WOLF} speakerName="Luna" photoUrl={null} photoAlt="" />
                </Frame>
            </div>

            <div className="flex flex-wrap items-start gap-8">
                <Frame title="Debate offer" width={416}>
                    <AskReplyBubbles
                        text="A hedgehog would tell you the opposite: curl up and wait it out. Want to hear what Pip thinks?"
                        isLive={false}
                        avatarUrl={WOLF}
                        speakerName="Luna"
                        photoUrl={null}
                        photoAlt=""
                        special={<AskDebateOfferSection words={words} disabled={false} onYes={() => undefined} onNotNow={() => undefined} />}
                    />
                </Frame>
                <Frame title="Setup, private" width={416}>{setup({named: [{captureId: id(13), speciesProfileId: null, animal: "Groundhog", nickname: null}]})}</Frame>
                <Frame title="Setup, public" width={416}>{setup({initialVisibility: "public"})}</Frame>
                <Frame title="Setup, public, only yours" width={416}>{setup({initialVisibility: "public", host: {...host, captureId: LONE_HOST}})}</Frame>
                <Frame title="Setup, public, Power not earned" width={416}>{setup({initialVisibility: "public", host: {...host, powerEarned: false}})}</Frame>
                <Frame title="Setup, from a call, no question yet" width={416}>{setup({fromCall: true, problem: ""})}</Frame>
                <Frame title="Setup, approving the public text" width={416}>
                    {setup({approving: debate({visibility: "public", status: "approving", problem_public: "Someone was offered a team lead role and is scared of managing people. Take it, or stay a designer?", credits_for_winner: 9, stakes: true})})}
                </Frame>
            </div>

            <div className="flex flex-wrap items-start gap-8">
                <Frame title="Started, quiet in place" width={416}>
                    <AskSpecialBubble avatarUrl={WOLF}><DebateQuietSection debate={quiet} words={words} /></AskSpecialBubble>
                </Frame>
                <Frame title="Turns" width={416}>
                    <div className="flex flex-col">
                        <DebateTurnMessage participant={quiet.participants[1]} text={"I'd stay curled up for now.\n\nThe role came fast. Fast things are often traps."} />
                        <div className="pt-3.5"><DebateTurnMessage participant={quiet.participants[2]} text="Watch the team for a month. Then strike once." /></div>
                        <div className="pt-3.5"><DebateTurnMessage participant={quiet.participants[0]} text="" typingLabel="typing…" /></div>
                    </div>
                </Frame>
                <Frame title="Writing the report" width={416}>
                    <div className="flex flex-col gap-1">
                        <AskTypingBubble avatarUrl={WOLF} label={words.debate.writingReport} />
                        <p className="pl-9 text-[11px] font-semibold text-white/50">{words.debate.writingReport}</p>
                    </div>
                </Frame>
                <Frame title="Report, drawer" width={416}>
                    <AskSpecialBubble avatarUrl={WOLF}>
                        <DebateReportSections debate={debate({report})} words={words} onTryWay={() => undefined} />
                    </AskSpecialBubble>
                </Frame>
                <Frame title="Report, chosen" width={416}>
                    <AskSpecialBubble avatarUrl={WOLF}>
                        <DebateReportSections debate={debate({report})} words={words} onTryWay={() => undefined} chosenId={id(103)} />
                    </AskSpecialBubble>
                </Frame>
                <Frame title="Report and vote, Talk page" width={760}>
                    <AskSpecialBubble avatarUrl={WOLF}>
                        <DebateReportSections debate={publicVoting} words={words} onTryWay={() => undefined} />
                    </AskSpecialBubble>
                </Frame>
                <Frame title="Vote, settled" width={416}>
                    <AskSpecialBubble avatarUrl={WOLF}>
                        <DebateReportSections debate={debate({visibility: "public", status: "settled", winner_participant_id: id(103), vote_counts: {[id(101)]: 4, [id(102)]: 2, [id(103)]: 9}, total_votes: 15})} words={words} />
                    </AskSpecialBubble>
                </Frame>
            </div>
        </div>
    );
}
