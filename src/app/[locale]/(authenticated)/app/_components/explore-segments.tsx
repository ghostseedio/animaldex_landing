import Link from "@/app/[locale]/_components/link";

export type ExploreSegment = "feed" | "debates" | "collectors";

/**
 * Explore's segments (docs/companion-loop/SPEC.md, phase 4; 3.2 Debates,
 * docs/debates/SPEC.md section 4): Feed · Debates · Collectors. Feed and
 * Collectors are the feed page; Debates replaces Battles, at its own URL, so
 * this is a row of links. While the server has Debates off, it is not there.
 */
export default function ExploreSegments({active, debatesLabel, showsDebates = true}: {
    active: ExploreSegment;
    /** `debates.tab`, in the reader's language. */
    debatesLabel: string;
    showsDebates?: boolean;
}) {
    const segments: Array<{id: ExploreSegment; label: string; href: string}> = [
        {id: "feed", label: "Feed", href: "/app/explore"},
        ...(showsDebates ? [{id: "debates" as const, label: debatesLabel, href: "/app/debates"}] : []),
        {id: "collectors", label: "Collectors", href: "/app/explore?view=collectors"}
    ];
    return (
        <nav aria-label="Explore" className="flex border border-white/10 bg-white/[0.04] p-[3px]">
            {segments.map((item) => {
                const isOn = item.id === active;
                return (
                    <Link
                        key={item.id}
                        href={item.href}
                        aria-current={isOn ? "page" : undefined}
                        className={`min-w-0 flex-1 truncate px-1 py-[9px] text-center text-[13px] font-black transition ${isOn ? "bg-white text-black" : "text-white/60 hover:text-white"}`}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}
