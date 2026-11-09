"use client";

import {type ReactNode} from "react";
import DebatePost from "@/components/debates/debate-post";
import DebateThread from "@/components/debates/debate-thread";
import {DebateReportSections, DebateRow} from "@/components/debates/debate-views";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {decodeDebate, type Debate} from "@/lib/debates";
import type {CompanionWords} from "@/lib/companion-bond";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const HOST = id(1);
const HOUR = 3600e3;

const SEVEN = [
    {slug: "gray-wolf", animal: "Gray Wolf", nickname: "Luna", power: "Pack Pursuit", mine: true},
    {slug: "european-hedgehog", animal: "European Hedgehog", nickname: "Pip", power: "Curl and Wait", mine: true},
    {slug: "komodo-dragon", animal: "Komodo Dragon", nickname: null, power: "Patient Venom", mine: false},
    {slug: "barn-owl", animal: "Barn Owl", nickname: null, power: "Acoustic Precision", mine: false},
    {slug: "common-octopus", animal: "Common Octopus", nickname: null, power: "Distributed Mind", mine: false},
    {slug: "honey-badger", animal: "Honey Badger", nickname: null, power: "Fearless Persistence", mine: false},
    {slug: "bottlenose-dolphin", animal: "Bottlenose Dolphin", nickname: null, power: "Echo Bonds", mine: false}
];

const participants = (count: number, asker: boolean) => SEVEN.slice(0, count).map((animal, seat) => ({
    participant_id: id(101 + seat),
    capture_id: asker && animal.mine ? (seat === 0 ? HOST : id(11 + seat)) : undefined,
    seat,
    slug: animal.slug,
    animal_name: animal.animal,
    nickname: asker ? animal.nickname : null,
    power_name: animal.power,
    is_asker_owned: asker && animal.mine,
    owner_is_me: asker && animal.mine,
    opening: [
        "Take the lead, and move first. A pack follows the one who is right early, and keeps following while they stay right.",
        "Curl up until you know the ground. Rushing into a role you cannot see the edges of is how you get stepped on.",
        "Wait, watch the team for a month, then strike once with the change that matters most to them.",
        "Listen before you fly. The quiet parts of the team will tell you where the trouble really is.",
        "Try three small things at once and keep whichever one works. Most of thinking is done by the arms.",
        "Say yes and refuse to back down when it gets hard; stubbornness is underrated in a new lead.",
        "Bring the team with you: a lead who keeps everyone talking never has to shout."
    ][seat]
}));

const report = (count: number) => ({
    problem: "Take the team lead role, or stay a designer?",
    recommended_seat: 2,
    recommended_why: "It gives you a month of evidence before the choice is permanent.",
    ways: SEVEN.slice(0, count).map((animal, seat) => ({
        participant_id: id(101 + seat),
        way: ["Take it, and lead from the front.", "Stay put until you know the ground.", "Watch the team for a month, then decide.", "Ask the quiet ones first.", "Run three small trials.", "Say yes and push through.", "Keep everyone talking."][seat],
        lesson: "What its kind does when the ground shifts.",
        fits_when: "you want the say over where the work goes",
        costs: "your quiet design hours",
        fit: [62, 48, 86, 55, 51, 40, 58][seat]
    }))
});

const debate = (raw: Record<string, unknown>) => decodeDebate({
    id: id(900),
    visibility: "public",
    status: "voting",
    is_asker: true,
    host_capture_id: HOST,
    created_at: "2026-11-09T08:00:00Z",
    asked_public: true,
    ...raw
}) as Debate;

let installed = false;
/** The debate the in-thread block reads (`debate_v2`), answered from a fixture: a public vote, its way chosen. */
function installGalleryFetch() {
    if (installed || typeof window === "undefined") return;
    installed = true;
    const real = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        if (url.includes("/api/app/debates?id=")) {
            await new Promise((resolve) => setTimeout(resolve, 400));
            const full = {
                id: id(901), visibility: "public", status: "voting", is_asker: true, turns: [], host_capture_id: HOST, asked_public: true,
                participants: participants(3, true), report: report(3), my_way: id(103),
                voting_deadline_at: new Date(Date.now() + 40 * HOUR).toISOString(), votes_total: 2
            };
            return new Response(JSON.stringify({enabled: true, debate: full}), {status: 200, headers: {"Content-Type": "application/json"}});
        }
        if (url.includes("/api/app/debates")) {
            return new Response(JSON.stringify({ok: true, qualities: []}), {status: 200, headers: {"Content-Type": "application/json"}});
        }
        return real(input, init);
    };
}

function Frame({title, width, height, children}: {title: string; width: number; height?: number; children: ReactNode}) {
    return (
        <section className="flex flex-col gap-2" data-testid={`gallery-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
            <h2 className="max-w-[30rem] text-[11px] font-black uppercase tracking-[0.14em] text-ink-400">{title}</h2>
            <div className="border border-white/10 bg-canvas-950" style={{width, height}}>{children}</div>
        </section>
    );
}

export default function DebatesGalleryClient({words, locale}: {words: CompanionWords; locale: string}) {
    installGalleryFetch();
    const deadline = new Date(Date.now() + 40 * HOUR).toISOString();
    const chosenOther = debate({participants: participants(3, true), report: report(3), my_way: id(103), voting_deadline_at: deadline});
    const chosenOwn = debate({participants: participants(3, true), report: report(3), my_way: id(102), voting_deadline_at: deadline});
    // Back in the host's chat: the row My debates sends (no report, no chosen way); the block reads the rest.
    const listRow = decodeDebate({id: id(901), visibility: "public", status: "voting", role: "asker", participants: participants(3, true), created_at: "2026-11-09T08:00:00Z"}) as Debate;
    const card = (count: number, extra: Record<string, unknown> = {}) => debate({id: id(910 + count), is_asker: false, ...extra, participants: participants(count, false), report: {...report(count), try_first: "Ask for a one-month trial as lead before you decide."}, problem_public: "Someone was offered the lead of their design team after two years. They love the craft but want more say in where the work goes. Should they take it, or stay a designer and grow their influence another way, without losing the parts of the job they love most?", voting_deadline_at: deadline, votes_total: 5, can_vote: true, ...extra});
    return (
        <div className="flex flex-col gap-10 px-6 py-8">
            <h1 className="font-display text-3xl text-white">Debates gallery</h1>

            <div className="flex flex-wrap items-start gap-8">
                <Frame title="B. Chosen way: someone else's animal (the host's step)" width={416}>
                    <div className="p-4">
                        <DebateReportSections debate={chosenOther} words={words} locale={locale} onTryWay={() => undefined} chosenId={id(103)} qualities={[{tagKey: "patience", label: "Patience"}]} />
                    </div>
                </Frame>
                <Frame title="B. Chosen way: their own animal (its own step)" width={416}>
                    <div className="p-4">
                        <DebateReportSections debate={chosenOwn} words={words} locale={locale} onTryWay={() => undefined} chosenId={id(102)} />
                    </div>
                </Frame>
                <Frame title="A. Back in the host's chat: seeded from My debates, the chosen way still marked" width={416}>
                    <div className="p-4">
                        <DebateThread seed={listRow} words={words} typingLabel="typing" locale={locale} chat={{captureId: HOST}} hostFaceUrl={getSpeciesImageRoute("gray-wolf")} />
                    </div>
                </Frame>
            </div>

            <div className="flex flex-wrap items-start gap-8">
                <Frame title="E. Explore card, 7 animals, phone slot (375 × 670)" width={375} height={670}>
                    <DebatePost debate={card(7)} words={words} signedIn locale={locale} />
                </Frame>
                <Frame title="E. Explore card, 7 animals, desktop column (560 × 760)" width={560} height={760}>
                    <DebatePost debate={card(7)} words={words} signedIn locale={locale} />
                </Frame>
                <Frame title="E. Explore card, voted for the 6th animal (kept among the 3), rolled over" width={375} height={670}>
                    <DebatePost debate={card(7, {my_vote: id(106), can_vote: false, rollovers: 1, voting_deadline_at: new Date(Date.now() + 20 * HOUR).toISOString()})} words={words} signedIn locale={locale} />
                </Frame>
                <Frame title="E. Explore card, a small slot (375 × 520): steps down to faces" width={375} height={520}>
                    <DebatePost debate={card(7)} words={words} signedIn locale={locale} />
                </Frame>
            </div>

            <div className="flex flex-wrap items-start gap-8">
                <Frame title="E. Debate rows with 7 and 3 animals (faces +N)" width={375}>
                    <div className="px-5">
                        <DebateRow debate={card(7)} words={words} href="#" />
                        <DebateRow debate={card(3)} words={words} href="#" />
                    </div>
                </Frame>
            </div>
        </div>
    );
}
