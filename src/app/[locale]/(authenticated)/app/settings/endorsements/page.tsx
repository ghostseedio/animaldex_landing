import {redirect} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {SettingsScreen} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";
import {getAuthenticatedAppContext} from "@/data/authenticated-app";
import {getOwnerEndorsedCaptures} from "@/data/profile-authenticated";
import {formatAnimalDexNumber} from "@/lib/profile-capture-grid";
import {getLocalePath} from "@/lib/site";

export const dynamic = "force-dynamic";

/** iOS `endorsementsSheet`: the captures you endorsed, 48 newest, three to a row. */
export default async function EndorsementsPage({params}: {params: {locale: string}}) {
    const context = await getAuthenticatedAppContext();
    if (!context) redirect(getLocalePath(params.locale, "/account"));
    const captures = await getOwnerEndorsedCaptures(48);

    return (
        <SettingsScreen title="Endorsements">
            {captures.length === 0 ? (
                <p className="px-6 py-14 text-center text-[15px] text-white/60">Captures you endorse in Discovery will appear here.</p>
            ) : (
                <div className="-mx-4 grid grid-cols-3 gap-0.5 md:mx-0">
                    {captures.map((capture) => (
                        <Link
                            key={capture.id}
                            href={`/app/capture/${encodeURIComponent(capture.id)}`}
                            aria-label={`${capture.animalName}. Endorsed ${capture.endorsedStat}`}
                            className="group relative aspect-square overflow-hidden bg-black"
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={capture.imageSrc} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                            {capture.animalDexNumber != null ? (
                                <span className="absolute left-[7px] top-[7px] rounded-full border border-[#A7F432]/[0.28] bg-black/55 px-[7px] py-1 text-[11px] font-extrabold leading-none tabular-nums text-[#A7F432]">
                                    {formatAnimalDexNumber(capture.animalDexNumber)}
                                </span>
                            ) : (
                                <span className="absolute left-[7px] top-[7px] rounded-full bg-black/55 px-1.5 py-1 text-[9px] font-extrabold leading-none text-[#A8B0AA]">NOT INDEXED</span>
                            )}
                        </Link>
                    ))}
                </div>
            )}
        </SettingsScreen>
    );
}
