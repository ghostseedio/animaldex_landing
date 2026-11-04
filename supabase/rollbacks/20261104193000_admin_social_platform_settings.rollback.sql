-- Rollback of 20261104193000_admin_social_platform_settings: drops the
-- auto-share switches. The landing server then reads "table missing" and keeps
-- to the code defaults (X, Facebook, Pinterest and Instagram carousels paused),
-- so nothing the admin had paused starts posting except what the defaults
-- leave on; any platform the admin had turned back on is paused again.

DROP TABLE IF EXISTS public.admin_social_platform_settings;
