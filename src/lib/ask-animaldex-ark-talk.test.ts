import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {test} from "node:test";
import {
    ARK_ANONYMOUS_VISITOR,
    arkChatTurn,
    arkForClient,
    arkRefusal,
    arkVisitorNoteName,
    arkVisitorOwnerContext,
    askArkRequest,
    parseArkChatAnimal,
    type ArkChatAnimal
} from "@/lib/ask-animaldex/ark-chat-visitor";
import {visitorOwnerContext} from "@/lib/ask-animaldex/ark-sim";
import {buildChatTranscript, chatTranscriptSkip, type ChatTranscriptInput} from "@/lib/ask-animaldex/chat-history";
import {askThreadKey} from "@/lib/ask-animaldex/thread";
import {askDeclaredSubject} from "@/lib/ask-animaldex/subject";
import {
    askVisitorNoticeText,
    buildAskVisitorNotePrompts,
    deliveredAskVisitorNoteIds,
    parseAskPendingVisitorNotes
} from "@/lib/ask-animaldex/visitor-notes";

/**
 * Ark Talk on the website (Ark player control phase 2): the web port of
 * AnimalDex `_shared/ark-chat-visitor.ts` (F1, F2, D13, D14). No model is called.
 */

const repoRoot = process.cwd();
const readRepo = (...parts: string[]) => readFileSync(join(repoRoot, ...parts), "utf8");

const OWNER = "0a0a0a0a-1111-4222-8333-444455556666";
const VISITOR = "0b0b0b0b-1111-4222-8333-444455556666";
const ANIMAL = "0c0c0c0c-1111-4222-8333-444455556666";
const VOYAGE = "0d0d0d0d-1111-4222-8333-444455556666";
const SPECIES = "0e0e0e0e-1111-4222-8333-444455556666";
const CAPTURE = "0f0f0f0f-1111-4222-8333-444455556666";
const CLIENT_CAPTURE = "1a1a1a1a-1111-4222-8333-444455556666";
const DISPLAY_NAME = "Alice Wonderland";
const HANDLE = "alice";

function rpcRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        animal_id: ANIMAL,
        voyage_id: VOYAGE,
        species_profile_id: SPECIES,
        species_slug: "cheetah",
        alive: true,
        origin: "arrived",
        audience: "visitor",
        owner_user_id: OWNER,
        capture_id: CAPTURE,
        owner_label: {label: "Voyager 7", named: false, handle: null},
        visitor_label: "Voyager 12",
        ...overrides
    };
}

function animal(overrides: Record<string, unknown> = {}): ArkChatAnimal {
    const parsed = parseArkChatAnimal(rpcRow(overrides));
    assert.ok(parsed);
    return parsed;
}

const ownerContextRow = {
    owner_name: DISPLAY_NAME,
    owner_username: HANDLE,
    share_journey: true,
    journey: {note: "We worked on finishing what we start.", exchanges: 4},
    has_spoken: true,
    diary_visibility: "public",
    public_diary: []
};

test("F1: an Ark subject is the Ark animal's; a malformed id is refused, never read as a card", () => {
    assert.deepEqual(askArkRequest({arkAnimalId: ANIMAL.toUpperCase(), captureId: CLIENT_CAPTURE}), {arkAnimalId: ANIMAL, invalid: false});
    for (const bad of ["", "nope", 7, {}]) assert.deepEqual(askArkRequest({arkAnimalId: bad}), {arkAnimalId: null, invalid: true});
    assert.deepEqual(askArkRequest({captureId: CLIENT_CAPTURE}), {arkAnimalId: null, invalid: false});
    assert.deepEqual(askArkRequest(null), {arkAnimalId: null, invalid: false});
    // The request's subject drops the browser's card on the Ark path (request.ts is server-only: read as source).
    const request = readRepo("src/lib/ask-animaldex/request.ts");
    const branchAt = request.indexOf("if (ark.arkAnimalId) {");
    assert.ok(branchAt > 0);
    const arkBranch = request.slice(branchAt, request.indexOf("\n    }\n", branchAt));
    assert.match(arkBranch, /captureId: null,/);
    assert.match(arkBranch, /trialContext: null,/);
    assert.match(arkBranch, /arkAnimalId: ark\.arkAnimalId/);
});

test("F1: the audience comes from the Ark animal: owner, visitor, public; inconsistent or dead is refused", () => {
    const own = arkChatTurn(animal({audience: "owner", owner_label: null, visitor_label: null}), OWNER);
    assert.equal(own?.audience, "owner");
    assert.deepEqual(own?.thread, {captureId: CAPTURE, speciesProfileId: SPECIES});
    assert.equal(own?.promptCaptureId, CAPTURE);

    const visit = arkChatTurn(animal(), VISITOR);
    assert.equal(visit?.audience, "visitor");
    assert.equal(visit?.ownerId, OWNER);
    assert.equal(visit?.noteCaptureId, CAPTURE);
    // Nothing of the owner's capture reaches a visitor's prompt, and the visit is not kept.
    assert.equal(visit?.promptCaptureId, null);
    assert.equal(visit?.thread, null);

    for (const row of [
        rpcRow({origin: "born", audience: "public", owner_user_id: null, capture_id: null, owner_label: null, visitor_label: null}),
        rpcRow({audience: "public", owner_user_id: OWNER, capture_id: CAPTURE})
    ]) {
        for (const caller of [OWNER, VISITOR]) {
            const turn = arkChatTurn(parseArkChatAnimal(row), caller);
            assert.equal(turn?.audience, "public");
            assert.equal(turn?.ownerId, null);
            assert.equal(turn?.noteCaptureId, null);
            assert.equal(turn?.ownerLabel, null);
        }
    }
    assert.equal(arkChatTurn(animal(), OWNER), null);
    assert.equal(arkChatTurn(animal({audience: "owner"}), VISITOR), null);
    assert.equal(arkChatTurn(animal({alive: false}), VISITOR), null);
    assert.equal(arkChatTurn(animal(), null), null);
    // D13: a sleeper is alive; nothing asks the hour.
    assert.equal(arkChatTurn(animal({asleep: true}), VISITOR)?.audience, "visitor");
});

test("F2: the owner is the Ark label to a visitor; owner_username only when named; the display name nowhere", () => {
    const unnamed = arkVisitorOwnerContext(ownerContextRow, arkChatTurn(animal({owner_label: {label: "Voyager 7", named: false, handle: HANDLE}}), VISITOR)!.ownerLabel)!;
    assert.equal(unnamed.owner_name, "Voyager 7");
    assert.equal("owner_username" in unnamed, false);
    const prompted = JSON.stringify(visitorOwnerContext(unnamed));
    assert.ok(!prompted.includes(DISPLAY_NAME) && !prompted.includes(HANDLE));

    const named = arkVisitorOwnerContext(ownerContextRow, parseArkChatAnimal(rpcRow({owner_label: {label: HANDLE, named: true, handle: HANDLE}}))!.ownerLabel)!;
    assert.equal(named.owner_name, `@${HANDLE}`);
    assert.equal(named.owner_username, HANDLE);
    assert.ok(!JSON.stringify(named).includes(DISPLAY_NAME));

    const none = arkVisitorOwnerContext(ownerContextRow, null)!;
    assert.equal("owner_name" in none, false);
    assert.equal(askVisitorNoticeText("English", null), null);
    const notice = askVisitorNoticeText("English", "Voyager 7")!;
    assert.ok(notice.includes("Voyager 7") && !notice.includes(DISPLAY_NAME));
});

test("D14: an Ark visit's gist and the owner's notes use the visitor's Ark label; '@handle' delivers said with or without '@'", () => {
    assert.equal(arkVisitorNoteName(arkChatTurn(animal({visitor_label: "a Voyager"}), VISITOR)!), ARK_ANONYMOUS_VISITOR);
    assert.equal(arkVisitorNoteName(arkChatTurn(animal({visitor_label: null}), VISITOR)!), ARK_ANONYMOUS_VISITOR);
    assert.equal(arkVisitorNoteName(arkChatTurn(animal({visitor_label: "@victor"}), VISITOR)!), "@victor");
    const prompts = buildAskVisitorNotePrompts({
        ownerName: "Voyager 7",
        animalName: "Cheetah",
        visitorName: "a Voyager",
        existingNote: null,
        visitorMessage: "What does your owner work on with you?",
        answer: "Finishing what they start."
    });
    assert.ok(prompts.user.includes("visitor_name: a Voyager") && !prompts.user.includes(DISPLAY_NAME));
    const notes = parseAskPendingVisitorNotes([
        {id: "n1", visitor: "@victor", note: "asked what you work on", day: "2026-11-12"},
        {id: "n2", visitor: "a Voyager", note: "asked about your dives", day: "2026-11-12"}
    ]);
    assert.deepEqual(deliveredAskVisitorNoteIds(notes, "Victor came by."), ["n1"]);
    assert.deepEqual(deliveredAskVisitorNoteIds(notes, "A Voyager asked about your dives."), ["n2"]);
});

test("an Ark visit is not kept in history; the browser hears no person's or capture's id", async () => {
    const visit = arkChatTurn(animal(), VISITOR)!;
    const input: ChatTranscriptInput = {
        userId: VISITOR,
        captureId: visit.thread?.captureId ?? null,
        arkVisit: !visit.thread,
        speciesProfileId: SPECIES,
        call: false,
        aboutTrial: false,
        greeting: false,
        requestId: "8f9e0a1b-1111-4222-8333-444455556666",
        question: "Who looks after you?",
        answer: "Voyager 7 does.",
        askedAt: new Date("2026-11-12T00:00:00Z")
    };
    assert.equal(chatTranscriptSkip(input), "ark_visit");
    assert.equal(await buildChatTranscript(input), null);
    const sent = JSON.stringify(arkForClient(visit));
    assert.deepEqual(JSON.parse(sent), {animal_id: ANIMAL, audience: "visitor", owner_label: "Voyager 7"});
    for (const secret of [OWNER, VISITOR, CAPTURE, VOYAGE]) assert.ok(!sent.includes(secret));
    assert.deepEqual(arkRefusal("signed_out"), {body: {error: "ark_sign_in_required"}, status: 401});
    assert.equal(arkRefusal("unavailable").status, 503);
});

test("the Talk page's ?ark= is the subject's arkAnimalId, in its own local thread", () => {
    const subject = askDeclaredSubject("/talk/cheetah", {scope: "species", slug: "cheetah", name: "Cheetah", captureId: null, arkAnimalId: ANIMAL}, null);
    assert.equal(subject.arkAnimalId, ANIMAL);
    assert.equal(askThreadKey(subject), `ark:${ANIMAL}`);
    assert.equal(askThreadKey({...subject, arkAnimalId: null}), "species:cheetah");
    const chat = readRepo("src/app/[locale]/talk/talk-chat.tsx");
    assert.match(chat, /params\.get\("ark"\)/);
    assert.match(chat, /arkAnimalId\}, null\)/);
    // The request body carries it (both turns and the hello).
    const thread = readRepo("src/components/ask-animaldex/use-ask-thread.ts");
    assert.equal(thread.split("...(subject.arkAnimalId ? {arkAnimalId: subject.arkAnimalId} : {})").length - 1, 2);
    assert.match(readRepo("src/app/[locale]/talk/talk-picker.tsx"), /arkAnimalId: ark\}/);
});

test("/api/ask/stream: the Ark decides before anything reads the subject, and a visitor gets nothing owner-only", () => {
    const route = readRepo("src/app/api/ask/stream/route.ts");
    const arkAt = route.indexOf("const arkAsked = askArkRequest(body.subject);");
    const packetAt = route.indexOf("const basePacketPending = buildAskPacket({subject");
    assert.ok(arkAt > 0 && packetAt > arkAt, "the Ark animal is resolved before the record is read");
    assert.ok(route.includes('if (arkAsked.invalid) return askJson({error: "invalid_ark_animal_id"}, 400);'));
    assert.ok(route.includes("loadAskArkAnimal(arkAsked.arkAnimalId!, reader.userId)"));
    // The browser's card and slug are replaced by the Ark animal's species; its capture never.
    assert.ok(route.includes("slug: arkTurn?.speciesSlug ?? null,\n            captureId: null,"));
    // Owner and visitor come from the Ark; every owner-only read keys off ownsCapture (the loop, bond, progress, notes).
    assert.ok(route.includes('const ownsCapture = arkTurn ? arkTurn.audience === "owner" :'));
    assert.ok(route.includes('const isVisit = arkTurn ? arkTurn.audience === "visitor" :'));
    assert.ok(route.includes("const ownerSpeciesIdPending = speciesIdPending.then((speciesId) => (ownsCapture && viewer.userId ? speciesId : null));"));
    assert.ok(route.includes(".then((context) => (arkTurn ? arkVisitorOwnerContext(context, arkTurn.ownerLabel) : context))"));
    assert.ok(route.includes("const howYouMet = card && !(arkTurn && isVisit) ?"));
    assert.ok(route.includes("captureId: arkTurn ? arkTurn.noteCaptureId : subject.captureId,"));
    assert.ok(route.includes("arkVisit: Boolean(arkTurn && !arkTurn.thread),"));
    assert.ok(route.includes("arkVoyageId: arkTurn?.voyageId ?? null"));
    assert.ok(route.includes('arkTurn.audience === "public"'));
    // The visitor's card on the Ark is whose it is, nothing of the capture.
    assert.ok(route.includes("arkVisitorCard(arkTurn.ownerId)"));
    // A gone animal still answers an emergency first.
    const refusal = route.slice(route.indexOf("if (arkAsked.arkAnimalId && !(arkTurn && arkTurn.speciesSlug)) {"));
    assert.ok(refusal.indexOf("crisisFor()") < refusal.indexOf("await refund();"));
    const context = readRepo("src/app/api/ask/context/route.ts");
    assert.ok(context.includes("arkTurn ? Promise.resolve(isVisit ? arkTurn.ownerLabel?.label ?? null : null)"));
});
