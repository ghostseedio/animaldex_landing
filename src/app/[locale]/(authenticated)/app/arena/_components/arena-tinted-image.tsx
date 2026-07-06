import type {ArenaModuleAccent} from "@/lib/app-module-thumbnails";
import {arenaAccentBlendColor} from "@/lib/arena-tint-utils";

export default function ArenaTintedImage({
    src,
    accent,
    className = "",
    desaturated = true
}: {
    src: string;
    accent: ArenaModuleAccent;
    className?: string;
    desaturated?: boolean;
}) {
    return (
        <div className={`relative overflow-hidden ${className}`}>
            <img
                src={src}
                alt=""
                className={`h-full w-full object-cover ${desaturated ? "saturate-0 contrast-[1.04]" : ""}`}
            />
            {desaturated ? (
                <>
                    <div
                        className="pointer-events-none absolute inset-0 mix-blend-color"
                        style={{backgroundColor: arenaAccentBlendColor(accent)}}
                        aria-hidden="true"
                    />
                    <div className="pointer-events-none absolute inset-0 bg-black/[0.22]" aria-hidden="true" />
                </>
            ) : null}
        </div>
    );
}
