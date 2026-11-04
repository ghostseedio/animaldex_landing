import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
    AI_CONSENT_VERSION,
    AI_LONG_SESSION_MS,
    AI_SESSION_IDLE_MS,
    ageBandFor,
    aiGateStep,
    birthYearOptions,
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
