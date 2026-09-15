import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { convertAmount, fxDate, fxKey, parseFxPairs, type FxRates } from "./fx-convert";

const rates: FxRates = {
  base: "USD",
  rates: { [fxKey("GBP", "2026-08-25")]: 1.3, [fxKey("IDR", "2026-09-15")]: 0.00006 },
  failed: [],
  provider: "Wise",
  fetchedAt: "2026-09-15T00:00:00Z",
};

describe("fx conversion", () => {
  it("converts at the rate for the amount's own date", () => {
    assert.equal(convertAmount(10, "GBP", "2026-08-25", "USD", rates), 13);
    assert.equal(convertAmount(10, "GBP", "2026-09-01", "USD", rates), null);
  });

  it("passes the target currency through and refuses rates for another base", () => {
    assert.equal(convertAmount(5, "usd", "2020-01-01", "USD", null), 5);
    assert.equal(convertAmount(5, "GBP", "2026-08-25", "GBP", rates), 5);
    assert.equal(convertAmount(5, "IDR", "2026-09-15", "GBP", rates), null);
  });

  it("clamps future dates to today so month-end lookups hit today's rate", () => {
    assert.equal(fxDate("2026-09-30", "2026-09-15"), "2026-09-15");
    assert.equal(fxDate("2026-08-25T23:59:00Z", "2026-09-15"), "2026-08-25");
    assert.equal(fxDate("not a date", "2026-09-15"), "2026-09-15");
    assert.equal(convertAmount(1_000_000, "IDR", "2026-09-30T00:00:00Z", "USD", rates), 60);
  });

  it("parses, dedupes and validates requested pairs", () => {
    const pairs = parseFxPairs("gbp@2026-08-25,GBP@2026-08-25,IDR@2026-09-15,bad,US@2026-01-01,EUR@yesterday");
    assert.deepEqual(pairs.map((pair) => pair.key), ["GBP@2026-08-25", "IDR@2026-09-15"]);
  });
});
