import assert from "node:assert/strict";
import test from "node:test";
import en from "../data/locales/en.json";
import id from "../data/locales/id.json";
import {
    NEW_DRAFT,
    SEND_WAIT_MS,
    SUGGEST_MAX_CALLS,
    SUGGEST_PAUSE_MS,
    TALK_FRONT_DOOR_WORDS_EN,
    animalForCandidate,
    applySuggestion,
    changeRowAnimals,
    choiceForText,
    decodeFrontDoorHandoff,
    decodeTalkSuggestion,
    defaultChoice,
    defaultFrontDoorAnimal,
    draftAnswered,
    draftCalled,
    featuredFrontDoorAnimal,
    frontDoorChatHref,
    frontDoorHandoff,
    frontDoorReason,
    frontDoorSpeciesKey,
    handoffMatches,
    includeWild,
    isSuggestable,
    meetOneNowAnimals,
    pickManually,
    sendPlan,
    suggestionDue,
    talkFrontDoorWords,
    wordsChanged,
    type FrontDoorDraft,
    type OwnFrontDoorAnimal
} from "@/lib/talk-front-door";

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const WOLF = uuid(1);
const FOX = uuid(2);
const KOALA = uuid(3);
const OCTOPUS = uuid(9);

function own(n: number, name: string, fields: Partial<OwnFrontDoorAnimal> = {}): OwnFrontDoorAnimal {
    const species = uuid(n);
    return {
        key: frontDoorSpeciesKey(species),
        kind: "own",
        speciesProfileId: species,
        captureId: uuid(100 + n),
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        name,
        power: `${name} Power`,
        lastTalkedAt: null,
        lastActivityAt: null,
        capturedAt: null,
        ...fields
    };
}

const FEATURED = [
    featuredFrontDoorAnimal({slug: "gray-wolf", name: "Gray Wolf", power: "Pack Pursuit"}),
    featuredFrontDoorAnimal({slug: "common-octopus", name: "Common Octopus", power: "Many Minds"}),
    featuredFrontDoorAnimal({slug: "little-owl", name: "Little Owl", power: "Still Watching"})
];

/** A `talk_suggest` answer as the server writes it (SPEC 6.1), with the website's slugs. */
function answer(pick: Record<string, unknown> | null, fields: Record<string, unknown> = {}) {
    return {pick, why: pick ? "lesson" : null, also: [], picked_by: "model", candidates: pick ? [pick] : [], ...fields};
}

const candidate = (species: string, kind: "own" | "wild", fields: Record<string, unknown> = {}) => ({
    species_profile_id: species,
    capture_id: kind === "own" ? uuid(200) : null,
    animal: kind === "own" ? "Red Fox" : "Common Octopus",
    nickname: null,
    power_name: kind === "own" ? "Cunning" : "Many Minds",
    kind,
    slug: kind === "own" ? "red-fox" : "common-octopus",
    ...fields
});

// MARK: - The default choice

test("the default is the animal they talked to last, else their newest card, else the first Meet one now animal", () => {
    const wolf = own(1, "Gray Wolf", {lastTalkedAt: 1000, capturedAt: 10});
    const fox = own(2, "Red Fox", {lastTalkedAt: 5000, capturedAt: 5});
    const koala = own(3, "Koala", {capturedAt: 900});
    assert.equal(defaultFrontDoorAnimal([wolf, fox, koala], FEATURED)?.name, "Red Fox");
    // Never talked to any: the newest card.
    const neverTalked = [own(1, "Gray Wolf", {capturedAt: 10}), own(3, "Koala", {capturedAt: 900})];
    assert.equal(defaultFrontDoorAnimal(neverTalked, FEATURED)?.name, "Koala");
    // No dates at all: the first of theirs.
    assert.equal(defaultFrontDoorAnimal([own(1, "Gray Wolf")], FEATURED)?.name, "Gray Wolf");
    // No animals: the first Meet one now animal (on Companions the web's own, the Common Octopus).
    assert.equal(defaultFrontDoorAnimal([], meetOneNowAnimals(FEATURED, "common-octopus"))?.name, "Common Octopus");
    // A guest on /talk: the first featured animal.
    assert.equal(defaultFrontDoorAnimal([], FEATURED)?.name, "Gray Wolf");
    assert.equal(defaultFrontDoorAnimal([], []), null);
});

test("wild animals are asked for only below 5 of their own", () => {
    assert.equal(includeWild(0), true);
    assert.equal(includeWild(4), true);
    assert.equal(includeWild(5), false);
    assert.equal(includeWild(12), false);
});

// MARK: - When a call may run

test("short drafts never call: they go to the default", () => {
    assert.equal(isSuggestable("hi"), false);
    assert.equal(isSuggestable("ok"), false);
    assert.equal(isSuggestable("   hello there  "), false);
    assert.equal(isSuggestable("I can't sleep"), true);
    for (const text of ["hi", "ok", "help me pls"]) {
        assert.equal(suggestionDue({draft: NEW_DRAFT, text, lastEditAt: 0, now: 10_000, canSuggest: true}), false, text);
        assert.equal(sendPlan({draft: NEW_DRAFT, text, canSuggest: true}), "now", text);
    }
    const wolf = own(1, "Gray Wolf", {lastTalkedAt: 1000});
    const suggested = {animal: own(2, "Red Fox"), why: "lesson" as const, by: "suggestion" as const};
    // A suggested animal goes back to the default when the draft is cut back to "hi".
    assert.deepEqual(choiceForText(suggested, "hi", NEW_DRAFT, wolf), defaultChoice(wolf));
    // A Change tap still holds.
    assert.deepEqual(choiceForText({...suggested, by: "manual"}, "hi", {...NEW_DRAFT, manual: true}, wolf), {...suggested, by: "manual"});
});

test("a call runs after a 700 ms pause, for 12 characters or more, when 3 words changed, at most 4 times a draft", () => {
    const text = "I keep putting off my thesis";
    const due = (draft: FrontDoorDraft, value: string, pause = SUGGEST_PAUSE_MS) =>
        suggestionDue({draft, text: value, lastEditAt: 1000, now: 1000 + pause, canSuggest: true});
    assert.equal(due(NEW_DRAFT, text, SUGGEST_PAUSE_MS - 1), false);
    assert.equal(due(NEW_DRAFT, text), true);
    // The first call needs only the 12 characters: a long two-word draft gets one.
    assert.equal(due(NEW_DRAFT, "Procrastination everywhere"), true);
    assert.equal(due(NEW_DRAFT, "short one"), false);
    // Not before Talk's gate, signed out or with the switch off.
    assert.equal(suggestionDue({draft: NEW_DRAFT, text, lastEditAt: 0, now: 5000, canSuggest: false}), false);
    // Once asked, the same text (or one word more) does not ask again.
    let draft = draftCalled(NEW_DRAFT, text);
    assert.equal(due(draft, text), false);
    assert.equal(due(draft, `${text} again`), false);
    assert.equal(due(draft, `${text} again and again`), true);
    // Four calls, then no more for this draft.
    let value = text;
    for (let call = 1; call < SUGGEST_MAX_CALLS; call += 1) {
        value = `${value} one two three${call}`;
        assert.equal(due(draft, value), true, `call ${call + 1}`);
        draft = draftAnswered(draftCalled(draft, value), value, true);
    }
    assert.equal(draft.calls, SUGGEST_MAX_CALLS);
    assert.equal(due(draft, `${value} four five six seven`), false);
    // A Change tap stops them too.
    assert.equal(due({...NEW_DRAFT, manual: true}, text), false);
});

test("words changed: a word replaced is one, words added or taken away count each", () => {
    assert.equal(wordsChanged("", "I keep putting off my thesis"), 6);
    assert.equal(wordsChanged("I keep putting off my thesis", "I keep putting off my essay"), 1);
    assert.equal(wordsChanged("I keep putting off my thesis", "I keep putting off my thesis every single day"), 3);
    assert.equal(wordsChanged("I keep putting off my thesis every single day", "I keep putting off my thesis"), 3);
    assert.equal(wordsChanged("Can't SLEEP.", "can't sleep"), 0);
    // A script written without spaces: each character is a word.
    assert.equal(wordsChanged("", "眠れない"), 4);
});

// MARK: - Applying an answer

test("an answer makes its pick the chosen animal with its reason; anything else keeps the choice", () => {
    const wolf = own(1, "Gray Wolf", {lastTalkedAt: 1000});
    const fox = own(2, "Red Fox", {power: null});
    const current = defaultChoice(wolf);
    const suggestion = decodeTalkSuggestion(answer(candidate(FOX, "own"), {why: "focus"}));
    const applied = applySuggestion(current, suggestion, NEW_DRAFT, [wolf, fox]);
    assert.equal(applied.animal?.key, fox.key);
    assert.equal(applied.why, "focus");
    assert.equal(applied.by, "suggestion");
    // Their own row (its name and card), with the candidate's Power where the row has none.
    assert.equal(applied.animal?.captureId, fox.captureId);
    assert.equal(applied.animal?.power, "Cunning");
    // No pick, an unreadable answer, a wild pick with no slug: the choice stays.
    assert.deepEqual(applySuggestion(current, decodeTalkSuggestion(answer(null)), NEW_DRAFT, [wolf]), current);
    assert.deepEqual(applySuggestion(current, decodeTalkSuggestion({error: "feature_paused"}), NEW_DRAFT, [wolf]), current);
    assert.deepEqual(applySuggestion(current, decodeTalkSuggestion(answer(candidate(OCTOPUS, "wild", {slug: null}))), NEW_DRAFT, [wolf]), current);
    // A wild pick is drawn from the candidate.
    const wild = applySuggestion(current, decodeTalkSuggestion(answer(candidate(OCTOPUS, "wild"))), NEW_DRAFT, [wolf]);
    assert.deepEqual({kind: wild.animal?.kind, slug: wild.animal?.slug, captureId: wild.animal?.captureId, why: wild.why}, {kind: "wild", slug: "common-octopus", captureId: null, why: "lesson"});
});

test("a manual pick locks the choice for the draft", () => {
    const wolf = own(1, "Gray Wolf", {lastTalkedAt: 1000});
    const fox = own(2, "Red Fox");
    const koala = own(3, "Koala");
    const suggested = applySuggestion(defaultChoice(wolf), decodeTalkSuggestion(answer(candidate(FOX, "own"))), NEW_DRAFT, [wolf, fox, koala]);
    const picked = pickManually(NEW_DRAFT, suggested, koala);
    assert.equal(picked.choice.animal?.key, koala.key);
    assert.equal(picked.choice.why, null);
    assert.equal(picked.choice.by, "manual");
    assert.equal(picked.draft.manual, true);
    // No later answer moves it, and no more calls go out.
    const later = decodeTalkSuggestion(answer(candidate(WOLF, "own", {slug: "gray-wolf"}), {why: "continuing"}));
    assert.deepEqual(applySuggestion(picked.choice, later, picked.draft, [wolf, fox, koala]), picked.choice);
    assert.equal(suggestionDue({draft: picked.draft, text: "a brand new long draft about work", lastEditAt: 0, now: 5000, canSuggest: true}), false);
    assert.equal(sendPlan({draft: picked.draft, text: "a brand new long draft about work", canSuggest: true}), "now");
    // Picking the suggestion's own pick keeps its reason.
    assert.equal(pickManually(NEW_DRAFT, suggested, fox).choice.why, "lesson");
});

// MARK: - The send wait

test("sending waits for the suggestion of the current text, 2.5 s at most", () => {
    assert.equal(SEND_WAIT_MS, 2500);
    const text = "I keep putting off my thesis";
    // Sent before the pause ended: ask now and wait.
    assert.equal(sendPlan({draft: NEW_DRAFT, text, canSuggest: true}), "call_and_wait");
    // A call is out for this text (or nearly this text): wait for it.
    const out = draftCalled(NEW_DRAFT, text);
    assert.equal(sendPlan({draft: out, text, canSuggest: true}), "wait");
    assert.equal(sendPlan({draft: out, text: `${text} now`, canSuggest: true}), "wait");
    // It came back: send at once.
    const back = draftAnswered(out, text, true);
    assert.equal(sendPlan({draft: back, text, canSuggest: true}), "now");
    // It failed: send at once to whoever is chosen.
    assert.equal(sendPlan({draft: draftAnswered(out, text, false), text, canSuggest: true}), "now");
    // Three words more since the answer: ask again and wait.
    assert.equal(sendPlan({draft: back, text: `${text} every single day`, canSuggest: true}), "call_and_wait");
    // No suggestion allowed (signed out, before the gate, switch off): at once.
    assert.equal(sendPlan({draft: NEW_DRAFT, text, canSuggest: false}), "now");
});

// MARK: - The answer's shape (SPEC 6.1)

test("a talk_suggest answer is read as the contract says, and nothing else is", () => {
    const decoded = decodeTalkSuggestion({
        pick: candidate(FOX, "own"),
        why: "continuing",
        also: [candidate(KOALA, "own", {animal: "Koala"}), candidate(FOX, "own"), candidate(OCTOPUS, "wild"), candidate(WOLF, "own")],
        picked_by: "keywords",
        candidates: [candidate(FOX, "own"), candidate(KOALA, "own"), {species_profile_id: "nope", animal: "x", kind: "own"}]
    });
    assert.ok(decoded);
    assert.equal(decoded.pick?.speciesProfileId, FOX);
    assert.equal(decoded.why, "continuing");
    // Up to 2 more fits, never the pick again.
    assert.deepEqual(decoded.also.map((fit) => fit.speciesProfileId), [KOALA]);
    assert.equal(decoded.pickedBy, "keywords");
    assert.deepEqual(decoded.candidates.map((fit) => fit.speciesProfileId), [FOX, KOALA]);
    assert.equal(decodeTalkSuggestion({pick: null, why: "lesson", also: [], picked_by: "default", candidates: []})?.why, null);
    assert.equal(decodeTalkSuggestion({error: "invalid_request"}), null);
    assert.equal(decodeTalkSuggestion(null), null);
    // A wild candidate never carries a card.
    assert.equal(decodeTalkSuggestion(answer(candidate(OCTOPUS, "wild", {capture_id: uuid(5)})))?.pick?.captureId, null);
});

// MARK: - The Change row (SPEC 4.2)

test("Change offers the fits, then the rest of theirs by recent activity, then wild ones", () => {
    const wolf = own(1, "Gray Wolf", {lastActivityAt: 100});
    const fox = own(2, "Red Fox", {lastActivityAt: 50});
    const koala = own(3, "Koala", {lastActivityAt: 900});
    const hedgehog = own(4, "Hedgehog", {capturedAt: 400});
    const suggestion = decodeTalkSuggestion({
        pick: candidate(FOX, "own"),
        why: "lesson",
        also: [candidate(OCTOPUS, "wild")],
        picked_by: "model",
        candidates: [candidate(FOX, "own"), candidate(uuid(10), "wild", {animal: "Little Owl", slug: "little-owl"}), candidate(OCTOPUS, "wild")]
    });
    const row = changeRowAnimals({suggestion, own: [wolf, fox, koala, hedgehog], wildFallback: FEATURED});
    assert.deepEqual(row.map((animal) => animal.name), ["Red Fox", "Common Octopus", "Koala", "Hedgehog", "Gray Wolf", "Little Owl"]);
    // Before any answer, with fewer than 5 of their own: theirs, then the Meet one now animals.
    const before = changeRowAnimals({suggestion: null, own: [wolf], wildFallback: FEATURED});
    assert.deepEqual(before.map((animal) => animal.name), ["Gray Wolf", "Common Octopus", "Little Owl"]);
    // A guest: the featured animals.
    assert.deepEqual(changeRowAnimals({suggestion: null, own: [], wildFallback: FEATURED}).map((animal) => animal.name), ["Gray Wolf", "Common Octopus", "Little Owl"]);
    // Five or more of their own: no wild ones unless the answer had them.
    const five = [wolf, fox, koala, hedgehog, own(5, "Otter")];
    assert.equal(changeRowAnimals({suggestion: null, own: five, wildFallback: FEATURED}).some((animal) => animal.kind === "wild"), false);
    // The animal chosen is always in the row.
    const chosen = featuredFrontDoorAnimal({slug: "orca", name: "Orca", power: "Pod Echo"});
    assert.equal(changeRowAnimals({suggestion: null, own: five, wildFallback: [], chosen})[0].name, "Orca");
});

// MARK: - Sending

test("send opens the chosen animal's chat: their card, or the species' public chat", () => {
    const fox = own(2, "Red Fox");
    assert.equal(frontDoorChatHref(fox, "app"), `/app/capture/${fox.captureId}?talk=1`);
    assert.equal(frontDoorChatHref(fox, "talk"), `/talk/red-fox?card=${fox.captureId}`);
    assert.equal(frontDoorChatHref({...fox, slug: null}, "talk"), `/app/capture/${fox.captureId}?talk=1`);
    assert.equal(frontDoorChatHref(FEATURED[1], "app"), "/talk/common-octopus");
    assert.equal(frontDoorChatHref({...FEATURED[1], slug: null}, "talk"), null);
});

test("the message waits for the chat it was sent to, and only that one", () => {
    const fox = own(2, "Red Fox");
    const now = 1_000_000;
    const toFox = frontDoorHandoff(fox, "  I keep   putting off my thesis ", now);
    assert.equal(toFox.text, "I keep putting off my thesis");
    assert.equal(handoffMatches(toFox, {captureId: fox.captureId, slug: "red-fox"}, now + 500), true);
    assert.equal(handoffMatches(toFox, {captureId: fox.captureId?.toUpperCase() ?? null, slug: null}, now + 500), true);
    // Not the species' public chat, nor another card, nor two minutes later.
    assert.equal(handoffMatches(toFox, {captureId: null, slug: "red-fox"}, now + 500), false);
    assert.equal(handoffMatches(toFox, {captureId: uuid(999), slug: "red-fox"}, now + 500), false);
    assert.equal(handoffMatches(toFox, {captureId: fox.captureId, slug: "red-fox"}, now + 3 * 60 * 1000), false);
    // A wild animal's public chat, by slug or by species; never a card's.
    const wild = animalForCandidate(decodeTalkSuggestion(answer(candidate(OCTOPUS, "wild")))!.pick!, []);
    assert.ok(wild);
    const toOctopus = frontDoorHandoff(wild, "What do I do about my boss", now);
    assert.equal(handoffMatches(toOctopus, {captureId: null, slug: "common-octopus"}, now), true);
    assert.equal(handoffMatches(toOctopus, {captureId: null, slug: "octopus", speciesProfileId: OCTOPUS}, now), true);
    assert.equal(handoffMatches(toOctopus, {captureId: uuid(5), slug: "common-octopus"}, now), false);
    // Kept as JSON in this browser, and read back.
    assert.deepEqual(decodeFrontDoorHandoff(JSON.stringify(toOctopus)), toOctopus);
    assert.equal(decodeFrontDoorHandoff("{"), null);
    assert.equal(decodeFrontDoorHandoff(JSON.stringify({text: " ", at: now})), null);
});

// MARK: - Words

test("the six strings are the apps' words, in every locale", () => {
    assert.deepEqual(TALK_FRONT_DOOR_WORDS_EN, {
        placeholder: "What's on your mind?",
        sendTo: "Send to {name}",
        change: "Change",
        whyContinuing: "Carrying on from earlier",
        whyFocus: "Working on this with you",
        whyLesson: "Fits best"
    });
    assert.deepEqual(talkFrontDoorWords((en as Record<string, unknown>).talkFrontDoor), TALK_FRONT_DOOR_WORDS_EN);
    const indonesian = (id as Record<string, unknown>).talkFrontDoor as Record<string, string>;
    for (const key of Object.keys(TALK_FRONT_DOOR_WORDS_EN)) {
        assert.equal(typeof indonesian?.[key], "string", key);
        assert.notEqual(indonesian[key], TALK_FRONT_DOOR_WORDS_EN[key as keyof typeof TALK_FRONT_DOOR_WORDS_EN], `${key} is translated`);
    }
    assert.match(indonesian.sendTo, /\{name\}/);
    // A missing word falls back to English.
    assert.equal(talkFrontDoorWords({change: "Ganti"}).placeholder, "What's on your mind?");
    const words = talkFrontDoorWords(null);
    assert.equal(frontDoorReason("continuing", words), "Carrying on from earlier");
    assert.equal(frontDoorReason("focus", words), "Working on this with you");
    assert.equal(frontDoorReason("lesson", words), "Fits best");
    assert.equal(frontDoorReason(null, words), null);
});

// MARK: - Where a message came from (SPEC 6.3)

test("the person's message keeps its door as meta.origin; anything else is ignored", async () => {
    const {buildChatTranscript, chatMessageOrigin} = await import("@/lib/ask-animaldex/chat-history");
    assert.equal(chatMessageOrigin("front_door"), "front_door");
    assert.equal(chatMessageOrigin("referral"), "referral");
    assert.equal(chatMessageOrigin("push"), null);
    assert.equal(chatMessageOrigin(undefined), null);
    const REQUEST = "6c3f8a3e-6a5b-4c55-9a66-8f9e3c1d2b10";
    const base = {
        userId: uuid(500),
        captureId: uuid(102),
        speciesProfileId: FOX,
        call: false,
        aboutTrial: false,
        greeting: false,
        requestId: REQUEST,
        question: "I keep putting off my thesis",
        answer: "A fox starts with the smallest hole.",
        askedAt: new Date("2026-11-07T08:00:00Z")
    };
    const sent = await buildChatTranscript({...base, origin: "front_door"});
    assert.deepEqual(sent?.p_messages[0].meta, {origin: "front_door"});
    // The reply never carries it.
    assert.equal(sent?.p_messages[1].meta, undefined);
    // Beside a step report, both are kept.
    const report = await buildChatTranscript({...base, origin: "referral", stepReport: {stepId: uuid(77), media: "photo"}});
    assert.deepEqual(report?.p_messages[0].meta, {step_report: {step_id: uuid(77), media_kind: "photo"}, origin: "referral"});
    // None, or an unknown door: no meta at all, as before.
    assert.equal((await buildChatTranscript(base))?.p_messages[0].meta, undefined);
    assert.equal((await buildChatTranscript({...base, origin: "elsewhere" as never}))?.p_messages[0].meta, undefined);
});
