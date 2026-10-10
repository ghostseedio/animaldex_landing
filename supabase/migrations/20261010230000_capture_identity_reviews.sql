-- Identity review queue: pairs of one owner's captures, taken moments apart,
-- that landed on different AnimalDex numbers and may be one animal named twice
-- (a semi-slug filed as a mantis egg case seconds after it was filed correctly).
--
-- A scheduled scan (/api/admin/maintenance/identity-review/scan) finds the
-- pairs, compares both photos with a vision model, and stores a verdict here.
-- Nothing is changed on the captures until an operator applies the verdict in
-- /admin/identity-review, which reuses the existing capture-identity and merge
-- maintenance routes. Burst judgements are not run unattended (see self-heal).
--
-- Service role only: the queue names users and holds model reasoning.

BEGIN;

CREATE TABLE IF NOT EXISTS public.capture_identity_reviews (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    -- Ordered pair: capture_a is the earlier photo. One row per pair, ever.
    capture_a_id uuid NOT NULL REFERENCES public.captures(id) ON DELETE CASCADE,
    capture_b_id uuid NOT NULL REFERENCES public.captures(id) ON DELETE CASCADE,
    species_a_profile_id uuid,
    species_b_profile_id uuid,
    seconds_apart integer NOT NULL,
    distance_m integer,
    -- Why the scan picked the pair: low confidence, related names, broad label.
    signals jsonb NOT NULL DEFAULT '[]'::jsonb,
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'same_animal', 'different_animals', 'unclear', 'error', 'applied', 'dismissed')),
    -- Model output: same_animal, confidence, correct label, which capture is wrong, reasoning.
    verdict jsonb,
    suggested_species_profile_id uuid,
    -- The capture whose identity the verdict says to move.
    suggested_capture_id uuid,
    model text,
    attempts integer NOT NULL DEFAULT 0,
    last_error text,
    analyzed_at timestamptz,
    reviewed_at timestamptz,
    review_note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT capture_identity_reviews_pair_key UNIQUE (capture_a_id, capture_b_id),
    CONSTRAINT capture_identity_reviews_distinct CHECK (capture_a_id <> capture_b_id)
);

CREATE INDEX IF NOT EXISTS capture_identity_reviews_status_idx
    ON public.capture_identity_reviews (status, created_at DESC);
CREATE INDEX IF NOT EXISTS capture_identity_reviews_user_idx
    ON public.capture_identity_reviews (user_id);

ALTER TABLE public.capture_identity_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.capture_identity_reviews FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.capture_identity_reviews TO service_role;

COMMENT ON TABLE public.capture_identity_reviews IS
    'Suspected same-animal capture pairs with different AnimalDex numbers, analysed by the identity-review scan and resolved in /admin/identity-review. Service role only.';

COMMIT;
