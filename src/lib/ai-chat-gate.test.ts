import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {describe, it} from "node:test";
import {fileURLToPath} from "node:url";
import {
    AI_CONSENT_VERSION,
    AI_LONG_SESSION_MS,
    AI_SESSION_IDLE_MS,
    AGE_RESTRICTED_COOKIE,
    ageBandFor,
    aiGateStep,
    birthYearOptions,
    hasAgeRestrictedMark,
    isAgeRestrictedPath,
    isCurrentConsent,
    isValidBirthYear,
    longSessionNoticeDue,
    parseAiSession,
    touchAiSession,
    type AiGateFacts
} from "./ai-chat-gate";

const NOW = new Date("2026-11-04T12:00:00Z");

describe("age bands", () => {
    it("are public.age_band's: the calendar year minus the birth year, the boundary year counting as the older band", () => {
        assert.equal(ageBandFor(null, NOW), "unknown");
        assert.equal(ageBandFor(2014, NOW), "under_13");
        assert.equal(ageBandFor(2013, NOW), "teen", "13 this calendar year is a teen");
        assert.equal(ageBandFor(2009, NOW), "teen");
        assert.equal(ageBandFor(2008, NOW), "adult", "18 this calendar year is an adult");
        assert.equal(ageBandFor(1990, NOW), "adult");
        assert.equal(ageBandFor(2012.5, NOW), "unknown");
    });

    it("take a year from 1900 to this year, newest first", () => {
        const years = birthYearOptions(NOW);
        assert.equal(years[0], 2026);
        assert.equal(years[years.length - 1], 1900);
        assert.ok(isValidBirthYear(1990, NOW));
        assert.ok(!isValidBirthYear(1899, NOW));
        assert.ok(!isValidBirthYear(2027, NOW));
        assert.ok(!isValidBirthYear("1990", NOW));
    });
});

describe("the gate before the first chat", () => {
    const facts = (overrides: Partial<AiGateFacts>): AiGateFacts => ({
        signedIn: true,
        birthYear: null,
        band: "unknown",
        ageCheckAvailable: true,
        consented: false,
        ...overrides
    });

    it("asks an account its age first, then for consent, then opens", () => {
        assert.equal(aiGateStep(facts({})), "age");
        assert.equal(aiGateStep(facts({birthYear: 1995, band: "adult"})), "consent");
        assert.equal(aiGateStep(facts({birthYear: 1995, band: "adult", consented: true})), "open");
        assert.equal(aiGateStep(facts({birthYear: 2010, band: "teen", consented: true})), "open");
    });

    it("closes Talk under 13, whatever else is true", () => {
        assert.equal(aiGateStep(facts({birthYear: 2016, band: "under_13", consented: true})), "blocked");
    });

    it("asks a guest only for consent, and never asks an age the server cannot keep", () => {
        assert.equal(aiGateStep(facts({signedIn: false})), "consent");
        assert.equal(aiGateStep(facts({signedIn: false, consented: true})), "open");
        assert.equal(aiGateStep(facts({ageCheckAvailable: false})), "consent", "before the migration: no age check");
        assert.equal(aiGateStep(facts({ageCheckAvailable: false, consented: true})), "open");
    });

    it("counts a stored consent only for the current version", () => {
        assert.equal(AI_CONSENT_VERSION, "2026-11");
        assert.ok(isCurrentConsent("2026-11"));
        assert.ok(!isCurrentConsent("2026-10"));
        assert.ok(!isCurrentConsent(null));
    });
});

describe("the long-session notice", () => {
    const start = Date.parse("2026-11-04T08:00:00Z");

    it("shows once a session has run past three hours, and a long gap starts a new session", () => {
        let session = touchAiSession(null, start);
        assert.equal(longSessionNoticeDue(session, start), false);
        for (let minute = 20; minute <= 180; minute += 20) session = touchAiSession(session, start + minute * 60_000);
        assert.equal(session.startedAt, start);
        assert.equal(longSessionNoticeDue(session, start + AI_LONG_SESSION_MS - 1), false);
        assert.equal(longSessionNoticeDue(session, start + AI_LONG_SESSION_MS), true);
        // Gone for an hour: a new session, and no notice until it too runs long.
        const later = start + AI_LONG_SESSION_MS + AI_SESSION_IDLE_MS + 60_000;
        assert.equal(longSessionNoticeDue(session, later), false);
        assert.equal(touchAiSession(session, later).startedAt, later);
    });

    it("reads back what it stored and refuses junk", () => {
        const session = touchAiSession(null, start);
        assert.deepEqual(parseAiSession(JSON.stringify(session)), session);
        assert.equal(parseAiSession("{"), null);
        assert.equal(parseAiSession(JSON.stringify({startedAt: 5, lastActiveAt: 1})), null);
        assert.equal(parseAiSession(null), null);
    });
});

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const readRepo = (path: string) => readFileSync(join(repoRoot, path), "utf8");

describe("every web chat carries the disclosure and asks through the gate (SPEC 3.1)", () => {
    it("has the spec's words, in both languages", () => {
        const en = JSON.parse(readRepo("src/data/locales/en.json")).askAnimalDex;
        assert.equal(en.consentBody, "The animals are AI. What you write is sent to our AI providers to create replies.");
        assert.equal(en.aiNotice, "Replies are AI-generated.");
        // Under 13, AnimalDex is closed, not only Talk (6 Nov 2026).
        assert.equal(en.under13Title, "AnimalDex is for ages 13 and up");
        assert.equal(en.ageTitle, "A quick age check");
        const id = JSON.parse(readRepo("src/data/locales/id.json")).askAnimalDex;
        for (const key of ["consentTitle", "consentBody", "consentMore", "consentAgree", "consentNotNow", "aiNotice", "aiNoticeLong", "aiNoticeBreak", "ageTitle", "ageBody", "under13Title", "under13Body", "under13Closing", "under13Failed", "under13Retry", "under13Support"]) {
            assert.equal(typeof id[key], "string", key);
            assert.equal(typeof en[key], "string", key);
        }
    });

    it("tags every chat header AI (the tag opens the safety page), keeps the three-hour notice, and gates every message", () => {
        const chat = readRepo("src/components/ask-animaldex/ask-conversation.tsx");
        // The header's AI tag is the disclosure and opens the safety page; the inline
        // "Replies are AI-generated." line left the top of the chat (owner, 2026-11-06).
        assert.match(chat, /<AiTag label=\{labels\.aiTagLabel\} linksToSafety \/>/);
        assert.doesNotMatch(chat, /<AiNotice text=\{labels\.aiNotice\}/);
        assert.match(chat, /labels\.aiNoticeBreak : labels\.aiNoticeLong/);
        assert.match(chat, /if \(!\(await aiGate\.request\(\)\)\) return null;/);
        assert.match(chat, /aiGate\.blocked \?/);
        assert.match(readRepo("src/app/[locale]/talk/talk-chat.tsx"), /<AiTag label=\{labels\.aiTagLabel\} \/>/);
        assert.match(readRepo("src/app/[locale]/(authenticated)/app/debates/[id]/debate-detail.tsx"), /<AiTag \/>/);
        assert.match(readRepo("src/app/[locale]/layout.tsx"), /<AiChatGateProvider words=\{gateWords\}>/);
        // The home demo's chips send our words: an account is still gated, a guest is not asked.
        const demo = readRepo("src/app/[locale]/(composited)/(home)/_components/home-idea-demo.tsx");
        assert.match(demo, /gate\.request\(\{ownWords: false\}\)/);
        assert.match(demo, /<AiTag/);
        // The consent links the safety page, which exists.
        assert.match(readRepo("src/components/ai-gate/ai-chat-gate.tsx"), /AI_SAFETY_HREF = "\/legal\/ai-and-safety"/);
        assert.match(readRepo("src/app/legal/ai-and-safety/page.tsx"), /ai-and-safety/);
    });

    it("never blocks a chat because the backend migration is missing", () => {
        const route = readRepo("src/app/api/app/ai-gate/route.ts");
        assert.match(route, /missing: true/);
        assert.match(route, /available: false/);
        assert.match(route, /isSameOriginBrowserRequest/);
    });
});

describe("under 13, AnimalDex is closed (6 Nov 2026)", () => {
    it("marks this browser, and the mark shows the block on the web app and sign-in", () => {
        assert.equal(AGE_RESTRICTED_COOKIE, "adx_age_restricted");
        assert.ok(hasAgeRestrictedMark("adx_ft=x; adx_age_restricted=1"));
        assert.ok(hasAgeRestrictedMark("adx_age_restricted=1"));
        assert.ok(!hasAgeRestrictedMark("adx_age_restricted=0; other=1"));
        assert.ok(!hasAgeRestrictedMark(""));
        assert.ok(!hasAgeRestrictedMark(null));
        assert.ok(isAgeRestrictedPath("/app"));
        assert.ok(isAgeRestrictedPath("/id/app/settings"));
        assert.ok(isAgeRestrictedPath("/account"));
        assert.ok(!isAgeRestrictedPath("/animals/red-fox"));
        assert.ok(!isAgeRestrictedPath("/apple"));
    });

    it("closes the account through delete-account, signs out and keeps the mark", () => {
        const route = readRepo("src/app/api/app/ai-gate/route.ts");
        assert.match(route, /action === "close_under_13"/);
        assert.match(route, /functions\/v1\/delete-account/);
        assert.match(route, /auth\.signOut\(\)/);
        assert.match(route, /AGE_RESTRICTED_COOKIE/);
        // Only an account the age check put under 13.
        assert.match(route, /ageBandFor\(kept\) !== "under_13"/);
        const gate = readRepo("src/components/ai-gate/ai-chat-gate.tsx");
        assert.match(gate, /close_under_13/);
        assert.match(gate, /hasAgeRestrictedMark/);
        assert.match(gate, /words\.under13Support/);
    });
});
