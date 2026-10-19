-- Guest checkout for a published Guide listing.
-- Paddle collects the listed fee (converted to a supported currency when needed).
-- This does not insert a cash booking and does not post withdrawable Earnings.
-- Completing a cash booking still runs settle_completed_guide_booking, which
-- would credit money AnimalDex never held. A paid website checkout must not
-- take that path.

BEGIN;

CREATE TABLE IF NOT EXISTS public.guide_web_checkouts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    guide_listing_id uuid NOT NULL REFERENCES public.guide_listings(id) ON DELETE CASCADE,
    seller_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    guest_email text NOT NULL,
    requested_date date NOT NULL,
    guest_count integer NOT NULL CHECK (guest_count BETWEEN 1 AND 100),
    message text,
    listed_currency text NOT NULL CHECK (listed_currency ~ '^[A-Z]{3}$'),
    listed_total_minor bigint NOT NULL CHECK (listed_total_minor > 0),
    charge_currency text NOT NULL CHECK (charge_currency ~ '^[A-Z]{3}$'),
    charge_amount_minor bigint NOT NULL CHECK (charge_amount_minor > 0),
    fx_rate numeric,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'accepted', 'declined', 'refunded', 'failed')),
    paddle_transaction_id text,
    idempotency_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    paid_at timestamptz,
    CONSTRAINT guide_web_checkouts_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT guide_web_checkouts_message_length CHECK (message IS NULL OR char_length(message) <= 1000)
);

CREATE UNIQUE INDEX IF NOT EXISTS guide_web_checkouts_txn_uidx
    ON public.guide_web_checkouts (paddle_transaction_id)
    WHERE paddle_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS guide_web_checkouts_seller_idx
    ON public.guide_web_checkouts (seller_user_id, created_at DESC);

ALTER TABLE public.guide_web_checkouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS guide_web_checkouts_seller_select ON public.guide_web_checkouts;
CREATE POLICY guide_web_checkouts_seller_select ON public.guide_web_checkouts
    FOR SELECT TO authenticated
    USING (auth.uid() = seller_user_id);
REVOKE ALL ON public.guide_web_checkouts FROM PUBLIC, anon;
GRANT SELECT ON public.guide_web_checkouts TO authenticated;
GRANT ALL ON public.guide_web_checkouts TO service_role;

CREATE OR REPLACE FUNCTION public.mark_guide_web_checkout_paid(
    p_checkout_id uuid,
    p_transaction_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.guide_web_checkouts%ROWTYPE;
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF p_transaction_id IS NULL OR btrim(p_transaction_id) = '' THEN
        RAISE EXCEPTION 'checkout_transaction_mismatch' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_row FROM public.guide_web_checkouts WHERE id = p_checkout_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'checkout_not_found' USING ERRCODE = 'P0002';
    END IF;
    IF v_row.paddle_transaction_id IS DISTINCT FROM p_transaction_id THEN
        RAISE EXCEPTION 'checkout_transaction_mismatch' USING ERRCODE = '22023';
    END IF;
    IF v_row.status = 'paid' THEN
        RETURN jsonb_build_object('ok', true, 'already', true);
    END IF;
    IF v_row.status <> 'pending' THEN
        RAISE EXCEPTION 'checkout_not_pending' USING ERRCODE = '22023';
    END IF;

    UPDATE public.guide_web_checkouts
    SET status = 'paid', paid_at = now()
    WHERE id = p_checkout_id;
    RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_guide_web_checkout_refunded(p_transaction_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.role() IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    UPDATE public.guide_web_checkouts
    SET status = 'refunded'
    WHERE paddle_transaction_id = p_transaction_id
      AND status IN ('pending', 'paid', 'accepted');
    RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_guide_web_checkout(p_checkout_id uuid, p_action text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_row public.guide_web_checkouts%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF p_action NOT IN ('accepted', 'declined') THEN
        RAISE EXCEPTION 'invalid_checkout_action' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO v_row FROM public.guide_web_checkouts WHERE id = p_checkout_id FOR UPDATE;
    IF NOT FOUND OR v_row.seller_user_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
    IF v_row.status <> 'paid' THEN
        RAISE EXCEPTION 'checkout_not_paid' USING ERRCODE = '22023';
    END IF;

    UPDATE public.guide_web_checkouts SET status = p_action WHERE id = p_checkout_id;
    RETURN jsonb_build_object('ok', true, 'status', p_action);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_guide_web_checkout_paid(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_guide_web_checkout_refunded(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_guide_web_checkout(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_guide_web_checkout_paid(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.mark_guide_web_checkout_refunded(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_guide_web_checkout(uuid, text) TO authenticated, service_role;

COMMIT;
