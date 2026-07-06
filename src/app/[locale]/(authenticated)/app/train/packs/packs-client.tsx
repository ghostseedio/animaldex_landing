"use client";

import {useEffect, useMemo, useState, useTransition} from "react";
import {useRouter} from "next/navigation";
import type {TrainAnimalPack, TrainPackCapture} from "@/data/train-modules";

type PackReveal = {
    pack: TrainAnimalPack;
    captures: TrainPackCapture[];
};

const STORAGE_BASE = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals";
const SLIDESHOW_IMAGES = [
    "create-a-pack-2.webp",
    "apex-pack.webp",
    "wild-pack.webp",
    "jungle-pack.webp",
    "coastal-pack.webp",
    "safari-pack.webp",
    "night-pack.webp",
    "aquatic-pack.webp",
    "rare-pack.webp",
    "farm-pack.webp",
    "feline-pack.webp",
    "mixed-pack.webp",
    "sealed-pack.webp"
];

function fileNameForTitle(title: string) {
    const normalized = title
        .trim()
        .toLowerCase()
        .replace(/\+/g, " plus ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

    return `${normalized || "sealed-pack"}.webp`;
}

function packArtworkUrls(pack: TrainAnimalPack) {
    const names = [
        pack.specialtyTheme ? fileNameForTitle(`${pack.specialtyTheme} Pack`) : null,
        pack.baseTheme ? fileNameForTitle(`${pack.baseTheme} Pack`) : null,
        "sealed-pack.webp"
    ].filter(Boolean) as string[];

    return Array.from(new Set(names)).map((name) => `${STORAGE_BASE}/${name}`);
}

function sellerHandle(pack: TrainAnimalPack) {
    const username = pack.sellerUsername?.trim();
    if (!username) return "@collector";
    return username.startsWith("@") ? username : `@${username}`;
}

function packStatusTitle(pack: TrainAnimalPack) {
    if (pack.openedAt || pack.status === "opened") return "Opened";
    if (pack.status === "sold") return "Sold";
    if (pack.status === "listed") return "Listed";
    if (pack.status === "cancelled") return "Cancelled";
    return pack.status;
}

function summaryBadges(pack: TrainAnimalPack) {
    return [
        `${pack.packSize || 10} animals`,
        `Tier ${pack.guaranteedMinimumTier ?? "B"}+ guaranteed`,
        `${pack.qualityBand ?? "Mixed"} power`,
        `${pack.rarityBand ?? "Mixed"} rarity`
    ];
}

function sellerPackFooter(pack: TrainAnimalPack) {
    if (pack.status === "listed") return `Waiting for a buyer. Listed at ${pack.listedPrice ?? 0} credits.`;
    if (pack.status === "opened" || pack.status === "sold") {
        return `Sale value ${pack.sellerProceeds ?? 0} after a ${pack.platformFee ?? 0} credit platform burn.`;
    }
    return "Listing closed.";
}

function purchasedPackFooter(pack: TrainAnimalPack) {
    if (pack.status === "sold" && !pack.openedAt) {
        return `Purchased from ${sellerHandle(pack)}. Open the pack to reveal the animals and transfer them into your collection.`;
    }

    if (pack.openedAt) {
        return `Opened ${new Intl.DateTimeFormat("en", {month: "short", day: "numeric"}).format(new Date(pack.openedAt))} from ${sellerHandle(pack)}.`;
    }

    return `Purchased from ${sellerHandle(pack)}.`;
}

function tierRank(tier: string) {
    return ({E: 0, D: 1, C: 2, B: 3, A: 4, S: 5} as Record<string, number>)[tier] ?? 0;
}

function responseError(body: unknown, fallback: string) {
    return body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : fallback;
}

export default function PacksClient({
    initialPacks,
    initialEligibleCaptures
}: {
    initialPacks: TrainAnimalPack[];
    initialEligibleCaptures: TrainPackCapture[];
}) {
    const router = useRouter();
    const [packs, setPacks] = useState(initialPacks);
    const [eligibleCaptures, setEligibleCaptures] = useState(initialEligibleCaptures);
    const [showBuilder, setShowBuilder] = useState(false);
    const [reveal, setReveal] = useState<PackReveal | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [workingPackId, setWorkingPackId] = useState<string | null>(null);
    const [, startTransition] = useTransition();

    const purchased = packs.filter((pack) => pack.isBuyer && pack.status !== "cancelled");
    const unopened = purchased.filter((pack) => pack.status === "sold" && !pack.openedAt);
    const opened = purchased.filter((pack) => pack.status === "opened" || Boolean(pack.openedAt));
    const listings = packs.filter((pack) => pack.isSeller && pack.status !== "cancelled");
    const activeListings = listings.filter((pack) => pack.status === "listed");

    function upsertPack(pack: TrainAnimalPack | null | undefined) {
        if (!pack) return;
        setPacks((current) => {
            const without = current.filter((item) => item.id !== pack.id);
            return [pack, ...without].sort((left, right) => (right.createdAt ?? "").localeCompare(left.createdAt ?? ""));
        });
        startTransition(() => router.refresh());
    }

    async function createPack(captureIds: string[], listedPrice: number) {
        const response = await fetch("/api/app/packs", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({captureIds, listedPrice})
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(responseError(body, "Could not create pack."));
        upsertPack(body.pack as TrainAnimalPack);
        setEligibleCaptures((current) => current.filter((capture) => !captureIds.includes(capture.captureId)));
    }

    async function cancelPack(pack: TrainAnimalPack) {
        setWorkingPackId(pack.id);
        try {
            const response = await fetch("/api/app/packs", {
                method: "PATCH",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "cancel", packId: pack.id})
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(responseError(body, "Could not cancel pack."));
            upsertPack(body.pack as TrainAnimalPack);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not cancel pack.");
        } finally {
            setWorkingPackId(null);
        }
    }

    async function openPack(pack: TrainAnimalPack) {
        setWorkingPackId(pack.id);
        setReveal({pack, captures: []});
        try {
            const response = await fetch("/api/app/packs", {
                method: "PATCH",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "open", packId: pack.id})
            });
            const body = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(responseError(body, "Could not open pack."));
            const openedPack = body.pack as TrainAnimalPack;
            const captures = Array.isArray(body.captures) ? body.captures as TrainPackCapture[] : [];
            upsertPack(openedPack);
            setReveal({pack: openedPack, captures});
        } catch (caught) {
            setReveal(null);
            setError(caught instanceof Error ? caught.message : "Could not open pack.");
        } finally {
            setWorkingPackId(null);
        }
    }

    return (
        <div className="space-y-8">
            <section className="grid grid-cols-3 gap-3">
                <Metric label="Unopened" value={unopened.length} accent="green" />
                <Metric label="Listings" value={activeListings.length} accent="orange" />
                <Metric
                    label="Eligible captures"
                    value={eligibleCaptures.length}
                    accent="violet"
                    detail={eligibleCaptures.length >= 10 ? "Ready to build" : "Need 10 for a pack"}
                />
            </section>

            <section className="space-y-4">
                <SectionHeader
                    icon="📦"
                    title="Your Packs"
                    action={eligibleCaptures.length >= 10 ? (
                        <button type="button" onClick={() => setShowBuilder(true)} className="text-xs font-black uppercase tracking-[0.14em] text-primary-200">
                            Build pack
                        </button>
                    ) : null}
                />

                {unopened.length > 0 ? (
                    <>
                        <ShelfLabel>Unopened</ShelfLabel>
                        <PackStrip>
                            {unopened.map((pack) => (
                                <PackCard
                                    key={pack.id}
                                    pack={pack}
                                    accent="green"
                                    primaryActionTitle={workingPackId === pack.id ? "Opening..." : "Tap to Open"}
                                    primaryAction={() => openPack(pack)}
                                    footerText={purchasedPackFooter(pack)}
                                />
                            ))}
                        </PackStrip>
                    </>
                ) : null}

                <BuildPackCallout eligibleCount={eligibleCaptures.length} onBuild={() => setShowBuilder(true)} />

                {opened.length > 0 ? (
                    <>
                        <ShelfLabel>Opened</ShelfLabel>
                        <PackStrip>
                            {opened.map((pack) => (
                                <PackCard
                                    key={pack.id}
                                    pack={pack}
                                    accent="white"
                                    primaryActionTitle="View Collection"
                                    primaryAction={() => router.push("/app/collection")}
                                    footerText={purchasedPackFooter(pack)}
                                />
                            ))}
                        </PackStrip>
                    </>
                ) : null}

                {purchased.length === 0 ? (
                    <EmptyState
                        title="No packs yet"
                        detail="Buy from the marketplace or build your own sealed pack. New acquisitions land here instantly."
                    />
                ) : null}
            </section>

            {listings.length > 0 ? (
                <section className="space-y-4">
                    <SectionHeader icon="📦" title="Your listings" />
                    <PackStrip>
                        {listings.map((pack) => (
                            <PackCard
                                key={pack.id}
                                pack={pack}
                                accent="orange"
                                primaryActionTitle={pack.status === "listed" ? workingPackId === pack.id ? "Cancelling..." : "Cancel Listing" : undefined}
                                primaryAction={pack.status === "listed" ? () => cancelPack(pack) : undefined}
                                footerText={sellerPackFooter(pack)}
                            />
                        ))}
                    </PackStrip>
                </section>
            ) : null}

            {showBuilder ? (
                <PackBuilderSheet
                    captures={eligibleCaptures}
                    onClose={() => setShowBuilder(false)}
                    onCreate={async (captureIds, listedPrice) => {
                        await createPack(captureIds, listedPrice);
                        setShowBuilder(false);
                    }}
                />
            ) : null}

            {reveal ? <PackOpeningOverlay reveal={reveal} onClose={() => setReveal(null)} onCollection={() => router.push("/app/collection")} /> : null}

            {error ? <ErrorDialog message={error} onClose={() => setError(null)} /> : null}
        </div>
    );
}

function Metric({label, value, detail, accent}: {label: string; value: number | string; detail?: string; accent: "green" | "orange" | "violet"}) {
    const colors = {
        green: "from-primary-400/80 to-primary-400/20",
        orange: "from-orange-400/80 to-orange-400/20",
        violet: "from-violet-400/80 to-violet-400/20"
    };

    return (
        <div className="rounded-[1.25rem] border border-white/[0.08] bg-white/[0.03] p-4">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.15em] text-white/35">{label}</p>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums text-white">{value}</p>
            {detail ? <p className="mt-1 text-xs leading-5 text-white/35">{detail}</p> : null}
            <div className={`mt-3 h-0.5 w-10 rounded-full bg-gradient-to-r ${colors[accent]}`} />
        </div>
    );
}

function SectionHeader({icon, title, action}: {icon: string; title: string; action?: React.ReactNode}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-400/10 ring-1 ring-orange-400/10">{icon}</span>
                <h2 className="font-display text-xl font-bold text-white md:text-2xl">{title}</h2>
            </div>
            {action}
        </div>
    );
}

function ShelfLabel({children}: {children: React.ReactNode}) {
    return <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-white/35">{children}</p>;
}

function PackStrip({children}: {children: React.ReactNode}) {
    return (
        <div className="-mx-4 overflow-x-auto px-4 pb-1">
            <div className="flex gap-4">{children}</div>
        </div>
    );
}

function PackCard({
    pack,
    accent,
    primaryActionTitle,
    primaryAction,
    footerText
}: {
    pack: TrainAnimalPack;
    accent: "green" | "orange" | "white";
    primaryActionTitle?: string;
    primaryAction?: () => void;
    footerText?: string;
}) {
    const accentClasses = {
        green: {
            text: "text-primary-200",
            pill: "bg-primary-400 text-black",
            soft: "bg-primary-400/10 text-primary-100",
            border: "border-primary-400/35"
        },
        orange: {
            text: "text-orange-200",
            pill: "bg-orange-300 text-black",
            soft: "bg-orange-400/10 text-orange-100",
            border: "border-orange-300/35"
        },
        white: {
            text: "text-white/80",
            pill: "bg-white/85 text-black",
            soft: "bg-white/10 text-white/75",
            border: "border-white/15"
        }
    }[accent];
    const artwork = packArtworkUrls(pack);

    return (
        <article className={`w-[min(20rem,calc(100vw-3.5rem))] shrink-0 rounded-[1.4rem] border bg-[#121212] p-3 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.95)] ${accentClasses.border}`}>
            <div className="relative h-46 overflow-hidden rounded-[1.15rem] border border-white/[0.08] bg-gradient-to-br from-orange-400/20 via-[#151515] to-black">
                <img src={artwork[0]} alt="" className="h-full w-full object-contain p-3" onError={(event) => {
                    const image = event.currentTarget;
                    const currentIndex = artwork.indexOf(image.src);
                    const next = artwork[currentIndex + 1] ?? artwork[artwork.length - 1];
                    if (next && image.src !== next) image.src = next;
                }} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <h3 className="font-display text-xl font-bold leading-tight text-white">{pack.themeTitle}</h3>
                    <p className="mt-1 text-xs font-bold text-white/70">Sealed • {pack.packSize || 10} animals</p>
                </div>
            </div>

            <div className="mt-3 flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-1.5 text-xs font-black ${accentClasses.soft}`}>⚡ {pack.listedPrice ?? 0}</span>
                <span className="inline-flex min-w-0 items-center rounded-full bg-white/[0.05] px-2.5 py-1.5 text-xs font-bold text-white/50">
                    <span className="truncate">{sellerHandle(pack)}</span>
                </span>
                <span className={`ml-auto rounded-full px-2.5 py-1 text-[0.62rem] font-black uppercase tracking-[0.1em] ${accentClasses.pill}`}>
                    {packStatusTitle(pack)}
                </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                {summaryBadges(pack).map((badge) => (
                    <span key={badge} className={`rounded-full px-2.5 py-1.5 text-[0.68rem] font-bold ${accentClasses.soft}`}>
                        {badge}
                    </span>
                ))}
            </div>

            {footerText ? <p className="mt-3 line-clamp-3 text-xs leading-5 text-white/45">{footerText}</p> : null}

            {primaryActionTitle && primaryAction ? (
                <button type="button" onClick={primaryAction} className="mt-4 w-full rounded-full bg-primary-400 px-4 py-3 text-sm font-black text-black">
                    {primaryActionTitle}
                </button>
            ) : null}
        </article>
    );
}

function BuildPackCallout({eligibleCount, onBuild}: {eligibleCount: number; onBuild: () => void}) {
    const ready = eligibleCount >= 10;
    const progress = Math.min(100, eligibleCount / 10 * 100);
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const timer = window.setInterval(() => setIndex((current) => (current + 1) % SLIDESHOW_IMAGES.length), 400);
        return () => window.clearInterval(timer);
    }, []);

    return (
        <article className="overflow-hidden rounded-[1.4rem] border border-white/[0.08] bg-[#121212]">
            <div className="relative h-48 overflow-hidden bg-gradient-to-br from-[#181818] via-orange-400/10 to-violet-500/10">
                <img src={`${STORAGE_BASE}/${SLIDESHOW_IMAGES[index]}`} alt="" className="h-full w-full object-contain p-10" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4">
                    <div className="flex items-end justify-between gap-4">
                        <div>
                            <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-orange-200">Build</p>
                            <h3 className="font-display text-2xl font-bold text-white">Create a Pack</h3>
                        </div>
                        <span className={`rounded-full px-3 py-1.5 text-xs font-black ${ready ? "bg-primary-400 text-black" : "bg-black/50 text-white"}`}>
                            {ready ? "Ready" : `${eligibleCount}/10`}
                        </span>
                    </div>
                </div>
            </div>
            <div className="space-y-3 bg-[#171717] p-4">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                    <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-primary-400" style={{width: `${Math.max(5, progress)}%`}} />
                </div>
                <p className="text-sm leading-6 text-white/55">
                    {ready ? "List a sealed mystery pack from 10 eligible captures." : `Need ${Math.max(0, 10 - eligibleCount)} more public, battle-ready captures to list.`}
                </p>
                {ready ? (
                    <button type="button" onClick={onBuild} className="w-full rounded-full bg-primary-400 px-4 py-3 text-sm font-black text-black">
                        Build New Pack
                    </button>
                ) : null}
            </div>
        </article>
    );
}

function PackBuilderSheet({
    captures,
    onClose,
    onCreate
}: {
    captures: TrainPackCapture[];
    onClose: () => void;
    onCreate: (captureIds: string[], listedPrice: number) => Promise<void>;
}) {
    const [selected, setSelected] = useState<string[]>([]);
    const [listedPrice, setListedPrice] = useState(25);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const selectedCaptures = useMemo(
        () => captures.filter((capture) => selected.includes(capture.captureId)),
        [captures, selected]
    );

    function toggle(captureId: string) {
        setSelected((current) => {
            if (current.includes(captureId)) return current.filter((id) => id !== captureId);
            if (current.length >= 10) return current;
            return [...current, captureId];
        });
    }

    async function submit() {
        if (selected.length !== 10) {
            setError("Select exactly 10 captures.");
            return;
        }
        setIsSubmitting(true);
        setError(null);
        try {
            await onCreate(selected, listedPrice);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not create pack.");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md">
            <div className="mx-auto flex h-full max-w-2xl flex-col bg-[#090909]">
                <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <button type="button" onClick={onClose} className="text-sm font-bold text-primary-200">Close</button>
                    <div className="text-center">
                        <h2 className="font-display text-lg font-bold text-white">Build Pack</h2>
                        <p className="text-[0.68rem] font-bold text-white/45">{selected.length} of 10 selected</p>
                    </div>
                    <span className="w-12" />
                </header>

                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4 pb-32">
                    <section className="rounded-[1.35rem] border border-white/10 bg-gradient-to-br from-[#171717] via-orange-400/10 to-violet-500/10 p-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-[0.65rem] font-black uppercase tracking-[0.16em] text-orange-200">Sealed listing</p>
                                <h3 className="mt-1 font-display text-2xl font-bold text-white">Mystery Pack</h3>
                            </div>
                            <div className="text-right">
                                <p className="font-display text-3xl font-bold text-primary-200">{listedPrice}</p>
                                <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-white/40">credits</p>
                            </div>
                        </div>

                        <div className="mt-4 space-y-2">
                            <div className="grid grid-cols-10 gap-1">
                                {Array.from({length: 10}, (_, index) => (
                                    <span key={index} className={`h-1.5 rounded-full ${index < selected.length ? "bg-primary-400" : "bg-white/10"}`} />
                                ))}
                            </div>
                            <p className="text-xs font-bold text-white/35">{selected.length} of 10 captures chosen</p>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            {["Tier B+", "Hidden contents", "10 animals"].map((label) => (
                                <span key={label} className="rounded-full bg-white/[0.06] px-3 py-1.5 text-[0.68rem] font-bold text-white/60">{label}</span>
                            ))}
                        </div>

                        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.04] p-3">
                            <button type="button" onClick={() => setListedPrice((value) => Math.max(5, value - 5))} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-lg font-black text-white">−</button>
                            <span className="text-sm font-bold text-white/55">Listing price</span>
                            <span className="ml-auto text-sm font-black text-white">{listedPrice} credits</span>
                            <button type="button" onClick={() => setListedPrice((value) => Math.min(5000, value + 5))} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-lg font-black text-white">+</button>
                        </div>
                    </section>

                    <div>
                        <p className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-white/45">Select 10 captures</p>
                        <p className="mt-1 text-sm leading-6 text-white/35">Selections stay hidden. The server assigns the theme and verifies the Tier B+ guarantee.</p>
                    </div>

                    <div className="space-y-3">
                        {captures.map((capture) => (
                            <BuilderCaptureRow
                                key={capture.captureId}
                                capture={capture}
                                selected={selected.includes(capture.captureId)}
                                onToggle={() => toggle(capture.captureId)}
                            />
                        ))}
                    </div>

                    {selectedCaptures.length > 0 ? (
                        <p className="text-xs leading-5 text-white/30">
                            Selected: {selectedCaptures.map((capture) => capture.animalName).join(", ")}
                        </p>
                    ) : null}
                </div>

                <div className="border-t border-white/10 bg-black/70 p-5 backdrop-blur">
                    <p className="mb-3 text-center text-[0.68rem] font-bold leading-5 text-white/35">
                        Buyers see theme, guarantees, price, and quality bands — never the exact animals.
                    </p>
                    {error ? <p className="mb-3 rounded-xl border border-red-400/25 bg-red-500/10 p-3 text-sm text-red-200">{error}</p> : null}
                    <button
                        type="button"
                        onClick={submit}
                        disabled={selected.length !== 10 || isSubmitting}
                        className="w-full rounded-full bg-primary-400 px-4 py-3.5 text-sm font-black text-black disabled:opacity-50"
                    >
                        {isSubmitting ? "Listing..." : `List Pack · ${listedPrice} credits`}
                    </button>
                </div>
            </div>
        </div>
    );
}

function BuilderCaptureRow({capture, selected, onToggle}: {capture: TrainPackCapture; selected: boolean; onToggle: () => void}) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className={`flex w-full items-center gap-3 rounded-[1.1rem] border p-3 text-left transition ${selected ? "border-primary-400/70 bg-primary-400/[0.08]" : "border-white/[0.08] bg-[#151515]"}`}
        >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${selected ? "bg-primary-400 text-black" : "bg-white/[0.06] text-white/35"}`}>
                {selected ? "✓" : "○"}
            </span>
            <img src={capture.imageSrc} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-white/10" />
            <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-bold text-white">{capture.animalName}</h3>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[0.62rem] font-black uppercase tracking-[0.06em]">
                    <span className="rounded-full bg-white/[0.06] px-2 py-1 text-white/55">Lvl 1</span>
                    <span className="rounded-full bg-orange-400/15 px-2 py-1 text-orange-200">Tier {capture.battleTier}</span>
                    {capture.contextLabel ? <span className="rounded-full bg-white/[0.06] px-2 py-1 text-white/55">{capture.contextLabel}</span> : null}
                </div>
                <div className="mt-1 flex gap-2 text-[0.68rem] font-semibold text-white/35">
                    <span className="text-primary-200">Value {capture.tradeValue}</span>
                    <span>Rarity {capture.rarity}%</span>
                    <span>Power {capture.battlePower}</span>
                </div>
            </div>
        </button>
    );
}

function PackOpeningOverlay({reveal, onClose, onCollection}: {reveal: PackReveal; onClose: () => void; onCollection: () => void}) {
    const ordered = useMemo(() => [...reveal.captures].sort((left, right) => {
        const tierDelta = tierRank(left.battleTier) - tierRank(right.battleTier);
        if (tierDelta !== 0) return tierDelta;
        const rarityDelta = left.rarity - right.rarity;
        if (rarityDelta !== 0) return rarityDelta;
        return left.tradeValue - right.tradeValue;
    }), [reveal.captures]);
    const [visibleCount, setVisibleCount] = useState(0);
    const completed = ordered.length > 0 && visibleCount >= ordered.length;
    const focused = ordered[Math.max(0, visibleCount - 1)];

    useEffect(() => {
        setVisibleCount(0);
        if (ordered.length === 0) return;

        const start = window.setTimeout(() => {
            let next = 0;
            const interval = window.setInterval(() => {
                next += 1;
                setVisibleCount(next);
                if (next >= ordered.length) window.clearInterval(interval);
            }, 280);
        }, 900);

        return () => window.clearTimeout(start);
    }, [ordered]);

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[#070707]">
            <div className="mx-auto max-w-2xl space-y-6 px-5 py-8">
                <div className="text-center">
                    <h2 className="font-display text-3xl font-bold text-white">{completed ? "Pack Opened" : "Opening Pack"}</h2>
                    <p className="mt-2 text-xl font-bold text-primary-200">{reveal.pack.themeTitle}</p>
                    <p className="mt-2 text-sm leading-6 text-white/50">
                        {ordered.length === 0 ? "Opening pack… fetching the sealed contents." : completed ? "All 10 animals are now in your collection." : "Revealing each animal from lowest tier to highest."}
                    </p>
                </div>

                {ordered.length === 0 ? (
                    <PackCard pack={reveal.pack} accent="green" footerText="Opening pack…" />
                ) : focused ? (
                    <RevealHero capture={focused} final={completed && focused.captureId === ordered[ordered.length - 1]?.captureId} />
                ) : null}

                {ordered.length > 0 ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-10 gap-1">
                            {ordered.map((capture, index) => (
                                <span key={capture.captureId} className={`h-1.5 rounded-full ${index < visibleCount ? "bg-primary-400" : "bg-white/10"}`} />
                            ))}
                        </div>
                        {!completed ? <p className="text-center text-sm font-bold text-white/45">Revealed {visibleCount} of {ordered.length}</p> : null}
                    </div>
                ) : null}

                {completed ? (
                    <>
                        <section className="rounded-[1.4rem] border border-white/10 bg-[#121212] p-4">
                            <h3 className="font-display text-xl font-bold text-white">All Reveals</h3>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                {ordered.map((capture, index) => (
                                    <MiniRevealCard key={capture.captureId} capture={capture} final={index === ordered.length - 1} />
                                ))}
                            </div>
                        </section>
                        <div className="space-y-3">
                            <button type="button" onClick={onCollection} className="w-full rounded-full bg-primary-400 px-4 py-3 text-sm font-black text-black">View Collection</button>
                            <button type="button" onClick={onClose} className="w-full rounded-full border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black text-white">Done</button>
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}

function RevealHero({capture, final}: {capture: TrainPackCapture; final: boolean}) {
    return (
        <article className={`rounded-[1.5rem] border bg-[#121212] p-4 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.95)] ${final ? "border-orange-300/70" : "border-white/10"}`}>
            <img src={capture.imageSrc} alt={capture.animalName} className="aspect-[4/3] w-full rounded-[1.2rem] object-cover" />
            <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                    <h3 className="font-display text-2xl font-bold text-white">{capture.animalName}</h3>
                    {capture.scientificName ? <p className="mt-1 truncate text-sm italic text-white/45">{capture.scientificName}</p> : null}
                </div>
                {final ? <span className="rounded-full bg-orange-300 px-3 py-1.5 text-[0.68rem] font-black uppercase tracking-[0.12em] text-black">Final</span> : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
                <Chip>Lvl 1</Chip>
                <Chip>Tier {capture.battleTier}</Chip>
                <Chip>Power {capture.battlePower}</Chip>
                {capture.speciesSlug ? <Chip>#{capture.speciesSlug.slice(0, 6).toUpperCase()}</Chip> : null}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
                <RevealMetric title="Value" value={capture.tradeValue} />
                <RevealMetric title="Rarity" value={`${capture.rarity}%`} />
                <RevealMetric title="Setting" value={capture.contextLabel ?? "Unknown"} />
            </div>
        </article>
    );
}

function MiniRevealCard({capture, final}: {capture: TrainPackCapture; final: boolean}) {
    return (
        <article className={`rounded-[1rem] border bg-white/[0.04] p-3 ${final ? "border-orange-300/50" : "border-white/[0.08]"}`}>
            <img src={capture.imageSrc} alt="" className="aspect-square w-full rounded-xl object-cover" />
            <h4 className="mt-2 line-clamp-2 text-sm font-bold text-white">{capture.animalName}</h4>
            <div className="mt-2 flex flex-wrap gap-1">
                <Chip small>Tier {capture.battleTier}</Chip>
                <Chip small>{capture.rarity}%</Chip>
            </div>
        </article>
    );
}

function Chip({children, small = false}: {children: React.ReactNode; small?: boolean}) {
    return <span className={`rounded-full bg-white/[0.06] font-black text-white/60 ${small ? "px-2 py-1 text-[0.62rem]" : "px-3 py-1.5 text-xs"}`}>{children}</span>;
}

function RevealMetric({title, value}: {title: string; value: React.ReactNode}) {
    return (
        <div className="rounded-2xl bg-white/[0.04] px-3 py-2">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.12em] text-white/30">{title}</p>
            <p className="mt-1 truncate text-sm font-bold text-white">{value}</p>
        </div>
    );
}

function EmptyState({title, detail}: {title: string; detail: string}) {
    return (
        <div className="rounded-[1.25rem] border border-white/10 bg-[#121212] p-5">
            <h3 className="font-display text-xl font-bold text-white">📦 {title}</h3>
            <p className="mt-2 text-sm leading-6 text-white/45">{detail}</p>
        </div>
    );
}

function ErrorDialog({message, onClose}: {message: string; onClose: () => void}) {
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-5 backdrop-blur">
            <div className="w-full max-w-sm rounded-[1.25rem] border border-white/10 bg-[#121212] p-5">
                <h2 className="font-display text-xl font-bold text-white">Pack Error</h2>
                <p className="mt-3 text-sm leading-6 text-white/60">{message}</p>
                <button type="button" onClick={onClose} className="mt-5 w-full rounded-full bg-primary-400 px-4 py-3 text-sm font-black text-black">OK</button>
            </div>
        </div>
    );
}
