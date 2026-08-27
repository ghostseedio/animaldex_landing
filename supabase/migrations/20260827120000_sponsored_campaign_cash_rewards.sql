-- Deterministic sponsor-funded campaign Earnings. This is deliberately
-- separate from AnimalDex Credits, PvP stakes, random drawings and payouts.

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

comment on table public.campaign_cash_rewards is
  'Fixed deterministic sponsor-funded Earnings. Never AnimalDex Credits, wagering, a random prize, or a user-funded pool.';

create table if not exists public.campaign_reward_grants (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.sponsored_campaigns(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  reward_type text not null default 'cash' check (reward_type = 'cash'),
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  status text not null default 'allocated'
    check (status in ('allocated', 'posted', 'cancelled')),
  earning_entry_id uuid references public.earning_entries(id) on delete restrict,
  qualification_reference text not null,
  idempotency_key text not null unique,
  allocated_at timestamptz not null default now(),
  posted_at timestamptz,
  constraint campaign_reward_grants_one_cash_per_user unique (campaign_id, user_id, reward_type)
);

comment on table public.campaign_reward_grants is
  'Immutable allocation boundary between authoritative campaign completion and the fiat Earnings ledger.';

alter table public.sponsored_campaigns
  add column if not exists thumbnail_storage_path text,
  add column if not exists thumbnail_alt_text text,
  add column if not exists thumbnail_updated_at timestamptz;

create index if not exists campaign_reward_grants_campaign_status_idx
  on public.campaign_reward_grants(campaign_id, status);

alter table public.campaign_cash_rewards enable row level security;
alter table public.campaign_reward_grants enable row level security;
revoke all on public.campaign_cash_rewards from anon, authenticated;
revoke all on public.campaign_reward_grants from anon, authenticated;

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
  select * into v_campaign from public.sponsored_campaigns where id = p_campaign_id for update;
  if v_campaign.id is null then raise exception 'campaign_not_found'; end if;
  if v_campaign.status not in ('draft', 'submitted', 'rejected') then
    raise exception 'campaign_not_editable';
  end if;
  if v_campaign.sponsor_organization_id is null then
    raise exception 'cash_reward_requires_sponsor';
  end if;
  if p_amount_minor <= 0 or p_max_recipients <= 0 or coalesce(p_platform_fee_minor, 0) < 0 then
    raise exception 'invalid_cash_reward';
  end if;
  if upper(btrim(p_currency_code)) !~ '^[A-Z]{3}$' then
    raise exception 'invalid_currency';
  end if;

  insert into public.campaign_cash_rewards (
    campaign_id, amount_minor, currency_code, max_recipients, platform_fee_minor,
    funding_status, funded_amount_minor, funded_at, funding_reference, updated_at
  ) values (
    p_campaign_id, p_amount_minor, upper(btrim(p_currency_code)), p_max_recipients,
    coalesce(p_platform_fee_minor, 0), 'draft', 0, null, null, now()
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
  v_liability bigint;
begin
  select * into v_reward from public.campaign_cash_rewards
  where campaign_id = p_campaign_id for update;
  if v_reward.campaign_id is null then raise exception 'cash_reward_not_configured'; end if;
  v_liability := (v_reward.amount_minor * v_reward.max_recipients) + v_reward.platform_fee_minor;
  if p_funded_amount_minor <> v_liability then raise exception 'funding_must_equal_campaign_total'; end if;
  if nullif(btrim(p_funding_reference), '') is null then raise exception 'funding_reference_required'; end if;

  update public.campaign_cash_rewards set
    funding_status = 'confirmed',
    funded_amount_minor = p_funded_amount_minor,
    funded_at = now(),
    funding_reference = btrim(p_funding_reference),
    updated_at = now()
  where campaign_id = p_campaign_id
  returning * into v_reward;
  return v_reward;
end;
$$;

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
  if nullif(btrim(p_storage_path), '') is null then raise exception 'thumbnail_path_required'; end if;
  if nullif(btrim(p_alt_text), '') is null then raise exception 'thumbnail_alt_required'; end if;
  update public.sponsored_campaigns set
    thumbnail_storage_path = btrim(p_storage_path),
    thumbnail_alt_text = left(btrim(p_alt_text), 240),
    thumbnail_updated_at = now(),
    updated_at = now()
  where id = p_campaign_id and status in ('draft', 'submitted', 'rejected');
  if not found then raise exception 'campaign_not_editable'; end if;
end;
$$;

create or replace function public.sponsored_campaign_cash_publish_guard()
returns trigger language plpgsql set search_path = public as $$
declare v_reward public.campaign_cash_rewards;
begin
  if new.status in ('approved', 'scheduled', 'live')
     and old.status is distinct from new.status then
    select * into v_reward from public.campaign_cash_rewards where campaign_id = new.id;
    if v_reward.campaign_id is not null and (
      v_reward.funding_status <> 'confirmed'
      or v_reward.funded_amount_minor < (v_reward.amount_minor * v_reward.max_recipients) + v_reward.platform_fee_minor
    ) then
      raise exception 'cash_campaign_funding_not_confirmed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sponsored_campaign_cash_publish_guard on public.sponsored_campaigns;
create trigger sponsored_campaign_cash_publish_guard
before update of status on public.sponsored_campaigns
for each row execute function public.sponsored_campaign_cash_publish_guard();

create or replace function public.allocate_sponsored_campaign_cash_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward public.campaign_cash_rewards;
  v_grant public.campaign_reward_grants;
  v_count integer;
  v_entry_id uuid;
begin
  if new.status <> 'completed' or new.completed_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.status = 'completed' then return new; end if;

  select * into v_reward from public.campaign_cash_rewards
  where campaign_id = new.campaign_id for update;
  if v_reward.campaign_id is null or v_reward.funding_status <> 'confirmed' then return new; end if;

  select count(*) into v_count from public.campaign_reward_grants
  where campaign_id = new.campaign_id and status <> 'cancelled';
  if v_count >= v_reward.max_recipients then return new; end if;

  insert into public.campaign_reward_grants (
    campaign_id, user_id, amount_minor, currency_code, qualification_reference,
    idempotency_key
  ) values (
    new.campaign_id, new.user_id, v_reward.amount_minor, v_reward.currency_code,
    new.campaign_id::text || ':' || new.user_id::text,
    'campaign_reward:' || new.campaign_id::text || ':' || new.user_id::text
  )
  on conflict (campaign_id, user_id, reward_type) do nothing
  returning * into v_grant;
  if v_grant.id is null then return new; end if;

  perform public.post_pending_earning(
    p_user_id => new.user_id,
    p_currency_code => v_reward.currency_code,
    p_amount_minor => v_reward.amount_minor,
    p_source_type => 'campaign_reward',
    p_source_id => v_grant.id::text,
    p_idempotency_key => v_grant.idempotency_key,
    p_metadata => jsonb_build_object(
      'campaign_id', new.campaign_id,
      'campaign_reward_grant_id', v_grant.id,
      'rules_version', new.rules_version_accepted
    )
  );

  select id into v_entry_id
  from public.earning_entries
  where idempotency_key = v_grant.idempotency_key;

  update public.campaign_reward_grants set
    status = 'posted', earning_entry_id = v_entry_id, posted_at = now()
  where id = v_grant.id;
  return new;
end;
$$;

drop trigger if exists allocate_sponsored_campaign_cash_reward on public.campaign_participants;
create trigger allocate_sponsored_campaign_cash_reward
after insert or update on public.campaign_participants
for each row execute function public.allocate_sponsored_campaign_cash_reward();

create or replace view public.campaign_cash_reward_inventory_v1
with (security_invoker = true) as
select
  r.campaign_id,
  r.amount_minor,
  r.currency_code,
  r.max_recipients,
  r.platform_fee_minor,
  r.funding_status,
  r.funded_amount_minor,
  r.funded_at,
  r.funding_reference,
  count(g.id) filter (where g.status <> 'cancelled')::integer as allocated_recipients,
  greatest(0, r.max_recipients - count(g.id) filter (where g.status <> 'cancelled'))::integer as remaining_recipients,
  (r.amount_minor * r.max_recipients) as reward_liability_minor,
  (r.amount_minor * r.max_recipients) + r.platform_fee_minor as campaign_total_minor
from public.campaign_cash_rewards r
left join public.campaign_reward_grants g on g.campaign_id = r.campaign_id
group by r.campaign_id;

revoke all on public.campaign_cash_reward_inventory_v1 from anon, authenticated;
grant select on public.campaign_cash_reward_inventory_v1 to service_role;
grant execute on function public.admin_set_campaign_cash_reward(uuid, bigint, text, integer, bigint) to service_role;
grant execute on function public.admin_confirm_campaign_cash_funding(uuid, bigint, text) to service_role;
grant execute on function public.admin_set_sponsored_campaign_thumbnail(uuid, text, text) to service_role;
revoke all on function public.admin_set_campaign_cash_reward(uuid, bigint, text, integer, bigint) from public;
revoke all on function public.admin_confirm_campaign_cash_funding(uuid, bigint, text) from public;
revoke all on function public.admin_set_sponsored_campaign_thumbnail(uuid, text, text) from public;
