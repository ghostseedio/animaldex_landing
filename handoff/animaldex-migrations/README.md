# Handoff: migration for the AnimalDex repo

`20260926100000_capture_provenance_integrity.sql` belongs in
`~/AnimalDex/supabase/migrations/`, not here. It alters `public.captures`,
`public.capture_images` and `public.analysis_results`, and that schema is owned
by the iOS repo — this repo has only ever added indexes to `captures`. It is
staged here so it can be reviewed in git before being moved.

## Before applying

Check the version is still free in **both** repos. `20260925160000` was once
claimed by both, which made a landing migration look already-applied when it
was not:

    ls ~/AnimalDex/supabase/migrations/20260926100000* \
       ~/AnimalDex-landing/supabase/migrations/20260926100000*

## Validate first

`VALIDATE-rollback-only.sql` is the same file with `COMMIT` replaced by
`ROLLBACK`. It executes every statement against the real schema and then throws
the work away, which proves the syntax, the trigger definitions and the
deferred foreign key without changing anything:

    npx supabase db query --linked -f handoff/animaldex-migrations/VALIDATE-rollback-only.sql

Expect no output and no error. Anything else is a real problem — fix it before
applying the committing version.

## Then apply

    cp handoff/animaldex-migrations/20260926100000_capture_provenance_integrity.sql \
       ~/AnimalDex/supabase/migrations/
    npx supabase db query --linked -f ~/AnimalDex/supabase/migrations/20260926100000_capture_provenance_integrity.sql

Commit it in `~/AnimalDex` so the repo and the database agree.

## What it does not fix

Clients can still INSERT their own `analysis_results` row (self-declaring
species, which drives the AnimalDex number) and set `status` and
`analysis_credit_cost` directly. Both need an RPC the app calls instead, so they
are coupled to an app release. `SupabaseManualCaptureSyncService.swift`
legitimately inserts `analysis_results` today — revoking that grant without
shipping the RPC first would break Discover saves.

And no server rule proves a JPEG came from a camera. This makes the recorded
metadata true and the unverifiable claims visible; it does not authenticate
pixels.
