-- web_funnel_events contract (migration 20261104180000). Local/disposable database only.
BEGIN;

DO $$
DECLARE
    v_hash text := repeat('a', 64);
    v_count integer;
BEGIN
    INSERT INTO public.web_funnel_events(visitor_hash, event, variant, chip_kind, path)
    VALUES (v_hash, 'hero_view', 'b', NULL, '/'),
           (v_hash, 'demo_start', 'b', 'idea', '/'),
           (v_hash, 'signup', 'b', NULL, '/talk/african-lion');
    SELECT count(*) INTO v_count FROM public.web_funnel_events WHERE visitor_hash = v_hash;
    IF v_count <> 3 THEN RAISE EXCEPTION 'expected_3_rows_got_%', v_count; END IF;

    -- Only the funnel's own steps, variants, chip kinds, hashes and paths.
    BEGIN
        INSERT INTO public.web_funnel_events(visitor_hash, event, variant) VALUES (v_hash, 'page_view', 'a');
        RAISE EXCEPTION 'unknown_event_should_fail';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
        INSERT INTO public.web_funnel_events(visitor_hash, event, variant) VALUES (v_hash, 'hero_view', 'c');
        RAISE EXCEPTION 'unknown_variant_should_fail';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
        INSERT INTO public.web_funnel_events(visitor_hash, event, variant, chip_kind) VALUES (v_hash, 'demo_start', 'a', 'voice');
        RAISE EXCEPTION 'unknown_chip_kind_should_fail';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
        INSERT INTO public.web_funnel_events(visitor_hash, event, variant) VALUES ('raw-visitor-id', 'hero_view', 'a');
        RAISE EXCEPTION 'unhashed_visitor_should_fail';
    EXCEPTION WHEN check_violation THEN NULL; END;
    BEGIN
        INSERT INTO public.web_funnel_events(visitor_hash, event, variant, path) VALUES (v_hash, 'hero_view', 'a', 'https://evil.example/');
        RAISE EXCEPTION 'absolute_path_should_fail';
    EXCEPTION WHEN check_violation THEN NULL; END;

    -- Service role only: the browser roles hold no privilege on it.
    IF has_table_privilege('anon', 'public.web_funnel_events', 'INSERT')
       OR has_table_privilege('anon', 'public.web_funnel_events', 'SELECT')
       OR has_table_privilege('authenticated', 'public.web_funnel_events', 'INSERT')
       OR has_table_privilege('authenticated', 'public.web_funnel_events', 'SELECT') THEN
        RAISE EXCEPTION 'browser_roles_must_not_touch_funnel_events';
    END IF;
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.web_funnel_events'::regclass) THEN
        RAISE EXCEPTION 'rls_must_be_enabled';
    END IF;
END $$;

ROLLBACK;
