-- Capture provenance integrity: make the server the source of truth for when a
-- capture happened, and record the claims it cannot verify.
--
-- WHY. On 2026-09-25 one account produced 24 captures whose recorded origin was
-- entirely fabricated. Twelve carried created_at of 2026-09-15 — ten days
-- before the account itself existed (profile created 2026-09-25 05:38:42) — and
-- landed 13 to 83 seconds after signup, roughly six seconds apart. The other
-- twelve were the same JPEG submitted twelve times (1280x1709, 546,059 bytes
-- each) at coordinates 13.7563, 100.5018: the Bangkok city-centre value, four
-- decimal places on both axes, which no GPS fix returns. All 24 claimed
-- acquisition_kind = 'live_capture' and location_evidence_source = 'device_gps'
-- at 5 m accuracy.
--
-- None of that required a modified app. `authenticated` holds column-level
-- INSERT on created_at, captured_at, acquisition_kind and location_lat/lng, and
-- the RLS policy captures_all_own is `auth.uid() = user_id` with no WITH CHECK
-- — it constrains whose row it is, never what is in it. A POST to
-- /rest/v1/captures with a forged body was sufficient.
--
-- Half the defence already existed and simply never ran on this path:
-- captures_invalidate_untrusted_coordinate_change downgrades location evidence
-- when coordinates move without a trusted bundle, but it is an UPDATE-only
-- trigger. An INSERT walks straight past it. Section 3 fixes exactly that.
--
-- WHAT THIS DOES NOT DO. No server-side rule can prove a JPEG came from a
-- camera rather than a web page. This migration makes the recorded metadata
-- true and makes the un-provable claims visible; it does not authenticate
-- pixels. Closing the remaining holes — clients can still INSERT their own
-- analysis_results (self-declaring species) and set status/analysis_credit_cost
-- directly — requires an RPC the app calls instead, and therefore an app
-- release. Deliberately out of scope here: this file cannot break a shipped
-- client.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Where un-provable claims are recorded
-- ---------------------------------------------------------------------------
-- A separate table rather than columns on captures: this is evidence about a
-- row, it is append-only, and keeping it outside captures means none of the
-- sixteen existing triggers on that table change behaviour.
CREATE TABLE IF NOT EXISTS public.capture_provenance_events (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- DEFERRABLE INITIALLY DEFERRED is required, not stylistic: the timestamp
    -- and coordinate triggers below are BEFORE INSERT on captures, so the
    -- parent row does not exist yet when the event row is written. An
    -- immediate FK check would abort every flagged capture.
    capture_id  uuid NOT NULL REFERENCES public.captures(id) ON DELETE CASCADE
                DEFERRABLE INITIALLY DEFERRED,
    user_id     uuid,
    kind        text NOT NULL,
    detail      jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.capture_provenance_events IS
    'Append-only record of capture origin claims the server could not verify, '
    'or corrected. Written by trigger; read by /admin. Never written by clients.';

CREATE INDEX IF NOT EXISTS capture_provenance_events_user_idx
    ON public.capture_provenance_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS capture_provenance_events_kind_idx
    ON public.capture_provenance_events (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS capture_provenance_events_capture_idx
    ON public.capture_provenance_events (capture_id);

ALTER TABLE public.capture_provenance_events ENABLE ROW LEVEL SECURITY;
-- No policies: RLS with zero policies denies every client. The service role
-- bypasses RLS, which is the only reader (/admin) and the trigger is definer.
REVOKE ALL ON public.capture_provenance_events FROM anon, authenticated;
GRANT SELECT ON public.capture_provenance_events TO service_role;

-- ---------------------------------------------------------------------------
-- 2. created_at is the server's clock; captured_at is bounded
-- ---------------------------------------------------------------------------
-- created_at is forced rather than constrained because it has no legitimate
-- client value. captured_at is clamped rather than rejected: it is genuinely
-- client-supplied for offline captures, and the iOS timeline orders on it
-- (SupabaseCapturesListService orders by captured_at, not created_at), so a
-- hard failure would break real syncs over a few seconds of clock skew.
CREATE OR REPLACE FUNCTION public.captures_enforce_provenance_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_account_created timestamptz;
    v_floor           timestamptz;
    v_ceiling         timestamptz;
    v_claimed         timestamptz := NEW.captured_at;
BEGIN
    NEW.created_at := now();
    NEW.updated_at := now();

    SELECT created_at INTO v_account_created
      FROM public.profiles WHERE id = NEW.user_id;

    -- One day of slack below account creation absorbs a capture taken offline
    -- moments before the account finished being created. Five minutes above
    -- now() absorbs ordinary device clock skew.
    v_floor   := COALESCE(v_account_created, now()) - interval '1 day';
    v_ceiling := now() + interval '5 minutes';

    IF NEW.captured_at IS NULL THEN
        NEW.captured_at := now();
    ELSIF NEW.captured_at < v_floor THEN
        NEW.captured_at := v_floor;
        INSERT INTO public.capture_provenance_events (capture_id, user_id, kind, detail)
        VALUES (NEW.id, NEW.user_id, 'captured_at_before_account',
                jsonb_build_object('claimed', v_claimed, 'account_created', v_account_created, 'clamped_to', v_floor));
    ELSIF NEW.captured_at > v_ceiling THEN
        NEW.captured_at := now();
        INSERT INTO public.capture_provenance_events (capture_id, user_id, kind, detail)
        VALUES (NEW.id, NEW.user_id, 'captured_at_in_future',
                jsonb_build_object('claimed', v_claimed, 'clamped_to', now()));
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS captures_enforce_provenance_timestamps_trg ON public.captures;
CREATE TRIGGER captures_enforce_provenance_timestamps_trg
    BEFORE INSERT ON public.captures
    FOR EACH ROW EXECUTE FUNCTION public.captures_enforce_provenance_timestamps();

-- ---------------------------------------------------------------------------
-- 3. The coordinate trust rule, applied on INSERT as well
-- ---------------------------------------------------------------------------
-- Same test as captures_invalidate_untrusted_coordinate_change, which until now
-- only guarded UPDATE. A capture inserted through the trusted persist path
-- arrives with the full bundle and is untouched; a forged direct INSERT cannot
-- set those columns at all (they are not granted to authenticated), so it is
-- recorded as a claim rather than as device evidence.
CREATE OR REPLACE FUNCTION public.captures_validate_inserted_coordinates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_trusted boolean;
BEGIN
    IF NEW.location_lat IS NULL OR NEW.location_lng IS NULL THEN
        RETURN NEW;
    END IF;

    v_trusted :=
        NEW.location_evidence_source IS NOT DISTINCT FROM 'device_gps'
        AND NEW.location_accuracy_m IS NOT NULL
        AND NEW.location_accuracy_m > 0
        AND NEW.location_accuracy_m <= 150
        AND NEW.location_fix_at IS NOT NULL;

    IF NOT v_trusted THEN
        NEW.location_accuracy_m := NULL;
        NEW.location_fix_at := NULL;
        NEW.location_evidence_source := 'user_confirmed';
    END IF;

    -- A coordinate that survives rounding to four decimals is a place name
    -- someone looked up, not a fix. 13.7563, 100.5018 is Bangkok on Wikipedia.
    IF NEW.location_lat = round(NEW.location_lat::numeric, 4)::double precision
       AND NEW.location_lng = round(NEW.location_lng::numeric, 4)::double precision
    THEN
        INSERT INTO public.capture_provenance_events (capture_id, user_id, kind, detail)
        VALUES (NEW.id, NEW.user_id, 'low_precision_coordinate',
                jsonb_build_object('lat', NEW.location_lat, 'lng', NEW.location_lng, 'claimed_trusted', v_trusted));
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS captures_validate_inserted_coordinates_trg ON public.captures;
CREATE TRIGGER captures_validate_inserted_coordinates_trg
    BEFORE INSERT ON public.captures
    FOR EACH ROW EXECUTE FUNCTION public.captures_validate_inserted_coordinates();

-- ---------------------------------------------------------------------------
-- 4. The same file, submitted repeatedly
-- ---------------------------------------------------------------------------
-- content_sha256 exists on capture_images and is NULL on every row, so it
-- cannot be used yet — populating it needs a worker that reads Storage.
-- Dimensions plus exact byte size is the signal actually available today, and
-- it is what identified this account: twelve captures at exactly 546,059 bytes.
-- Recorded, never blocked: two photos of the same subject seconds apart can
-- legitimately share a size, and a false positive must not cost a real capture.
CREATE OR REPLACE FUNCTION public.capture_images_flag_repeat_media()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id uuid;
    v_matches integer;
BEGIN
    IF NEW.byte_size IS NULL OR NEW.width_px IS NULL OR NEW.height_px IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT user_id INTO v_user_id FROM public.captures WHERE id = NEW.capture_id;
    IF v_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT count(*) INTO v_matches
      FROM public.capture_images ci
      JOIN public.captures c ON c.id = ci.capture_id
     WHERE c.user_id = v_user_id
       AND ci.capture_id <> NEW.capture_id
       AND ci.byte_size = NEW.byte_size
       AND ci.width_px  = NEW.width_px
       AND ci.height_px = NEW.height_px;

    IF v_matches >= 2 THEN
        INSERT INTO public.capture_provenance_events (capture_id, user_id, kind, detail)
        VALUES (NEW.capture_id, v_user_id, 'repeat_media',
                jsonb_build_object('byte_size', NEW.byte_size, 'width_px', NEW.width_px,
                                   'height_px', NEW.height_px, 'prior_matches', v_matches));
    END IF;

    RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS capture_images_flag_repeat_media_trg ON public.capture_images;
CREATE TRIGGER capture_images_flag_repeat_media_trg
    AFTER INSERT ON public.capture_images
    FOR EACH ROW EXECUTE FUNCTION public.capture_images_flag_repeat_media();

-- ---------------------------------------------------------------------------
-- 5. anon has no business writing to any of this
-- ---------------------------------------------------------------------------
-- These are Supabase's default blanket grants. RLS blocks them today because
-- every write policy tests auth.uid(), which is NULL for anon — so this changes
-- no behaviour. It removes the case where one future policy written without an
-- auth.uid() test silently opens unauthenticated writes.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.capture_images   FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.analysis_results FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.profiles         FROM anon;
REVOKE DELETE, TRUNCATE                  ON public.captures        FROM anon;

ROLLBACK;
