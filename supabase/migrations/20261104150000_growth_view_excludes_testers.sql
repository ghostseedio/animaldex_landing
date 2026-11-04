-- /admin/metrics leaves out dev testers (profiles.is_dev_tester, e.g. the
-- owner's own account) and system accounts. Every user metric starts from
-- this view, and activity by an account missing from it is dropped, so this
-- one filter removes them from signups, activity, retention and channels.
-- Same columns as 20261104120000; only the WHERE is new.

begin;

create or replace view public.admin_user_growth_v1 as
with devices as (
    select
        user_id,
        (array_agg(platform order by first_seen_at))[1] as first_reported_platform,
        min(first_seen_at) as first_reported_at,
        array_agg(distinct platform) as reported_platforms,
        max(last_seen_at) as last_seen_at
    from public.user_devices
    group by user_id
)
select
    p.id as user_id,
    p.created_at,
    d.first_reported_platform,
    d.first_reported_at,
    d.reported_platforms,
    d.last_seen_at,
    exists (select 1 from public.user_push_tokens t where t.user_id = p.id) as has_apns_token,
    exists (
        select 1 from public.app_store_purchases s
        where s.user_id = p.id and s.environment = 'Production'
    ) as has_app_store_purchase,
    exists (
        select 1 from public.credit_transactions c
        where c.user_id = p.id and c.reason = 'purchase'
          and c.metadata->>'source' in ('play_billing', 'google_play', 'google_play_billing')
    ) or coalesce(e.entitlements ? 'google_play_pro', false) as has_play_purchase,
    coalesce(u.raw_app_meta_data->'providers', jsonb_build_array(u.raw_app_meta_data->>'provider')) as auth_providers,
    a.first_platform as acquisition_platform,
    a.self_reported_source,
    a.self_reported_detail,
    a.install_referrer,
    a.utm_source,
    a.utm_medium,
    a.utm_campaign,
    a.gclid,
    a.apple_ads_attributed,
    a.apple_ads_campaign_id,
    a.store_attribution_at,
    a.utm_content,
    a.landing_path,
    a.referrer_host
from public.profiles p
left join devices d on d.user_id = p.id
left join auth.users u on u.id = p.id
left join public.subscriber_entitlements e on e.user_id = p.id
left join public.user_acquisition a on a.user_id = p.id
where not coalesce(p.is_dev_tester, false)
  and not coalesce(p.is_system, false);

revoke all on public.admin_user_growth_v1 from public, anon, authenticated;
grant select on public.admin_user_growth_v1 to service_role;

commit;
