alter table public.sponsored_campaigns
  add column if not exists thumbnail_storage_path text,
  add column if not exists thumbnail_alt_text text,
  add column if not exists thumbnail_updated_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sponsored-challenges',
  'sponsored-challenges',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.campaign_cash_rewards (
  campaign_id uuid primary key references public.sponsored_campaigns(id) on delete cascade,
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  max_recipients integer not null check (max_recipients > 0),
  platform_fee_minor bigint not null default 0 check (platform_fee_minor >= 0),
  funding_status text not null default 'draft'
    check (funding_status in ('draft', 'pending', 'confirmed', 'cancelled', 'refunded')),
  funded_amount_minor bigint not null default 0 check (funded_amount_minor >= 0),
  funded_at timestamptz,
  funding_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campaign_cash_rewards_liability_check
    check (funded_amount_minor <= (amount_minor * max_recipients) + platform_fee_minor)
);

alter table public.campaign_cash_rewards enable row level security;
revoke all on public.campaign_cash_rewards from anon, authenticated;

create or replace view public.campaign_cash_reward_inventory_v1
with (security_invoker = true)
as
select
  campaign_id,
  amount_minor,
  currency_code,
  max_recipients,
  platform_fee_minor,
  funding_status,
  funded_amount_minor,
  funded_at,
  funding_reference,
  0::integer as allocated_recipients,
  max_recipients as remaining_recipients,
  (amount_minor * max_recipients) as reward_liability_minor,
  (amount_minor * max_recipients) + platform_fee_minor as campaign_total_minor
from public.campaign_cash_rewards;

revoke all on public.campaign_cash_reward_inventory_v1 from anon, authenticated;

create or replace function public.admin_set_campaign_cash_reward(
  p_campaign_id uuid,
  p_amount_minor bigint,
  p_currency_code text,
  p_max_recipients integer,
  p_platform_fee_minor bigint default 0
) returns public.campaign_cash_rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.sponsored_campaigns;
  v_result public.campaign_cash_rewards;
begin
  select * into v_campaign
  from public.sponsored_campaigns
  where id = p_campaign_id
  for update;
  if v_campaign.id is null then raise exception 'campaign_not_found'; end if;
  if v_campaign.status not in ('draft', 'submitted', 'rejected') then
    raise exception 'campaign_not_editable';
  end if;
  if v_campaign.sponsor_organization_id is null then
    raise exception 'cash_reward_requires_sponsor';
  end if;
  if p_amount_minor <= 0 or p_max_recipients <= 0
     or coalesce(p_platform_fee_minor, 0) < 0 then
    raise exception 'invalid_cash_reward';
  end if;
  if upper(btrim(p_currency_code)) !~ '^[A-Z]{3}$' then
    raise exception 'invalid_currency';
  end if;

  insert into public.campaign_cash_rewards (
    campaign_id, amount_minor, currency_code, max_recipients,
    platform_fee_minor, funding_status, funded_amount_minor,
    funded_at, funding_reference, updated_at
  ) values (
    p_campaign_id, p_amount_minor, upper(btrim(p_currency_code)),
    p_max_recipients, coalesce(p_platform_fee_minor, 0),
    'draft', 0, null, null, now()
  )
  on conflict (campaign_id) do update set
    amount_minor = excluded.amount_minor,
    currency_code = excluded.currency_code,
    max_recipients = excluded.max_recipients,
    platform_fee_minor = excluded.platform_fee_minor,
    funding_status = 'draft',
    funded_amount_minor = 0,
    funded_at = null,
    funding_reference = null,
    updated_at = now()
  returning * into v_result;
  return v_result;
end;
$$;

create or replace function public.admin_confirm_campaign_cash_funding(
  p_campaign_id uuid,
  p_funded_amount_minor bigint,
  p_funding_reference text
) returns public.campaign_cash_rewards
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward public.campaign_cash_rewards;
  v_total bigint;
begin
  select * into v_reward
  from public.campaign_cash_rewards
  where campaign_id = p_campaign_id
  for update;
  if v_reward.campaign_id is null then raise exception 'cash_reward_not_configured'; end if;
  v_total := (v_reward.amount_minor * v_reward.max_recipients) + v_reward.platform_fee_minor;
  if p_funded_amount_minor <> v_total then
    raise exception 'funding_must_equal_campaign_total';
  end if;
  if nullif(btrim(p_funding_reference), '') is null then
    raise exception 'funding_reference_required';
  end if;

  update public.campaign_cash_rewards
  set funding_status = 'confirmed',
      funded_amount_minor = p_funded_amount_minor,
      funded_at = now(),
      funding_reference = btrim(p_funding_reference),
      updated_at = now()
  where campaign_id = p_campaign_id
  returning * into v_reward;
  return v_reward;
end;
$$;

grant execute on function public.admin_set_campaign_cash_reward(uuid, bigint, text, integer, bigint)
  to service_role;
grant execute on function public.admin_confirm_campaign_cash_funding(uuid, bigint, text)
  to service_role;
revoke all on function public.admin_set_campaign_cash_reward(uuid, bigint, text, integer, bigint)
  from public;
revoke all on function public.admin_confirm_campaign_cash_funding(uuid, bigint, text)
  from public;

create or replace function public.admin_set_sponsored_campaign_thumbnail(
  p_campaign_id uuid,
  p_storage_path text,
  p_alt_text text
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(p_storage_path), '') is null then
    raise exception 'thumbnail_path_required';
  end if;
  if nullif(btrim(p_alt_text), '') is null then
    raise exception 'thumbnail_alt_required';
  end if;

  update public.sponsored_campaigns
  set thumbnail_storage_path = btrim(p_storage_path),
      thumbnail_alt_text = left(btrim(p_alt_text), 240),
      thumbnail_updated_at = now(),
      updated_at = now()
  where id = p_campaign_id
    and status in ('draft', 'submitted', 'rejected');

  if not found then raise exception 'campaign_not_editable'; end if;
end;
$$;

grant execute on function public.admin_set_sponsored_campaign_thumbnail(uuid, text, text)
  to service_role;
revoke all on function public.admin_set_sponsored_campaign_thumbnail(uuid, text, text)
  from public;

create or replace function public.list_sponsored_campaign_cash_rewards(
  p_campaign_ids uuid[]
)
returns table (
  campaign_id uuid,
  amount_minor bigint,
  currency_code text,
  max_recipients integer,
  remaining_recipients integer,
  campaign_total_minor bigint,
  funding_status text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.campaign_id,
         r.amount_minor,
         r.currency_code,
         r.max_recipients,
         r.max_recipients as remaining_recipients,
         (r.amount_minor * r.max_recipients) + r.platform_fee_minor as campaign_total_minor,
         r.funding_status
  from public.campaign_cash_rewards r
  join public.sponsored_campaigns c on c.id = r.campaign_id
  where r.campaign_id = any(coalesce(p_campaign_ids, array[]::uuid[]))
    and c.status in ('scheduled', 'live', 'completed')
  order by r.campaign_id;
$$;

grant execute on function public.list_sponsored_campaign_cash_rewards(uuid[])
  to authenticated;
revoke all on function public.list_sponsored_campaign_cash_rewards(uuid[])
  from anon;
