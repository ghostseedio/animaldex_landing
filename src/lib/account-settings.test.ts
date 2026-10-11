import assert from "node:assert/strict";
import test from "node:test";
import {
    accountStandingFooter,
    accountStandingValue,
    convertFromUsd,
    decodeAccountStanding,
    missionsSubtitle,
    normalizeLocationVisibility,
    passwordChangeFootnote,
    passwordChangeProblem,
    resolveDisplayCurrency,
    signInMethodLabels
} from "@/lib/account-settings";

test("sign-in methods read as iOS words them, once each", () => {
    assert.deepEqual(signInMethodLabels(["email", "google", "email", "apple"]), ["Email and password", "Google", "Sign in with Apple"]);
    assert.deepEqual(signInMethodLabels(["twitter", "azure"]), ["X", "Microsoft"]);
    assert.match(passwordChangeFootnote(["Sign in with Apple"]), /^This account uses Sign in with Apple/);
});

test("a password change is refused before it reaches the server when it cannot work", () => {
    assert.equal(passwordChangeProblem({current: "", next: "abcdefgh", confirm: "abcdefgh"}), "Enter your current password.");
    assert.match(passwordChangeProblem({current: "x", next: "short", confirm: "short"}) ?? "", /8–128/);
    assert.equal(passwordChangeProblem({current: "x", next: "abcdefgh", confirm: "abcdefgX"}), "New passwords don’t match.");
    assert.equal(passwordChangeProblem({current: "abcdefgh", next: "abcdefgh", confirm: "abcdefgh"}), "New password must be different from your current password.");
    assert.equal(passwordChangeProblem({current: "old-one", next: "abcdefgh", confirm: "abcdefgh"}), null);
});

test("account standing decodes the RPC and words each state", () => {
    const standing = decodeAccountStanding({standing: "at_risk", strikeCount: 1, maxStrikes: 3, strikes: [{id: "a", reason: "Fake location", createdAt: "2026-10-01T00:00:00Z"}]});
    assert.equal(accountStandingValue(standing), "1 of 3 strikes");
    assert.match(accountStandingFooter(standing), /Three strikes suspend/);
    assert.equal(accountStandingValue(decodeAccountStanding(null)), "Good standing");
    assert.equal(accountStandingFooter(decodeAccountStanding({standing: "suspended"})), "This account is suspended.");
});

test("missions row and location privacy fall back safely", () => {
    assert.equal(missionsSubtitle(0), "Earn credits through progression");
    assert.equal(missionsSubtitle(1), "1 active mission");
    assert.equal(missionsSubtitle(4), "4 active missions");
    assert.equal(normalizeLocationVisibility("friends"), "friends");
    assert.equal(normalizeLocationVisibility("nobody"), "everyone");
});

test("display currency follows the iOS reference rates", () => {
    assert.equal(resolveDisplayCurrency("system", "GBP"), "GBP");
    assert.equal(resolveDisplayCurrency("eur", "GBP"), "EUR");
    assert.equal(resolveDisplayCurrency("XYZ", "XYZ"), "USD");
    assert.equal(convertFromUsd(100, "USD"), 100);
    assert.ok(Math.abs((convertFromUsd(117.33, "EUR") ?? 0) - 100) < 1e-9);
});
