import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

// The chat engine (strategy, 2026-11-04), ported from the apps'
// supabase/functions/_shared at strategy/chat-engine: turn kinds, the angle,
// routing, the crisis check, age bands and the reply guards, and the stream
// route that wires them for the guest Talk API and the signed-in chat.
import {heuristicTurnKind, resolveTurnKind, shorthandIn} from "@/lib/ask-animaldex/turn-kind";
import {angleForClient, askRecordFacets, chooseAngle, parseAngleCandidates} from "@/lib/ask-animaldex/angle";
import {DEFAULT_CHAT_ROUTING, parseChatRoutingConfig, routeChatTurn} from "@/lib/ask-animaldex/chat-routing";
import {crisisDecision, parseCrisisCheck} from "@/lib/ask-animaldex/crisis";
import {crisisReplyText, resolveCrisisCountry} from "@/lib/ask-animaldex/crisis-helplines";
import {ageBandFor, ageRestrictedBody, teenMemoryAllowed} from "@/lib/ask-animaldex/age-band";
import {imagesUsed, newStepAllowed, turnGuideLines} from "@/lib/ask-animaldex/reply-guards";
import {askKindVerdictPromptSection, askWithChosenLatch, buildAskKindVerdictPrompt, parseAskTurnRead} from "@/lib/ask-animaldex/kind-verdict";
import {askSharedRuleLines, buildAskStreamingSystemBlocks, buildAskStreamingSystemPrompt} from "@/lib/ask-animaldex/prompt";
import {companionLoopRules, secondOpinionFields, SECOND_OPINION_LABEL} from "@/lib/ask-animaldex/companion-focus";
import {parseAskMemoryDelta} from "@/lib/ask-animaldex/companion";

const flat = (text: string) => text.replace(/\s+/g, " ");

test("turn kinds: an idea, a decision, a problem, small talk, and shorthand spelled out", () => {
    assert.equal(heuristicTurnKind("I'm thinking of starting a podcast"), "idea");
    assert.equal(heuristicTurnKind("should I move to Lisbon or stay?"), "decision");
    assert.equal(heuristicTurnKind("my flatmate keeps eating my food"), "problem");
    assert.equal(heuristicTurnKind("hi pet"), "chat");
    assert.equal(resolveTurnKind("idea", "hi"), "idea");
    assert.deepEqual(shorthandIn("wdyn").map((item) => item.term), ["wdyn"]);
});

test("the read: an idea's latches, the least obvious unheard one chosen, read as the animal's take", () => {
    const read = parseAskTurnRead({
        kind: "idea",
        safety: false,
        app: false,
        obvious: "Pick a niche and post weekly",
        latches: [
            {from: "power", behaviour: "Lionesses encircle prey from fixed positions", twist: "Fixed seats", fit: 4, fresh: 3},
            {from: "system_dynamics", behaviour: "The roar is an honest count of who is there", twist: "Claim only your real audience", fit: 5, fresh: 5}
        ]
    });
    assert.equal(read.kind, "idea");
    const chosen = askWithChosenLatch(read.verdict);
    assert.equal(chosen?.latch?.source, "system_dynamics");
    assert.equal(askWithChosenLatch(read.verdict, ["roar honest count there"])?.latch?.source, "power");
    const section = askKindVerdictPromptSection(chosen!);
    assert.ok(section.startsWith("your_kinds_take — read before this reply"));
    assert.ok(section.includes('"from":"your System Dynamics"'));
    assert.deepEqual(parseAskTurnRead({kind: "chat", safety: false, app: true}), {kind: "chat", safety: false, app: true, verdict: null});
    assert.equal(parseAskTurnRead({kind: "problem", safety: true, verdict: "Leave"}).verdict, null);
    const prompt = flat(buildAskKindVerdictPrompt({animalName: "African Lion", powerName: "Pride Command", message: "x", heard: ["lionesses encircle prey"]}));
    assert.ok(prompt.includes("1. kind: what did they bring?"));
    assert.ok(prompt.includes('already heard from it (find others): "lionesses encircle prey"'));
});

test("the web packet's facets reach the latches, and the chip needs the species", () => {
    const facets = askRecordFacets({
        power: {behavioralEvidence: [{title: "Cooperative Hunting", observation: "Lionesses encircle prey.", biologicalFunction: "", interpretation: ""}]},
        systemDynamics: {
            archetypeName: "Coalition-Held Territory",
            mechanism: null,
            frequency: {primary: "MID", behavior: "BIMODAL", modes: [{name: "Roaring", frequency: "MID"}]},
            crossDomain: [],
            failureModes: [{title: "The Roar Is an Honest Count", explanation: "Numbers must be real."}],
            transition: null
        },
        interestingFacts: ["A roar carries eight kilometres."],
        identification: [],
        diet: "Ungulates.",
        predators: null,
        sleepPattern: null
    } as never);
    assert.ok(facets.system_dynamics.includes("where it fails: The Roar Is an Honest Count: Numbers must be real."));
    assert.ok(facets.power[0].startsWith("Cooperative Hunting"));
    assert.ok(facets.field_guide.includes("food: Ungulates."));
    const angle = chooseAngle({candidates: parseAngleCandidates([{from: "power", behaviour: "Hunts as a line at dusk", fit: 4}])});
    assert.deepEqual(angleForClient(angle, "s1"), {behaviour: "Hunts as a line at dusk", source: "power", species_profile_id: "s1"});
    assert.equal(angleForClient(angle, null), null);
});

test("routing: Haiku for a hello and small talk, the deep model at medium or more for a real turn", () => {
    const base = {
        kind: "idea" as const,
        greeting: false,
        call: false,
        isPro: false,
        personaEffort: "low" as const,
        maxEffort: "medium",
        config: DEFAULT_CHAT_ROUTING,
        chatModel: "claude-opus-5-5",
        callModel: "claude-haiku-5-5"
    };
    assert.deepEqual(routeChatTurn({...base, kind: "chat"}), {tier: "small_talk", model: "claude-haiku-5-5", effort: "low", thinking: "off", fallback: false});
    assert.deepEqual(routeChatTurn(base), {tier: "deep", model: "claude-opus-5-5", effort: "medium", thinking: "adaptive", fallback: true});
    assert.equal(routeChatTurn({...base, greeting: true}).model, "claude-haiku-5-5");
    assert.equal(parseChatRoutingConfig({turn_routing: false}).enabled, false);
});

test("a crisis: the classifier decides, and the fixed reply gives local lines in the reader's language", () => {
    assert.equal(crisisDecision({check: parseCrisisCheck({risk: "crisis", category: "suicide"}), patternHit: false}).crisis, true);
    assert.equal(crisisDecision({check: parseCrisisCheck({risk: "none"}), patternHit: true}).crisis, false);
    assert.equal(crisisDecision({check: null, patternHit: true}).source, "pattern");
    assert.equal(resolveCrisisCountry({requestCountry: "us"}), "US");
    const us = crisisReplyText({country: "US"});
    assert.ok(us.includes("- 988 Suicide & Crisis Lifeline: call or text 988"));
    assert.ok(us.includes("call 911"));
    assert.ok(crisisReplyText({languageName: "French", country: "FR"}).includes("3114"));
    assert.ok(crisisReplyText({country: null}).includes("findahelpline.com"));
});

test("age bands, the under-13 refusal and teen memory", () => {
    const now = new Date("2026-11-04T00:00:00Z");
    assert.equal(ageBandFor(2014, now), "under_13");
    assert.equal(ageBandFor(2013, now), "teen");
    assert.equal(ageBandFor(null, now), "unknown");
    assert.equal(ageRestrictedBody(null).code, "age_restricted");
    assert.equal(teenMemoryAllowed("Has a crush on someone"), false);
    const raw = {add: [{fact: "Lives in Leeds with an aunt", kind: "context"}, {fact: "Is learning to skateboard", kind: "goal"}]};
    assert.deepEqual(parseAskMemoryDelta(raw, new Set(), {teen: true}).add.map((item) => item.fact), ["Is learning to skateboard"]);
});

test("reply guards: a repeated picture, a step a day, the turn's guide", () => {
    assert.equal(imagesUsed(["An arm regrows slowly.", "The arm regrows again."])[0], "arm regrows");
    const now = new Date("2026-11-04T18:00:00Z");
    const open = {step: "Ask for one hour", set_at: "2026-11-04T09:00:00Z"};
    assert.equal(newStepAllowed({openTrial: open, newStep: "Something new", reportedDone: false, userMessage: "ok", now}), false);
    assert.equal(newStepAllowed({openTrial: open, newStep: "Something new", reportedDone: false, userMessage: "a different step please", now}), true);
    const guide = turnGuideLines({kind: "chat", hasTake: false, message: "hru", replies: []});
    assert.ok(guide[0].startsWith("this_turn — small talk."));
    assert.ok(guide.some((line) => line.includes("hru = how are you")));
});

test("the shared rules are one cached block, the same for every animal", () => {
    const a = buildAskStreamingSystemBlocks({scope: "species", animalName: "African Lion", mode: "auto"});
    const b = buildAskStreamingSystemBlocks({scope: "species", animalName: "Gray Wolf", mode: "chat", languageName: "Spanish"});
    assert.equal(a[0], b[0]);
    assert.equal(a[0], askSharedRuleLines().join("\n"));
    assert.equal(buildAskStreamingSystemPrompt({scope: "species", animalName: "African Lion", mode: "auto"}), a.join("\n\n"));
    // Each block carries its own cache breakpoint (providers.ts is server-only, so read as source).
    const providers = readFileSync(new URL("./ask-animaldex/providers.ts", import.meta.url), "utf8");
    assert.ok(providers.includes("system: claudeSystemBlocks(params.systemPrompt),"));
    assert.ok(providers.includes('cache_control: {type: "ephemeral" as const}'));
    const shared = flat(a[0]);
    assert.ok(shared.includes("say plainly that you are an AI speaking as this animal"));
    assert.ok(shared.includes("gets no side: build on it"));
    assert.equal(buildAskStreamingSystemBlocks({scope: "general"}).length, 1);
});

test("after an idea or a decision, the debate offer is a second opinion", () => {
    assert.ok(flat(companionLoopRules({offersSteps: true, debates: true}).join("\n")).includes("hear two more of their animals on it"));
    assert.deepEqual(secondOpinionFields({isPro: false, privateDebatesToday: 1}), {kind: "second_opinion", label: SECOND_OPINION_LABEL, paywall: "second_opinion"});
});

test("the stream route wires it: age gate, crisis before the limit, routing, the guide, turn_kind and angle", () => {
    const route = readFileSync(new URL("../app/api/ask/stream/route.ts", import.meta.url), "utf8");
    assert.ok(route.includes('if (ageBand === "under_13") {'));
    assert.ok(route.includes("return askJson(ageRestrictedBody(askLanguageName(body.locale)), 403);"));
    assert.ok(route.indexOf('if (ageBand === "under_13") {') < route.indexOf("if (rate && !rate.allowed) {"));
    assert.ok(route.includes("// Out of messages is never a reason to miss an emergency."));
    assert.ok(route.includes('request.headers.get("cf-ipcountry")'));
    assert.ok(route.includes("requestAskTurnRead({"));
    assert.ok(route.includes("facets: askRecordFacets(verdictSpecies),"));
    assert.ok(route.includes("const route = speaksAsAnimal && !isCall && service"));
    assert.ok(route.includes("turnGuide: speaksAsAnimal"));
    assert.ok(route.includes("...(speaksAsAnimal ? {turn_kind: turnKind, angle: clientAngle} : {})"));
    assert.ok(route.includes("recordAngleHeard(service, {userId, speciesProfileId: speciesId, angle: chosenAngle})"));
    assert.ok(route.includes("secondOpinionFields({isPro: rate?.isPro === true"));
    assert.ok(route.includes("buildAskStreamingSystemBlocks(promptOptions)"));
    // turn_kind and angle ride in `closing`, spread into the done event itself (top level, as the apps read them).
    assert.ok(route.includes("send({done: true, follow_up_prompts: split.followUps, ...closing, ...companionFields});"));
    assert.ok(route.includes('const fields = {turn_kind: "crisis" as TurnKind, angle: null, signed_in: viewer.signedIn, conversation_mode: "auto"};'));
    // A public chat's step only for a client that draws it.
    assert.ok(route.includes('const publicSteps = publicChat && advertised.includes("step") && !isCall && !isGreeting'));
});
