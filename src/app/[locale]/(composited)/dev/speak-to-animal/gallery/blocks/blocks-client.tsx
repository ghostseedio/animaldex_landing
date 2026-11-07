"use client";

import {useEffect} from "react";
import {AskReplyBubbles, AskUserBubble} from "@/components/ask-animaldex/ask-messenger";
import {AnimalChatBlockContext, type AnimalChatBlockContextValue} from "@/components/ask-animaldex/animal-chat-blocks";
import {decodeAnimalTrial, type AnimalTrial} from "@/lib/animal-trials";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import examples from "@/lib/trial-motion/__fixtures__/examples.json";

/**
 * The fixture replies stand in for the model, and the chat's animal is
 * supplied here as the chat will supply it: Luna, a Gray Wolf, with three
 * Trials whose loops are the spec's gold examples and a stand-in Power icon.
 * Nothing is fetched for them.
 */

const PAGES = ["richidea", "richideaplain", "chatloop", "chatloopplain", "chatimage", "chatimageplain", "chatnothing"] as const;
type ChatBlocksGalleryPage = (typeof PAGES)[number];

const WOLF_ID = "00000000-0000-4000-8000-00000000a001";
const WOLF_FACE = getSpeciesImageRoute("gray-wolf");

function board(key: string): unknown {
    return (examples as Array<{key: string; storyboard: unknown}>).find((example) => example.key === key)?.storyboard ?? null;
}

function trial(frequency: "LOW" | "MID" | "HIGH", title: string, instructions: string, storyboardKey: string): AnimalTrial {
    return decodeAnimalTrial({
        species_profile_id: WOLF_ID,
        frequency,
        species_display_name: "Gray Wolf",
        title,
        instructions,
        motion_storyboard: board(storyboardKey)
    }) as AnimalTrial;
}

/** The apps' gallery Trials (YourStepGalleryFixtures.trials): the loops are the spec's gold examples. */
const TRIALS: AnimalTrial[] = [
    trial("LOW", "Flat Squat Against Loaded Spring", "Hold a flat squat for five seconds, then drop and spring straight back out. Compare how far each one carried you.", "cheetah-LOW"),
    trial("MID", "The Two-Tree Rule", "Count everything open on your plate, close all but two, and finish those two before you open anything else.", "koala-MID"),
    trial("HIGH", "The Dance That Sends Others", "Pick one find that is genuinely useful, say it as exact directions, and send it to the group.", "honeybee-MID")
];

/** A stand-in Power icon: a paw of four pads and a palm, in the icons' 24 × 24 units. */
const PAW_ICON = '<svg viewBox="0 0 24 24"><circle cx="6" cy="9" r="2"/><circle cx="10" cy="5" r="2"/><circle cx="14" cy="5" r="2"/><circle cx="18" cy="9" r="2"/><path d="M8 16c0-2.5 1.8-4.5 4-4.5s4 2 4 4.5c0 2-1.6 3-4 3s-4-1-4-3z"/></svg>';

const CONTEXT: AnimalChatBlockContextValue = {
    speciesProfileId: WOLF_ID,
    animalName: "Luna",
    trials: TRIALS,
    powerIconSvg: PAW_ICON
};

const IDEA_QUESTION = "I'm thinking of starting a small Sunday running club in my neighbourhood.";
const IDEA_WORDS = "Start it, but not as a club. A pack doesn't form because someone puts up a sign; it forms around whoever keeps running the same trail at the same hour.";
const IDEA_SKETCH = [
    "```text",
    "HOW A PACK FORMS",
    "┌──────────────┐    ┌──────────────┐",
    "│ YOU RUN THE  │ →  │ ONE NEIGHBOUR│",
    "│ SAME ROUTE,  │    │ JOINS ONCE   │",
    "│ SUNDAY 7:00  │    └──────┬───────┘",
    "└──────────────┘           ↓",
    "       ↑            ┌──────────────┐",
    "       └────────────┤ THEY BRING   │",
    "                    │ ONE MORE     │",
    "                    └──────────────┘",
    "```"
].join("\n");
const IDEA_PLAIN_MIDDLE = "Run the same route at seven every Sunday for a month, alone if you have to. The first neighbour who joins once will bring one more, and that's how it grows.";
const IDEA_CLOSE = "Name the route, not the club. The name can come once there are four of you.";

const LOOP_QUESTION = "How do I stop starting ten things and finishing none?";
const LOOP_WORDS = "Close all but two. When the pack is on an elk, nobody chases the hare that crosses the trail. Two jobs open, the rest shut until those are done.";
const LOOP_BLOCK = "```animaldex-loop\n{\"frequency\":\"MID\",\"caption\":\"Two jobs open, everything else closed until they are done.\"}\n```";
const LOOP_CLOSE = "Write down the two tonight, and close every tab that isn't one of them.";

const IMAGE_QUESTION = "My team keeps stepping on each other's work. What would you do?";
const IMAGE_WORDS = "Name who owns each piece before anyone moves. A pack that argues mid-chase loses the elk.";
const IMAGE_POWER = "```animaldex-image\n{\"of\":\"power\",\"caption\":\"Pack Coordination: everyone knows their piece before anyone moves.\"}\n```";
const IMAGE_MIDDLE = "Don't take the lone hunter's way out and do it all yourself: one tired wolf can't bring down what four coordinated ones can.";
const IMAGE_SPECIES = "```animaldex-image\n{\"of\":\"species\",\"name\":\"Red Fox\",\"caption\":\"The fox hunts alone and wins by surprise. I don't.\"}\n```";

/**
 * Nothing to show draws nothing: a species with no art, a Trial the animal
 * does not have, and (in `Exchange`) a loop with no chat animal supplied.
 */
const NOTHING_BLOCKS = [
    "```animaldex-image\n{\"of\":\"species\",\"name\":\"Snorkel Weasel\",\"caption\":\"No art for this one.\"}\n```",
    "```animaldex-loop\n{\"frequency\":\"EXTREME\"}\n```",
    "```animaldex-image\n{\"of\":\"selfie\"}\n```"
].join("\n\n");

/** The question and the reply for a page: AFTER with its picture, BEFORE the same words alone. */
function exchange(page: ChatBlocksGalleryPage): {question: string; reply: string} {
    switch (page) {
        case "richidea":
            return {question: IDEA_QUESTION, reply: [IDEA_WORDS, IDEA_SKETCH, IDEA_CLOSE].join("\n\n")};
        case "richideaplain":
            return {question: IDEA_QUESTION, reply: [IDEA_WORDS, IDEA_PLAIN_MIDDLE, IDEA_CLOSE].join("\n\n")};
        case "chatloop":
            return {question: LOOP_QUESTION, reply: [LOOP_WORDS, LOOP_BLOCK, LOOP_CLOSE].join("\n\n")};
        case "chatloopplain":
            return {question: LOOP_QUESTION, reply: [LOOP_WORDS, LOOP_CLOSE].join("\n\n")};
        case "chatimage":
            return {question: IMAGE_QUESTION, reply: [IMAGE_WORDS, IMAGE_POWER, IMAGE_MIDDLE, IMAGE_SPECIES].join("\n\n")};
        case "chatimageplain":
            return {question: IMAGE_QUESTION, reply: [IMAGE_WORDS, IMAGE_MIDDLE].join("\n\n")};
        case "chatnothing":
            return {question: IMAGE_QUESTION, reply: [IMAGE_WORDS, NOTHING_BLOCKS, IMAGE_MIDDLE].join("\n\n")};
    }
}

/** One page as the chat lays it out: their message, then Luna's reply in the thread's plain style. */
function Exchange({page}: {page: ChatBlocksGalleryPage}) {
    const {question, reply} = exchange(page);
    return (
        <div className="flex flex-col gap-3.5" data-testid={`chat-blocks-${page}`}>
            <AskUserBubble text={question} label="You said" />
            <AskReplyBubbles plain text={reply} isLive={false} avatarUrl={WOLF_FACE} speakerName="Luna" photoUrl={null} photoAlt="" />
            {page === "chatnothing" ? (
                // The same loop as chatloop, in a chat that supplies no animal.
                <AnimalChatBlockContext.Provider value={null}>
                    <AskReplyBubbles plain text={[LOOP_WORDS, LOOP_BLOCK].join("\n\n")} isLive={false} avatarUrl={WOLF_FACE} speakerName="Luna" photoUrl={null} photoAlt="" />
                </AnimalChatBlockContext.Provider>
            ) : null}
        </div>
    );
}

/** `page` is the `?page=` value: one page, or (none or unknown) every page side by side. */
export default function ChatBlocksGalleryClient({page: wanted}: {page: string | null}) {
    const page = PAGES.find((entry) => entry === wanted) ?? null;
    useEffect(() => {
        const wanted = new URLSearchParams(window.location.search).get("theme");
        if (wanted) document.documentElement.setAttribute("data-theme", wanted);
    }, []);

    return (
        <AnimalChatBlockContext.Provider value={CONTEXT}>
            {page ? (
                <div className="mx-auto w-full max-w-[760px] bg-canvas-950 px-4 py-6">
                    <p className="pb-4 text-[11px] font-black uppercase tracking-[0.14em] text-ink-400">{page}</p>
                    <Exchange page={page} />
                </div>
            ) : (
                <div className="flex flex-col gap-8 px-6 py-8">
                    <h1 className="font-display text-3xl text-white">Chat pictures gallery</h1>
                    <div className="flex flex-wrap items-start gap-8">
                        {PAGES.map((entry) => (
                            <section key={entry} className="flex flex-col gap-2">
                                <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-ink-400">{entry}</h2>
                                <div className="w-[390px] border border-white/10 bg-canvas-950 px-4 py-4">
                                    <Exchange page={entry} />
                                </div>
                            </section>
                        ))}
                    </div>
                </div>
            )}
        </AnimalChatBlockContext.Provider>
    );
}
