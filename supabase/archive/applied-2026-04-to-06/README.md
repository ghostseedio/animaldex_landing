# Applied legacy migrations (April–June 2026)

These eighteen files ran against production long ago and their objects were
verified present on 2026-09-25: `species_subtitles`, the `species_profiles`
catalog columns, and the `support_threads` / support-inbox schema all exist.

They are kept for reference but moved out of `supabase/migrations/` because
their filenames use an eight-digit date (`20260410_…`) rather than the
fourteen-digit version (`20260410120000_…`) the Supabase CLI matches against
`supabase_migrations.schema_migrations`. While they sat in the migrations
directory the CLI could never match them to a history row, so every one showed
as pending forever — and `supabase db push` would have tried to re-run all
eighteen, including the `20260616` seed, which takes a
`share row exclusive` lock on `species_profiles`.

Nothing here should be re-run. If one is ever needed again, read it, confirm
against the live schema first, and apply it deliberately rather than through
`db push`.

## Why this project's migration history looks strange

Two repositories push migrations to the same Supabase project
(`wwhsdzpczekgdlobwaej`): `AnimalDex` (the iOS app, which owns the great
majority) and this one. `supabase migration list` therefore reports hundreds of
"remote-only" migrations that are not drift — they are the iOS repo's, working
as intended. Only this repo's own files are worth reconciling here.

One consequence to watch for: the two repos can pick the same version number.
`20260925160000` was claimed by both, which made this repo's migration look
already-applied when it was not. Check both repositories before choosing a
version.
