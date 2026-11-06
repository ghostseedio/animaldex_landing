import {redirect} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {SettingsScreen} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getOwnerEndorsedCaptures, getOwnerRatedCaptures, getOwnerSentGiftCaptures} from "@/data/profile-authenticated";
import type {PublicProfileCapture} from "@/data/public-profiles";
import {formatAnimalDexNumber} from "@/lib/profile-capture-grid";
import {getLocalePath} from "@/lib/site";

export const dynamic = "force-dynamic";

/** iOS `AnimalDexBandHeader`: an uppercase micro band over a flush grid. */
function BandHeader({title}: {title: string}) {
    return <h2 className="-mx-4 border-b border-white/[0.08] px-4 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[0.12em] text-white/40 md:mx-0">{title}</h2>;
}

function CaptureGrid({items, label, badge}: {
    items: PublicProfileCapture[];
    label: (item: PublicProfileCapture) => string;
    badge?: (item: PublicProfileCapture) => string | null;
}) {
    return (
        <div className="-mx-4 grid grid-cols-3 gap-0.5 md:mx-0">
            {items.map((capture) => {
                const corner = badge?.(capture) ?? null;
                return (
                    <Link
                        key={capture.id}
                        href={`/app/capture/${encodeURIComponent(capture.id)}`}
                        aria-label={label(capture)}
                        className="group relative aspect-square overflow-hidden bg-black"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={capture.imageSrc} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                        {corner ? (
                            <span className="absolute left-[7px] top-[7px] rounded-full bg-black/55 px-[7px] py-1 text-[11px] font-extrabold leading-none tabular-nums text-[#FFD60A]">{corner}</span>
                        ) : capture.animalDexNumber != null ? (
                            <span className="absolute left-[7px] top-[7px] rounded-full border border-[#A7F432]/[0.28] bg-black/55 px-[7px] py-1 text-[11px] font-extrabold leading-none tabular-nums text-[#A7F432]">
                                {formatAnimalDexNumber(capture.animalDexNumber)}
                            </span>
                        ) : null}
                    </Link>
                );
            })}
        </div>
    );
}

/**
 * iOS `GiftsSentView` (the drawer's "Gifts"): the captures you sent a Gift
 * to, then the ones you rated, then earlier endorsements, which stopped
 * growing once Gifts replaced the Endorse button.
 */
export default async function GiftsPage({params}: {params: {locale: string}}) {
    const context = await getAuthenticatedAppContext();
    if (!context) redirect(getLocalePath(params.locale, "/account"));
    const [gifts, rated, endorsed] = await Promise.all([
        getOwnerSentGiftCaptures(48),
        getOwnerRatedCaptures(48),
        getOwnerEndorsedCaptures(48)
    ]);

    return (
        <SettingsScreen title="Gifts">
            {gifts.length ? (
                <CaptureGrid items={gifts} label={(capture) => `${capture.animalName}. Sent a Gift`} />
            ) : (
                <p className="px-6 py-14 text-center text-[15px] text-white/60">Gifts you send and ratings you leave will appear here.</p>
            )}
            {rated.length ? (
                <section>
                    <BandHeader title="Ratings" />
                    <CaptureGrid
                        items={rated}
                        label={(capture) => `${capture.animalName}. Rated ${(capture as typeof rated[number]).stars} stars`}
                        badge={(capture) => `${(capture as typeof rated[number]).stars} ★`}
                    />
                </section>
            ) : null}
            {endorsed.length ? (
                <section>
                    <BandHeader title="Endorsements" />
                    <CaptureGrid items={endorsed} label={(capture) => `${capture.animalName}. Endorsed ${(capture as typeof endorsed[number]).endorsedStat}`} />
                </section>
            ) : null}
        </SettingsScreen>
    );
}
