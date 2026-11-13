-- One-off, NOT a migration and NOT applied (16 Nov 2026). Run by hand once,
-- as the postgres role, after reading it.
--
-- growth_marketing_daily.ad_spend has no currency. The rows entered by hand
-- in 2026 hold Indonesian Rupiah (values such as 175000.00), and the admin's
-- fallback path labels them "google_ads, IDR" only while a month has no row in
-- growth_marketing_daily_spend (src/app/api/admin/growth/_lib/plan.ts). This
-- moves each such day into the currency-aware spend table with the currency
-- written down, so the Rupiah can never be read as dollars, then zeroes the
-- legacy column (the admin reads the spend table first; the nightly auto-fill
-- writes ad_spend 0 from now on). Idempotent: a day that already has spend
-- rows is left alone.
--
-- Check first:
--   SELECT date, ad_spend FROM public.growth_marketing_daily WHERE ad_spend > 0 ORDER BY date;
--   SELECT * FROM public.growth_marketing_daily_spend ORDER BY date;
-- If any 2026 day was actually entered in USD, exclude it in the WHERE below.

BEGIN;

INSERT INTO public.growth_marketing_daily_spend (date, platform, os, amount, currency_code, reported_installs)
SELECT d.date, 'google_ads', 'mixed', d.ad_spend, 'IDR', NULL
  FROM public.growth_marketing_daily d
 WHERE d.ad_spend > 0
   AND d.date < DATE '2026-11-16'
   AND NOT EXISTS (
        SELECT 1 FROM public.growth_marketing_daily_spend s WHERE s.date = d.date
   );

UPDATE public.growth_marketing_daily d
   SET ad_spend = 0,
       notes = concat_ws(' · ', NULLIF(d.notes, ''), format('ad_spend %s moved to growth_marketing_daily_spend as IDR on 2026-11-16', d.ad_spend)),
       updated_at = now()
 WHERE d.ad_spend > 0
   AND d.date < DATE '2026-11-16'
   AND EXISTS (
        SELECT 1 FROM public.growth_marketing_daily_spend s
         WHERE s.date = d.date AND s.currency_code = 'IDR' AND s.amount = d.ad_spend
   );

-- Verify before COMMIT:
--   SELECT date, ad_spend, notes FROM public.growth_marketing_daily WHERE notes LIKE '%moved to growth_marketing_daily_spend%' ORDER BY date;
--   SELECT date, platform, os, amount, currency_code FROM public.growth_marketing_daily_spend WHERE currency_code = 'IDR' ORDER BY date;

COMMIT;
