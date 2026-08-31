import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {LIVE_CONTRADICTORY_LISTING_ID} from "./guide-listing-quality";

const here = dirname(fileURLToPath(import.meta.url));
const migration = readFileSync(
    join(here, "../../../AnimalDex/supabase/migrations/20260831120000_guide_listing_public_place.sql"),
    "utf8"
);

test("public-place migration is additive and does not mutate the live contradictory listing", () => {
    assert.match(migration, /ADD COLUMN IF NOT EXISTS public_locality/);
    assert.match(migration, /p_public_place jsonb DEFAULT NULL/);
    assert.match(migration, /This migration does not UPDATE existing listing rows/);
    assert.doesNotMatch(migration, new RegExp(LIVE_CONTRADICTORY_LISTING_ID));
    assert.doesNotMatch(migration, /UPDATE public\.guide_listings\s+SET[\s\S]{0,200}WHERE id\s*=/);
    assert.match(migration, /CASE WHEN p_public_place IS NULL THEN public_place_name/);
    assert.doesNotMatch(migration, /public_latitude, l.public_longitude/);
});
