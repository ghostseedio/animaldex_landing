"use client";

/**
 * Returns the reader to the top of the page.
 *
 * The previous control was an anchor to `#top`. Nothing on the page carries that
 * id, and the router treats the click as a navigation rather than a fragment
 * jump, so it moved the page a few pixels and stopped — measured scrolling from
 * 2472 to 2563 instead of to 0. Scrolling here explicitly also lets the motion be
 * dropped for readers who have asked for that.
 */
export default function FooterBackToTop({label}: {label: string}) {
    return (
        <button
            type="button"
            onClick={() => {
                const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
                window.scrollTo({top: 0, behavior: prefersReducedMotion ? "auto" : "smooth"});
            }}
            className="group inline-flex min-h-11 items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-300 transition-colors hover:text-primary-200 focus-visible:text-primary-200"
        >
            {label}
            <span
                aria-hidden="true"
                className="inline-flex h-6 w-6 items-center justify-center border border-line-300 transition-colors group-hover:border-primary-400 group-focus-visible:border-primary-400"
            >
                ↑
            </span>
        </button>
    );
}
