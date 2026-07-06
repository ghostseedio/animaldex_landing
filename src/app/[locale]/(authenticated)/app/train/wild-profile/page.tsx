import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import {AppPageHeader, AppPrimaryLink} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import TrainBackLink from "@/app/[locale]/(authenticated)/app/train/train-back-link";
import {getTrainWildProfileState} from "@/data/train-modules";
import {formatAppLongDate} from "@/lib/app-dates";
import {appStoreUrl} from "@/lib/store-links";

const HERO_IMAGE = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/lion-identity-thumbnail.webp";

function RoleCard({
    label,
    name,
    speciesSlug,
    confidence
}: {
    label: string;
    name: string;
    speciesSlug: string | null;
    confidence: number | null;
}) {
    return (
        <div className="rounded-[1.2rem] border border-white/10 bg-[#151515] p-4">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-violet-300">{label}</p>
            {speciesSlug ? (
                <Link href={`/animals/${speciesSlug}`} className="mt-2 block font-display text-2xl font-bold text-white hover:text-primary-200">
                    {name}
                </Link>
            ) : (
                <p className="mt-2 font-display text-2xl font-bold text-white">{name}</p>
            )}
            {confidence != null ? <p className="mt-2 text-xs text-white/40">{Math.round(confidence * 100)}% confidence</p> : null}
        </div>
    );
}

export default async function WildProfilePage({params}: {params: {locale: string}}) {
    const profile = await getTrainWildProfileState();
    const showConversion = !profile.hasProfile || profile.hasInProgressInterview;

    return (
        <div className="space-y-8">
            <div>
                <TrainBackLink />
                <div className="mt-5">
                    <AppPageHeader
                        eyebrow="Identity"
                        title="Wild Profile"
                        description="Origin, Apex, and Active animal roles from your AnimalDex interview."
                    />
                </div>
            </div>

            <section className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#151515]">
                <div className="relative aspect-[16/10]">
                    <Image src={HERO_IMAGE} alt="" fill unoptimized className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                        <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-violet-300">Wild profile</p>
                        <h2 className="mt-1 font-display text-3xl font-bold text-white">
                            {profile.hasInProgressInterview
                                ? "Continue your interview"
                                : profile.hasProfile
                                    ? profile.headline
                                    : "Discover your animals"}
                        </h2>
                    </div>
                </div>
            </section>

            {showConversion ? (
                <section className="space-y-5 rounded-[1.5rem] border border-white/10 bg-[#151515] p-6">
                    <div className="grid gap-3 sm:grid-cols-3">
                        {["Origin", "Apex", "Active"].map((role) => (
                            <div key={role} className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center">
                                <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-white/35">{role}</p>
                                <p className="mt-3 text-sm text-white/45">?</p>
                            </div>
                        ))}
                    </div>
                    <p className="text-sm leading-6 text-white/50">
                        {profile.hasInProgressInterview
                            ? "Your Wild Profile interview is in progress. Continue in the AnimalDex app to reveal your Origin, Apex, and Active animals."
                            : "Take the animal interview in AnimalDex to unlock your Origin, Apex, and Active animals. It takes about five minutes."}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <a href={appStoreUrl} className="inline-flex rounded-2xl bg-primary-400 px-5 py-3 text-sm font-black text-black">
                            {profile.hasInProgressInterview ? "Continue in app" : "Start interview in app"}
                        </a>
                        <AppPrimaryLink href="/answers/what-animal-am-i">Learn about Wild Profile</AppPrimaryLink>
                    </div>
                </section>
            ) : (
                <section className="space-y-5">
                    {profile.summary ? <p className="text-sm leading-7 text-white/55">{profile.summary}</p> : null}
                    <div className="grid gap-3 md:grid-cols-3">
                        {profile.origin ? <RoleCard {...profile.origin} /> : null}
                        {profile.apex ? <RoleCard {...profile.apex} /> : null}
                        {profile.active ? <RoleCard {...profile.active} /> : null}
                    </div>
                    {profile.generatedAt ? (
                        <p className="text-xs text-white/35">
                            Generated {formatAppLongDate(profile.generatedAt, params.locale)}
                        </p>
                    ) : null}
                </section>
            )}
        </div>
    );
}
