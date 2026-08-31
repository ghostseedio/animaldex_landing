-- Provider-neutral web commerce with a Paddle Billing live adapter.
-- Additive because the unapplied Stripe migration may have reached an unknown shared environment.
-- Apple IAP, Google Play Billing, and Instagram Import economy/concurrency are intentionally untouched.
-- Apply only after live Paddle account/domain approval and live catalog/env are configured.
-- Do not include 20260831120000_guide_listing_public_place.sql in this billing release.

BEGIN;

CREATE TABLE IF NOT EXISTS public.web_purchases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider text NOT NULL CHECK (provider IN ('paddle')),
    product_code text NOT NULL CHECK (product_code IN ('purchase_25', 'purchase_100', 'pro_upgrade')),
    return_path text NOT NULL DEFAULT '/app/import/instagram',
    expected_provider_price_id text NOT NULL,
    provider_transaction_id text,
    provider_customer_id text,
    provider_subscription_id text,
    provider_product_id text,
    purchase_state text NOT NULL DEFAULT 'created' CHECK (purchase_state IN (
        'created', 'pending', 'fulfilled', 'canceled', 'failed', 'refunded', 'business_review'
    )),
    fulfilled_at timestamptz,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_transaction_id)
);
CREATE INDEX IF NOT EXISTS web_purchases_user_created_idx ON public.web_purchases (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS web_purchases_subscription_idx ON public.web_purchases (provider, provider_subscription_id)
    WHERE provider_subscription_id IS NOT NULL;
ALTER TABLE public.web_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS web_purchases_select_own ON public.web_purchases;
CREATE POLICY web_purchases_select_own ON public.web_purchases FOR SELECT USING (auth.uid() = user_id);
REVOKE ALL ON public.web_purchases FROM PUBLIC, anon;
GRANT SELECT ON public.web_purchases TO authenticated;
GRANT ALL ON public.web_purchases TO service_role;

CREATE TABLE IF NOT EXISTS public.web_purchase_events (
    provider text NOT NULL CHECK (provider IN ('paddle')),
    event_id text NOT NULL,
    event_type text NOT NULL,
    occurred_at timestamptz NOT NULL,
    payload_digest text NOT NULL,
    notification_id text,
    processing_status text NOT NULL DEFAULT 'processing' CHECK (processing_status IN ('processing', 'processed', 'failed')),
    attempts integer NOT NULL DEFAULT 1,
    processing_started_at timestamptz NOT NULL DEFAULT now(),
    processed_at timestamptz,
    last_error text,
    PRIMARY KEY (provider, event_id)
);
ALTER TABLE public.web_purchase_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.web_purchase_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.web_purchase_events TO service_role;

CREATE TABLE IF NOT EXISTS public.paddle_subscriptions (
    paddle_subscription_id text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    purchase_id uuid REFERENCES public.web_purchases(id) ON DELETE SET NULL,
    paddle_customer_id text NOT NULL,
    paddle_price_id text NOT NULL,
    paddle_product_id text,
    status text NOT NULL CHECK (status IN ('active', 'trialing', 'past_due', 'paused', 'canceled')),
    grace_period_end timestamptz,
    current_period_end timestamptz,
    scheduled_change_action text,
    scheduled_change_at timestamptz,
    last_event_id text NOT NULL,
    last_event_at timestamptz NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS paddle_subscriptions_user_status_idx ON public.paddle_subscriptions (user_id, status);
CREATE INDEX IF NOT EXISTS paddle_subscriptions_customer_idx ON public.paddle_subscriptions (paddle_customer_id);
ALTER TABLE public.paddle_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS paddle_subscriptions_select_own ON public.paddle_subscriptions;
CREATE POLICY paddle_subscriptions_select_own ON public.paddle_subscriptions FOR SELECT USING (auth.uid() = user_id);
REVOKE ALL ON public.paddle_subscriptions FROM PUBLIC, anon;
GRANT SELECT ON public.paddle_subscriptions TO authenticated;
GRANT ALL ON public.paddle_subscriptions TO service_role;

CREATE TABLE IF NOT EXISTS public.web_purchase_adjustments (
    provider text NOT NULL CHECK (provider IN ('paddle')),
    provider_adjustment_id text NOT NULL,
    purchase_id uuid REFERENCES public.web_purchases(id) ON DELETE SET NULL,
    provider_transaction_id text NOT NULL,
    action text NOT NULL,
    adjustment_type text,
    status text NOT NULL,
    event_id text NOT NULL,
    event_occurred_at timestamptz NOT NULL,
    credit_delta_attempted integer NOT NULL DEFAULT 0,
    credit_delta_applied integer NOT NULL DEFAULT 0,
    unrecovered_credits integer NOT NULL DEFAULT 0,
    policy_status text NOT NULL DEFAULT 'recorded' CHECK (policy_status IN (
        'recorded', 'fully_reversed', 'partial_unrecovered', 'needs_business_review'
    )),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, provider_adjustment_id)
);
ALTER TABLE public.web_purchase_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.web_purchase_adjustments FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.web_purchase_adjustments TO service_role;

CREATE OR REPLACE FUNCTION public.web_store_credit_delta(p_product_code text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE p_product_code WHEN 'purchase_25' THEN 25 WHEN 'purchase_100' THEN 100
        WHEN 'pro_upgrade' THEN 0 ELSE NULL END;
$$;

CREATE OR REPLACE FUNCTION public.user_has_animaldex_pro(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        (NOT (e.entitlements ? 'canonical_pro')
            AND COALESCE((SELECT is_pro FROM public.profiles WHERE id = p_user_id), false))
        OR COALESCE((e.entitlements->'apple_pro'->>'is_active')::boolean, false)
        OR (
            COALESCE((e.entitlements->'pro'->>'is_active')::boolean, false)
            AND COALESCE(e.entitlements->'pro'->>'source', '') IN ('storekit_current_entitlements', 'app_store', '')
        )
        OR EXISTS (
            SELECT 1 FROM public.app_store_purchases a
            WHERE a.user_id = p_user_id AND a.product_code = 'pro_upgrade'
              AND (a.expires_at IS NULL OR a.expires_at > now())
        )
        OR COALESCE((e.entitlements->'google_play_pro'->>'is_active')::boolean, false)
        OR EXISTS (
            SELECT 1 FROM public.paddle_subscriptions p
            WHERE p.user_id = p_user_id AND (
                p.status IN ('active', 'trialing')
                OR (p.status = 'past_due' AND p.grace_period_end > now())
            )
        )
    FROM (SELECT COALESCE((SELECT entitlements FROM public.subscriber_entitlements WHERE user_id = p_user_id), '{}'::jsonb) AS entitlements) e;
$$;

CREATE OR REPLACE FUNCTION public.refresh_animaldex_pro_entitlement(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_entitlements jsonb := '{}'::jsonb;
    v_apple boolean := false;
    v_google boolean := false;
    v_paddle boolean := false;
    v_is_pro boolean := false;
    v_now timestamptz := now();
BEGIN
    IF p_user_id IS NULL THEN RAISE EXCEPTION 'invalid_user' USING ERRCODE = '22023'; END IF;
    SELECT COALESCE(entitlements, '{}'::jsonb) INTO v_entitlements
      FROM public.subscriber_entitlements WHERE user_id = p_user_id;
    v_apple := COALESCE((v_entitlements->'apple_pro'->>'is_active')::boolean, false)
        OR (COALESCE((v_entitlements->'pro'->>'is_active')::boolean, false)
            AND COALESCE(v_entitlements->'pro'->>'source', '') IN ('storekit_current_entitlements', 'app_store', ''))
        OR EXISTS (SELECT 1 FROM public.app_store_purchases a WHERE a.user_id = p_user_id
            AND a.product_code = 'pro_upgrade' AND (a.expires_at IS NULL OR a.expires_at > v_now));
    v_google := COALESCE((v_entitlements->'google_play_pro'->>'is_active')::boolean, false);
    v_paddle := EXISTS (SELECT 1 FROM public.paddle_subscriptions p WHERE p.user_id = p_user_id
        AND (p.status IN ('active', 'trialing') OR (p.status = 'past_due' AND p.grace_period_end > v_now)));
    v_is_pro := v_apple OR v_google OR v_paddle;

    INSERT INTO public.subscriber_entitlements (user_id, entitlements, last_synced_at, created_at, updated_at)
    VALUES (p_user_id, jsonb_build_object('canonical_pro', jsonb_build_object(
        'is_active', v_is_pro, 'apple', v_apple, 'google_play', v_google, 'paddle', v_paddle, 'refreshed_at', v_now
    )), v_now, v_now, v_now)
    ON CONFLICT (user_id) DO UPDATE SET
        entitlements = subscriber_entitlements.entitlements || EXCLUDED.entitlements,
        last_synced_at = v_now, updated_at = v_now;
    UPDATE public.profiles SET is_pro = v_is_pro, updated_at = v_now WHERE id = p_user_id;
    RETURN v_is_pro;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_app_store_pro_entitlement(p_is_active boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_now timestamptz := now();
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
    INSERT INTO public.subscriber_entitlements (user_id, entitlements, last_synced_at, created_at, updated_at)
    VALUES (v_user_id, jsonb_build_object(
        'apple_pro', jsonb_build_object('source', 'storekit_current_entitlements', 'is_active', COALESCE(p_is_active, false), 'synced_at', v_now),
        'pro', jsonb_build_object('source', 'storekit_current_entitlements', 'is_active', COALESCE(p_is_active, false), 'synced_at', v_now)
    ), v_now, v_now, v_now)
    ON CONFLICT (user_id) DO UPDATE SET entitlements = subscriber_entitlements.entitlements || EXCLUDED.entitlements,
        last_synced_at = v_now, updated_at = v_now;
    RETURN public.refresh_animaldex_pro_entitlement(v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_google_play_pro_entitlement(p_is_active boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid(); v_now timestamptz := now();
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
    INSERT INTO public.subscriber_entitlements (user_id, entitlements, last_synced_at, created_at, updated_at)
    VALUES (v_user_id, jsonb_build_object('google_play_pro', jsonb_build_object(
        'source', 'play_billing', 'is_active', COALESCE(p_is_active, false), 'synced_at', v_now
    )), v_now, v_now, v_now)
    ON CONFLICT (user_id) DO UPDATE SET entitlements = subscriber_entitlements.entitlements || EXCLUDED.entitlements,
        last_synced_at = v_now, updated_at = v_now;
    RETURN public.refresh_animaldex_pro_entitlement(v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.register_web_purchase(
    p_user_id uuid, p_provider text, p_product_code text, p_return_path text, p_provider_price_id text
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
    IF p_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'invalid_user' USING ERRCODE = '22023';
    END IF;
    IF p_provider IS DISTINCT FROM 'paddle' THEN RAISE EXCEPTION 'unsupported_provider' USING ERRCODE = '22023'; END IF;
    IF public.web_store_credit_delta(p_product_code) IS NULL THEN RAISE EXCEPTION 'unknown_product' USING ERRCODE = '22023'; END IF;
    IF p_provider_price_id IS NULL OR p_provider_price_id !~ '^pri_' THEN RAISE EXCEPTION 'invalid_provider_price' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.web_purchases (user_id, provider, product_code, return_path, expected_provider_price_id, purchase_state)
    VALUES (p_user_id, p_provider, p_product_code,
        COALESCE(NULLIF(btrim(p_return_path), ''), '/app/import/instagram'), p_provider_price_id, 'pending')
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_web_purchase_event(
    p_provider text, p_event_id text, p_event_type text, p_occurred_at timestamptz, p_payload_digest text,
    p_notification_id text DEFAULT NULL
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_claimed boolean := false;
BEGIN
    INSERT INTO public.web_purchase_events (
        provider, event_id, event_type, occurred_at, payload_digest, notification_id, processing_status
    ) VALUES (p_provider, p_event_id, p_event_type, p_occurred_at, p_payload_digest, p_notification_id, 'processing')
    ON CONFLICT (provider, event_id) DO UPDATE SET
        event_type = EXCLUDED.event_type, occurred_at = EXCLUDED.occurred_at,
        payload_digest = EXCLUDED.payload_digest, notification_id = COALESCE(EXCLUDED.notification_id, web_purchase_events.notification_id),
        processing_status = 'processing',
        attempts = web_purchase_events.attempts + 1, processing_started_at = now(), last_error = NULL
    WHERE web_purchase_events.processing_status = 'failed'
       OR (web_purchase_events.processing_status = 'processing' AND web_purchase_events.processing_started_at < now() - interval '5 minutes')
    RETURNING true INTO v_claimed;
    RETURN COALESCE(v_claimed, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_web_purchase_event(p_provider text, p_event_id text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.web_purchase_events SET processing_status = 'processed', processed_at = now(), last_error = NULL
    WHERE provider = p_provider AND event_id = p_event_id AND processing_status = 'processing';
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_web_purchase_event(p_provider text, p_event_id text, p_error text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    UPDATE public.web_purchase_events SET processing_status = 'failed', last_error = left(COALESCE(p_error, 'webhook_failed'), 500)
    WHERE provider = p_provider AND event_id = p_event_id AND processing_status = 'processing';
    RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.fulfill_web_purchase(
    p_purchase_id uuid,
    p_provider text,
    p_provider_transaction_id text,
    p_provider_customer_id text,
    p_provider_subscription_id text,
    p_provider_price_id text,
    p_provider_product_id text,
    p_reported_user_id uuid,
    p_event_id text,
    p_occurred_at timestamptz
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_purchase public.web_purchases%ROWTYPE;
    v_delta integer := 0; v_balance integer := 0; v_is_pro boolean := false; v_now timestamptz := now();
BEGIN
    IF p_purchase_id IS NULL OR p_provider_transaction_id IS NULL THEN RAISE EXCEPTION 'invalid_fulfillment' USING ERRCODE = '22023'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('web-purchase:' || p_purchase_id::text, 0));
    SELECT * INTO v_purchase FROM public.web_purchases WHERE id = p_purchase_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'unknown_purchase'; END IF;
    IF v_purchase.provider IS DISTINCT FROM p_provider OR p_provider IS DISTINCT FROM 'paddle' THEN RAISE EXCEPTION 'purchase_provider_mismatch'; END IF;
    IF p_reported_user_id IS NOT NULL AND v_purchase.user_id IS DISTINCT FROM p_reported_user_id THEN RAISE EXCEPTION 'purchase_user_mismatch'; END IF;
    IF v_purchase.expected_provider_price_id IS DISTINCT FROM p_provider_price_id THEN RAISE EXCEPTION 'purchase_price_mismatch'; END IF;
    IF EXISTS (SELECT 1 FROM public.web_purchases w WHERE w.provider = p_provider
        AND w.provider_transaction_id = p_provider_transaction_id AND w.id <> p_purchase_id) THEN
        RAISE EXCEPTION 'provider_transaction_already_bound';
    END IF;
    IF v_purchase.purchase_state IN ('fulfilled', 'refunded', 'business_review') THEN
        SELECT COALESCE(balance, 0) INTO v_balance FROM public.credit_balances WHERE user_id = v_purchase.user_id;
        RETURN jsonb_build_object('ok', true, 'duplicate', true, 'balance', v_balance,
            'delta', 0, 'is_pro', public.user_has_animaldex_pro(v_purchase.user_id));
    END IF;
    v_delta := COALESCE(public.web_store_credit_delta(v_purchase.product_code), 0);
    INSERT INTO public.credit_balances (user_id, balance) VALUES (v_purchase.user_id, 0) ON CONFLICT (user_id) DO NOTHING;
    IF v_delta > 0 THEN
        UPDATE public.credit_balances SET balance = balance + v_delta, updated_at = v_now
        WHERE user_id = v_purchase.user_id RETURNING balance INTO v_balance;
        INSERT INTO public.credit_transactions (user_id, delta, reason, idempotency_key, metadata, created_at)
        VALUES (v_purchase.user_id, v_delta, 'purchase', 'paddle:transaction:' || p_provider_transaction_id,
            jsonb_build_object('provider', 'paddle', 'source', 'paddle', 'purchase_id', p_purchase_id,
                'transaction_id', p_provider_transaction_id, 'customer_id', p_provider_customer_id,
                'price_id', p_provider_price_id, 'product_id', p_provider_product_id,
                'product_code', v_purchase.product_code, 'event_id', p_event_id), v_now)
        ON CONFLICT (idempotency_key) DO NOTHING;
    ELSE
        SELECT COALESCE(balance, 0) INTO v_balance FROM public.credit_balances WHERE user_id = v_purchase.user_id;
    END IF;
    UPDATE public.web_purchases SET purchase_state = 'fulfilled', fulfilled_at = v_now,
        provider_transaction_id = p_provider_transaction_id, provider_customer_id = p_provider_customer_id,
        provider_subscription_id = p_provider_subscription_id, provider_product_id = p_provider_product_id,
        updated_at = v_now WHERE id = p_purchase_id;
    IF v_purchase.product_code = 'pro_upgrade' THEN
        IF p_provider_subscription_id IS NULL OR p_provider_customer_id IS NULL THEN RAISE EXCEPTION 'subscription_provenance_missing'; END IF;
        INSERT INTO public.paddle_subscriptions (
            paddle_subscription_id, user_id, purchase_id, paddle_customer_id, paddle_price_id,
            paddle_product_id, status, last_event_id, last_event_at
        ) VALUES (p_provider_subscription_id, v_purchase.user_id, p_purchase_id, p_provider_customer_id,
            p_provider_price_id, p_provider_product_id, 'active', p_event_id, p_occurred_at)
        ON CONFLICT (paddle_subscription_id) DO UPDATE SET
            purchase_id = COALESCE(paddle_subscriptions.purchase_id, EXCLUDED.purchase_id),
            user_id = EXCLUDED.user_id, paddle_customer_id = EXCLUDED.paddle_customer_id,
            paddle_price_id = EXCLUDED.paddle_price_id,
            paddle_product_id = COALESCE(EXCLUDED.paddle_product_id, paddle_subscriptions.paddle_product_id),
            updated_at = v_now;
    END IF;
    v_is_pro := public.refresh_animaldex_pro_entitlement(v_purchase.user_id);
    RETURN jsonb_build_object('ok', true, 'duplicate', false, 'balance', v_balance, 'delta', v_delta, 'is_pro', v_is_pro);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_paddle_subscription_state(
    p_purchase_id uuid,
    p_reported_user_id uuid,
    p_paddle_subscription_id text,
    p_paddle_customer_id text,
    p_status text,
    p_price_id text,
    p_product_id text,
    p_current_period_end timestamptz,
    p_scheduled_change_action text,
    p_scheduled_change_at timestamptz,
    p_occurred_at timestamptz,
    p_event_id text
)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_purchase public.web_purchases%ROWTYPE; v_existing public.paddle_subscriptions%ROWTYPE; v_user_id uuid; v_grace timestamptz;
BEGIN
    IF p_paddle_subscription_id IS NULL OR p_status NOT IN ('active', 'trialing', 'past_due', 'paused', 'canceled') THEN
        RAISE EXCEPTION 'invalid_subscription';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('paddle-subscription:' || p_paddle_subscription_id, 0));
    SELECT * INTO v_existing FROM public.paddle_subscriptions WHERE paddle_subscription_id = p_paddle_subscription_id FOR UPDATE;
    IF FOUND THEN
        IF p_occurred_at < v_existing.last_event_at THEN RETURN public.user_has_animaldex_pro(v_existing.user_id); END IF;
        v_user_id := v_existing.user_id;
        IF p_purchase_id IS NOT NULL AND v_existing.purchase_id IS NOT NULL AND v_existing.purchase_id <> p_purchase_id THEN
            RAISE EXCEPTION 'subscription_purchase_mismatch';
        END IF;
    ELSE
        IF p_purchase_id IS NULL THEN RAISE EXCEPTION 'subscription_purchase_unresolved'; END IF;
        SELECT * INTO v_purchase FROM public.web_purchases WHERE id = p_purchase_id FOR UPDATE;
        IF NOT FOUND OR v_purchase.provider <> 'paddle' OR v_purchase.product_code <> 'pro_upgrade' THEN
            RAISE EXCEPTION 'subscription_purchase_unresolved';
        END IF;
        IF v_purchase.expected_provider_price_id <> p_price_id THEN RAISE EXCEPTION 'subscription_price_mismatch'; END IF;
        v_user_id := v_purchase.user_id;
    END IF;
    IF p_reported_user_id IS NOT NULL AND v_user_id <> p_reported_user_id THEN RAISE EXCEPTION 'subscription_user_mismatch'; END IF;
    IF v_existing.paddle_price_id IS NOT NULL AND v_existing.paddle_price_id <> p_price_id THEN RAISE EXCEPTION 'subscription_price_mismatch'; END IF;
    v_grace := CASE WHEN p_status = 'past_due' THEN
        CASE WHEN v_existing.status = 'past_due' THEN v_existing.grace_period_end ELSE p_occurred_at + interval '7 days' END
        ELSE NULL END;
    INSERT INTO public.paddle_subscriptions (
        paddle_subscription_id, user_id, purchase_id, paddle_customer_id, paddle_price_id, paddle_product_id,
        status, grace_period_end, current_period_end, scheduled_change_action, scheduled_change_at,
        last_event_id, last_event_at, updated_at
    ) VALUES (p_paddle_subscription_id, v_user_id, p_purchase_id, COALESCE(p_paddle_customer_id, ''), p_price_id,
        p_product_id, p_status, v_grace, p_current_period_end, p_scheduled_change_action, p_scheduled_change_at,
        p_event_id, p_occurred_at, now())
    ON CONFLICT (paddle_subscription_id) DO UPDATE SET
        purchase_id = COALESCE(paddle_subscriptions.purchase_id, EXCLUDED.purchase_id),
        paddle_customer_id = EXCLUDED.paddle_customer_id, paddle_price_id = EXCLUDED.paddle_price_id,
        paddle_product_id = COALESCE(EXCLUDED.paddle_product_id, paddle_subscriptions.paddle_product_id),
        status = EXCLUDED.status, grace_period_end = EXCLUDED.grace_period_end,
        current_period_end = EXCLUDED.current_period_end,
        scheduled_change_action = EXCLUDED.scheduled_change_action, scheduled_change_at = EXCLUDED.scheduled_change_at,
        last_event_id = EXCLUDED.last_event_id, last_event_at = EXCLUDED.last_event_at, updated_at = now();
    UPDATE public.web_purchases SET provider_customer_id = COALESCE(p_paddle_customer_id, provider_customer_id),
        provider_subscription_id = p_paddle_subscription_id, provider_product_id = COALESCE(p_product_id, provider_product_id),
        updated_at = now() WHERE id = p_purchase_id;
    RETURN public.refresh_animaldex_pro_entitlement(v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_web_purchase_adjustment(
    p_provider text,
    p_provider_adjustment_id text,
    p_provider_transaction_id text,
    p_action text,
    p_adjustment_type text,
    p_status text,
    p_event_id text,
    p_occurred_at timestamptz
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_purchase public.web_purchases%ROWTYPE; v_existing public.web_purchase_adjustments%ROWTYPE;
    v_credits integer := 0; v_balance integer := 0; v_apply integer := 0; v_unrecovered integer := 0;
    v_policy text := 'recorded'; v_now timestamptz := now();
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('web-adjustment:' || p_provider || ':' || p_provider_adjustment_id, 0));
    SELECT * INTO v_existing FROM public.web_purchase_adjustments
    WHERE provider = p_provider AND provider_adjustment_id = p_provider_adjustment_id FOR UPDATE;
    IF FOUND AND v_existing.credit_delta_applied > 0 THEN
        RETURN jsonb_build_object('ok', true, 'duplicate', true, 'applied', 0, 'policy_status', v_existing.policy_status);
    END IF;
    SELECT * INTO v_purchase FROM public.web_purchases
    WHERE provider = p_provider AND provider_transaction_id = p_provider_transaction_id FOR UPDATE;
    IF NOT FOUND THEN v_policy := 'needs_business_review';
    ELSIF p_adjustment_type IS DISTINCT FROM 'full' THEN v_policy := 'needs_business_review';
    ELSIF p_action IN ('chargeback_warning', 'chargeback_warning_reverse', 'chargeback_reverse', 'credit_reverse') THEN
        v_policy := 'needs_business_review';
    ELSIF p_status = 'approved' AND p_action IN ('refund', 'credit', 'chargeback') THEN
        v_credits := COALESCE(public.web_store_credit_delta(v_purchase.product_code), 0);
        IF v_credits <= 0 THEN
            v_policy := 'needs_business_review';
        ELSE
            INSERT INTO public.credit_balances (user_id, balance) VALUES (v_purchase.user_id, 0) ON CONFLICT (user_id) DO NOTHING;
            SELECT balance INTO v_balance FROM public.credit_balances WHERE user_id = v_purchase.user_id FOR UPDATE;
            v_apply := LEAST(COALESCE(v_balance, 0), v_credits);
            v_unrecovered := GREATEST(0, v_credits - v_apply);
            IF v_apply > 0 THEN
                UPDATE public.credit_balances SET balance = balance - v_apply, updated_at = v_now
                WHERE user_id = v_purchase.user_id RETURNING balance INTO v_balance;
                INSERT INTO public.credit_transactions (user_id, delta, reason, idempotency_key, metadata, created_at)
                VALUES (v_purchase.user_id, -v_apply, 'refund', 'paddle:adjustment:' || p_provider_adjustment_id,
                    jsonb_build_object('provider', 'paddle', 'source', 'paddle', 'purchase_id', v_purchase.id,
                        'transaction_id', p_provider_transaction_id, 'adjustment_id', p_provider_adjustment_id,
                        'action', p_action, 'requested_credits', v_credits, 'unrecovered_credits', v_unrecovered,
                        'policy', 'reverse_unspent_only'), v_now)
                ON CONFLICT (idempotency_key) DO NOTHING;
            END IF;
            v_policy := CASE WHEN v_unrecovered = 0 THEN 'fully_reversed'
                WHEN v_apply = 0 THEN 'needs_business_review' ELSE 'partial_unrecovered' END;
            UPDATE public.web_purchases SET purchase_state = CASE WHEN v_unrecovered = 0 THEN 'refunded' ELSE 'business_review' END,
                updated_at = v_now WHERE id = v_purchase.id;
        END IF;
    END IF;
    INSERT INTO public.web_purchase_adjustments (
        provider, provider_adjustment_id, purchase_id, provider_transaction_id, action, adjustment_type,
        status, event_id, event_occurred_at, credit_delta_attempted, credit_delta_applied,
        unrecovered_credits, policy_status, updated_at
    ) VALUES (p_provider, p_provider_adjustment_id, v_purchase.id, p_provider_transaction_id, p_action,
        p_adjustment_type, p_status, p_event_id, p_occurred_at, v_credits, v_apply, v_unrecovered, v_policy, v_now)
    ON CONFLICT (provider, provider_adjustment_id) DO UPDATE SET
        purchase_id = COALESCE(web_purchase_adjustments.purchase_id, EXCLUDED.purchase_id),
        status = EXCLUDED.status, event_id = EXCLUDED.event_id, event_occurred_at = EXCLUDED.event_occurred_at,
        credit_delta_attempted = EXCLUDED.credit_delta_attempted,
        credit_delta_applied = web_purchase_adjustments.credit_delta_applied + EXCLUDED.credit_delta_applied,
        unrecovered_credits = EXCLUDED.unrecovered_credits, policy_status = EXCLUDED.policy_status, updated_at = v_now;
    RETURN jsonb_build_object('ok', true, 'applied', v_apply, 'unrecovered', v_unrecovered,
        'balance', v_balance, 'policy_status', v_policy);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_web_billing_status(p_purchase_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_balance integer := 0; v_purchase public.web_purchases%ROWTYPE; v_provider text := 'none';
BEGIN
    IF v_user IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '28000'; END IF;
    PERFORM public.refresh_animaldex_pro_entitlement(v_user);
    SELECT COALESCE(balance, 0) INTO v_balance FROM public.credit_balances WHERE user_id = v_user;
    IF EXISTS (SELECT 1 FROM public.paddle_subscriptions p WHERE p.user_id = v_user
        AND (p.status IN ('active', 'trialing') OR (p.status = 'past_due' AND p.grace_period_end > now()))) THEN
        v_provider := 'paddle';
    ELSIF COALESCE((SELECT (entitlements->'apple_pro'->>'is_active')::boolean
        FROM public.subscriber_entitlements WHERE user_id = v_user), false) THEN v_provider := 'apple';
    ELSIF COALESCE((SELECT (entitlements->'google_play_pro'->>'is_active')::boolean
        FROM public.subscriber_entitlements WHERE user_id = v_user), false) THEN v_provider := 'google';
    END IF;
    IF p_purchase_id IS NOT NULL THEN
        SELECT * INTO v_purchase FROM public.web_purchases WHERE id = p_purchase_id AND user_id = v_user;
    END IF;
    RETURN jsonb_build_object('balance', v_balance, 'is_pro', public.user_has_animaldex_pro(v_user),
        'pro_provider', v_provider, 'purchase_state', v_purchase.purchase_state,
        'product_code', v_purchase.product_code, 'return_path', v_purchase.return_path,
        'fulfilled', v_purchase.purchase_state IN ('fulfilled', 'refunded', 'business_review'));
END;
$$;

-- Preserve App Store purchase behavior while making its Pro mutation source-aware.
CREATE OR REPLACE FUNCTION public.apply_app_store_purchase(
    p_user_id uuid, p_transaction_id text, p_original_transaction_id text, p_product_id text,
    p_product_code text, p_environment text, p_purchase_date timestamptz, p_expires_at timestamptz,
    p_app_account_token uuid, p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (balance integer, delta integer, reason text, product_code text, transaction_id text, created_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_delta integer := 0; v_balance integer := 0; v_created_at timestamptz := now(); v_rows integer := 0; v_active boolean;
BEGIN
    IF p_user_id IS NULL THEN RAISE EXCEPTION 'invalid_user' USING ERRCODE = '22023'; END IF;
    v_delta := public.web_store_credit_delta(p_product_code);
    IF v_delta IS NULL THEN RAISE EXCEPTION 'invalid_product_code' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.credit_balances (user_id, balance) VALUES (p_user_id, 0) ON CONFLICT (user_id) DO NOTHING;
    INSERT INTO public.app_store_purchases (transaction_id, original_transaction_id, user_id, product_id, product_code,
        environment, purchase_date, expires_at, app_account_token, metadata, created_at, updated_at)
    VALUES (p_transaction_id, p_original_transaction_id, p_user_id, p_product_id, p_product_code, p_environment,
        p_purchase_date, p_expires_at, p_app_account_token, COALESCE(p_metadata, '{}'::jsonb), v_created_at, v_created_at)
    ON CONFLICT ON CONSTRAINT app_store_purchases_pkey DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows = 0 THEN
        SELECT COALESCE(credit_balances.balance, 0) INTO v_balance FROM public.credit_balances WHERE user_id = p_user_id;
        RETURN QUERY SELECT v_balance, 0, 'purchase'::text, p_product_code, p_transaction_id, v_created_at; RETURN;
    END IF;
    IF v_delta > 0 THEN
        UPDATE public.credit_balances SET balance = credit_balances.balance + v_delta, updated_at = v_created_at
        WHERE user_id = p_user_id RETURNING credit_balances.balance INTO v_balance;
    ELSE SELECT COALESCE(credit_balances.balance, 0) INTO v_balance FROM public.credit_balances WHERE user_id = p_user_id; END IF;
    INSERT INTO public.credit_transactions (user_id, delta, reason, idempotency_key, metadata, created_at)
    VALUES (p_user_id, v_delta, 'purchase', 'app_store:' || p_transaction_id,
        jsonb_build_object('product_code', p_product_code, 'product_id', p_product_id, 'source', 'app_store',
            'environment', p_environment, 'original_transaction_id', p_original_transaction_id) || COALESCE(p_metadata, '{}'::jsonb),
        v_created_at) ON CONFLICT (idempotency_key) DO NOTHING;
    IF p_product_code = 'pro_upgrade' THEN
        v_active := p_expires_at IS NULL OR p_expires_at > v_created_at;
        INSERT INTO public.subscriber_entitlements (user_id, entitlements, last_synced_at, created_at, updated_at)
        VALUES (p_user_id, jsonb_build_object('apple_pro', jsonb_build_object('product_id', p_product_id,
            'transaction_id', p_transaction_id, 'original_transaction_id', p_original_transaction_id,
            'environment', p_environment, 'expires_at', p_expires_at, 'is_active', v_active, 'source', 'app_store')),
            v_created_at, v_created_at, v_created_at)
        ON CONFLICT (user_id) DO UPDATE SET entitlements = subscriber_entitlements.entitlements || EXCLUDED.entitlements,
            last_synced_at = EXCLUDED.last_synced_at, updated_at = v_created_at;
        PERFORM public.refresh_animaldex_pro_entitlement(p_user_id);
    END IF;
    RETURN QUERY SELECT COALESCE(v_balance, 0), v_delta, 'purchase'::text, p_product_code, p_transaction_id, v_created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.register_web_purchase(uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_web_purchase_event(text, text, text, timestamptz, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_web_purchase_event(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fail_web_purchase_event(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fulfill_web_purchase(uuid, text, text, text, text, text, text, uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_paddle_subscription_state(uuid, uuid, text, text, text, text, text, timestamptz, text, timestamptz, timestamptz, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_web_purchase_adjustment(text, text, text, text, text, text, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_web_billing_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.refresh_animaldex_pro_entitlement(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.register_web_purchase(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_my_web_billing_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_web_purchase_event(text, text, text, timestamptz, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_web_purchase_event(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_web_purchase_event(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_web_purchase(uuid, text, text, text, text, text, text, uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_paddle_subscription_state(uuid, uuid, text, text, text, text, text, timestamptz, text, timestamptz, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_web_purchase_adjustment(text, text, text, text, text, text, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_animaldex_pro_entitlement(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_app_store_pro_entitlement(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_google_play_pro_entitlement(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_has_animaldex_pro(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.web_store_credit_delta(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_app_store_purchase(uuid, text, text, text, text, text, timestamptz, timestamptz, uuid, jsonb) TO service_role;

COMMIT;
