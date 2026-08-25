import assert from "node:assert/strict";
import test from "node:test";
import {isSupabaseAuthCookieName, requestHasSupabaseAuthCookie} from "./supabase/auth-cookie";

test("recognizes current and chunked Supabase auth cookie names", () => {
    assert.equal(isSupabaseAuthCookieName("sb-abc123-auth-token"), true);
    assert.equal(isSupabaseAuthCookieName("sb-abc123-auth-token.0"), true);
    assert.equal(isSupabaseAuthCookieName("sb-abc123-auth-token.1"), true);
    assert.equal(isSupabaseAuthCookieName("sb-abc123-auth-token-code-verifier"), true);
    assert.equal(isSupabaseAuthCookieName("animaldex_guest"), false);
    assert.equal(isSupabaseAuthCookieName("animaldex_support_admin"), false);
});

test("detects auth cookies from Next cookie lists and Cookie header strings", () => {
    assert.equal(requestHasSupabaseAuthCookie([{name: "sb-ref-auth-token"}]), true);
    assert.equal(requestHasSupabaseAuthCookie([{name: "theme"}]), false);
    assert.equal(requestHasSupabaseAuthCookie("theme=dark; sb-ref-auth-token=jwt"), true);
    assert.equal(requestHasSupabaseAuthCookie("animaldex_guest=abc"), false);
    assert.equal(requestHasSupabaseAuthCookie(""), false);
    assert.equal(requestHasSupabaseAuthCookie(undefined), false);
});
