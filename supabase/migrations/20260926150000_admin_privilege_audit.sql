-- Privilege posture, as data, so CI can assert on it.
--
-- Three Severity-0 exposures were found by hand on 2026-09-25: 23 tables
-- writable by the logged-out role, 202 mutating SECURITY DEFINER functions it
-- could execute, and the ALTER DEFAULT PRIVILEGES entries that regenerate both
-- on every CREATE. All three were invisible to code review because none of them
-- live in a migration -- they are database state, and the repo never asserted
-- anything about it.
--
-- This function is the assertion surface. It returns one row per violation, so
-- an empty result is the contract holding. src/lib/database-privilege-contract
-- .test.ts fails CI on any row.
--
-- Read-only, service_role only. It reports posture; it never changes it.

begin;

create or replace function public.admin_privilege_audit_v1()
returns table (
    severity text,
    kind text,
    object_name text,
    detail text
)
language sql
stable
security definer
set search_path = public, pg_catalog, pg_temp
as $$
    -- 1. Any table the logged-out role can write. RLS is not a defence here:
    --    a definer function or a future permissive policy turns a grant into
    --    an open door, and least privilege says anon never writes.
    -- RLS off means the grant IS the access path: critical. RLS on means the
    -- policy predicate is doing the work, which holds today but is a weaker
    -- guarantee than not holding the grant: warning, not noise to be ignored.
    select case when c.relrowsecurity then 'warning' else 'critical' end::text,
           'anon_table_write'::text, c.relname::text,
           string_agg(distinct g.privilege_type, ',' order by g.privilege_type)
             || case when c.relrowsecurity then ' (contained by RLS)' else ' (RLS OFF)' end
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join information_schema.role_table_grants g
        on g.table_schema = 'public' and g.table_name = c.relname
     where n.nspname = 'public' and c.relkind = 'r'
       and g.grantee = 'anon'
       and g.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
     group by c.relname, c.relrowsecurity

    union all
    -- 2. Mutating SECURITY DEFINER functions the logged-out role can call.
    --    A definer runs as its owner and bypasses RLS and table grants, so
    --    this is the bypass that made (1) insufficient on its own.
    select 'critical', 'anon_definer_execute', p.proname::text,
           pg_get_function_identity_arguments(p.oid)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef and p.prokind = 'f'
       and p.provolatile = 'v'
       and p.prosrc ~* '\m(insert|update|delete|truncate)\M'
       and has_function_privilege('anon', p.oid, 'EXECUTE')

    union all
    -- 3. The defaults that regenerate 1 and 2 on every CREATE.
    select 'critical', 'unsafe_default_privilege',
           coalesce(pg_get_userbyid(d.defaclrole), '?') || '/' || d.defaclobjtype::text,
           array_to_string(d.defaclacl, ' | ')
      from pg_default_acl d
      join pg_namespace n on n.oid = d.defaclnamespace
     where n.nspname = 'public'
       and (
            (d.defaclobjtype = 'r' and array_to_string(d.defaclacl, ',') ~ 'anon=[a-zA-Z]*[awdD]')
         or (d.defaclobjtype = 'f' and array_to_string(d.defaclacl, ',') ~ 'anon=[a-zA-Z]*X')
         or (d.defaclobjtype = 'S' and array_to_string(d.defaclacl, ',') ~ 'anon=[a-zA-Z]*w')
       )

    union all
    -- 4. Reference and config tables must never be client-writable. These are
    --    the catalogue, pricing and editorial control surfaces; a write here
    --    affects every user at once rather than one account.
    select 'critical', 'reference_table_client_write', g.table_name::text,
           g.grantee || ':' || g.privilege_type
      from information_schema.role_table_grants g
     where g.table_schema = 'public'
       and g.grantee in ('anon','authenticated')
       and g.privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')
       and g.table_name in (
            'species_profiles','species_subtitles','species_behavior_principles',
            'species_principle_fusion_recipes','best_for_tag_remap','canonical_best_for_tags',
            'breed_market_profiles','breed_market_country_adjustments','instagram_import_pricing',
            'arena_v2_config','discover_featured_slots','challenge_scenarios',
            'external_import_stage_limits')

    union all
    -- 5. RLS must stay on where user data lives. Losing it turns every
    --    remaining grant into unrestricted cross-user access.
    select 'critical', 'rls_disabled', c.relname::text, 'row level security is off'
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
       and c.relname in ('captures','capture_images','analysis_results','profiles',
                         'capture_provenance_events','capture_analysis_queue')

    union all
    -- 6. Write policies the logged-out role can actually satisfy.
    --    Supabase creates policies as `TO public`, which includes anon, so the
    --    role list alone flags 45 perfectly safe policies. What makes them safe
    --    is the predicate: `auth.uid() = user_id` is NULL for anon and so never
    --    true. A write policy reachable by anon that does NOT test auth.uid()
    --    (or auth.jwt()) is the real defect.
    select 'critical', 'anon_write_policy', tablename::text,
           policyname || ' (' || cmd || ') predicate does not test auth.uid()'
      from pg_policies
     where schemaname = 'public'
       and cmd in ('INSERT','UPDATE','DELETE','ALL')
       and (roles::text like '%anon%' or roles::text = '{public}')
       and coalesce(with_check, qual, '') !~ 'auth\.(uid|jwt)\(\)'

    order by 1, 2, 3;
$$;

comment on function public.admin_privilege_audit_v1() is
    'Database privilege posture as violation rows. Empty result = contract holds. Service role only.';

revoke all on function public.admin_privilege_audit_v1() from public, anon, authenticated;
grant execute on function public.admin_privilege_audit_v1() to service_role;

commit;
