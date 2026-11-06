"use client";

/**
 * DEV ONLY: the Companions roster, drawn by the real page from fixtures
 * (every row kind: an unread message, an open step, a conversation, animals
 * never talked to), so it can be looked at without a session. The page's
 * four reads are answered here; nothing reaches the server.
 *
 * `?frontDoor=1` adds the Talk front door (AnimalDex
 * docs/talk-front-door/SPEC.md), as the page shows it with its switch on:
 * its suggestion is answered here too, from the draft's words ("sleep" is
 * the Koala they work on it with, "boss" or "work" the Wolf they were just
 * talking to, anything else the Fox's lesson, with a wild Octopus and Owl
 * to change to), after a short wait like the server's.
 */

import {useEffect, useState} from "react";
import CompanionsPage, {type CompanionsFrontDoor} from "@/app/[locale]/(authenticated)/app/companions/companions-page";
import {AppShellChromeContext} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";
import {APP_SHELL_WORDS_EN} from "@/lib/app-shell-words";
import type {CompanionWords} from "@/lib/companion-bond";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const WOLF = id(1);
const FOX = id(2);
const KOALA = id(3);
const OTTER = id(4);
const OWL = id(5);
const BEE = id(6);
const HEDGEHOG = id(7);

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

/** `animal_companions_v1`, in the server's order. */
const COMPANIONS = [
    {species_profile_id: WOLF, capture_id: id(11), slug: "gray-wolf", animal: "Gray Wolf", nickname: "Luna", level: 4, stage: "working_together", power: {name: "Pack Pursuit", earned: true}, unread: 1, last_activity: minutesAgo(12)},
    {species_profile_id: FOX, capture_id: id(12), slug: "red-fox", animal: "Red Fox", nickname: null, level: 2, stage: "getting_to_know_you", power: {name: "Cunning", earned: false}, open_trial: "Walk the long way home once this week", last_activity: minutesAgo(60 * 26)},
    {species_profile_id: KOALA, capture_id: id(13), slug: "koala", animal: "Koala", nickname: "Mo", level: 1, stage: "met", power: {name: "Eucalyptus Selectivity", earned: false}, focus: "Sleep", last_activity: minutesAgo(60 * 5)},
    {species_profile_id: OTTER, capture_id: id(14), slug: "cheetah", animal: "Cheetah", nickname: null, level: 3, stage: "trusted", power: {name: "Spring-Loaded Spine", earned: true}, last_activity: minutesAgo(60 * 24 * 3)},
    {species_profile_id: OWL, capture_id: id(15), slug: "little-owl", animal: "Little Owl", nickname: null, level: 1, stage: "met", power: {name: "Still Watching", earned: false}, last_activity: null},
    {species_profile_id: BEE, capture_id: id(16), slug: "western-honey-bee", animal: "Western Honey Bee", nickname: null, level: 1, stage: "met", power: {name: "Hive Mind", earned: false}, last_activity: null},
    {species_profile_id: HEDGEHOG, capture_id: id(17), slug: "european-hedgehog", animal: "European Hedgehog", nickname: "Pip", level: 1, stage: "met", power: {name: "Curl and Wait", earned: false}, last_activity: null}
];

const CARDS = COMPANIONS.map((row, index) => ({
    capture_id: row.capture_id,
    species_profile_id: row.species_profile_id,
    animal: row.animal,
    nickname: row.nickname,
    slug: row.slug,
    captured_at: minutesAgo(60 * 24 * (index + 2))
}));

/** `animal_conversations`: the animals that wrote, and the ones talked to. */
const CONVERSATIONS = [
    {species_profile_id: WOLF, capture_id: id(11), animal_name: "Gray Wolf", nickname: "Luna", last_message_id: "m1", last_message_body: "Did you speak first in the meeting, or wait for the room?", last_message_at: minutesAgo(12), last_talked_at: minutesAgo(60 * 3), unread_count: 1, muted: false, talked_days: 6},
    {species_profile_id: FOX, capture_id: id(12), animal_name: "Red Fox", nickname: null, last_message_id: "m2", last_message_body: "A fox takes the long way when the short one is watched.", last_message_at: minutesAgo(60 * 26), last_talked_at: minutesAgo(60 * 26), unread_count: 0, muted: false, talked_days: 2},
    {species_profile_id: KOALA, capture_id: id(13), animal_name: "Koala", nickname: "Mo", last_message_id: "m3", last_message_body: "I found a **warm** branch. Did you find yours?", last_message_at: minutesAgo(60 * 5), last_talked_at: minutesAgo(60 * 5), unread_count: 0, muted: true, talked_days: 3},
    {species_profile_id: OTTER, capture_id: id(14), animal_name: "Cheetah", nickname: null, last_message_id: "m4", last_message_body: "Speed is nothing without the stop. Where did you brake today?", last_message_at: minutesAgo(60 * 24 * 3), last_talked_at: minutesAgo(60 * 24 * 3), unread_count: 0, muted: false, talked_days: 1}
];

const STEPS = [
    {id: id(91), species_profile_id: FOX, capture_id: id(12), animal: "Red Fox", nickname: null, slug: "red-fox", step: "Walk the long way home once this week", status: "open", accepted_at: minutesAgo(60 * 20)}
];

/** `talk_suggest` (SPEC 6.1) for the draft, as the server answers it, with the website's slugs. */
function gallerySuggestion(text: string) {
    const ownCandidate = (row: typeof COMPANIONS[number]) => ({
        species_profile_id: row.species_profile_id,
        capture_id: row.capture_id,
        animal: row.animal,
        nickname: row.nickname,
        power_name: row.power.name,
        kind: "own",
        slug: row.slug
    });
    const wild = [
        {species_profile_id: id(21), capture_id: null, animal: "Common Octopus", nickname: null, power_name: "Many Minds", kind: "wild", slug: "common-octopus"},
        {species_profile_id: id(22), capture_id: null, animal: "Orca", nickname: null, power_name: "Pod Echo", kind: "wild", slug: "orca"}
    ];
    const [wolf, fox, koala] = COMPANIONS;
    const lower = text.toLowerCase();
    const [pick, why, also] = lower.includes("sleep")
        ? [koala, "focus", [ownCandidate(wolf)]]
        : lower.includes("boss") || lower.includes("work")
            ? [wolf, "continuing", [ownCandidate(fox), wild[0]]]
            : [fox, "lesson", [wild[0]]];
    return {pick: ownCandidate(pick), why, also, picked_by: "model", candidates: [...COMPANIONS.map(ownCandidate), ...wild]};
}

let installed = false;
function installGalleryFetch() {
    if (installed || typeof window === "undefined") return;
    installed = true;
    const real = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        const json = (payload: unknown) => new Response(JSON.stringify(payload), {status: 200, headers: {"Content-Type": "application/json"}});
        if (url.includes("/api/app/companions/cards")) return json({cards: CARDS, available: true});
        if (url.includes("/api/app/companions")) return json({companions: COMPANIONS, available: true});
        if (url.includes("/api/ask/animal-messages")) return json({conversations: CONVERSATIONS, available: true});
        if (url.includes("/api/app/steps")) return json({steps: STEPS});
        if (url.includes("/api/app/talk-suggest")) {
            const body = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {text?: string};
            await new Promise((resolve) => setTimeout(resolve, 600));
            return json({ok: true, suggestion: gallerySuggestion(body.text ?? "")});
        }
        return real(input, init);
    };
}

export default function CompanionsGalleryClient({words, locale, frontDoor = null}: {words: CompanionWords; locale: string; frontDoor?: CompanionsFrontDoor | null}) {
    const [ready, setReady] = useState(false);
    useEffect(() => {
        installGalleryFetch();
        setReady(true);
    }, []);
    if (!ready) return null;
    return (
        <AppShellChromeContext.Provider value={{isAuthenticated: true, unreadCount: 0, unreadMessageCount: 0, words: APP_SHELL_WORDS_EN, toggleMenu: () => undefined, setBottomNavHidden: () => undefined}}>
            {/* The app shell's own ground: pinned dark, the list width of /app. */}
            <div className="theme-dark min-h-screen bg-black text-white">
                <div className="mx-auto w-full max-w-[92rem] px-4 py-7 sm:px-7 lg:px-10 lg:py-10" data-testid="companions-gallery">
                    <CompanionsPage words={words} locale={locale} frontDoor={frontDoor} />
                </div>
            </div>
        </AppShellChromeContext.Provider>
    );
}
