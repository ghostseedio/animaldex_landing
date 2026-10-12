import assert from "node:assert/strict";
import test from "node:test";
import {evaluateAdminApiRequest, isAdminApiPath} from "./admin-request-policy";

const hosts = ["localhost:3000", "animaldex.app", "https://www.animaldex.app"];

test("safe methods always pass, including the cross-site OAuth callback navigation", () => {
    assert.deepEqual(evaluateAdminApiRequest({method: "GET", origin: null, secFetchSite: "cross-site", allowedHosts: hosts}), {allowed: true});
    assert.deepEqual(evaluateAdminApiRequest({method: "HEAD", origin: "https://evil.example", secFetchSite: null, allowedHosts: hosts}), {allowed: true});
});

test("same-origin browser writes pass whichever host the proxy presents", () => {
    assert.deepEqual(
        evaluateAdminApiRequest({method: "POST", origin: "https://www.animaldex.app", secFetchSite: "same-origin", allowedHosts: ["localhost:3000", null, "https://www.animaldex.app"]}),
        {allowed: true}
    );
    assert.deepEqual(
        evaluateAdminApiRequest({method: "DELETE", origin: "http://localhost:3000", secFetchSite: "same-origin", allowedHosts: hosts}),
        {allowed: true}
    );
    assert.deepEqual(
        evaluateAdminApiRequest({method: "PUT", origin: "https://ANIMALDEX.app", secFetchSite: null, allowedHosts: hosts}),
        {allowed: true}
    );
});

test("cross-site browser writes are refused", () => {
    assert.deepEqual(
        evaluateAdminApiRequest({method: "POST", origin: "https://evil.example", secFetchSite: "cross-site", allowedHosts: hosts}),
        {allowed: false, reason: "cross-site"}
    );
    assert.deepEqual(
        evaluateAdminApiRequest({method: "POST", origin: "https://evil.example", secFetchSite: null, allowedHosts: hosts}),
        {allowed: false, reason: "foreign-origin"}
    );
    assert.deepEqual(
        evaluateAdminApiRequest({method: "POST", origin: "null", secFetchSite: null, allowedHosts: hosts}),
        {allowed: false, reason: "foreign-origin"}
    );
    assert.deepEqual(
        evaluateAdminApiRequest({method: "POST", origin: "https://animaldex.app.evil.example", secFetchSite: null, allowedHosts: hosts}),
        {allowed: false, reason: "foreign-origin"}
    );
});

test("non-browser callers without browser headers reach the handler's own auth", () => {
    assert.deepEqual(evaluateAdminApiRequest({method: "POST", origin: null, secFetchSite: null, allowedHosts: hosts}), {allowed: true});
});

test("only /api/admin paths are covered", () => {
    assert.equal(isAdminApiPath("/api/admin"), true);
    assert.equal(isAdminApiPath("/api/admin/support/login"), true);
    assert.equal(isAdminApiPath("/api/administrators"), false);
    assert.equal(isAdminApiPath("/admin"), false);
    assert.equal(isAdminApiPath("/api/support/reply"), false);
});
