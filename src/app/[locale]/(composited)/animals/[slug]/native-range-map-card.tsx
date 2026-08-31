import type {CSSProperties, ReactNode} from "react";
import Link from "@/app/[locale]/_components/link";
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
    variant?: "default" | "animal-card";
    layout?: "compact" | "wide";
    settingTag?: string | null;
    humanContext?: string | null;
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

function AnimalCardHeader() {
    return (
        <div className="flex items-center gap-2">
            <svg
                aria-hidden="true"
                className="h-[17px] w-[17px] shrink-0 text-[#A7F432]"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2Zm6.91 6h-3.03a15.7 15.7 0 0 0-1.36-3.19A8.04 8.04 0 0 1 18.91 8ZM12 4c.83 1.2 1.45 2.54 1.82 4h-3.64A12.54 12.54 0 0 1 12 4ZM4.26 14a7.82 7.82 0 0 1 0-4h3.4a16.7 16.7 0 0 0 0 4h-3.4Zm.83 2h3.03c.3 1.12.76 2.2 1.36 3.19A8.04 8.04 0 0 1 5.09 16Zm3.03-8H5.09a8.04 8.04 0 0 1 4.39-3.19A15.7 15.7 0 0 0 8.12 8ZM12 20a12.54 12.54 0 0 1-1.82-4h3.64A12.54 12.54 0 0 1 12 20Zm2.19-6H9.81a14.58 14.58 0 0 1 0-4h4.38a14.58 14.58 0 0 1 0 4Zm.33 5.19A15.7 15.7 0 0 0 15.88 16h3.03a8.04 8.04 0 0 1-4.39 3.19ZM16.34 14a16.7 16.7 0 0 0 0-4h3.4a7.82 7.82 0 0 1 0 4h-3.4Z" />
            </svg>
            <div className="min-w-0">
                <h3 className="text-[12px] font-medium leading-[15px] text-white">Native range</h3>
                <p className="text-[11px] font-semibold leading-[14px] text-white/[0.42]">
                    Natural range, not this capture location
                </p>
            </div>
        </div>
    );
}

function AnimalCardShell({children, wide = false}: {children: ReactNode; wide?: boolean}) {
    return (
        <div className={`flex w-full flex-col gap-[10px] border-b border-white/10 bg-[linear-gradient(135deg,rgba(167,244,50,0.08),rgba(255,255,255,0.03))] px-5 py-[18px] ${
            wide ? "lg:gap-3 lg:rounded-[22px] lg:border lg:px-6 lg:py-6" : ""
        }`}>
            {children}
        </div>
    );
}

function SearchNearbyButton() {
    return (
        <Link
            href="/locations"
            className="mt-1 flex w-full items-center gap-2 rounded-full bg-[#A7F432] px-3.5 py-3 text-[13px] font-extrabold text-black/[0.86]"
        >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-[13px] w-[13px]" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="10" cy="10" r="5.5" />
                <path d="m14.2 14.2 4.3 4.3M10 6.8v6.4M6.8 10h6.4" strokeLinecap="round" />
            </svg>
            <span>Search near me</span>
            <svg aria-hidden="true" viewBox="0 0 24 24" className="ml-auto h-[11px] w-[11px] opacity-70" fill="none" stroke="currentColor" strokeWidth="2.4">
                <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </Link>
    );
}

function WildCaptureHint() {
    return (
        <div className="rounded-[14px] border border-white/[0.08] bg-white/[0.03] p-3">
            <p className="text-[11px] font-semibold text-white/[0.42]">Wild reward hint</p>
            <p className="mt-1.5 text-[15px] font-medium leading-5 text-[#A7F432]/90">First-time wild species earn bonus rewards, including 1 free credit.</p>
        </div>
    );
}

function AnimalCardVectorMap({regions, wide = false}: {regions: ReturnType<typeof getAvailableNativeRangeRegions>; wide?: boolean}) {
    return (
        <div className={`relative h-[168px] w-full overflow-hidden rounded-[18px] border border-white/[0.07] bg-[linear-gradient(135deg,rgba(255,255,255,0.03),rgba(0,0,0,0.14))] p-3 ${
            wide ? "lg:h-[230px]" : ""
        }`}>
            <div className="absolute inset-3">
                <MaskLayer assetPath={NATIVE_RANGE_WORLD_BASE_ASSET} color="rgba(255,255,255,0.12)" />
                {regions.map((region) => {
                    const overlayAssetPath = getNativeRangeOverlayAssetPath(region);

                    if (!overlayAssetPath) {
                        return null;
                    }

                    const accent = getNativeRangeAccent(region);

                    return (
                        <div
                            key={region}
                            className="absolute inset-0 mix-blend-screen"
                            style={{filter: `drop-shadow(0 6px 12px ${accent})`}}
                        >
                            <MaskLayer assetPath={overlayAssetPath} color={accent} />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default function NativeRangeMapCard({entry, labels, variant = "default", layout = "compact", settingTag, humanContext}: NativeRangeMapCardProps) {
    const presentation = resolveNativeRangePresentation(entry);
    const wide = layout === "wide";
    const shouldShowWildCaptureHint = settingTag?.trim().toLowerCase() === "zoo"
        || humanContext?.trim().toLowerCase() === "captive";

    if (presentation.kind === "hidden") {
        if (variant !== "animal-card") return null;
        return (
            <AnimalCardShell wide={wide}>
                <div className="flex items-center gap-2">
                    <svg aria-hidden="true" className="h-[17px] w-[17px] shrink-0 text-white/[0.62]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M3.5 12h17M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21C9.5 18.4 8.2 15.4 8.2 12S9.5 5.6 12 3Z" />
                    </svg>
                    <div>
                        <h3 className="text-xs font-medium text-white">Native range</h3>
                        <p className="text-[11px] font-semibold text-white/[0.42]">Location unknown</p>
                    </div>
                </div>
                <p className="text-[15px] font-medium leading-5 text-white/[0.62]">AnimalDex does not have a mapped native range region for this profile yet.</p>
            </AnimalCardShell>
        );
    }

    if (variant === "animal-card") {
        if (presentation.kind === "textOnly") {
            return (
                <AnimalCardShell wide={wide}>
                    <AnimalCardHeader />
                    <span className="w-fit rounded-full bg-[#A7F432]/[0.12] px-[10px] py-[6px] text-[11px] font-semibold leading-[14px] text-[#A7F432]">
                        {presentation.title}
                    </span>
                    {presentation.body ? (
                        <p className="text-[15px] font-medium leading-[20px] text-white/[0.62]">{presentation.body}</p>
                    ) : null}
                    {shouldShowWildCaptureHint ? <WildCaptureHint /> : null}
                    <SearchNearbyButton />
                </AnimalCardShell>
            );
        }

        const {descriptor} = presentation;
        const renderedRegions = getAvailableNativeRangeRegions(descriptor.regions);
        const hasVectorMap = renderedRegions.length > 0;

        return (
            <AnimalCardShell wide={wide}>
                <AnimalCardHeader />

                <span className="w-fit rounded-full bg-white/[0.04] px-[10px] py-[6px] text-[11px] font-semibold leading-[14px] text-white/[0.62]">
                    {getNativeRangeTierLabel(descriptor)}
                </span>

                {hasVectorMap ? <AnimalCardVectorMap regions={renderedRegions} wide={wide} /> : null}

                {hasVectorMap ? (
                    <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-2">
                        {descriptor.regions.map((region) => {
                            const isRendered = renderedRegions.includes(region);

                            return (
                                <div
                                    key={region}
                                    className="flex min-w-0 items-center gap-2 rounded-full bg-white/[0.03] px-[10px] py-[7px]"
                                >
                                    <span
                                        aria-hidden="true"
                                        className="h-2 w-2 shrink-0 rounded-full"
                                        style={{
                                            backgroundColor: getNativeRangeAccent(region),
                                            opacity: isRendered ? 1 : 0.35
                                        }}
                                    />
                                    <span
                                        className="truncate text-[11px] font-semibold leading-[14px] text-white/[0.62]"
                                        style={{opacity: isRendered ? 1 : 0.65}}
                                    >
                                        {getNativeRangeRegionLabel(region)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <span className="w-fit rounded-full bg-[#A7F432]/[0.12] px-[10px] py-[6px] text-[11px] font-semibold leading-[14px] text-[#A7F432]">
                        {getNativeRangeDisplayLabel(descriptor)}
                    </span>
                )}

                {descriptor.habitatText ? (
                    <p className="text-[15px] font-medium leading-[20px] text-white/[0.62]">{descriptor.habitatText}</p>
                ) : null}
                {shouldShowWildCaptureHint ? <WildCaptureHint /> : null}
                <SearchNearbyButton />
            </AnimalCardShell>
        );
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
