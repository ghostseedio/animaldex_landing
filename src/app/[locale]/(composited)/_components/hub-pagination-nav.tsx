import Link from "@/app/[locale]/_components/link";
import {getPaginationItems, type HubPagination} from "@/data/hub-pagination";

type HubPaginationNavProps = {
    pagination: HubPagination;
    page: number;
    totalPages: number;
    locale: string;
    label: string;
};

export default function HubPaginationNav({pagination, page, totalPages, locale, label}: HubPaginationNavProps) {
    if (totalPages <= 1) return null;

    const href = (target: number) => `${pagination.pagePath(target)}#${pagination.anchor}`;
    const stepClass = "inline-flex min-h-[2.625rem] items-center border border-line-300 px-4 text-sm font-semibold text-ink-200 transition-colors hover:border-primary-300 hover:text-white";

    return (
        <nav aria-label={label} className="mt-10 flex flex-col items-center gap-4">
            <p className="font-mono text-[11px] tabular-nums text-ink-400">
                Page {page.toLocaleString(locale)} of {totalPages.toLocaleString(locale)}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
                {page > 1 ? <Link href={href(page - 1)} rel="prev" className={stepClass}>Previous</Link> : null}
                {getPaginationItems(page, totalPages).map((item, index) => item === "gap" ? (
                    <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-ink-400">…</span>
                ) : item === page ? (
                    <span
                        key={item}
                        aria-current="page"
                        className="flex min-h-[2.625rem] min-w-[2.625rem] items-center justify-center border border-primary-300 px-3 font-mono text-sm font-bold tabular-nums text-primary-200"
                    >
                        {item}
                    </span>
                ) : (
                    <Link
                        key={item}
                        href={href(item)}
                        aria-label={`Go to page ${item}`}
                        className="flex min-h-[2.625rem] min-w-[2.625rem] items-center justify-center px-3 font-mono text-sm tabular-nums text-ink-300 transition-colors hover:text-white"
                    >
                        {item}
                    </Link>
                ))}
                {page < totalPages ? <Link href={href(page + 1)} rel="next" className={stepClass}>Next</Link> : null}
            </div>
        </nav>
    );
}
