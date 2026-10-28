import assert from "node:assert/strict";
import test from "node:test";
import crypto from "crypto";
import {
    assertPaddleApiConfigured,
    assertPaddleClientConfigured,
    assertPaddleProductCheckoutConfigured,
    assertPaddleWebhookConfigured,
    isAnimalDexProductionDeployment,
    paddleApiHost,
    paddleCatalogError,
    paddlePriceIdForProduct,
    paddleProductAvailability,
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
    assert.equal(productCodeForPaddlePriceId("", liveEnv), null);
    assert.equal(assertPaddleClientConfigured(liveEnv), null);
    assert.equal(assertPaddleProductCheckoutConfigured("pro_upgrade", liveEnv), null);
    assert.deepEqual(paddleProductAvailability(liveEnv), {purchase_25: true, purchase_100: true, pro_upgrade: true});
    assert.equal(assertPaddleApiConfigured(liveEnv), null);
    assert.equal(assertPaddleWebhookConfigured(liveEnv), null);
    assert.equal(resolvePaddleEnvironment(liveEnv), "production");
    assert.equal(paddleApiHost("production"), "https://api.paddle.com");
});

test("production animaldex.app rejects sandbox credentials", () => {
    assert.equal(isAnimalDexProductionDeployment(liveEnv), true);
    assert.match(assertPaddleClientConfigured({...liveEnv, PADDLE_ENVIRONMENT: "sandbox"}) ?? "", /production animaldex.app/i);
    assert.match(assertPaddleApiConfigured({...liveEnv, PADDLE_ENVIRONMENT: "sandbox"}) ?? "", /production animaldex.app/i);
    assert.match(assertPaddleClientConfigured({...liveEnv, NEXT_PUBLIC_PADDLE_CLIENT_TOKEN: "test_token"}) ?? "", /live/);
    assert.match(assertPaddleApiConfigured({...liveEnv, PADDLE_API_KEY: "pdl_sdbx_apikey_example"}) ?? "", /live/);
    assert.match(assertPaddleProductCheckoutConfigured("pro_upgrade", {...liveEnv, PADDLE_PRICE_CREDITS_100: "pri_25"}) ?? "", /distinct/);
    assert.match(assertPaddleWebhookConfigured({...liveEnv, PADDLE_WEBHOOK_SECRET: ""}) ?? "", /webhook secret/);
    // Nothing can be sold that the webhook could not fulfil.
    assert.match(assertPaddleProductCheckoutConfigured("purchase_25", {...liveEnv, PADDLE_WEBHOOK_SECRET: ""}) ?? "", /webhook secret/);
});

test("each catalog product is available on its own Price ID", () => {
    const proOnly = {...liveEnv, PADDLE_PRICE_CREDITS_25: "", PADDLE_PRICE_CREDITS_100: undefined} as unknown as NodeJS.ProcessEnv;
    assert.equal(paddleCatalogError(proOnly), null);
    assert.equal(assertPaddleProductCheckoutConfigured("pro_upgrade", proOnly), null);
    assert.match(assertPaddleProductCheckoutConfigured("purchase_25", proOnly) ?? "", /PADDLE_PRICE_CREDITS_25/);
    assert.deepEqual(paddleProductAvailability(proOnly), {purchase_25: false, purchase_100: false, pro_upgrade: true});
    assert.equal(productCodeForPaddlePriceId("pri_pro", proOnly), "pro_upgrade");

    const packsOnly = {...liveEnv, PADDLE_PRICE_PRO_MONTHLY: ""} as unknown as NodeJS.ProcessEnv;
    assert.deepEqual(paddleProductAvailability(packsOnly), {purchase_25: true, purchase_100: true, pro_upgrade: false});
});

test("a missing catalog Price ID never stops the webhook, the API or Wildlife Guide checkout", () => {
    const noCatalog = {
        ...liveEnv,
        PADDLE_PRICE_CREDITS_25: "",
        PADDLE_PRICE_CREDITS_100: "",
        PADDLE_PRICE_PRO_MONTHLY: ""
    } as unknown as NodeJS.ProcessEnv;
    assert.equal(assertPaddleWebhookConfigured(noCatalog), null);
    assert.equal(assertPaddleApiConfigured(noCatalog), null);
    assert.equal(assertPaddleClientConfigured(noCatalog), null);
    assert.deepEqual(paddleProductAvailability(noCatalog), {purchase_25: false, purchase_100: false, pro_upgrade: false});
});

test("a configured value that is not a distinct Price ID closes the whole catalog", () => {
    const productId = {...liveEnv, PADDLE_PRICE_CREDITS_25: "pro_01h_not_a_price"} as unknown as NodeJS.ProcessEnv;
    assert.match(paddleCatalogError(productId) ?? "", /PADDLE_PRICE_CREDITS_25 must be a Paddle Price ID/);
    assert.deepEqual(paddleProductAvailability(productId), {purchase_25: false, purchase_100: false, pro_upgrade: false});
    assert.equal(productCodeForPaddlePriceId("pri_pro", productId), null);

    const shared = {...liveEnv, PADDLE_PRICE_PRO_MONTHLY: "pri_25"} as unknown as NodeJS.ProcessEnv;
    assert.match(paddleCatalogError(shared) ?? "", /distinct/);
    assert.equal(productCodeForPaddlePriceId("pri_25", shared), null);
});

test("sandbox remains available only off the production host", () => {
    assert.equal(assertPaddleClientConfigured(sandboxEnv), null);
    assert.equal(assertPaddleProductCheckoutConfigured("purchase_25", sandboxEnv), null);
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
