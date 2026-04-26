alter table public.species_profiles
    add column if not exists landing_page_slug text,
    add column if not exists catalog_source text,
    add column if not exists catalog_status text;

comment on column public.species_profiles.landing_page_slug is
    'Landing-site editorial slug for the canonical species profile when seeded from the website catalog.';

comment on column public.species_profiles.catalog_source is
    'Where the canonical species profile originated, e.g. landing_repo, capture_analysis, or manual.';

comment on column public.species_profiles.catalog_status is
    'Editorial catalog lifecycle state, e.g. seeded, active, or hidden.';

create unique index if not exists species_profiles_landing_page_slug_key
    on public.species_profiles (landing_page_slug)
    where landing_page_slug is not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'species_profiles_catalog_source_check'
    ) then
        alter table public.species_profiles
            add constraint species_profiles_catalog_source_check
            check (catalog_source in ('landing_repo', 'capture_analysis', 'manual'));
    end if;

    if not exists (
        select 1
        from pg_constraint
        where conname = 'species_profiles_catalog_status_check'
    ) then
        alter table public.species_profiles
            add constraint species_profiles_catalog_status_check
            check (catalog_status in ('seeded', 'active', 'hidden'));
    end if;
end $$;
