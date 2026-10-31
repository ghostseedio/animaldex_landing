import assert from "node:assert/strict";
import test from "node:test";

// 3.2 "Your step" and Debates: the web's animal holds the apps' words, string
// by string. The fixture is the apps' own server modules' output (AnimalDex
// proof-debates-server, `scripts/generate-your-step-parity-fixture.mts`): the loop
// rules (with and without the debate offer), the prompt lines (with and
// without companion.debate, and a call's may_hand_over), the Warmup,
// debate-marker and report helpers, the hidden lines (a call's DEBATE_OFFER
// and DEBATE included), the card and debate mediums, and the owner's, the
// opted-out and the call's system-prompt sections as built (the call that
// takes debates included).
import fixture from "./ask-animaldex/__fixtures__/your-step-server-prompts.json";
import {
    COMPANION_OUTPUT_LINES,
    REFERRAL_OPENING_RULES,
    companionLoopRules,
    companionPromptLines,
    CALL_DEBATE_OUTPUT_LINES,
    CALL_DEBATE_RULES,
    companionWarmup,
    conversationOffersDebate,
    conversationOffersWarmup,
    debateOfferAnimals,
    debateOfferProblem,
    describeStepMedia,
    stepReportMediaLine,
    type CompanionStepReport,
    extractCompanionLines,
    parseDebateMarker,
    openStepForClient,
    parseCompanionRoster,
    parseCompanionState,
    type CompanionWarmup
} from "@/lib/ask-animaldex/companion-focus";
import {
    ANIMAL_AUTO_MODE_RULES,
    ANIMAL_CHAT_MODE_RULES,
    ANIMAL_NO_STEP_OFFER_RULES,
    ANIMAL_RELATIONSHIP_RULES,
    askStepOfferRules
} from "@/lib/ask-animaldex/companion";
import {buildAskStreamingSystemPrompt, type AskPromptOptions} from "@/lib/ask-animaldex/prompt";
import {ANIMAL_GREETING_RULES} from "@/lib/ask-animaldex/grounding";

/** Lines from the first starting with `from` up to (not including) the next starting with `to`, as the fixture cut them. */
function slice(prompt: string, from: string, to: string): string[] {
    const lines = prompt.split("\n");
    const start = lines.findIndex((line) => line.startsWith(from));
    assert.ok(start >= 0, `no line starts with ${from}`);
    const end = lines.findIndex((line, index) => index > start && line.startsWith(to));
    assert.ok(end >= 0, `no line after ${from} starts with ${to}`);
    return lines.slice(start, end);
}

function sections(options: Omit<AskPromptOptions, "scope">) {
    const prompt = buildAskStreamingSystemPrompt({scope: "species", animalName: "African Lion", ...options});
    return {
        medium: slice(prompt, "Medium —", "Formatting —").filter((line, index, all) => !(index === all.length - 1 && line === "")),
        loop: slice(prompt, "How you talk: read what they need", "Relationship — how you speak about you and them:"),
        output: slice(prompt, "Output shape —", "Follow-ups:")
    };
}

/** Each line on its own, so a failure names the line that drifted. */
function sameLines(web: readonly string[], server: readonly string[], what: string) {
    for (let index = 0; index < Math.max(web.length, server.length); index += 1) {
        assert.equal(web[index], server[index], `${what}, line ${index + 1}`);
    }
}

test("the fixture is the proof bonus + debates fixes server lane's build (owner, 2026-10-31)", () => {
    assert.equal(fixture.source.ref, "proof-debates-server");
    assert.match(fixture.source.commit, /^cc714467/);
});

test("proof bonus: the animal hears what the proof shows, as the server says it", () => {
    for (const item of fixture.proof.stepReportMediaLine) {
        assert.equal(stepReportMediaLine(item.input as CompanionStepReport), item.output, JSON.stringify(item.input));
    }
    // The old line is gone: a photo with no check is "nobody could look at it", never "you cannot see".
    assert.equal(fixture.companionLoopRules.offersSteps.join("\n").includes("you do not see it"), false);
});

test("debates fixes: the offer's problem is the animal's focus, as the server picks it", () => {
    for (const item of fixture.proof.debateOfferProblem) {
        assert.equal(debateOfferProblem(parseCompanionState(item.input.state), item.input.lines, item.input.written), item.output, JSON.stringify(item.input));
    }
    // The offer comes first in a reply where it may be made.
    assert.equal(fixture.companionLoopRules.debates.join("\n").includes("this offer comes first"), true);
});

test("the companion loop's rules and hidden lines are the apps', word for word", () => {
    sameLines(companionLoopRules({offersSteps: true}), fixture.companionLoopRules.offersSteps, "companionLoopRules (steps)");
    sameLines(companionLoopRules({offersSteps: false}), fixture.companionLoopRules.noSteps, "companionLoopRules (no steps)");
    sameLines(companionLoopRules({offersSteps: true, debates: true}), fixture.companionLoopRules.debates, "companionLoopRules (debates)");
    sameLines(companionLoopRules({offersSteps: false, debates: true}), fixture.companionLoopRules.debatesNoSteps, "companionLoopRules (debates, no steps)");
    sameLines(COMPANION_OUTPUT_LINES, fixture.arrays.COMPANION_OUTPUT_LINES, "COMPANION_OUTPUT_LINES");
    sameLines(REFERRAL_OPENING_RULES, fixture.arrays.REFERRAL_OPENING_RULES, "REFERRAL_OPENING_RULES");
});

test("the mode, step-offer and relationship rules are the apps'", () => {
    sameLines(ANIMAL_AUTO_MODE_RULES, fixture.arrays.ANIMAL_AUTO_MODE_RULES, "ANIMAL_AUTO_MODE_RULES");
    sameLines(ANIMAL_CHAT_MODE_RULES, fixture.arrays.ANIMAL_CHAT_MODE_RULES, "ANIMAL_CHAT_MODE_RULES");
    sameLines(ANIMAL_RELATIONSHIP_RULES, fixture.arrays.ANIMAL_RELATIONSHIP_RULES, "ANIMAL_RELATIONSHIP_RULES");
    const offers = fixture.stepOfferRules;
    sameLines(askStepOfferRules(true, "auto"), offers.autoYes, "stepOfferRules(true, auto)");
    sameLines(askStepOfferRules(false, "auto"), offers.autoNo, "stepOfferRules(false, auto)");
    sameLines(askStepOfferRules(true, "chat"), offers.chatYes, "stepOfferRules(true, chat)");
    sameLines(askStepOfferRules(false, "chat"), offers.chatNo, "stepOfferRules(false, chat)");
    sameLines(askStepOfferRules(true, "guidance"), offers.guidanceYes, "stepOfferRules(true, guidance)");
    sameLines(askStepOfferRules(false, "training"), offers.training, "stepOfferRules(false, training)");
    sameLines(ANIMAL_NO_STEP_OFFER_RULES, offers.autoNo, "ANIMAL_NO_STEP_OFFER_RULES");
});

test("the turn's loop lines come out as the server writes them", () => {
    fixture.companionPromptLines.forEach((item, index) => {
        const input = item.input as {
            state: unknown;
            roster: unknown;
            powerEarned: boolean;
            powerJustEarned?: boolean;
            warmup?: CompanionWarmup;
            stepReport?: CompanionStepReport | null;
            debateOffer?: boolean;
            debateHandOver?: boolean;
        };
        const web = companionPromptLines({
            ...input,
            state: parseCompanionState(input.state),
            roster: parseCompanionRoster(input.roster)
        });
        sameLines(web, item.output, `companionPromptLines case ${index + 1}`);
    });
});

test("the Warmup, the report's media and the open step read as the server reads them", () => {
    for (const item of fixture.companionWarmup) {
        assert.deepEqual(companionWarmup(item.input), item.output, JSON.stringify(item.input));
    }
    for (const item of fixture.conversationOffersWarmup) {
        assert.equal(conversationOffersWarmup(item.input), item.output, JSON.stringify(item.input));
    }
    for (const item of fixture.conversationOffersDebate) {
        assert.equal(conversationOffersDebate(item.input), item.output, JSON.stringify(item.input));
    }
    for (const item of fixture.describeStepMedia) {
        assert.equal(describeStepMedia(item.input), item.output, JSON.stringify(item.input));
    }
    for (const item of fixture.openStepForClient) {
        const open = item.input ? parseCompanionState({open_trial: item.input})?.open_trial : null;
        assert.deepEqual(openStepForClient(open), item.output, JSON.stringify(item.input));
    }
});

test("the owner's chat with cards: medium, loop and output shape are the apps' sections", () => {
    const owner = sections({mode: "auto", supportedVisuals: ["flow", "scale", "chart", "card"], companionLoop: {offersSteps: true}, suggestSteps: true, stories: true});
    sameLines(owner.medium, fixture.prompts.ownerLoop.medium, "owner medium");
    sameLines(owner.loop, fixture.prompts.ownerLoop.loop, "owner loop");
    sameLines(owner.output, fixture.prompts.ownerLoop.output, "owner output");
    // The card rule itself, as `ASSISTANT_VISUAL_MEDIUMS.card`; without "debate", no debate card.
    assert.equal(owner.medium.join("\n").includes(fixture.arrays.CARD_MEDIUM.join("\n")), true);
    assert.equal(owner.medium.join("\n").includes('"kind":"debate"'), false);

    const optedOut = sections({mode: "auto", supportedVisuals: ["flow", "scale", "chart", "photo", "card"], companionLoop: {offersSteps: false}, suggestSteps: false, stories: true});
    sameLines(optedOut.medium, fixture.prompts.ownerLoopNoSteps.medium, "opted-out medium");
    sameLines(optedOut.loop, fixture.prompts.ownerLoopNoSteps.loop, "opted-out loop");
    sameLines(optedOut.output, fixture.prompts.ownerLoopNoSteps.output, "opted-out output");
});

test("the owner with personalisation off: cards and the apps' unasked Trial offer, no loop", () => {
    const noLoop = sections({mode: "auto", supportedVisuals: ["flow", "scale", "chart", "card"], companionLoop: null, suggestSteps: true, stories: true});
    sameLines(noLoop.loop, fixture.prompts.ownerNoLoop.loop, "no-loop loop");
    sameLines(noLoop.output, fixture.prompts.ownerNoLoop.output, "no-loop output");
    const noSteps = sections({mode: "auto", supportedVisuals: ["flow", "scale", "chart", "card"], companionLoop: null, suggestSteps: false, stories: true});
    sameLines(noSteps.loop, fixture.prompts.ownerNoLoopNoSteps.loop, "no-loop opted-out loop");
});

test("3.2 Debates, the owner's chat that draws the debate card: medium, loop and output are the apps'", () => {
    const owner = sections({mode: "auto", supportedVisuals: ["flow", "scale", "chart", "card", "debate"], companionLoop: {offersSteps: true, debates: true}, suggestSteps: true, stories: true});
    sameLines(owner.medium, fixture.prompts.ownerLoopDebate.medium, "debate owner medium");
    sameLines(owner.loop, fixture.prompts.ownerLoopDebate.loop, "debate owner loop");
    sameLines(owner.output, fixture.prompts.ownerLoopDebate.output, "debate owner output");
    // The card rule, then the debate kind (`ASSISTANT_VISUAL_MEDIUMS.debate`) right after it.
    assert.equal(owner.medium.join("\n").includes([...fixture.arrays.CARD_MEDIUM, ...fixture.arrays.DEBATE_MEDIUM].join("\n")), true);
    // The one-time offer is in the loop's rules.
    assert.equal(owner.loop.join("\n").includes(fixture.companionLoopRules.debates.join("\n")), true);
    assert.equal(owner.loop.some((line) => line.startsWith("- Other animals' ways (companion.debate)")), true);

    const optedOut = sections({mode: "auto", supportedVisuals: ["flow", "scale", "chart", "photo", "card", "debate"], companionLoop: {offersSteps: false, debates: true}, suggestSteps: false, stories: true});
    sameLines(optedOut.medium, fixture.prompts.ownerLoopDebateNoSteps.medium, "debate opted-out medium");
    sameLines(optedOut.loop, fixture.prompts.ownerLoopDebateNoSteps.loop, "debate opted-out loop");
    sameLines(optedOut.output, fixture.prompts.ownerLoopDebateNoSteps.output, "debate opted-out output");
    // Someone who turned step suggestions off is never offered a debate.
    assert.equal(optedOut.loop.some((line) => line.includes("companion.debate")), false);

    const noLoop = sections({mode: "auto", supportedVisuals: ["flow", "scale", "chart", "card", "debate"], companionLoop: null, suggestSteps: true, stories: true});
    sameLines(noLoop.medium, fixture.prompts.ownerNoLoopDebate.medium, "debate no-loop medium");
    sameLines(noLoop.loop, fixture.prompts.ownerNoLoopDebate.loop, "debate no-loop loop");
    sameLines(noLoop.output, fixture.prompts.ownerNoLoopDebate.output, "debate no-loop output");
});

test("3.2 Debates: no battle and no comparison card anywhere in the owner's chat, as the apps test it", () => {
    for (const visuals of [["card"], ["card", "debate"]] as const) {
        for (const companionLoop of [{offersSteps: true, debates: visuals.length > 1}, {offersSteps: false}, null]) {
            const prompt = buildAskStreamingSystemPrompt({scope: "species", mode: "auto", animalName: "African Lion", supportedVisuals: [...visuals], companionLoop, stories: true});
            assert.equal(/battle|comparison \(a comparison|comparison card/i.test(prompt), false, JSON.stringify({visuals, companionLoop}));
            assert.equal(prompt.includes('"kind":"debate"'), visuals.length > 1, JSON.stringify({visuals, companionLoop}));
        }
    }
    // The site-wide assistant never describes the animals' debate card.
    assert.equal(buildAskStreamingSystemPrompt({scope: "general", supportedVisuals: ["flow", "card", "debate"]}).includes('"kind":"debate"'), false);
});

test("SPEC section 6: the marker, the owner's animals it names and the hidden lines read as the server reads them", () => {
    for (const item of fixture.parseDebateMarker) {
        assert.deepEqual(parseDebateMarker(item.input), item.output, item.input);
    }
    for (const item of fixture.debateOfferAnimals) {
        assert.deepEqual(debateOfferAnimals(item.keys, parseCompanionRoster(item.roster)), item.output, JSON.stringify(item.keys));
    }
    for (const item of fixture.extractCompanionLines) {
        assert.deepEqual(extractCompanionLines(item.input), item.output, item.input);
    }
    // The fixture really carries a hand-over and a voice offer.
    assert.equal(fixture.extractCompanionLines.some((item) => item.output.lines.debate && item.output.lines.debateOffered), true);
});

test("SPEC section 6, a call that takes debates: the spoken offer, the hand-over and its hidden lines are the apps'", () => {
    const call = sections({mode: "auto", supportedVisuals: [], companionLoop: null, call: true, callDebates: true, suggestSteps: true, stories: true});
    sameLines(call.medium, fixture.prompts.callDebates.medium, "debate call medium");
    sameLines(call.loop, fixture.prompts.callDebates.loop, "debate call loop");
    sameLines(call.output, fixture.prompts.callDebates.output, "debate call output");
    sameLines(CALL_DEBATE_RULES, fixture.arrays.CALL_DEBATE_RULES, "CALL_DEBATE_RULES");
    sameLines(CALL_DEBATE_OUTPUT_LINES, fixture.arrays.CALL_DEBATE_OUTPUT_LINES, "CALL_DEBATE_OUTPUT_LINES");
    const joined = call.loop.join("\n");
    assert.equal(joined.includes(fixture.arrays.ANIMAL_CALL_DEBATE_STEP_RULES.join("\n")), true, "ANIMAL_CALL_DEBATE_STEP_RULES");
    assert.equal(joined.includes(fixture.arrays.CALL_DEBATE_RULES.join("\n")), true);
    assert.equal(call.output.join("\n").includes(fixture.arrays.CALL_DEBATE_OUTPUT_LINES.join("\n")), true);
    // A call that does not take debates keeps the old call rules: no offer, no hidden debate lines.
    const older = buildAskStreamingSystemPrompt({scope: "species", mode: "auto", animalName: "African Lion", supportedVisuals: [], call: true, stories: true});
    assert.equal(older.includes("DEBATE"), false);
    assert.equal(older.includes("offer no Warmup, Trials or debates"), true);
});

test("a call: no loop rules, the call's step rule, no cards", () => {
    const call = sections({mode: "auto", supportedVisuals: [], companionLoop: null, call: true, suggestSteps: true, stories: true});
    sameLines(call.medium, fixture.prompts.call.medium, "call medium");
    sameLines(call.loop, fixture.prompts.call.loop, "call loop");
    sameLines(call.output, fixture.prompts.call.output, "call output");
    assert.equal(call.loop.join("\n").includes(fixture.arrays.ANIMAL_CALL_STEP_RULES.join("\n")), true);
});

test("the greeting, the visitor's rules and the role rules carry the 3.2 words", () => {
    sameLines(ANIMAL_GREETING_RULES, fixture.arrays.ANIMAL_GREETING_RULES, "ANIMAL_GREETING_RULES");
    const visitor = buildAskStreamingSystemPrompt({scope: "species", mode: "auto", animalName: "African Lion", speakingTo: "visitor"});
    assert.equal(visitor.includes(fixture.arrays.ANIMAL_VISITOR_RULES.join("\n")), true, "ANIMAL_VISITOR_RULES");
    assert.equal(visitor.includes(fixture.arrays.ANIMAL_VISITOR_FOLLOW_UP_RULES.join("\n")), true, "ANIMAL_VISITOR_FOLLOW_UP_RULES");
    const owner = buildAskStreamingSystemPrompt({scope: "species", mode: "auto", animalName: "African Lion", supportedVisuals: ["card"], companionLoop: {offersSteps: true}});
    const lines = owner.split("\n");
    // The one role line the website words for its own record (no contrasting_species on the web).
    const roleOnWeb = fixture.arrays.ANIMAL_ROLE_RULES.filter((line) => !line.includes("contrasting_species"));
    assert.equal(roleOnWeb.length, fixture.arrays.ANIMAL_ROLE_RULES.length - 1);
    for (const line of roleOnWeb) assert.equal(lines.includes(line), true, `ANIMAL_ROLE_RULES: ${line}`);
    // The follow-ups, less the loop's next step: it reads owner_progress, which the website does not send.
    const loopLine = fixture.arrays.ANIMAL_FOLLOW_UP_RULES.findIndex((line) => line.startsWith("- The loop's next step"));
    const followUps = fixture.arrays.ANIMAL_FOLLOW_UP_RULES.filter((_, index) => index < loopLine || index > loopLine + 3);
    assert.equal(owner.includes(followUps.join("\n")), true, "ANIMAL_FOLLOW_UP_RULES");
});
