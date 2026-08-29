-- Persist the non-sensitive recipient address collected during payout destination setup.
-- Bank account details (sort code / account number / IBAN) remain ephemeral and are
-- never stored; address is kept so finance approval can validate the Wise recipient
-- account against the corridor's dynamic account-requirements before quoting.
alter table if exists public.payout_profiles
    add column if not exists address_country text,
    add column if not exists address_city text,
    add column if not exists address_post_code text,
    add column if not exists address_first_line text,
    add column if not exists address_state text;
