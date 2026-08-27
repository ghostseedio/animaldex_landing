alter table public.growth_marketing_daily_organic
    drop constraint if exists growth_marketing_daily_organic_platform_check;

alter table public.growth_marketing_daily_organic
    add constraint growth_marketing_daily_organic_platform_check
    check (platform in ('tiktok', 'instagram', 'youtube', 'facebook', 'x', 'reddit', 'other'));
