import assert from "node:assert/strict";
import test from "node:test";

// 3.2 "Your step": the web's animal holds the apps' words, string by string.
// The fixture is the apps' own server modules' output (AnimalDex r32-server,
// `scripts/generate-your-step-parity-fixture.mts`): the loop rules, the
// prompt lines, the Warmup and report helpers, the card medium, and the
// owner's, the opted-out and the call's system-prompt sections as built.
import fixture from "./ask-animaldex/__fixtures__/your-step-server-prompts.json";
import {
    COMPANION_OUTPUT_LINES,
    REFERRAL_OPENING_RULES,
    companionLoopRules,
    companionPromptLines,
    companionWarmup,
    conversationOffersWarmup,
    describeStepMedia,
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

test("the fixture is the server lane's 3.2 build", () => {
    assert.equal(fixture.source.ref, "r32-server");
    assert.match(fixture.source.commit, /^25c163e8/);
});

test("the companion loop's rules and hidden lines are the apps', word for word", () => {
    sameLines(companionLoopRules({offersSteps: true}), fixture.companionLoopRules.offersSteps, "companionLoopRules (steps)");
    sameLines(companionLoopRules({offersSteps: false}), fixture.companionLoopRules.noSteps, "companionLoopRules (no steps)");
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
            stepReport?: {media: string | null} | null;
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
    // The card rule itself, as `ASSISTANT_VISUAL_MEDIUMS.card`.
    assert.equal(owner.medium.join("\n").includes(fixture.arrays.CARD_MEDIUM.join("\n")), true);

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
