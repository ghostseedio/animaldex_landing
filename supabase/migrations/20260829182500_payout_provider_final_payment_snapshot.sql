-- Provider-final payment facts snapshot (read model / payment provenance).
--
-- These columns capture the provider-confirmed final payment facts for a PAID
-- payout. They are strictly a read-model concern:
--   * never used for accounting or ledger math;
--   * never alter payout amount, holds, or payment state transitions;
--   * written only when the provider reports `outgoing_payment_sent`.

alter table if exists public.payouts
    add column if not exists provider_final_source_amount_minor integer,
    add column if not exists provider_final_source_currency text,
    add column if not exists provider_final_target_amount_minor integer,
    add column if not exists provider_final_target_currency text,
    add column if not exists provider_payment_reference text,
    add column if not exists provider_finalized_at timestamptz;

-- One-off provenance backfill for the first real payout.
-- Narrowly scoped to this payout id, idempotent (fills only null columns), and
-- provenance-only: it does not touch status, amounts, holds, or ledger state.
-- Known Wise-confirmed facts: sourceValue 1.30 USD -> targetValue 0.96 GBP,
-- reference "AnimalDex 43a4089b".
update public.payouts
set
    provider_final_source_amount_minor = coalesce(provider_final_source_amount_minor, 130),
    provider_final_source_currency  = coalesce(provider_final_source_currency, 'USD'),
    provider_final_target_amount_minor = coalesce(provider_final_target_amount_minor, 96),
    provider_final_target_currency  = coalesce(provider_final_target_currency, 'GBP'),
    provider_payment_reference      = coalesce(provider_payment_reference, 'AnimalDex 43a4089b'),
    provider_finalized_at           = coalesce(provider_finalized_at, paid_at)
where id = '43a4089b-cea0-4369-b754-5a89c7db6e66';

-- Canonical creator-reward payment provenance helper.
--
-- Returns the consumer-safe `payment_details` JSON object for the latest PAID
-- payout of the given user + earning currency, or NULL when none exists. It
-- reads only the immutable provider-final snapshot columns (never calls Wise).
--
--   * provider_payment_reference  -> payment_reference (deliberate rename)
--   * sender_name                 -> null (no canonical legal-entity config in SQL)
--   * destination_mask            -> the stored safe mask verbatim (no relabeling)
create or replace function public.creator_reward_receipt_payment_details(
    p_user_id uuid,
    p_currency_code text
) returns jsonb
language sql
stable
security definer
set search_path = public
as $$
    select jsonb_build_object(
        'paid_at', p.paid_at,
        'provider', p.provider,
        'sender_name', null::text,
        'provider_transfer_ref', p.provider_transfer_ref,
        'payment_reference', p.provider_payment_reference,
        'source_amount_minor', p.provider_final_source_amount_minor,
        'source_currency', p.provider_final_source_currency,
        'target_amount_minor', p.provider_final_target_amount_minor,
        'target_currency', p.provider_final_target_currency,
        'destination_mask', pp.masked_destination
    )
    from public.payouts p
    left join public.payout_profiles pp on pp.id = p.payout_profile_id
    where p.user_id = p_user_id
      and p.status = 'paid'
      and p.provider_transfer_ref is not null
      and upper(p.currency_code) = upper(p_currency_code)
    order by p.paid_at desc nulls last
    limit 1;
$$;

-- Internal-only helper: block direct client invocation.
revoke all on function public.creator_reward_receipt_payment_details(uuid, text) from public;

-- ---------------------------------------------------------------------------
-- Canonical creator-reward receipt read model (list) — add payment_details.
-- The RETURN TABLE row type changes, so the function must be dropped first
-- (PostgreSQL cannot change a function's OUT-parameter row type in place).
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.list_my_creator_reward_receipts();

CREATE OR REPLACE FUNCTION public.list_my_creator_reward_receipts()
 RETURNS TABLE(period_id uuid, period_slug text, period_display_name text, period_start timestamp with time zone, period_end timestamp with time zone, currency_code text, amount_minor bigint, status text, financial_status text, eligibility_state text, contribution_categories text[], created_at timestamp with time zone, payment_details jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    WITH mine AS (
        SELECT DISTINCT period_key AS pid
        FROM (
            SELECT a.period_id AS period_key
            FROM public.creator_reward_allocations a
            WHERE a.user_id = v_uid
              AND a.status IN ('finalized', 'posted')
            UNION
            SELECT e.period_id
            FROM public.creator_reward_eligibilities e
            WHERE e.user_id = v_uid
            UNION
            SELECT s.period_id
            FROM public.creator_reward_contribution_snapshots s
            WHERE s.user_id = v_uid
        ) keys
    )
    SELECT
        p.id,
        p.slug,
        p.display_name,
        p.period_start,
        p.period_end,
        coalesce(a.currency_code, p.currency_code),
        coalesce(a.allocation_amount_minor, 0)::bigint,
        coalesce(fin.financial_status, public.creator_reward_user_facing_status(
            p.status,
            coalesce(e.is_eligible, true),
            a.id IS NOT NULL,
            a.allocation_amount_minor,
            a.status,
            ee.entry_kind
        )),
        fin.financial_status,
        CASE
            WHEN e.is_eligible IS FALSE THEN 'not_eligible'
            WHEN a.id IS NULL AND p.status IN ('finalized', 'posted') THEN 'no_allocation'
            WHEN a.id IS NOT NULL THEN 'eligible'
            ELSE 'pending_review'
        END,
        public.creator_reward_sanitized_contribution_categories(
            s.qualifying_capture_count,
            s.gift_event_counted_gifts,
            s.gift_event_unique_senders
        ),
        coalesce(a.finalized_at, a.posted_at, a.created_at, s.created_at, e.created_at, p.updated_at),
        public.creator_reward_receipt_payment_details(
            v_uid,
            coalesce(a.currency_code, p.currency_code)
        )
    FROM mine m
    JOIN public.creator_reward_periods p ON p.id = m.pid
    LEFT JOIN public.creator_reward_allocations a
        ON a.period_id = p.id
       AND a.user_id = v_uid
       AND a.status IN ('finalized', 'posted')
    LEFT JOIN public.creator_reward_eligibilities e
        ON e.period_id = p.id
       AND e.user_id = v_uid
    LEFT JOIN public.creator_reward_contribution_snapshots s
        ON s.period_id = p.id
       AND s.user_id = v_uid
    LEFT JOIN public.earning_entries ee
        ON ee.id = a.earning_entry_id
    LEFT JOIN LATERAL (
        SELECT public.creator_reward_allocation_financial_status(
            v_uid,
            a.id,
            ee.account_id,
            coalesce(a.currency_code, p.currency_code),
            coalesce(a.allocation_amount_minor, 0)::bigint
        ) AS financial_status
        WHERE a.id IS NOT NULL
          AND ee.account_id IS NOT NULL
          AND coalesce(a.allocation_amount_minor, 0) > 0
    ) fin ON TRUE
    WHERE p.status IN ('frozen', 'calculated', 'finalized', 'posted')
       OR a.id IS NOT NULL
    ORDER BY coalesce(a.finalized_at, a.posted_at, p.period_end) DESC NULLS LAST;
END;
$function$;

-- ---------------------------------------------------------------------------
-- Canonical creator-reward receipt read model (detail) — add payment_details.
-- Delegates to the list RPC so both stay in lock-step.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_creator_reward_receipt(p_period_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_uid uuid := auth.uid();
    v_row record;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
    END IF;

    SELECT
        r.period_id,
        r.period_slug,
        r.period_display_name,
        r.period_start,
        r.period_end,
        r.currency_code,
        r.amount_minor,
        r.status,
        r.financial_status,
        r.eligibility_state,
        r.contribution_categories,
        r.created_at,
        r.payment_details
    INTO v_row
    FROM public.list_my_creator_reward_receipts() r
    WHERE r.period_id = p_period_id;

    IF v_row.period_id IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN jsonb_build_object(
        'period_id', v_row.period_id,
        'period_slug', v_row.period_slug,
        'period_display_name', v_row.period_display_name,
        'period_start', v_row.period_start,
        'period_end', v_row.period_end,
        'currency_code', v_row.currency_code,
        'amount_minor', v_row.amount_minor,
        'status', v_row.status,
        'financial_status', v_row.financial_status,
        'eligibility_state', v_row.eligibility_state,
        'contribution_categories', to_jsonb(v_row.contribution_categories),
        'created_at', v_row.created_at,
        'eligibility_message', CASE v_row.eligibility_state
            WHEN 'not_eligible' THEN 'Account was not eligible during the snapshot'
            WHEN 'no_allocation' THEN 'Your contribution was counted, but this period did not result in a payable allocation'
            ELSE NULL
        END,
        'payment_details', v_row.payment_details
    );
END;
$function$;
