import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import ArenaTintedImage from "@/app/[locale]/(authenticated)/app/arena/_components/arena-tinted-image";
import {arenaAccentTextClass, type ArenaModuleAccent} from "@/lib/app-module-thumbnails";

export default function ArenaModuleCard({
    href,
    title,
    subtitle,
    statusLabel,
    thumbnailUrl,
    accent
}: {
    href: string;
    title: string;
    subtitle: string;
    statusLabel: string | null;
    thumbnailUrl: string;
    accent: ArenaModuleAccent;
}) {
    const detailLine = statusLabel ?? subtitle;
    const detailClass = statusLabel ? arenaAccentTextClass(accent) : "text-white/35";

    return (
        <Link
            href={href}
            className="block w-[132px] shrink-0 overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#141414] transition active:scale-[0.98]"
        >
            <ArenaTintedImage src={thumbnailUrl} accent={accent} className="h-[104px] w-full" desaturated />
            <div className="flex h-[78px] w-[132px] flex-col justify-start px-2.5 py-2.5">
                <div className="flex items-center gap-1.5">
                    <p className="min-w-0 flex-1 truncate text-[13px] font-bold text-white">{title}</p>
                    <AppIcon name="chevron" className="h-2.5 w-2.5 shrink-0 text-white/35" />
                </div>
                <p className={`mt-1.5 line-clamp-2 min-h-8 text-[0.62rem] leading-snug ${detailClass}`}>
                    {detailLine}
                </p>
            </div>
        </Link>
    );
}
