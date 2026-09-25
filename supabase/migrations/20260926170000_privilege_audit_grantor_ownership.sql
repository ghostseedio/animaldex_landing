-- Refine admin_privilege_audit_v1: an unsafe default privilege only matters if
-- the role it belongs to actually creates objects here.
--
-- After the emergency work, the audit reported exactly three criticals, all of
-- them supabase_admin's ALTER DEFAULT PRIVILEGES entries in public. They cannot
-- be removed -- `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin` fails with
-- 42501 "permission denied to change default privileges" both from the CLI role
-- and from the dashboard SQL editor, because neither is a member of
-- supabase_admin.
--
-- They are also currently harmless. Default privileges apply per CREATING role,
-- and supabase_admin owns zero tables in public; all 235 belong to postgres,
-- whose defaults were fixed by 20260926140000. So supabase_admin's entries
-- describe what would happen to objects it creates, and it creates none.
--
-- Leaving them as `critical` would mean shipping a privilege test that can
-- never pass, which trains everyone to ignore it -- the exact failure mode this
-- test exists to prevent. Suppressing them entirely would mean missing the day
-- supabase_admin does create a table and the defaults become live.
--
-- So the severity is derived from ownership: critical while the grantor owns
-- objects in public, warning while it owns none. The condition is checked on
-- every run, so this upgrades itself back to critical automatically.

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
    select 'critical', 'anon_definer_execute', p.proname::text,
           pg_get_function_identity_arguments(p.oid)
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef and p.prokind = 'f'
       and p.provolatile = 'v'
       and p.prosrc ~* '\m(insert|update|delete|truncate)\M'
       and has_function_privilege('anon', p.oid, 'EXECUTE')

    union all
    -- Severity follows ownership: see the header.
    select case
             when exists (
               select 1 from pg_class c2
                join pg_namespace n2 on n2.oid = c2.relnamespace
               where n2.nspname = 'public' and c2.relkind = 'r'
                 and c2.relowner = d.defaclrole
             ) then 'critical' else 'warning'
           end,
           'unsafe_default_privilege',
           coalesce(pg_get_userbyid(d.defaclrole), '?') || '/' || d.defaclobjtype::text,
           array_to_string(d.defaclacl, ' | ')
             || case when exists (
                       select 1 from pg_class c3
                        join pg_namespace n3 on n3.oid = c3.relnamespace
                       where n3.nspname = 'public' and c3.relkind = 'r'
                         and c3.relowner = d.defaclrole)
                     then ' [LIVE: this role owns tables in public]'
                     else ' [inert: this role owns no tables in public]' end
      from pg_default_acl d
      join pg_namespace n on n.oid = d.defaclnamespace
     where n.nspname = 'public'
       and (
            (d.defaclobjtype = 'r' and array_to_string(d.defaclacl, ',') ~ 'anon=[a-zA-Z]*[awdD]')
         or (d.defaclobjtype = 'f' and array_to_string(d.defaclacl, ',') ~ 'anon=[a-zA-Z]*X')
         or (d.defaclobjtype = 'S' and array_to_string(d.defaclacl, ',') ~ 'anon=[a-zA-Z]*w')
       )

    union all
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
    select 'critical', 'rls_disabled', c.relname::text, 'row level security is off'
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
       and c.relname in ('captures','capture_images','analysis_results','profiles',
                         'capture_provenance_events','capture_analysis_queue')

    union all
    select 'critical', 'anon_write_policy', tablename::text,
           policyname || ' (' || cmd || ') predicate does not test auth.uid()'
      from pg_policies
     where schemaname = 'public'
       and cmd in ('INSERT','UPDATE','DELETE','ALL')
       and (roles::text like '%anon%' or roles::text = '{public}')
       and coalesce(with_check, qual, '') !~ 'auth\.(uid|jwt)\(\)'

    order by 1, 2, 3;
$$;

revoke all on function public.admin_privilege_audit_v1() from public, anon, authenticated;
grant execute on function public.admin_privilege_audit_v1() to service_role;

commit;
