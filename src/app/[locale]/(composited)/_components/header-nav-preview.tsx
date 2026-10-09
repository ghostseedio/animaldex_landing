import type {ReactNode} from "react";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import type {NavPreviewId} from "@/data/public-navigation";

/*
 * The scenes in a desktop dropdown's preview pane. Each one is drawn from
 * transparent species cutouts and line icons rather than a photo, so nothing is
 * ever cropped by the pane, and each says what the page is (two animals facing
 * off for Compare, a zebra plus a rhino for Hybrids) rather than just showing
 * an animal. Scenes carry no words, so they need no translation.
 */

/** A species cutout, shown whole. Lazy, so a closed panel fetches nothing. */
function Cutout({slug, className = ""}: {slug: string; className?: string}) {
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={getSpeciesArtworkRoute(slug, 256)}
            alt=""
            loading="lazy"
            decoding="async"
            className={`object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.55)] ${className}`}
        />
    );
}

function Tile({slug}: {slug: string}) {
    return (
        <div className="grid aspect-square place-items-center rounded-[2px] border border-line-200 bg-white/[0.035] p-1.5">
            <Cutout slug={slug} className="h-full w-full" />
        </div>
    );
}

function Badge({children, className = ""}: {children: ReactNode; className?: string}) {
    return (
        <span className={`grid place-items-center rounded-[2px] font-display font-black leading-none ${className}`}>
            {children}
        </span>
    );
}

function Icon({children, className = "h-7 w-7"}: {children: ReactNode; className?: string}) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={className}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            {children}
        </svg>
    );
}

/** A large line icon inside two rings, for pages that are not about an animal. */
function IconScene({children}: {children: ReactNode}) {
    return (
        <div className="absolute inset-0 grid place-items-center">
            <div className="grid h-32 w-32 place-items-center rounded-full border border-line-200">
                <div className="grid h-20 w-20 place-items-center rounded-full border border-primary-400/50 bg-primary-400/[0.07] text-primary-400">
                    <Icon className="h-10 w-10">{children}</Icon>
                </div>
            </div>
        </div>
    );
}

function MapLayer({region, className}: {region: string; className: string}) {
    const url = `url(/images/native-range/${region}.svg)`;
    return (
        <div
            className={`absolute inset-0 ${className}`}
            style={{maskImage: url, WebkitMaskImage: url, maskSize: "contain", WebkitMaskSize: "contain", maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat", maskPosition: "center", WebkitMaskPosition: "center"}}
        />
    );
}

const scenes: Record<NavPreviewId, () => ReactNode> = {
    browse: () => (
        <div className="absolute inset-0 grid grid-cols-2 content-center gap-2 p-6">
            {["bengal-tiger", "bald-eagle", "octopus", "red-fox"].map((slug) => <Tile key={slug} slug={slug} />)}
        </div>
    ),
    compare: () => (
        <div className="absolute inset-0 flex items-center justify-center px-3">
            <Cutout slug="lion" className="h-24 w-24 -scale-x-100" />
            <Badge className="z-10 -mx-3 h-9 w-9 shrink-0 bg-primary-400 text-[0.8125rem] text-canvas-950">VS</Badge>
            <Cutout slug="bengal-tiger" className="h-24 w-24" />
        </div>
    ),
    tiers: () => (
        <div className="absolute inset-0 flex flex-col justify-center gap-2 px-5">
            {[
                {tier: "S", tone: "bg-primary-400 text-canvas-950", slugs: ["cheetah", "peregrine-falcon", "great-white-shark"]},
                {tier: "A", tone: "bg-primary-400/60 text-canvas-950", slugs: ["gray-wolf", "lion", "octopus"]},
                {tier: "B", tone: "bg-white/[0.12] text-ink-100", slugs: ["red-fox", "honey-bee", "barn-owl"]}
            ].map((row) => (
                <div key={row.tier} className="flex items-center gap-2">
                    <Badge className={`h-12 w-9 shrink-0 text-lg ${row.tone}`}>{row.tier}</Badge>
                    <div className="grid flex-1 grid-cols-3 gap-1.5">
                        {row.slugs.map((slug) => (
                            <div key={slug} className="grid h-12 place-items-center rounded-[2px] border border-line-200 bg-white/[0.035] p-1">
                                <Cutout slug={slug} className="h-full w-full" />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    ),
    hybrid: () => (
        <div className="absolute inset-0 flex items-center justify-center px-2">
            <Cutout slug="plains-zebra" className="h-24 w-24" />
            <Badge className="z-10 -mx-2 h-8 w-8 shrink-0 bg-primary-400 text-xl text-canvas-950">+</Badge>
            <Cutout slug="white-rhinoceros" className="h-24 w-24" />
        </div>
    ),
    locations: () => (
        <div className="absolute inset-x-3 inset-y-0">
            <MapLayer region="world_base" className="bg-white/[0.16]" />
            {["range_sub_saharan_africa", "range_south_america", "range_southeast_asia"].map((region) => (
                <MapLayer key={region} region={region} className="bg-primary-400/85" />
            ))}
        </div>
    ),
    experiences: () => (
        <div className="absolute inset-0 grid place-items-center">
            <Cutout slug="common-kingfisher" className="h-36 w-36" />
            <span className="absolute bottom-7 left-7 grid h-11 w-11 place-items-center rounded-full border border-primary-400/50 bg-canvas-950 text-primary-400">
                {/* Binoculars: a guided outing, not just an animal. */}
                <Icon className="h-6 w-6"><circle cx="6.5" cy="15.5" r="3.5" /><circle cx="17.5" cy="15.5" r="3.5" /><path d="M10 15.5h4M5 12l2-7h2.5l.5 7M19 12l-2-7h-2.5l-.5 7" /></Icon>
            </span>
        </div>
    ),
    ask: () => (
        <div className="absolute inset-0">
            {/* A question put to an animal: Ask AnimalDex is a conversation. */}
            <div className="absolute right-5 top-7 rounded-[10px] rounded-bl-[2px] border border-primary-400/50 bg-primary-400/[0.08] px-3.5 py-2.5">
                <div className="flex gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-primary-400" />
                    <span className="h-2 w-2 rounded-full bg-primary-400/70" />
                    <span className="h-2 w-2 rounded-full bg-primary-400/40" />
                </div>
            </div>
            <div className="absolute bottom-[4.5rem] right-[4.5rem] rounded-[10px] rounded-br-[2px] bg-white/[0.1] px-3 py-2 text-ink-100">
                <Icon className="h-4 w-4"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" /><path d="M12 17h.01" /></Icon>
            </div>
            <Cutout slug="barn-owl" className="absolute bottom-5 left-4 h-32 w-32" />
        </div>
    ),
    lessons: () => (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6">
            <Cutout slug="octopus" className="h-28 w-28" />
            {/* Three ruled lines: the lesson written up from the behaviour. */}
            <div className="w-full space-y-1.5">
                <div className="h-1.5 w-full rounded-full bg-primary-400/80" />
                <div className="h-1.5 w-4/5 rounded-full bg-white/[0.16]" />
                <div className="h-1.5 w-3/5 rounded-full bg-white/[0.16]" />
            </div>
        </div>
    ),
    powers: () => (
        <div className="absolute inset-0 grid place-items-center">
            <Cutout slug="peacock-mantis-shrimp" className="h-36 w-36" />
            <span className="absolute right-6 top-6 grid h-11 w-11 place-items-center rounded-full bg-primary-400 text-canvas-950">
                <Icon className="h-6 w-6"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></Icon>
            </span>
        </div>
    ),
    behaviours: () => (
        <div className="absolute inset-0">
            {/* A pack moving together: behaviour is what animals do, in company. */}
            <Cutout slug="gray-wolf" className="absolute left-4 top-8 h-20 w-20 opacity-70" />
            <Cutout slug="gray-wolf" className="absolute right-4 top-12 h-20 w-20 -scale-x-100 opacity-70" />
            <Cutout slug="gray-wolf" className="absolute bottom-6 left-1/2 h-32 w-32 -translate-x-1/2" />
        </div>
    ),
    challenge: () => (
        <div className="absolute inset-0 grid place-items-center">
            <div className="grid h-44 w-44 place-items-center rounded-full border border-line-200">
                <div className="grid h-32 w-32 place-items-center rounded-full border border-primary-400/40">
                    <div className="h-20 w-20 rounded-full border-2 border-primary-400/80" />
                </div>
            </div>
            <Cutout slug="peregrine-falcon" className="absolute h-24 w-24" />
            <span className="absolute bottom-7 right-7 grid h-9 w-9 place-items-center rounded-full bg-primary-400 text-canvas-950">
                <Icon className="h-5 w-5"><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>
            </span>
        </div>
    ),
    whatAmI: () => (
        <div className="absolute inset-0 grid place-items-center p-4">
            {/* The page's own hero, already a picture of the quiz result. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src="/images/blog/what-animal-am-i/wild-profile-hero.webp"
                alt=""
                loading="lazy"
                className="w-full rounded-[2px] border border-line-200"
            />
        </div>
    ),
    symbolism: () => (
        <div className="absolute inset-0 grid place-items-center">
            {/* Sun and moon behind the bird: what the animal stands for. */}
            <div className="absolute h-36 w-36 rounded-full border border-primary-400/40 bg-primary-400/[0.06]" />
            <span className="absolute right-6 top-5 text-primary-400">
                <Icon className="h-8 w-8"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></Icon>
            </span>
            <Cutout slug="common-raven" className="relative h-32 w-32" />
        </div>
    ),
    support: () => (
        <IconScene>
            <circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6" /><path d="M12 17h.01" />
        </IconScene>
    ),
    contact: () => (
        <IconScene>
            <rect x="3" y="5" width="18" height="14" rx="1.5" /><path d="m3.5 6 8.5 7 8.5-7" />
        </IconScene>
    ),
    sponsor: () => (
        <IconScene>
            <path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4v3h-4z" />
        </IconScene>
    ),
    brand: () => (
        <div className="absolute inset-0 grid place-items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.webp" alt="" loading="lazy" className="h-24 w-24" />
        </div>
    )
};

export default function HeaderNavPreview({previews, shown}: {previews: NavPreviewId[]; shown?: NavPreviewId}) {
    return (
        <div
            aria-hidden="true"
            className="relative w-[15rem] shrink-0 overflow-hidden border-r border-line-200 bg-[radial-gradient(circle_at_50%_40%,rgb(var(--c-primary-400)/0.09),transparent_70%)]"
        >
            {/* Every scene stays mounted and cross-fades, so moving down the list
                never waits on a fetch for the next one. */}
            {previews.map((id) => (
                <div
                    key={id}
                    className={`absolute inset-0 transition-opacity duration-200 ease-out motion-reduce:transition-none ${
                        id === shown ? "opacity-100" : "opacity-0"
                    }`}
                >
                    {scenes[id]()}
                </div>
            ))}
        </div>
    );
}
