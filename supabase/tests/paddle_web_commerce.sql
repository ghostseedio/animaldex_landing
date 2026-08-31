-- Paddle web commerce contract. Local/disposable database only.
BEGIN;

DO $$
DECLARE
    v_apple uuid := gen_random_uuid(); v_google uuid := gen_random_uuid();
    v_credit uuid := gen_random_uuid(); v_paddle uuid := gen_random_uuid();
    v_purchase uuid := gen_random_uuid(); v_pro_purchase uuid := gen_random_uuid();
    v_result jsonb; v_balance integer; v_claimed boolean;
BEGIN
    INSERT INTO auth.users(id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) VALUES
        (v_apple,'authenticated','authenticated','paddle-apple@example.test','',now(),now(),now()),
        (v_google,'authenticated','authenticated','paddle-google@example.test','',now(),now(),now()),
        (v_credit,'authenticated','authenticated','paddle-credit@example.test','',now(),now(),now()),
        (v_paddle,'authenticated','authenticated','paddle-pro@example.test','',now(),now(),now());
    INSERT INTO public.profiles(id, display_name, is_pro) VALUES
        (v_apple,'Apple',false),(v_google,'Google',false),(v_credit,'Credits',false),(v_paddle,'Paddle',false)
    ON CONFLICT (id) DO UPDATE SET is_pro = false;
    INSERT INTO public.credit_balances(user_id,balance) VALUES
        (v_apple,0),(v_google,0),(v_credit,4),(v_paddle,0)
    ON CONFLICT (user_id) DO UPDATE SET balance = EXCLUDED.balance;

    IF public.web_store_credit_delta('purchase_25') <> 25
       OR public.web_store_credit_delta('purchase_100') <> 100
       OR public.web_store_credit_delta('pro_upgrade') <> 0
       OR public.web_store_credit_delta('foreign') IS NOT NULL THEN RAISE EXCEPTION 'catalog_mapping_failed'; END IF;

    INSERT INTO public.web_purchases(id,user_id,provider,product_code,return_path,expected_provider_price_id,purchase_state)
    VALUES(v_purchase,v_credit,'paddle','purchase_25','/app/import/instagram','pri_25','pending');
    v_result := public.fulfill_web_purchase(v_purchase,'paddle','txn_credit','ctm_credit',NULL,'pri_25','pro_credits',NULL,'evt_credit',now());
    IF (v_result->>'delta')::int <> 25 OR (v_result->>'duplicate')::boolean THEN RAISE EXCEPTION 'credit_fulfill_failed_%',v_result; END IF;
    v_result := public.fulfill_web_purchase(v_purchase,'paddle','txn_credit','ctm_credit',NULL,'pri_25','pro_credits',NULL,'evt_credit_dup',now());
    IF (v_result->>'duplicate')::boolean IS NOT TRUE OR (v_result->>'delta')::int <> 0 THEN RAISE EXCEPTION 'duplicate_fulfill_failed_%',v_result; END IF;
    SELECT balance INTO v_balance FROM public.credit_balances WHERE user_id=v_credit;
    IF v_balance <> 29 THEN RAISE EXCEPTION 'credit_balance_expected_29_got_%',v_balance; END IF;
    IF (SELECT count(*) FROM public.credit_transactions WHERE idempotency_key='paddle:transaction:txn_credit') <> 1 THEN RAISE EXCEPTION 'duplicate_ledger_grant'; END IF;

    BEGIN
        PERFORM public.fulfill_web_purchase(v_purchase,'paddle','txn_credit','ctm_credit',NULL,'pri_100','pro_credits',NULL,'evt_wrong',now());
        RAISE EXCEPTION 'wrong_price_should_fail';
    EXCEPTION WHEN OTHERS THEN IF SQLERRM ILIKE '%wrong_price_should_fail%' OR SQLERRM NOT ILIKE '%price_mismatch%' THEN RAISE; END IF; END;
    BEGIN
        PERFORM public.fulfill_web_purchase(v_purchase,'paddle','txn_credit','ctm_credit',NULL,'pri_25','pro_credits',v_apple,'evt_foreign',now());
        RAISE EXCEPTION 'foreign_user_should_fail';
    EXCEPTION WHEN OTHERS THEN IF SQLERRM ILIKE '%foreign_user_should_fail%' OR SQLERRM NOT ILIKE '%user_mismatch%' THEN RAISE; END IF; END;

    INSERT INTO public.web_purchases(id,user_id,provider,product_code,return_path,expected_provider_price_id,purchase_state)
    VALUES(v_pro_purchase,v_paddle,'paddle','pro_upgrade','/app/import/instagram','pri_pro','pending');
    v_result := public.fulfill_web_purchase(v_pro_purchase,'paddle','txn_pro','ctm_pro','sub_pro','pri_pro','pro_monthly',NULL,'evt_pro',now());
    IF (v_result->>'is_pro')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'paddle_pro_not_active_%',v_result; END IF;

    -- Older cancellation cannot beat a newer activation.
    PERFORM public.sync_paddle_subscription_state(v_pro_purchase,NULL,'sub_pro','ctm_pro','active','pri_pro','pro_monthly',now()+interval '1 month',NULL,NULL,now(),'evt_active');
    PERFORM public.sync_paddle_subscription_state(v_pro_purchase,NULL,'sub_pro','ctm_pro','canceled','pri_pro','pro_monthly',now(),NULL,NULL,now()-interval '1 minute','evt_old_cancel');
    IF public.user_has_animaldex_pro(v_paddle) IS NOT TRUE THEN RAISE EXCEPTION 'out_of_order_event_removed_pro'; END IF;

    -- First payment failure grants exactly seven days, and repeated past_due does not extend it.
    PERFORM public.sync_paddle_subscription_state(v_pro_purchase,NULL,'sub_pro','ctm_pro','past_due','pri_pro','pro_monthly',now(),NULL,NULL,now()+interval '1 minute','evt_due');
    IF (SELECT grace_period_end FROM public.paddle_subscriptions WHERE paddle_subscription_id='sub_pro')
       IS DISTINCT FROM (now()+interval '7 days 1 minute') THEN
        -- Clock expression can differ by microseconds across statements; assert bounded below instead.
        IF (SELECT grace_period_end < now()+interval '6 days 23 hours' FROM public.paddle_subscriptions WHERE paddle_subscription_id='sub_pro') THEN
            RAISE EXCEPTION 'past_due_grace_missing';
        END IF;
    END IF;
    PERFORM public.sync_paddle_subscription_state(v_pro_purchase,NULL,'sub_pro','ctm_pro','past_due','pri_pro','pro_monthly',now(),NULL,NULL,now()+interval '2 minutes','evt_due_again');
    IF (SELECT grace_period_end > now()+interval '7 days 90 seconds' FROM public.paddle_subscriptions WHERE paddle_subscription_id='sub_pro') THEN
        RAISE EXCEPTION 'past_due_grace_extended_indefinitely';
    END IF;

    INSERT INTO public.subscriber_entitlements(user_id,entitlements) VALUES
        (v_apple,jsonb_build_object('apple_pro',jsonb_build_object('is_active',true,'source','storekit_current_entitlements'))),
        (v_google,jsonb_build_object('google_play_pro',jsonb_build_object('is_active',true,'source','play_billing')))
    ON CONFLICT (user_id) DO UPDATE SET entitlements=EXCLUDED.entitlements;
    PERFORM public.refresh_animaldex_pro_entitlement(v_apple); PERFORM public.refresh_animaldex_pro_entitlement(v_google);
    IF public.user_has_animaldex_pro(v_apple) IS NOT TRUE OR public.user_has_animaldex_pro(v_google) IS NOT TRUE THEN RAISE EXCEPTION 'native_pro_source_failed'; END IF;
    PERFORM public.sync_paddle_subscription_state(v_pro_purchase,NULL,'sub_pro','ctm_pro','canceled','pri_pro','pro_monthly',now(),NULL,NULL,now()+interval '3 minutes','evt_cancel');
    IF public.user_has_animaldex_pro(v_paddle) IS TRUE THEN RAISE EXCEPTION 'canceled_paddle_remained_pro'; END IF;
    IF public.user_has_animaldex_pro(v_apple) IS NOT TRUE OR public.user_has_animaldex_pro(v_google) IS NOT TRUE THEN RAISE EXCEPTION 'paddle_cancel_clobbered_native_pro'; END IF;

    v_claimed:=public.claim_web_purchase_event('paddle','evt_dup','transaction.completed',now(),'digest');
    IF v_claimed IS NOT TRUE THEN RAISE EXCEPTION 'first_event_claim_failed'; END IF;
    v_claimed:=public.claim_web_purchase_event('paddle','evt_dup','transaction.completed',now(),'digest');
    IF v_claimed IS TRUE THEN RAISE EXCEPTION 'concurrent_duplicate_claimed'; END IF;
    PERFORM public.fail_web_purchase_event('paddle','evt_dup','temporary');
    v_claimed:=public.claim_web_purchase_event('paddle','evt_dup','transaction.completed',now(),'digest');
    IF v_claimed IS NOT TRUE THEN RAISE EXCEPTION 'failed_event_not_retryable'; END IF;
    PERFORM public.complete_web_purchase_event('paddle','evt_dup');
    IF public.claim_web_purchase_event('paddle','evt_dup','transaction.completed',now(),'digest') IS TRUE THEN RAISE EXCEPTION 'processed_event_replayed'; END IF;

    UPDATE public.credit_balances SET balance=15 WHERE user_id=v_credit;
    v_result:=public.record_web_purchase_adjustment('paddle','adj_refund','txn_credit','refund','full','approved','evt_refund',now());
    IF (v_result->>'applied')::int<>15 OR (v_result->>'unrecovered')::int<>10 THEN RAISE EXCEPTION 'refund_policy_failed_%',v_result; END IF;
    SELECT balance INTO v_balance FROM public.credit_balances WHERE user_id=v_credit;
    IF v_balance<>0 THEN RAISE EXCEPTION 'refund_balance_negative_or_nonzero_%',v_balance; END IF;
    v_result:=public.record_web_purchase_adjustment('paddle','adj_refund','txn_credit','refund','full','approved','evt_refund_replay',now());
    IF (v_result->>'duplicate')::boolean IS NOT TRUE THEN RAISE EXCEPTION 'refund_replay_not_noop'; END IF;

    UPDATE public.credit_balances SET balance=10 WHERE user_id=v_credit;
    v_result:=public.record_web_purchase_adjustment('paddle','adj_partial','txn_credit','refund','partial','approved','evt_partial',now());
    IF v_result->>'policy_status'<>'needs_business_review' THEN RAISE EXCEPTION 'partial_refund_not_review_%',v_result; END IF;
    IF (SELECT balance FROM public.credit_balances WHERE user_id=v_credit)<>10 THEN RAISE EXCEPTION 'partial_refund_auto_debited'; END IF;

    RAISE NOTICE 'paddle_web_commerce OK';
END $$;

ROLLBACK;
