import assert from "node:assert/strict";
import test from "node:test";
import {refundReasonText} from "./wildlife-guide-refunds";

test("card refunds carry a reason Paddle can show", () => {
    assert.match(refundReasonText("no_reply"), /48 hours/);
    assert.match(refundReasonText("buyer_request"), /7 days/);
    assert.match(refundReasonText("payment_reversed"), /Duplicate/);
    assert.equal(refundReasonText(null), "Wildlife Guide refund.");
});
