BEGIN;

-- Monthly AI spend cap (16 Nov 2026): $100 a month across every provider and
-- surface, with an admin notice at 80%. Extends the apps' ai_spend_alert_config
-- (AnimalDex migration 20261029161300_ai_spend_visibility, a daily threshold
-- feeding a reliability incident) with the monthly figures the web admin reads
-- (src/lib/ai-spend-cap.ts: /admin and /admin/ai-spend).
--
-- Shared project, two repos (see the landing memory on migration history):
-- the table is created here only if the apps' migration has not run yet, with
-- the same shape, so either order applies cleanly. NOT applied by this change
-- set; until it is, the web reads AI_SPEND_MONTHLY_CAP_USD (default 100).

CREATE TABLE IF NOT EXISTS public.ai_spend_alert_config (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    daily_threshold_usd numeric(10, 2) NOT NULL DEFAULT 15 CHECK (daily_threshold_usd > 0),
    enabled boolean NOT NULL DEFAULT true,
    updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_spend_alert_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_spend_alert_config FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ai_spend_alert_config TO service_role;

ALTER TABLE public.ai_spend_alert_config
    ADD COLUMN IF NOT EXISTS monthly_cap_usd numeric(10, 2) NOT NULL DEFAULT 100 CHECK (monthly_cap_usd > 0),
    ADD COLUMN IF NOT EXISTS monthly_warn_ratio numeric(4, 3) NOT NULL DEFAULT 0.8 CHECK (monthly_warn_ratio > 0 AND monthly_warn_ratio <= 1);

COMMENT ON COLUMN public.ai_spend_alert_config.monthly_cap_usd IS
    'Monthly cap on estimated provider spend (every provider, every surface), USD. The web admin shows a notice from monthly_warn_ratio of it.';
COMMENT ON COLUMN public.ai_spend_alert_config.monthly_warn_ratio IS
    'Share of monthly_cap_usd at which the admin notice shows (0.8 = 80%).';

INSERT INTO public.ai_spend_alert_config (singleton, monthly_cap_usd, monthly_warn_ratio)
VALUES (true, 100, 0.8)
ON CONFLICT (singleton) DO UPDATE SET monthly_cap_usd = EXCLUDED.monthly_cap_usd, monthly_warn_ratio = EXCLUDED.monthly_warn_ratio, updated_at = now();

COMMIT;
