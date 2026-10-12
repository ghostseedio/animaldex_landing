import assert from "node:assert/strict";
import test from "node:test";
import {adminLoginThrottledResponse, throttleAdminLogin} from "./admin-login-throttle";

function requestFrom(ip: string) {
    return new Request("http://localhost/api/admin/support/login", {method: "POST", headers: {"x-forwarded-for": ip}});
}

test("a client is cut off after a few attempts in the window", () => {
    const scope = `per-client-${Date.now()}`;
    let allowed = 0;
    for (let i = 0; i < 20; i += 1) {
        if (throttleAdminLogin(requestFrom("203.0.113.9"), scope).allowed) allowed += 1;
    }
    assert.equal(allowed, 8);

    const blocked = throttleAdminLogin(requestFrom("203.0.113.9"), scope);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterSeconds >= 1);

    // A different client in the same scope still gets its own allowance.
    assert.equal(throttleAdminLogin(requestFrom("203.0.113.10"), scope).allowed, true);
});

test("rotating the forwarded address does not escape the global ceiling", () => {
    const scope = `global-${Date.now()}`;
    let allowed = 0;
    for (let i = 0; i < 200; i += 1) {
        if (throttleAdminLogin(requestFrom(`198.51.100.${i % 250}`), scope).allowed) allowed += 1;
    }
    assert.equal(allowed, 60);
});

test("the throttled response is a 429 with Retry-After", async () => {
    const response = adminLoginThrottledResponse({allowed: false, retryAfterSeconds: 42});
    assert.equal(response.status, 429);
    assert.equal(response.headers.get("retry-after"), "42");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal((await response.json()).ok, false);
});
