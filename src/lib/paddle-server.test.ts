import assert from "node:assert/strict";
import test from "node:test";
import crypto from "crypto";
import {
    assertPaddleApiConfigured,
    assertPaddleCheckoutConfigured,
    assertPaddleWebhookConfigured,
    isAnimalDexProductionDeployment,
    paddleApiHost,
    paddlePriceIdForProduct,
    productCodeForPaddlePriceId,
    resolvePaddleEnvironment,
    verifyPaddleSignature
} from "./paddle-server";

const liveEnv = {
    PADDLE_ENVIRONMENT: "production",
    PADDLE_API_KEY: "pdl_live_apikey_example",
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "live_exampletokenexampletokenex",
    PADDLE_WEBHOOK_SECRET: "pdl_ntfset_example",
    PADDLE_PRICE_CREDITS_25: "pri_25",
    PADDLE_PRICE_CREDITS_100: "pri_100",
    PADDLE_PRICE_PRO_MONTHLY: "pri_pro",
    NEXT_PUBLIC_SITE_URL: "https://animaldex.app"
} as unknown as NodeJS.ProcessEnv;

const sandboxEnv = {
    PADDLE_ENVIRONMENT: "sandbox",
    PADDLE_API_KEY: "pdl_sdbx_apikey_example",
    NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_example",
    PADDLE_WEBHOOK_SECRET: "pdl_ntfset_example",
    PADDLE_PRICE_CREDITS_25: "pri_25",
    PADDLE_PRICE_CREDITS_100: "pri_100",
    PADDLE_PRICE_PRO_MONTHLY: "pri_pro",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000"
} as unknown as NodeJS.ProcessEnv;

function signedHeader(body: string, secret: string, timestamp: number) {
    const signature = crypto.createHmac("sha256", secret).update(`${timestamp}:${body}`).digest("hex");
    return `ts=${timestamp};h1=${signature}`;
}

test("Paddle catalog maps only server-side Price IDs", () => {
    assert.equal(paddlePriceIdForProduct("purchase_25", liveEnv), "pri_25");
    assert.equal(productCodeForPaddlePriceId("pri_100", liveEnv), "purchase_100");
    assert.equal(productCodeForPaddlePriceId("pri_foreign", liveEnv), null);
    assert.equal(assertPaddleCheckoutConfigured(liveEnv), null);
    assert.equal(assertPaddleApiConfigured(liveEnv), null);
    assert.equal(assertPaddleWebhookConfigured(liveEnv), null);
    assert.equal(resolvePaddleEnvironment(liveEnv), "production");
    assert.equal(paddleApiHost("production"), "https://api.paddle.com");
});

test("production animaldex.app rejects sandbox credentials", () => {
    assert.equal(isAnimalDexProductionDeployment(liveEnv), true);
    assert.match(assertPaddleCheckoutConfigured({...liveEnv, PADDLE_ENVIRONMENT: "sandbox"}) ?? "", /production animaldex.app/i);
    assert.match(assertPaddleCheckoutConfigured({...liveEnv, NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_token"}) ?? "", /live/);
    assert.match(assertPaddleApiConfigured({...liveEnv, PADDLE_API_KEY: "pdl_sdbx_apikey_example"}) ?? "", /live/);
    assert.match(assertPaddleCheckoutConfigured({...liveEnv, PADDLE_PRICE_CREDITS_100: "pri_25"}) ?? "", /distinct/);
    assert.match(assertPaddleWebhookConfigured({...liveEnv, PADDLE_WEBHOOK_SECRET: ""}) ?? "", /webhook secret/);
});

test("sandbox remains available only off the production host", () => {
    assert.equal(assertPaddleCheckoutConfigured(sandboxEnv), null);
    assert.equal(assertPaddleApiConfigured(sandboxEnv), null);
    assert.equal(paddleApiHost("sandbox"), "https://sandbox-api.paddle.com");
});

test("Paddle signature verifies raw body and rejects missing, modified, wrong, and stale requests", () => {
    const body = JSON.stringify({event_id: "evt_1", event_type: "transaction.completed"});
    const secret = "pdl_ntfset_test";
    const now = 1_700_000_000;
    assert.equal(verifyPaddleSignature(body, signedHeader(body, secret, now), secret, 5, now).ok, true);
    assert.equal(verifyPaddleSignature(body, null, secret, 5, now).ok, false);
    assert.equal(verifyPaddleSignature(`${body} `, signedHeader(body, secret, now), secret, 5, now).ok, false);
    assert.equal(verifyPaddleSignature(body, signedHeader(body, "wrong", now), secret, 5, now).ok, false);
    assert.equal(verifyPaddleSignature(body, signedHeader(body, secret, now - 6), secret, 5, now).ok, false);
});

test("signature verifier accepts either h1 during secret rotation", () => {
    const body = "{}";
    const now = 1_700_000_000;
    const valid = signedHeader(body, "secret", now).split("h1=")[1];
    assert.equal(verifyPaddleSignature(body, `ts=${now};h1=bad;h1=${valid}`, "secret", 5, now).ok, true);
});
