import assert from "node:assert/strict";
import test from "node:test";
import {
    createSupportAdminSession,
    supportAdminPasswordMaxLength,
    verifySupportAdminPassword,
    verifySupportAdminSession
} from "./support-admin-auth";

function withEnv(values: Record<string, string | undefined>, run: () => void) {
    const previous: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(values)) {
        previous[key] = process.env[key];
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    try {
        run();
    } finally {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    }
}

const configured = {
    SUPPORT_ADMIN_PASSWORD: "correct horse battery staple",
    SUPPORT_ADMIN_SESSION_SECRET: "session-secret-for-tests",
    ADMIN_SUPPORT_PASSWORD: undefined,
    NEXTAUTH_SECRET: undefined
};

test("a freshly minted session verifies and a tampered one does not", () => {
    withEnv(configured, () => {
        const session = createSupportAdminSession();
        assert.equal(verifySupportAdminSession(session), true);

        const [version, expiresAt, nonce, signature] = session.split(".");
        assert.equal(version, "v2");
        assert.equal(verifySupportAdminSession(`${version}.${Number(expiresAt) + 60_000}.${nonce}.${signature}`), false);
        assert.equal(verifySupportAdminSession(`${version}.${expiresAt}.${nonce}x.${signature}`), false);
        assert.equal(verifySupportAdminSession(`${version}.${expiresAt}.${nonce}.${signature.slice(1)}`), false);
        assert.equal(verifySupportAdminSession(`v1.${expiresAt}.${nonce}.${signature}`), false);
        assert.equal(verifySupportAdminSession(undefined), false);
        assert.equal(verifySupportAdminSession(""), false);
    });
});

test("legacy three-part sessions are rejected", () => {
    withEnv(configured, () => {
        const expiresAt = Date.now() + 60_000;
        assert.equal(verifySupportAdminSession(`${expiresAt}.nonce.signature`), false);
    });
});

test("rotating the password revokes every outstanding session", () => {
    let session = "";
    withEnv(configured, () => {
        session = createSupportAdminSession();
        assert.equal(verifySupportAdminSession(session), true);
    });
    withEnv({...configured, SUPPORT_ADMIN_PASSWORD: "a new password"}, () => {
        assert.equal(verifySupportAdminSession(session), false);
    });
});

test("rotating the session secret revokes every outstanding session", () => {
    let session = "";
    withEnv(configured, () => {
        session = createSupportAdminSession();
    });
    withEnv({...configured, SUPPORT_ADMIN_SESSION_SECRET: "another secret"}, () => {
        assert.equal(verifySupportAdminSession(session), false);
    });
});

test("password check refuses empty config, wrong values and oversized input", () => {
    withEnv(configured, () => {
        assert.equal(verifySupportAdminPassword("correct horse battery staple"), true);
        assert.equal(verifySupportAdminPassword("correct horse battery stapl"), false);
        assert.equal(verifySupportAdminPassword(""), false);
        assert.equal(verifySupportAdminPassword("x".repeat(supportAdminPasswordMaxLength + 1)), false);
    });
    withEnv({...configured, SUPPORT_ADMIN_PASSWORD: undefined}, () => {
        assert.equal(verifySupportAdminPassword(""), false);
        assert.equal(verifySupportAdminPassword("anything"), false);
    });
});
