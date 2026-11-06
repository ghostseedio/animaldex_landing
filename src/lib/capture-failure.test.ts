import assert from "node:assert/strict";
import test from "node:test";
import {
    CAPTURE_FAILURES,
    CAPTURE_FAILURE_EXHAUSTED,
    captureFailureActions,
    captureFailureCopyEn,
    captureFailurePresentation,
    classifyCaptureFailure,
    describeCaptureFailure
} from "@/lib/capture-failure";

const copy = captureFailureCopyEn();

test("the table carries the server taxonomy's copy and retryability", () => {
    assert.equal(CAPTURE_FAILURES.no_animal_detected.title, "No animal found");
    assert.equal(CAPTURE_FAILURES.no_animal_detected.retryability, "permanent");
    assert.equal(CAPTURE_FAILURES.insufficient_credits.message, "This capture is saved. Add credits to continue analysing it.");
    assert.equal(CAPTURE_FAILURES.insufficient_credits.retryability, "user_action");
    assert.equal(CAPTURE_FAILURES.provider_timeout.retryability, "transient");
    assert.equal(CAPTURE_FAILURES.storage_unavailable.retryability, "conservative");
    assert.equal(CAPTURE_FAILURES.unknown.title, "Something went wrong");
    assert.equal(describeCaptureFailure("  NO_ANIMAL_DETECTED "), "no_animal_detected");
    assert.equal(describeCaptureFailure("relation \"captures\" violates check"), "unknown");
    assert.equal(describeCaptureFailure(null), "unknown");
});

test("an explicit code wins, then the status, then a narrow set of markers", () => {
    assert.equal(classifyCaptureFailure({errorCode: "likely_non_live_source", httpStatus: 500}), "authenticity_rejected");
    assert.equal(classifyCaptureFailure({errorCode: "unauthenticated"}), "authentication_required");
    assert.equal(classifyCaptureFailure({errorCode: "media_too_large"}), "media_too_large");
    assert.equal(classifyCaptureFailure({httpStatus: 402}), "insufficient_credits");
    assert.equal(classifyCaptureFailure({httpStatus: 429}), "provider_rate_limited");
    assert.equal(classifyCaptureFailure({httpStatus: 502}), "server_error");
    assert.equal(classifyCaptureFailure({message: "deadlock detected"}), "database_deadlock");
    assert.equal(classifyCaptureFailure({message: "TypeError: Failed to fetch"}), "network_unavailable");
    assert.equal(classifyCaptureFailure({message: "source_media_unavailable"}), "source_media_unavailable");
    assert.equal(classifyCaptureFailure({message: "no_primary_image"}), "media_missing");
    // Prose a provider or Postgres wrote is never a code, and never shown.
    assert.equal(classifyCaptureFailure({message: "duplicate key value violates unique constraint \"captures_pkey\""}), "unknown");
});

test("the words come from the reader's table; an exhausted retry says so only where a retry was promised", () => {
    assert.deepEqual(captureFailurePresentation("no_animal_detected", copy), {title: "No animal found", message: "We couldn't find an animal in this capture."});
    assert.deepEqual(captureFailurePresentation("server_error", copy, {attemptsExhausted: true}), CAPTURE_FAILURE_EXHAUSTED);
    assert.deepEqual(captureFailurePresentation("insufficient_credits", copy, {attemptsExhausted: true}), copy.insufficient_credits);
    const translated = {...copy, unknown: {title: "Terjadi kesalahan", message: "Tangkapanmu aman. Kami akan mencoba lagi."}};
    assert.equal(captureFailurePresentation("whatever", translated).title, "Terjadi kesalahan");
});

test("Retry where a retry can move it (iOS offersManualRetry), the person's own step where only they can", () => {
    assert.equal(captureFailureActions("provider_timeout").retry, true);
    assert.equal(captureFailureActions("no_animal_detected").retry, true);
    assert.equal(captureFailureActions("no_animal_detected").takeAnother, true);
    assert.equal(captureFailureActions("insufficient_credits").retry, false);
    assert.equal(captureFailureActions("insufficient_credits").getCredits, true);
    assert.equal(captureFailureActions("authentication_required").signIn, true);
    assert.equal(captureFailureActions("capture_rules_not_accepted").agreeToRules, true);
    assert.equal(captureFailureActions("account_suspended").takeAnother, false);
});
