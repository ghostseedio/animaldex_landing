import assert from "node:assert/strict";
import test from "node:test";

import {
    ASK_SETTLED_MARKER,
    askConversationLength,
    askConversationTurnInstruction,
    askMentionedSpeakers,
    askPhaseWordBudget,
    askShortNames,
    askVisibleTurnText,
    buildAskGroupTurnUserPrompt,
    planAskNextTurn,
    streamAskGroupConversation,
    type AskConversationTurn
} from "@/lib/ask-animaldex/group-conversation";
import {
    askDeterministicSpeakers,
    askGroupMaxSpeakers,
    askGroupRulesLines,
    askOnePerSpecies,
    parseAskGroupRouter,
    trimAskGroundingForGroup,
    type AskGroupParticipant
} from "@/lib/ask-animaldex/group-rules";
import {buildAskStreamingSystemPrompt} from "@/lib/ask-animaldex/prompt";
import type {AskCompanionVoice} from "@/lib/ask-animaldex/companion";
import type {AskSpeciesGrounding} from "@/lib/ask-animaldex/grounding";
import {askPersonaDials} from "@/lib/ask-animaldex/persona";

// The apps' animal-group-conversation.test.ts and the group half of
// animal-companion.test.ts, held to the same numbers.

/** Plays a round with stand-in lines. `settles` says which turns end settled. */
function play(speakers: number, settles: (index: number) => boolean = () => false): AskConversationTurn[] {
    const turns: AskConversationTurn[] = [];
    const length = askConversationLength(speakers);
    for (let guard = 0; guard < 20; guard += 1) {
        const plan = planAskNextTurn({speakers, turns, length});
        if (!plan) break;
        turns.push({speaker: plan.speaker, phase: plan.phase, text: "line", settled: settles(turns.length), mentioned: []});
    }
    return turns;
}

test("two animals who never agree: the leader makes the call, the other closes", () => {
    const turns = play(2);
    assert.deepEqual(turns.map((turn) => turn.phase), ["open", "react", "react", "react", "decide", "seal"]);
    assert.deepEqual(turns.map((turn) => turn.speaker), [0, 1, 0, 1, 0, 1]);
});

test("everyone states a position before the round lands, and it ends on the seal", () => {
    for (const speakers of [2, 3, 4]) {
        const turns = play(speakers);
        assert.equal(turns.length, askConversationLength(speakers));
        const lands = turns.findIndex((turn) => turn.phase === "decide");
        assert.equal(new Set(turns.slice(0, lands).map((turn) => turn.speaker)).size, speakers);
        // The leader (index 0, the most dominant) settles a disagreement.
        assert.equal(turns[lands].speaker, 0);
        assert.equal(turns[turns.length - 1].phase, "seal");
        assert.notEqual(turns[turns.length - 1].speaker, turns[lands].speaker);
        for (let i = 1; i < turns.length; i += 1) assert.notEqual(turns[i].speaker, turns[i - 1].speaker);
    }
});

test("each animal's first reaction is marked as its own position", () => {
    const plans = [];
    const turns: AskConversationTurn[] = [];
    for (;;) {
        const plan = planAskNextTurn({speakers: 3, turns, length: askConversationLength(3)});
        if (!plan) break;
        plans.push(plan);
        turns.push({speaker: plan.speaker, phase: plan.phase, text: "line", settled: false, mentioned: []});
    }
    assert.deepEqual(plans.filter((plan) => plan.first).map((plan) => plan.speaker), [1, 2]);
});

test("common ground only when most of the room came round", () => {
    const agreed = play(3, (index) => index === 2 || index === 3);
    assert.deepEqual(agreed.map((turn) => turn.phase), ["open", "react", "react", "react", "converge", "seal"]);
    const one = play(3, (index) => index === 3);
    const decided = one.findIndex((turn) => turn.phase === "decide");
    assert.ok(decided > 0 && !one.some((turn) => turn.phase === "converge"));
    // The seal after the leader's call may still disagree.
    const plan = planAskNextTurn({speakers: 3, turns: one.slice(0, decided + 1), length: askConversationLength(3)});
    assert.equal(plan?.overruled, true);
});

test("agreement lands a round sooner, but only after everyone has spoken and someone answered back", () => {
    const agreeing = play(3, () => true);
    assert.equal(agreeing.findIndex((turn) => turn.phase === "converge"), 4);
    assert.ok(agreeing.length < askConversationLength(3));
    assert.equal(play(3).length, askConversationLength(3));
});

test("the animal named in the last line answers next", () => {
    const turns: AskConversationTurn[] = [
        {speaker: 0, phase: "open", text: "a", settled: false, mentioned: []},
        {speaker: 1, phase: "react", text: "b", settled: false, mentioned: []},
        {speaker: 2, phase: "react", text: "c — what do you say, Wolf?", settled: false, mentioned: [1]}
    ];
    assert.deepEqual(planAskNextTurn({speakers: 3, turns, length: 7}), {speaker: 1, phase: "react", replyTo: 2});
});

test("a single answer is one turn; a failed speaker is skipped", () => {
    assert.deepEqual(planAskNextTurn({speakers: 3, turns: [], length: 6, single: true}), {speaker: 0, phase: "answer", replyTo: null});
    const out = new Set([0]);
    assert.deepEqual(planAskNextTurn({speakers: 2, turns: [], length: 5, out}), {speaker: 1, phase: "open", replyTo: null});
    const after = [{speaker: 1, phase: "open" as const, text: "x", settled: false, mentioned: []}];
    // Nobody left to talk with.
    assert.equal(planAskNextTurn({speakers: 2, turns: after, length: 5, out}), null);
});

test("big animals get shorter turns", () => {
    assert.ok(askPhaseWordBudget("react", 45) < askPhaseWordBudget("react", 95));
    assert.ok(askPhaseWordBudget("seal", 45) >= 12);
    assert.equal(askPhaseWordBudget("answer", 70), 70);
});

test("mentions: nickname, full name, or the animal's last word", () => {
    const names = [
        {nickname: "Luna", animalName: "Gray Wolf"},
        {nickname: null, animalName: "Koala"},
        {nickname: null, animalName: "African Bush Elephant"}
    ];
    assert.deepEqual(askMentionedSpeakers("Luna, you're wrong.", names), [0]);
    assert.deepEqual(askMentionedSpeakers("The wolf and the koala agree.", names), [0, 1]);
    assert.deepEqual(askMentionedSpeakers("Ask the Elephant.", names), [2]);
    assert.deepEqual(askMentionedSpeakers("Koalaesque thinking.", names), []);
});

test("the settled marker and follow-up sentinel never reach the person", () => {
    assert.deepEqual(askVisibleTurnText(`We agree, Luna. ${ASK_SETTLED_MARKER}`, true), {text: "We agree, Luna.", settled: true});
    assert.equal(askVisibleTurnText("Fine. §§FOLLOW_UPS§§\n- more", true).text, "Fine.");
    // Mid-stream, a tail that could become a marker is held back...
    assert.equal(askVisibleTurnText("Yes, we agree [[sett", false).text, "Yes, we agree ");
    // ...and ordinary text is not.
    assert.equal(askVisibleTurnText("Yes, we agree completely", false).text, "Yes, we agree completely");
});

test("instructions: reactions talk to the last speaker, the seal turns to the person", () => {
    const react = askConversationTurnInstruction({plan: {speaker: 1, phase: "react", replyTo: 0}, words: 30, replyToName: "Luna", personMessage: "?"}).join("\n");
    assert.ok(react.includes("Answer Luna directly"));
    assert.ok(react.includes("Hold your ground"));
    assert.ok(react.includes(ASK_SETTLED_MARKER));
    const first = askConversationTurnInstruction({plan: {speaker: 1, phase: "react", replyTo: 0, first: true}, words: 30, replyToName: "Luna", personMessage: "?"}).join("\n");
    assert.ok(first.includes("Say what YOU would do"));
    const seal = askConversationTurnInstruction({plan: {speaker: 0, phase: "seal", replyTo: 1}, words: 20, replyToName: "the Koala", personMessage: "?"}).join("\n");
    assert.ok(seal.includes("turn to the person"));
    const decide = askConversationTurnInstruction({plan: {speaker: 0, phase: "decide", replyTo: null}, words: 40, personMessage: "?"}).join("\n");
    assert.ok(decide.includes("you make the call"));
    const holdOut = askConversationTurnInstruction({plan: {speaker: 1, phase: "seal", replyTo: 0, overruled: true}, words: 20, replyToName: "the Dragon", personMessage: "?"}).join("\n");
    assert.ok(holdOut.includes("you do not have to agree"));
});

test("short names: nickname, the animal's last word, the full name when two share it", () => {
    assert.deepEqual(
        askShortNames([
            {nickname: "Zuri", animalName: "Cheetah"},
            {nickname: null, animalName: "African Bush Elephant"},
            {nickname: null, animalName: "Western Honey Bee"}
        ]),
        ["Zuri", "Elephant", "Bee"]
    );
    assert.deepEqual(askShortNames([{nickname: null, animalName: "Barn Owl"}, {nickname: "  ", animalName: "Tawny Owl"}]), ["Barn Owl", "Tawny Owl"]);
});

async function readFrames(response: Response): Promise<Array<Record<string, unknown>>> {
    const text = await response.text();
    return text.split("\n\n").filter((chunk) => chunk.startsWith("data: ")).map((chunk) => JSON.parse(chunk.slice(6)) as Record<string, unknown>);
}

const member = (id: string, name: string) => ({captureId: id, animalName: name, nickname: null, powerName: "P"});

test("stream: turns in order, each one after the last, markers stripped, a silent speaker refunded", async () => {
    const speakers = [
        {member: member("a", "Gray Wolf"), persona: {pace: "measured"}},
        {member: member("b", "Koala"), persona: {pace: "slow"}},
        {member: member("c", "Owl"), persona: {pace: "slow"}}
    ];
    const seen: number[] = [];
    const refunded: number[] = [];
    let done: Array<{text: string}> = [];
    const response = streamAskGroupConversation({
        speakers,
        length: 5,
        single: false,
        sourceFor: (plan, turns) => async (emit) => {
            // Each turn is written knowing every turn before it.
            seen.push(turns.length);
            if (plan.speaker === 2) throw new Error("model down");
            emit(`Turn ${turns.length} by ${plan.speaker} `);
            emit(plan.phase === "react" ? ASK_SETTLED_MARKER : "");
        },
        mentionsOf: () => [],
        closing: {remaining: 4},
        followUps: ["Carry on"],
        headers: {},
        onSpeakerSilent: async (speaker) => {
            refunded.push(speaker);
        },
        onDone: (turns) => {
            done = turns;
        }
    });
    const frames = await readFrames(response);
    assert.equal(frames[0].flow, "conversation");
    const turnStarts = frames.filter((frame) => frame.turn).map((frame) => (frame.turn as {participant: string}).participant);
    assert.equal(turnStarts[0], "a");
    assert.ok(frames.some((frame) => frame.error === "speaker_failed" && frame.participant === "c"));
    const text = frames.filter((frame) => typeof frame.delta === "string").map((frame) => frame.delta).join("");
    assert.equal(text.includes("[["), false);
    assert.deepEqual(refunded, [2]);
    assert.ok(done.length >= 3);
    const last = frames[frames.length - 1];
    assert.equal(last.done, true);
    assert.deepEqual(last.follow_up_prompts, ["Carry on"]);
    assert.equal(last.remaining, 4);
    assert.deepEqual(seen.slice(0, 3), [0, 1, 2]);
});

test("stream: the page going away stops further turns", async () => {
    let started = 0;
    const page = new AbortController();
    const response = streamAskGroupConversation({
        speakers: [{member: member("a", "Wolf"), persona: {}}, {member: member("b", "Koala"), persona: {}}],
        length: 5,
        single: false,
        sourceFor: (_plan, _turns, signal) => async (emit) => {
            started += 1;
            emit("Hello there.");
            await new Promise((resolve) => setTimeout(resolve, 30));
            if (signal.aborted) throw new Error("aborted");
        },
        mentionsOf: () => [],
        closing: {},
        followUps: [],
        headers: {},
        onSpeakerSilent: async () => undefined,
        onDone: () => undefined,
        signal: page.signal
    });
    const reader = response.body!.getReader();
    await reader.read();
    page.abort();
    await reader.cancel().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 120));
    assert.ok(started <= 2, `started ${started} turns after cancel`);
});

// MARK: - Who speaks, and the group prompt

const voice: AskCompanionVoice = {
    temperament: [{trait: "steady and patient"}],
    pace: "measured",
    stance: "steadies the person and asks who else is affected",
    advice_style: "Test a lot of options cheaply, then commit fully, together.",
    speech_habits: [],
    origin: "card"
};

function participant(id: string, animalName: string, nickname: string | null = null): AskGroupParticipant {
    return {captureId: id, speciesProfileId: `sp-${id}`, animalName, nickname, powerName: "Power", voice};
}

test("group routing without a model: addressed, named, first question, crisis", () => {
    const all = [participant("a", "Gray Wolf", "Luna"), participant("b", "Long-tailed Macaque"), participant("c", "Giant Oceanic Manta Ray"), participant("d", "Cheetah")];
    const base = {participants: all, addressedCaptureId: null, isFirstQuestion: false, message: "What next?", maxSpeakers: 3};
    assert.deepEqual(askDeterministicSpeakers({...base, addressedCaptureId: "b"})!.map((p) => p.captureId), ["b"]);
    assert.deepEqual(askDeterministicSpeakers({...base, message: "Luna, what do you think?"})!.map((p) => p.captureId), ["a"]);
    assert.equal(askDeterministicSpeakers({...base, isFirstQuestion: true})!.length, 3);
    assert.equal(askDeterministicSpeakers({...base, message: "I want to kill myself"})!.length, 1);
    assert.equal(askDeterministicSpeakers(base), null);
    const routed = parseAskGroupRouter({speakers: [{capture_id: "c", angle: "widen"}, {capture_id: "zz"}, {capture_id: "c"}]}, all, 3);
    assert.deepEqual(routed.map((entry) => entry.participant.captureId), ["c"]);
});

test("one of each species: the named one wins, the order stays", () => {
    const picked = askOnePerSpecies([
        {captureId: "1", speciesProfileId: "wolf", nickname: null},
        {captureId: "2", speciesProfileId: "koala", nickname: null},
        {captureId: "3", speciesProfileId: "wolf", nickname: "Luna"}
    ]);
    assert.deepEqual(picked.map((entry) => entry.captureId), ["2", "3"]);
    assert.equal(askGroupMaxSpeakers(null), 3);
    assert.equal(askGroupMaxSpeakers(9), 4);
    assert.equal(askGroupMaxSpeakers(2.4), 2);
});

const wolf: AskSpeciesGrounding = {
    slug: "gray-wolf",
    speciesProfileId: "sp-a",
    name: "Gray Wolf",
    scientificName: "Canis lupus",
    category: null,
    summary: "A family hunter.",
    identification: ["Long legs"],
    habitat: "Forests and tundra.",
    nativeRange: null,
    diet: "Large prey.",
    predators: null,
    sleepPattern: null,
    lifespan: null,
    reproduction: null,
    sexDifference: null,
    interestingFacts: ["Howls carry for miles"],
    behaviorTraits: [],
    spottingTips: [],
    power: {
        principleName: "Cooperation",
        principleExpression: "Together.",
        coreLesson: "Together, the group can do what one animal cannot.",
        shortMotto: "Together we go further.",
        corePattern: null,
        biologicalBasis: null,
        applicationExample: "At work.",
        behavioralEvidence: [],
        powerContinuum: null,
        embodimentPractices: [],
        reflectionQuestions: ["Who helps you?"],
        relatedPowers: []
    },
    systemDynamics: {
        archetypeName: "Family-Pack Prey Testing",
        mechanism: "Test many, commit to few",
        frequency: {primary: "MID", behavior: "Steady", modes: [{name: "Trotting", frequency: "MID"}]},
        crossDomain: ["Business", "Money & Finance", "Sport", "Art", "Music"].map((domain) => ({domain, entries: []})),
        failureModes: [{title: "a", explanation: ""}, {title: "b", explanation: ""}, {title: "c", explanation: ""}, {title: "d", explanation: ""}],
        transition: null
    },
    relatedSpecies: [{slug: "red-fox", name: "Red Fox"}],
    relatedLocations: []
};

test("group prompt: own angle, no step offers, never speaks for the others, the room's lines replace the one-to-one loop", () => {
    const all = [participant("a", "Gray Wolf"), participant("b", "Long-tailed Macaque")];
    const lines = askGroupRulesLines({me: all[0], angle: "weigh who is affected", others: [all[1]], speakingNow: all});
    const persona = askPersonaDials({stats: {dominance: 72, speed: 62, size: 43, intelligence: 62, rarity: 45}, dynamics: null, voice});
    const prompt = buildAskStreamingSystemPrompt({
        scope: "species",
        mode: "chat",
        supportedVisuals: [],
        voice,
        animalName: "Gray Wolf",
        persona,
        species: trimAskGroundingForGroup(wolf),
        groupLines: lines
    });
    assert.ok(prompt.includes("Your angle this time: weigh who is affected"));
    assert.ok(prompt.includes("Never write lines for the other animals"));
    assert.ok(prompt.includes("Never offer them and send no cards"));
    assert.ok(prompt.includes("In a group you set the direction"));
    // No one-to-one relationship rules, and no word count from the persona.
    assert.equal(prompt.includes("Relationship — how you speak about you and them"), false);
    assert.equal(prompt.includes("Length: like texting a friend"), false);
    const trimmed = trimAskGroundingForGroup(wolf);
    assert.equal(trimmed.systemDynamics!.crossDomain.length, 4);
    assert.equal(trimmed.systemDynamics!.failureModes.length, 3);
    assert.deepEqual(trimmed.interestingFacts, []);
    assert.equal(trimmed.power!.applicationExample, null);
    assert.equal(trimmed.power!.coreLesson, wolf.power!.coreLesson);
});

test("a turn's prompt: the message, memory, who said what, what was just said, this turn's job", () => {
    const user = buildAskGroupTurnUserPrompt({
        userMessage: "Should I take the job?",
        memory: [{fact: "Runs a bakery", animal: "Koala", noted_at: "2026-10-20"}],
        speciesProfileId: "sp-a",
        rightNow: "right_now — it is evening for them.",
        earlier: [{speaker: "the person", content: "Hi all"}],
        roundSoFar: [{speaker: "the Koala", content: "Rest first."}],
        turnInstruction: ["this_turn: your first word."]
    });
    assert.ok(user.startsWith("user_message: Should I take the job?"));
    assert.ok(user.includes("Runs a bakery (told to the Koala, 2026-10-20)"));
    assert.ok(user.includes("earlier_conversation (who said what):"));
    assert.ok(user.includes('just_now (the animals, after the person\'s message, in order):\n[{"speaker":"the Koala","content":"Rest first."}]'));
    assert.ok(user.includes("this_turn: your first word."));
    assert.ok(user.endsWith("Never bring up the Wild Profile."));
    assert.equal(user.includes("\n\n"), false);
});
