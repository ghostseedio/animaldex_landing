import Link from "@/app/[locale]/_components/link";
import SpeciesArtworkImage from "@/app/[locale]/(composited)/animals/species-artwork-image";
import SpeciesAskAnimalDex from "@/app/[locale]/(composited)/animals/[slug]/species-ask-animaldex";
import TalkLandingSwitch from "@/app/[locale]/talk/[slug]/talk-landing-switch";
import {AiNotice} from "@/components/ai-gate/ai-notices";
import {AskSubjectBridge} from "@/components/ask-animaldex/ask-animaldex-provider";
import StoreLink from "@/components/store/store-link";
import type {TalkLandingPage} from "@/data/talk-landing-pages";
import {getScopedTranslator} from "@/loaders/translation";
import {breadcrumbJsonLd, jsonLdHtml, webPageJsonLd, type JsonLd} from "@/lib/seo/structured-data";
import {ogImagePath} from "@/lib/og/og-image";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {SPECIES_ASK_DAILY_LIMITS} from "@/lib/species-ask";
import {TALK_LANDING_WORDS} from "@/lib/talk-landing";

/**
 * The indexable /talk/<slug> page (CC 5), signed out: "Talk to a Cheetah",
 * the field guide's own opening line, one sample exchange quoted from the
 * field guide, the species page's Ask entry (its chips are the three
 * questions; the drawer it opens meters the daily limits), the artwork, the
 * store buttons and the way to the species page. Every fact is a field of
 * the species snapshot, named in `talkLandingFieldSources`; nothing here is
 * written about the animal. English only, like its facts.
 */
export default async function TalkLanding({page, locale}: {page: TalkLandingPage; locale: string}) {
    const [t, askT] = await Promise.all([getScopedTranslator(locale, "animals"), getScopedTranslator(locale, "askAnimalDex")]);
    const words = TALK_LANDING_WORDS;
    const path = `/talk/${page.slug}`;
    const face = getSpeciesImageRoute(page.slug);
    const schema: JsonLd[] = [
        webPageJsonLd({
            locale: "en",
            path,
            name: page.title,
            description: page.description,
            image: ogImagePath("talk", page.slug),
            dateModified: page.updatedAt
        }),
        breadcrumbJsonLd("en", [{name: "AnimalDex", path: "/"}, {name: "Talk", path: "/talk"}, {name: page.heading, path}])
    ];
    // FAQ only where the three questions have real answers from the catalogue's field guide (talkLandingFaq).
    if (page.faq) {
        schema.push({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: page.faq.map((item) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: {"@type": "Answer", text: item.answer}
            }))
        });
    }
    const fieldGuideOf = words.fieldGuideOf.replace("{animal}", page.name);

    return (
        <TalkLandingSwitch slug={page.slug} name={page.name} power={page.power?.name ?? null} locale={locale} aiTagLabel={askT("aiTagLabel")}>
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: jsonLdHtml(schema)}} />
            {/* Tells the site-wide assistant which animal this page is about: the Ask entry below opens its chat. */}
            <AskSubjectBridge scope="species" slug={page.slug} name={page.name} title={page.name} summary={page.opening.text} avatarUrl={face} />
            <article className="mx-auto flex w-full max-w-[760px] flex-col gap-10 px-4 pb-16 pt-6 md:pt-10">
                <header className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
                    <SpeciesArtworkImage
                        slug={page.slug}
                        alt={page.imageAlt}
                        priority
                        fit="padded"
                        sizes="(min-width: 768px) 220px, 60vw"
                        className="mx-auto aspect-square w-[60vw] max-w-[220px] shrink-0 border border-white/10 md:mx-0 md:w-[220px]"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <h1 className="font-display text-3xl font-bold leading-tight text-white md:text-4xl">{page.heading}</h1>
                        <p className="text-[15px] leading-6 text-ink-200">
                            {page.power ? <span className="font-semibold text-primary-300">{page.power.name}. </span> : null}
                            {words.answersAsItself}
                        </p>
                        {/*
                          The opening line. No catalogue snapshot carries a greeting (2026-11-13), so this is
                          the first field-guide fact, as a neutral intro, never put in the animal's mouth
                          (talkLandingOpening); the field is page.opening.field.
                        */}
                        <blockquote className="border-l-2 border-primary-400 pl-4">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-ink-400">
                                {page.opening.kind === "greeting" ? page.name : words.fromFieldGuide}
                            </p>
                            <p className="mt-1 text-base leading-7 text-ink-100">{page.opening.text}</p>
                        </blockquote>
                        <div className="flex flex-wrap gap-2 pt-1">
                            <Link
                                href={`${path}?chat=1`}
                                className="inline-flex h-11 items-center bg-primary-400 px-5 text-[15px] font-bold text-canvas-950 transition-colors hover:bg-primary-300"
                            >
                                {words.openChat}
                            </Link>
                            <Link
                                href={page.speciesPath}
                                className="inline-flex h-11 items-center border border-white/15 px-5 text-[15px] font-semibold text-ink-100 transition-colors hover:border-primary-300/60 hover:text-white"
                            >
                                {words.readGuide.replace("{animal}", page.name)}
                            </Link>
                        </div>
                    </div>
                </header>

                {page.exchange ? (
                    <section aria-labelledby="talk-sample" className="flex flex-col gap-3">
                        <h2 id="talk-sample" className="font-display text-xl font-bold text-white">{words.sampleExchange}</h2>
                        <p className="text-sm leading-6 text-ink-300">{words.sampleExchangeHint.replace("{animal}", page.name)}</p>
                        {/* The reply is the field guide's own text, verbatim: page.exchange.field names the column. */}
                        <div className="flex flex-col gap-2 border border-white/10 bg-white/[0.03] p-4">
                            <div className="flex justify-end pl-[18%]">
                                <p className="max-w-full rounded-bubble bg-primary-400 px-3.5 py-2.5 text-[15px] leading-6 text-canvas-950" aria-label={`${words.you}: ${page.exchange.prompt}`}>
                                    {page.exchange.prompt}
                                </p>
                            </div>
                            <div className="flex justify-start pr-[12%]">
                                <div className="max-w-full rounded-bubble border border-white/10 bg-white/[0.06] px-3.5 py-2.5">
                                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-primary-300">
                                        {fieldGuideOf} · {page.exchange.topic}
                                    </p>
                                    <p className="mt-1 text-[15px] leading-6 text-ink-100">{page.exchange.answer}</p>
                                </div>
                            </div>
                        </div>
                    </section>
                ) : null}

                {/*
                  The species page's Ask entry, as it is today: its chips are the three field-guide
                  questions; the conversation it opens is the site-wide drawer, which meters the daily
                  limits (SPECIES_ASK_DAILY_LIMITS) and shows the sign-in prompt at the limit.
                  TODO(CC 2): once the inline Ask box and the "limit reached" panel land, mount them
                  here in place of the hand-off and wire the panel's store button to this page.
                */}
                <SpeciesAskAnimalDex
                    slug={page.slug}
                    animalName={page.name}
                    suggestions={page.questions.map((item) => ({label: item.prompt, prompt: item.prompt}))}
                    labels={{
                        eyebrow: t("askEyebrow"),
                        title: t("askTitle"),
                        description: t("askDescription"),
                        placeholder: t("askPlaceholder"),
                        submit: t("askSubmit"),
                        quota: t("askQuota", {
                            anonymous: String(SPECIES_ASK_DAILY_LIMITS.anonymous),
                            signedIn: String(SPECIES_ASK_DAILY_LIMITS.signedIn),
                            pro: String(SPECIES_ASK_DAILY_LIMITS.pro)
                        }),
                        noscript: t("askNoscript"),
                        layers: {
                            biology: {title: t("askLayerBiology"), caption: t("askLayerBiologyCaption")},
                            why: {title: t("askLayerWhy"), caption: t("askLayerWhyCaption")},
                            lesson: {title: t("askLayerLesson"), caption: t("askLayerLessonCaption")},
                            symbolism: {title: t("askLayerSymbolism"), caption: t("askLayerSymbolismCaption")}
                        }
                    }}
                />

                {page.questions.length > 0 ? (
                    <section aria-labelledby="talk-questions" className="flex flex-col gap-4">
                        <h2 id="talk-questions" className="font-display text-xl font-bold text-white">{words.questions.replace("{animal}", page.name)}</h2>
                        {/* Each answer is the field guide's own line (item.field). The FAQ JSON-LD above lists exactly these when all three are catalogue fields. */}
                        <dl className="flex flex-col divide-y divide-white/10 border border-white/10">
                            {page.questions.map((item) => (
                                <div key={item.field + item.prompt} className="flex flex-col gap-1.5 p-4">
                                    <dt className="text-[15px] font-semibold text-white">{item.question}</dt>
                                    <dd className="text-[15px] leading-6 text-ink-200">{item.answer}</dd>
                                    <dd className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-400">{fieldGuideOf} · {item.topic}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                ) : null}

                <section aria-labelledby="talk-app" className="flex flex-col gap-3 border border-white/10 bg-white/[0.03] p-5">
                    <h2 id="talk-app" className="font-display text-xl font-bold text-white">{words.getApp.replace("{animal}", page.name)}</h2>
                    <p className="text-sm leading-6 text-ink-300">{words.getAppHint}</p>
                    {/*
                      StoreLink as it is today: placement "page_talk" (the campaign), and the page path as
                      utm_content on click. TODO(CC 3): once buildStoreUrl lands in src/lib/store-links.ts,
                      build these hrefs with utm_content=talk_<slug> instead.
                    */}
                    <div className="flex flex-wrap gap-2 pt-1">
                        <StoreLink store="app_store" placement="page_talk" className="inline-flex h-11 items-center bg-white px-5 text-[15px] font-bold text-black transition-opacity hover:opacity-90">
                            {words.appStore}
                        </StoreLink>
                        <StoreLink store="google_play" placement="page_talk" className="inline-flex h-11 items-center border border-white/15 px-5 text-[15px] font-semibold text-ink-100 transition-colors hover:border-primary-300/60 hover:text-white">
                            {words.googlePlay}
                        </StoreLink>
                    </div>
                </section>

                <footer className="flex flex-col gap-2">
                    <AiNotice text={askT("aiNotice")} linkLabel={askT("aiSafetyLink")} />
                    <p className="text-center text-[11px] leading-4 text-ink-400">{askT("disclaimer")}</p>
                </footer>
            </article>
        </TalkLandingSwitch>
    );
}
