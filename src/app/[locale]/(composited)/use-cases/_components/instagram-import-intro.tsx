import {CameraIcon, InstagramIcon} from "@/app/[locale]/_components/icons";
import UseCaseProductCta from "@/app/[locale]/(composited)/use-cases/_components/use-case-product-cta";
import {INSTAGRAM_WEB_IMPORT_LIVE, archiveIntentHero, instagramWebImportCtaLabel} from "@/lib/instagram-import";

const FLOW_STEPS = [
    {
        label: "Connect Instagram",
        detail: "Link a compatible professional account"
    },
    {
        label: "AnimalDex finds wildlife",
        detail: "Posts are scanned for animal encounters"
    },
    {
        label: "You review each one",
        detail: "Confirm identity, location, and details"
    },
    {
        label: "They join your Dex",
        detail: "Eligible captures become collection entries"
    }
] as const;

export default function InstagramImportIntro({
    productHref,
    intent
}: {
    productHref: string;
    intent?: string | null;
}) {
    const ctaLabel = instagramWebImportCtaLabel();
    const hero = archiveIntentHero(intent);

    return (
        <section className="relative mx-auto mb-8 mt-10 max-w-5xl overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-[#060f0a] shadow-[0_24px_80px_-40px_rgba(0,0,0,0.85)] md:mt-14">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,rgba(167,244,50,0.14),transparent_36%),radial-gradient(circle_at_88%_82%,rgba(34,197,94,0.08),transparent_34%)]"
            />
            <div className="relative grid lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
                <div className="flex flex-col justify-center px-6 py-8 md:px-10 md:py-10">
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary-400/20 bg-primary-400/[0.07] px-3 py-1.5">
                        <InstagramIcon size={16} className="text-primary-200" />
                        <span className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-primary-200">
                            Wildlife archive import
                        </span>
                    </div>

                    <h2 className="mt-5 max-w-xl font-display text-3xl font-bold leading-[1.02] text-white md:text-[2.35rem]">
                        {hero.title}
                    </h2>

                    <p className="mt-4 max-w-xl text-base leading-7 text-ink-200 md:text-lg">
                        {hero.body}
                    </p>

                    <div className="mt-7 flex flex-col items-start gap-3">
                        <UseCaseProductCta
                            href={productHref}
                            label={ctaLabel}
                            event="instagram_import_cta"
                            extraEvents={["casual_archive_to_import"]}
                            source="import_use_case"
                        />
                        <p className="max-w-md text-sm leading-6 text-ink-400">
                            No need to manually search years of posts. First screening allowance included.
                        </p>
                        {INSTAGRAM_WEB_IMPORT_LIVE ? (
                            <p className="max-w-md text-sm leading-6 text-ink-400">
                                No app download required to get started. Sign in on the web to start reviewing. Download the app when you are ready to capture new animals in the field.
                            </p>
                        ) : null}
                    </div>
                    <p className="mt-5 max-w-md text-xs leading-5 text-ink-500">
                        Not every post is detected. Not every animal can be identified to species. Location is not inferred automatically. Instagram personal accounts are not guaranteed to connect.
                    </p>
                </div>

                <div className="border-t border-white/[0.08] bg-black/20 px-6 py-8 md:px-8 md:py-10 lg:border-l lg:border-t-0">
                    <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-ink-400">
                        How it works
                    </p>

                    <ol className="mt-5 flex flex-col gap-0">
                        {FLOW_STEPS.map((step, index) => (
                            <li key={step.label} className="relative flex gap-4 pb-6 last:pb-0">
                                {index < FLOW_STEPS.length - 1 ? (
                                    <span
                                        aria-hidden="true"
                                        className="absolute left-[1.15rem] top-10 h-[calc(100%-1.5rem)] w-px bg-gradient-to-b from-primary-400/35 to-transparent"
                                    />
                                ) : null}

                                <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary-400/25 bg-primary-400/10 text-xs font-black tabular-nums text-primary-100">
                                    {index === 0 ? (
                                        <InstagramIcon size={16} className="text-primary-200" />
                                    ) : index === FLOW_STEPS.length - 1 ? (
                                        <CameraIcon size={16} className="text-primary-200" />
                                    ) : (
                                        String(index + 1).padStart(2, "0")
                                    )}
                                </span>

                                <div className="min-w-0 pt-0.5">
                                    <p className="font-display text-lg font-bold text-white">{step.label}</p>
                                    <p className="mt-1 text-sm leading-6 text-ink-300">{step.detail}</p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </section>
    );
}
