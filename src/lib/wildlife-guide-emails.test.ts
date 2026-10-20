import assert from "node:assert/strict";
import test from "node:test";
import {renderGuideEmail, type GuideEmailPayload} from "./wildlife-guide-emails";
import {guideSaleLine, ownerGuideStatus} from "./virtual-wildlife-guides";

const SITE = "https://animaldex.app";
const NOW = Date.parse("2026-10-20T12:00:00Z");

const base: GuideEmailPayload = {
    purchaseId: "8c1c4c5e-0000-4000-8000-000000000001",
    guideId: "4909f30f-3b69-42b6-8268-45c808e5f5fd",
    guideSlug: "wildlife-of-battle-creek",
    guideTitle: "Wildlife of Battle Creek",
    channel: "credits",
    currencyCode: "USD",
    amountMinor: 299,
    creditsAmount: 25,
    earningsMinor: 177,
    paidAt: "2026-10-20T10:00:00Z",
    replyDueAt: "2026-10-22T10:00:00Z",
    refundWindowEndsAt: "2026-10-27T10:00:00Z",
    authorTermsAccepted: false,
    buyerName: "Sam",
    buyerUserId: "138bd2bc-af58-4e51-ac92-3df6161d53db",
    sellerName: "Alex",
    sellerUserId: "2f0b0d6a-0000-4000-8000-000000000002"
};

test("the author's sale email says what they earn, by when to reply, and to accept the terms", () => {
    const email = renderGuideEmail("seller_sale", base, SITE, NOW);
    assert.ok(email);
    assert.match(email.subject, /You sold "Wildlife of Battle Creek"/);
    assert.match(email.text, /\$1\.77/);
    assert.match(email.text, /Oct 22, 2026.*UTC/);
    assert.match(email.text, /refunded automatically/);
    assert.match(email.text, /accept the Wildlife Guide Author Terms/);
    assert.match(email.html, /\/app\/messages\/138bd2bc-af58-4e51-ac92-3df6161d53db/);
    const accepted = renderGuideEmail("seller_sale", {...base, authorTermsAccepted: true}, SITE, NOW);
    assert.doesNotMatch(accepted!.text, /accept the Wildlife Guide Author Terms/);
});

test("the reminder counts the hours left", () => {
    const email = renderGuideEmail("seller_reply_reminder", {...base, replyDueAt: "2026-10-20T20:00:00Z"}, SITE, NOW);
    assert.match(email!.subject, /8 hours left/);
    assert.match(email!.text, /\$1\.77 goes back to the buyer/);
});

test("the no-reply email says sales stopped but the guide stays public", () => {
    const email = renderGuideEmail("seller_no_reply_refund", base, SITE, NOW);
    assert.match(email!.text, /still public/);
    assert.match(email!.text, /resume sales/);
});

test("payout emails", () => {
    assert.match(renderGuideEmail("seller_payout_released", base, SITE, NOW)!.subject, /\$1\.77 from "Wildlife of Battle Creek" is in your Earnings/);
    assert.match(renderGuideEmail("seller_payout_held", base, SITE, NOW)!.text, /Accept and get paid/);
});

test("the buyer's receipt shows what they paid and links the buyer terms", () => {
    const credits = renderGuideEmail("buyer_purchase", base, SITE, NOW)!;
    assert.match(credits.text, /Paid: 25 Credits/);
    assert.match(credits.text, /\/legal\/wildlife-guide-buyer-terms/);
    assert.match(credits.html, /\/guides\/wildlife-of-battle-creek-4909f30f/);
    const card = renderGuideEmail("buyer_purchase", {...base, channel: "web_card", chargeCurrency: "USD", chargeAmountMinor: 299}, SITE, NOW)!;
    assert.match(card.text, /Paid: \$2\.99/);
    assert.match(card.text, /Paddle/);
});

test("refund emails say why and where the money goes", () => {
    const noReply = renderGuideEmail("buyer_refund", {...base, refundReason: "no_reply"}, SITE, NOW)!;
    assert.match(noReply.text, /didn't reply within 48 hours/);
    assert.match(noReply.text, /Credits balance/);
    const card = renderGuideEmail("buyer_refund", {...base, channel: "web_card", chargeAmountMinor: 299, chargeCurrency: "USD", refundReason: "buyer_request"}, SITE, NOW)!;
    assert.match(card.text, /5 to 10 business days/);
    const declined = renderGuideEmail("buyer_refund_declined", {...base, refundNote: "The guide matches its description."}, SITE, NOW)!;
    assert.match(declined.text, /Reason: The guide matches its description\./);
    assert.match(renderGuideEmail("buyer_refund_review", base, SITE, NOW)!.text, /a person reviews/);
});

test("unknown kinds render nothing, and text is escaped in HTML", () => {
    assert.equal(renderGuideEmail("something_new", base, SITE, NOW), null);
    const email = renderGuideEmail("seller_sale", {...base, guideTitle: "<script>x</script>"}, SITE, NOW)!;
    assert.doesNotMatch(email.html, /<script>x/);
});

test("the author's sale lines", () => {
    const sale = {purchaseId: "p", guideId: "g", guideTitle: "t", currencyCode: "USD", earningsMinor: 177};
    assert.equal(
        guideSaleLine({...sale, state: "awaiting_reply", replyDueAt: "2026-10-21T09:30:00Z"}, "en", {}, NOW),
        "Reply within 22 h to keep $1.77. No reply and the buyer is refunded."
    );
    assert.match(guideSaleLine({...sale, state: "payout_held"}, "en", {}, NOW), /Accept the Author Terms/);
    assert.match(guideSaleLine({...sale, state: "refunded", refundReason: "no_reply"}, "en", {}, NOW), /not earned/);
    assert.equal(guideSaleLine({...sale, state: "paid_out"}, "en", {salePaidOut: "{amount} dibayar."}, NOW), "$1.77 dibayar.");
});

test("a public guide whose sales are paused says so", () => {
    const card = {generationStatus: "ready", status: "published" as const, publiclyVisible: true};
    assert.equal(ownerGuideStatus(card, {publicEnabled: true, locationIsPublic: true}).key, "public");
    assert.equal(ownerGuideStatus({...card, salesPausedAt: "2026-10-20T00:00:00Z"}, {publicEnabled: true, locationIsPublic: true}).key, "salesPaused");
});
