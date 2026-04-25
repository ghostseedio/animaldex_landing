"use client";

import {CSSProperties} from "react";
import {
    DIRECTORY_NATIVE_RANGE_REGION_KEYS,
    getNativeRangeAccent,
    getNativeRangeOverlayAssetPath,
    getNativeRangeRegionLabel,
    NATIVE_RANGE_WORLD_BASE_ASSET,
    NativeRangeRegionKey
} from "@/data/native-range";

type SpeciesRegionMapProps = {
    currentRegion: NativeRangeRegionKey | "all";
    onSelectRegion: (region: NativeRangeRegionKey | "all") => void;
    allLabel: string;
    mapAriaLabel: string;
    mapActiveLabel: string;
};

function MaskLayer({assetPath, color, opacity = 1}: {assetPath: string; color: string; opacity?: number}) {
    const style = {
        backgroundColor: color,
        opacity,
        maskImage: `url(${assetPath})`,
        WebkitMaskImage: `url(${assetPath})`,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain"
    } as CSSProperties;

    return <div aria-hidden="true" className="absolute inset-0 transition-opacity duration-200" style={style} />;
}

export default function SpeciesRegionMap({
    currentRegion,
    onSelectRegion,
    allLabel,
    mapAriaLabel,
    mapActiveLabel
}: SpeciesRegionMapProps) {
    return (
        <div className="flex flex-col gap-4">
            <div
                className="relative h-52 md:h-64 w-full rounded-[1.75rem] border border-line-300 overflow-hidden bg-gradient-to-br from-white/[0.04] to-black/[0.18] p-3 md:p-4"
                aria-label={mapAriaLabel}
            >
                <MaskLayer assetPath={NATIVE_RANGE_WORLD_BASE_ASSET} color="rgba(255,255,255,0.14)" />
                {DIRECTORY_NATIVE_RANGE_REGION_KEYS.map((region) => {
                    const assetPath = getNativeRangeOverlayAssetPath(region);

                    if (!assetPath) {
                        return null;
                    }

                    return (
                        <MaskLayer
                            key={region}
                            assetPath={assetPath}
                            color={getNativeRangeAccent(region)}
                            opacity={currentRegion === region ? 0.92 : 0.14}
                        />
                    );
                })}

                <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-3">
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs uppercase tracking-[0.18em] text-ink-200">
                        {currentRegion === "all" ? allLabel : getNativeRangeRegionLabel(currentRegion)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-ink-300">
                        {mapActiveLabel}
                    </span>
                </div>
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={() => onSelectRegion("all")}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        currentRegion === "all"
                            ? "border-primary-400 bg-primary-500/20 text-white"
                            : "border-line-300 text-ink-300 hover:border-primary-400 hover:text-white"
                    }`}
                >
                    {allLabel}
                </button>
                {DIRECTORY_NATIVE_RANGE_REGION_KEYS.map((region) => (
                    <button
                        key={region}
                        type="button"
                        onClick={() => onSelectRegion(region)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            currentRegion === region
                                ? "border-primary-400 bg-primary-500/20 text-white"
                                : "border-line-300 text-ink-300 hover:border-primary-400 hover:text-white"
                        }`}
                    >
                        {getNativeRangeRegionLabel(region)}
                    </button>
                ))}
            </div>
        </div>
    );
}
