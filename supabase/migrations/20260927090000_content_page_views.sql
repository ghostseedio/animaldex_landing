-- View counts for editable content (blog posts and pages).
--
-- Public blog/page routes are ISR, so a server render happens on regeneration
-- rather than per visit and cannot be the counter. The count is recorded from
-- the browser instead, which also means crawlers — which do not run the
-- beacon — are excluded for free.
--
-- One row per (content_type, slug), incremented in place. Deliberately not a
-- per-visit event log: the admin surface only ever shows a total, and a log
-- would grow without bound for a number nobody queries historically.

CREATE TABLE IF NOT EXISTS public.content_page_views (
    content_type TEXT NOT NULL,
    slug TEXT NOT NULL,
    view_count BIGINT NOT NULL DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT content_page_views_pkey PRIMARY KEY (content_type, slug),
    CONSTRAINT content_page_views_type_known CHECK (content_type IN ('blog', 'page')),
    CONSTRAINT content_page_views_count_not_negative CHECK (view_count >= 0)
);

COMMENT ON TABLE public.content_page_views IS
    'Total views per editable content item, incremented by record_content_page_view.';

-- Ordering the admin list by popularity should not table-scan.
CREATE INDEX IF NOT EXISTS content_page_views_type_count_idx
    ON public.content_page_views (content_type, view_count DESC);

/**
 * Records one view and returns the new total.
 *
 * SECURITY DEFINER so the table itself stays closed: nothing but this function
 * writes to it, which keeps a caller from setting an arbitrary count. The slug
 * shape is asserted here as well as in the API route, because this is the only
 * check that holds no matter who calls it.
 */
CREATE OR REPLACE FUNCTION public.record_content_page_view(
    p_content_type TEXT,
    p_slug TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count BIGINT;
BEGIN
    IF p_content_type IS NULL OR p_content_type NOT IN ('blog', 'page') THEN
        RETURN NULL;
    END IF;

    IF p_slug IS NULL OR p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' THEN
        RETURN NULL;
    END IF;

    INSERT INTO public.content_page_views AS v (content_type, slug, view_count, last_viewed_at)
    VALUES (p_content_type, p_slug, 1, now())
    ON CONFLICT (content_type, slug)
    DO UPDATE SET
        view_count = v.view_count + 1,
        last_viewed_at = now()
    RETURNING v.view_count INTO v_count;

    RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.record_content_page_view(TEXT, TEXT) IS
    'Increments the view total for one content item and returns it.';

ALTER TABLE public.content_page_views ENABLE ROW LEVEL SECURITY;

-- No policies: reads and writes go through the service role and the definer
-- function above, never straight from a browser session.

REVOKE ALL ON FUNCTION public.record_content_page_view(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_content_page_view(TEXT, TEXT) TO service_role;
