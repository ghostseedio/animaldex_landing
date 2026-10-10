import Image from "next/image";

/** A player's round avatar, with an initial when they have no photo. */
export default function BattleAvatar({
    name,
    avatarUrl,
    size,
    winner = false,
    className = ""
}: {
    name: string;
    avatarUrl: string | null;
    size: number;
    winner?: boolean;
    className?: string;
}) {
    const ring = winner ? "ring-[3px] ring-primary-400" : "ring-2 ring-white/70";
    return (
        <span
            className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-700 font-display font-bold text-white shadow-lg shadow-black/40 ${ring} ${className}`}
            style={{width: size, height: size, fontSize: Math.round(size * 0.42)}}
        >
            {avatarUrl ? (
                <Image src={avatarUrl} alt="" width={size} height={size} sizes={`${size}px`} className="h-full w-full object-cover" />
            ) : (
                <span aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "?"}</span>
            )}
        </span>
    );
}
