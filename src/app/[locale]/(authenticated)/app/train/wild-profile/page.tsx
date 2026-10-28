import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import {AppPageHeader, AppPrimaryLink} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import TrainBackLink from "@/app/[locale]/(authenticated)/app/train/train-back-link";
import {getTrainWildProfileState} from "@/data/train-modules";
import {formatAppLongDate} from "@/lib/app-dates";
import StoreLink from "@/components/store/store-link";
import {getScopedTranslator} from "@/loaders/translation";

const INTERVIEW_PATH = "/app/train/wild-profile/interview";
const HERO_IMAGE = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/lion-identity-thumbnail.webp";

function RoleCard({
    label,
    name,
    speciesSlug,
    confidence,
    confidenceLabel
}: {
    label: string;
    name: string;
    speciesSlug: string | null;
    confidence: number | null;
    confidenceLabel: (percent: number) => string;
}) {
    return (
        <div className="border border-white/10 bg-[#151515] p-4">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-violet-300">{label}</p>
            {speciesSlug ? (
                <Link href={`/animals/${speciesSlug}`} className="mt-2 block font-display text-2xl font-bold text-white hover:text-primary-200">
                    {name}
                </Link>
            ) : (
                <p className="mt-2 font-display text-2xl font-bold text-white">{name}</p>
            )}
            {confidence != null ? <p className="mt-2 text-xs text-white/40">{confidenceLabel(Math.round(confidence * 100))}</p> : null}
        </div>
    );
}

export default async function WildProfilePage({params}: {params: {locale: string}}) {
    const [profile, t] = await Promise.all([
        getTrainWildProfileState(),
        getScopedTranslator(params.locale, "wildProfile")
    ]);
    const showConversion = !profile.hasProfile || profile.hasInProgressInterview;
    const confidenceLabel = (percent: number) => t("confidence", {percent});
    const roleLabels = {Origin: t("roleOrigin"), Apex: t("roleApex"), Active: t("roleActive")};
    const roleCard = (role: NonNullable<typeof profile.origin>) => (
        <RoleCard
            {...role}
            label={roleLabels[role.label as keyof typeof roleLabels] ?? role.label}
            confidenceLabel={confidenceLabel}
        />
    );

    return (
        <div className="space-y-8">
            <div>
                <TrainBackLink />
                <div className="mt-5">
                    <AppPageHeader
                        eyebrow={t("eyebrow")}
                        title={t("title")}
                        description={t("pageDescription")}
                    />
                </div>
            </div>

            <section className="overflow-hidden border border-white/10 bg-[#151515]">
                <div className="relative aspect-[16/10]">
                    <Image src={HERO_IMAGE} alt="" fill unoptimized className="object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                        <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-violet-300">{t("heroEyebrow")}</p>
                        <h2 className="mt-1 font-display text-3xl font-bold text-white">
                            {profile.hasInProgressInterview
                                ? t("heroContinue")
                                : profile.hasProfile
                                    ? profile.headline
                                    : t("heroDiscover")}
                        </h2>
                    </div>
                </div>
            </section>

            {showConversion ? (
                <section className="space-y-5 border border-white/10 bg-[#151515] p-6">
                    <div className="grid gap-3 sm:grid-cols-3">
                        {[t("roleOrigin"), t("roleApex"), t("roleActive")].map((role) => (
                            <div key={role} className="border border-dashed border-white/10 bg-black/20 px-4 py-8 text-center">
                                <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-white/35">{role}</p>
                                <p className="mt-3 text-sm text-white/45">?</p>
                            </div>
                        ))}
                    </div>
                    <p className="text-sm leading-6 text-white/50">
                        {profile.hasInProgressInterview ? t("inProgressBody") : t("introBody")}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                        <Link href={INTERVIEW_PATH} className="inline-flex bg-primary-400 px-5 py-3 text-sm font-black text-black">
                            {profile.hasInProgressInterview ? t("continueInterview") : t("startInterview")}
                        </Link>
                        <StoreLink store="app_store" placement="wild_profile" className="inline-flex border border-white/15 px-5 py-3 text-sm font-bold text-white/80 hover:border-white/30 hover:text-white">
                            {profile.hasInProgressInterview ? t("continueInApp") : t("useAppInstead")}
                        </StoreLink>
                        <AppPrimaryLink href="/what-animal-am-i">{t("learnMore")}</AppPrimaryLink>
                    </div>
                    <p className="text-xs leading-5 text-white/35">{t("privacyNote")}</p>
                </section>
            ) : (
                <section className="space-y-5">
                    {profile.lifePurpose ? (
                        <div className="border border-white/10 bg-[#151515] p-5">
                            <p className="text-[0.62rem] font-black uppercase tracking-[0.16em] text-violet-300">{t("lifePurposeTitle")}</p>
                            <p className="mt-2 font-display text-2xl font-bold leading-snug text-white">{profile.lifePurpose.statement}</p>
                            {profile.lifePurpose.explanation ? (
                                <p className="mt-3 text-sm leading-7 text-white/55">{profile.lifePurpose.explanation}</p>
                            ) : null}
                        </div>
                    ) : null}
                    {profile.summary ? <p className="text-sm leading-7 text-white/55">{profile.summary}</p> : null}
                    <div className="grid gap-3 md:grid-cols-3">
                        {profile.origin ? roleCard(profile.origin) : null}
                        {profile.apex ? roleCard(profile.apex) : null}
                        {profile.active ? roleCard(profile.active) : null}
                    </div>
                    {profile.canGoDeeper ? (
                        <div className="space-y-3 border border-primary-300/25 bg-[#151515] p-5">
                            <p className="font-display text-xl font-bold text-white">{t("goDeeperTitle")}</p>
                            <p className="text-sm leading-6 text-white/55">{t("goDeeperBody")}</p>
                            <Link href={INTERVIEW_PATH} className="inline-flex bg-primary-400 px-5 py-3 text-sm font-black text-black">
                                {t("goDeeperCta")}
                            </Link>
                            <p className="text-xs leading-5 text-white/35">{t("privacyNote")}</p>
                        </div>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {profile.generatedAt ? (
                            <p className="text-xs text-white/35">
                                {t("generated", {date: formatAppLongDate(profile.generatedAt, params.locale)})}
                            </p>
                        ) : <span />}
                        <Link href={INTERVIEW_PATH} underline className="text-sm font-bold text-primary-200 hover:text-primary-100">
                            {t("retake")}
                        </Link>
                    </div>
                </section>
            )}
        </div>
    );
}
