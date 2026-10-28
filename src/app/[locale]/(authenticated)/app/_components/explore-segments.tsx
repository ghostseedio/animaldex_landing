import Link from "@/app/[locale]/_components/link";

export type ExploreSegment = "feed" | "battles" | "collectors";

const SEGMENTS: Array<{id: ExploreSegment; label: string; href: string}> = [
    {id: "feed", label: "Feed", href: "/app/explore"},
    {id: "battles", label: "Battles", href: "/app/arena"},
    {id: "collectors", label: "Collectors", href: "/app/explore?view=collectors"}
];

/**
 * Explore's segments (docs/companion-loop/SPEC.md, phase 4): Feed · Battles ·
 * Collectors. Feed and Collectors are the feed page; Battles is the hub that
 * was the Play tab, at its own URL, so this is a row of links.
 */
export default function ExploreSegments({active}: {active: ExploreSegment}) {
    return (
        <nav aria-label="Explore" className="flex border border-white/10 bg-white/[0.04] p-[3px]">
            {SEGMENTS.map((item) => {
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
