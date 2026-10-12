"use client";

import {type CSSProperties, type ReactNode, useMemo} from "react";
import {parseAnimalPowerIcon} from "@/lib/animal-power-icon";
import {useAnimalPowerIcon} from "@/components/animal-detail/animal-powers/use-animal-power-icon";

/**
 * A Power's line icon, drawn in the surrounding text colour. It LEADS the
 * Power name: inline, about the cap height of that text, with a small gap after
 * it, so it sits in a heading, a truncated row or a flex line alike.
 *
 * Pass `svg` when the page already has it (static pages fetch it on the
 * server); otherwise `speciesProfileId` reads it through the batching hook.
 * Never a fused Power's id — fused Powers have no icon of their own.
 *
 * No icon (none authored, still loading, or unparseable) draws `fallback`,
 * which is nothing by default — no box, no gap.
 */
export default function AnimalPowerIcon({
    svg,
    speciesProfileId,
    size = "1.15em",
    gap = "0.3em",
    className,
    style,
    fallback = null
}: {
    svg?: string | null;
    speciesProfileId?: string | null;
    /** Width and height: an em size tracks the text it leads. */
    size?: number | string;
    /** Space after the icon. Pass 0 inside a flex row that already has a gap. */
    gap?: number | string;
    className?: string;
    style?: CSSProperties;
    fallback?: ReactNode;
}) {
    // The hook only reads when the page did not hand the svg down.
    const fetched = useAnimalPowerIcon(svg === undefined ? speciesProfileId : null);
    const source = svg === undefined ? fetched : svg;
    const shapes = useMemo(() => parseAnimalPowerIcon(source), [source]);

    if (!shapes) return <>{fallback}</>;

    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            className={className ? `inline-block shrink-0 align-[-0.2em] ${className}` : "inline-block shrink-0 align-[-0.2em]"}
            style={{width: size, height: size, marginRight: gap, ...style}}
        >
            {shapes.map((shape, index) => shape.kind === "path" ? (
                <path key={index} d={shape.d} fill={shape.fill} stroke={shape.stroke} />
            ) : (
                <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} fill={shape.fill} stroke={shape.stroke} />
            ))}
        </svg>
    );
}
