import Link from "@/app/[locale]/_components/link";

type RankingBreadcrumbsProps = {
    items: Array<{
        href?: string;
        label: string;
    }>;
};

export default function RankingBreadcrumbs({items}: RankingBreadcrumbsProps) {
    return (
        <nav aria-label="Breadcrumb" className="text-sm text-ink-300">
            <ol className="flex flex-wrap items-center gap-2">
                {items.map((item, index) => (
                    <li key={`${item.label}-${index}`} className="flex items-center gap-2">
                        {index > 0 && <span aria-hidden="true" className="text-line-300">/</span>}
                        {item.href ? (
                            <Link href={item.href} className="transition-colors hover:text-primary-100 focus-visible:text-primary-100">
                                {item.label}
                            </Link>
                        ) : (
                            <span className="text-white" aria-current={index === items.length - 1 ? "page" : undefined}>{item.label}</span>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}
