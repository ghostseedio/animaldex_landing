import type {CSSProperties} from "react";
import type {SpeciesEntry} from "@/data/species";
import {
    getAvailableNativeRangeRegions,
    getNativeRangeAccent,
    getNativeRangeDisplayLabel,
    getNativeRangeOverlayAssetPath,
    getNativeRangeRegionLabel,
    getNativeRangeTierLabel,
    NATIVE_RANGE_WORLD_BASE_ASSET,
    resolveNativeRangePresentation
} from "@/data/native-range";

type NativeRangeMapCardLabels = {
    title: string;
    description: string;
    missingAssets: string;
};

type NativeRangeMapCardProps = {
    entry: SpeciesEntry;
    labels: NativeRangeMapCardLabels;
};

function MaskLayer({assetPath, color}: {assetPath: string; color: string}) {
    const style = {
        backgroundColor: color,
        maskImage: `url(${assetPath})`,
        WebkitMaskImage: `url(${assetPath})`,
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
        maskSize: "contain",
        WebkitMaskSize: "contain"
    } as CSSProperties;

    return <div className="absolute inset-0" style={style} />;
}

export default function NativeRangeMapCard({entry, labels}: NativeRangeMapCardProps) {
    const presentation = resolveNativeRangePresentation(entry);

    if (presentation.kind === "hidden") {
        return null;
    }

    if (presentation.kind === "textOnly") {
        return (
            <div className="rounded-3xl border border-line-300 bg-surface-950/60 p-5 md:p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                    <h3 className="text-white font-semibold tracking-[0.08em] uppercase text-sm">{labels.title}</h3>
                    <p className="text-ink-300 text-sm">{labels.description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-primary-500/15 text-primary-100 border border-primary-400/25 px-3 py-1 text-sm">
                        {presentation.title}
                    </span>
                </div>
                {presentation.body ? <p className="text-ink-200 text-base md:text-lg leading-7">{presentation.body}</p> : null}
            </div>
        );
    }

    const {descriptor} = presentation;
    const renderedRegions = getAvailableNativeRangeRegions(descriptor.regions);
    const hasVectorMap = renderedRegions.length > 0;

    return (
        <div className="rounded-3xl border border-line-300 bg-surface-950/60 p-5 md:p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
                <h3 className="text-white font-semibold tracking-[0.08em] uppercase text-sm">{labels.title}</h3>
                <p className="text-ink-300 text-sm">{labels.description}</p>
            </div>

            <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-white/5 text-ink-100 border border-white/10 px-3 py-1 text-sm">
                    {getNativeRangeTierLabel(descriptor)}
                </span>
                {!hasVectorMap ? (
                    <span className="rounded-full bg-primary-500/15 text-primary-100 border border-primary-400/25 px-3 py-1 text-sm">
                        {getNativeRangeDisplayLabel(descriptor)}
                    </span>
                ) : null}
            </div>

            {hasVectorMap ? (
                <div className="relative h-44 md:h-48 rounded-[1.4rem] border border-white/8 overflow-hidden bg-gradient-to-br from-white/[0.04] to-black/[0.14] p-3">
                    <MaskLayer assetPath={NATIVE_RANGE_WORLD_BASE_ASSET} color="rgba(255,255,255,0.12)" />
                    {renderedRegions.map((region) => {
                        const overlayAssetPath = getNativeRangeOverlayAssetPath(region);

                        if (!overlayAssetPath) {
                            return null;
                        }

                        return (
                            <div
                                key={region}
                                className="absolute inset-0 drop-shadow-[0_8px_18px_rgba(0,0,0,0.25)]"
                            >
                                <MaskLayer assetPath={overlayAssetPath} color={getNativeRangeAccent(region)} />
                            </div>
                        );
                    })}
                </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
                {descriptor.regions.map((region) => {
                    const isRendered = renderedRegions.includes(region);

                    return (
                        <span
                            key={region}
                            className="rounded-full border px-3 py-1 text-sm"
                            style={{
                                borderColor: isRendered ? `${getNativeRangeAccent(region)}` : "rgba(255,255,255,0.08)",
                                color: isRendered ? getNativeRangeAccent(region) : "rgba(214,223,238,0.75)",
                                backgroundColor: isRendered ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.02)"
                            }}
                        >
                            {getNativeRangeRegionLabel(region)}
                        </span>
                    );
                })}
            </div>

            {renderedRegions.length < descriptor.regions.length ? (
                <p className="text-ink-300 text-sm">{labels.missingAssets}</p>
            ) : null}

            {descriptor.habitatText ? <p className="text-ink-200 text-base md:text-lg leading-7">{descriptor.habitatText}</p> : null}
        </div>
    );
}
