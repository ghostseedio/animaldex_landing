import assert from "node:assert/strict";
import test from "node:test";
import {COMMUNITY_TERMS_KEY} from "@/lib/community-terms";
import {acceptedTermsCacheKey, cachedTermsAccepted, parseTermsStatus, rememberTermsAccepted, termsGateBlocks, UPDATED_TERMS_WORDS} from "@/lib/updated-terms";

test("updated terms: only a readable 'not agreed' status blocks", () => {
    assert.equal(termsGateBlocks(parseTermsStatus({version: "2026-11-17", accepted: false, accepted_at: null})), true);
    assert.equal(termsGateBlocks(parseTermsStatus({version: "2026-11-17", accepted: true, accepted_at: "2026-11-17T10:00:00Z"})), false);
    // Offline, a missing RPC (migration not applied) or a strange answer never locks anyone out.
    assert.equal(termsGateBlocks(null), false);
    assert.equal(termsGateBlocks(parseTermsStatus(null)), false);
    assert.equal(termsGateBlocks(parseTermsStatus({accepted: false})), false);
    assert.equal(termsGateBlocks(parseTermsStatus([{version: "x", accepted: false}])), false);
});

test("updated terms: agreeing remembers this version and the Community Terms", () => {
    const store = new Map<string, string>();
    const storage = {getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value)};
    assert.equal(cachedTermsAccepted(storage, "u1", "2026-11-17"), false);
    rememberTermsAccepted(storage, "u1", "2026-11-17");
    assert.equal(cachedTermsAccepted(storage, "u1", "2026-11-17"), true);
    assert.equal(cachedTermsAccepted(storage, "u1", "2027-01-01"), false);
    assert.equal(cachedTermsAccepted(storage, "u2", "2026-11-17"), false);
    assert.equal(store.get(COMMUNITY_TERMS_KEY), "true");
    assert.equal(acceptedTermsCacheKey("u1", "v"), "animaldex.acceptedTerms.u1.v");
});

test("updated terms: the people clause is on the screen", () => {
    const text = UPDATED_TERMS_WORDS.rules.join(" ");
    assert.match(text, /Captures can show people/);
    assert.match(text, /permission or the right to share/);
    assert.match(text, /support@animaldex\.app/);
});
