BEGIN;

-- Drops the monthly cap columns only; the table (and the apps' daily
-- threshold) stays. The web falls back to AI_SPEND_MONTHLY_CAP_USD / $100.
ALTER TABLE public.ai_spend_alert_config
    DROP COLUMN IF EXISTS monthly_cap_usd,
    DROP COLUMN IF EXISTS monthly_warn_ratio;

COMMIT;
