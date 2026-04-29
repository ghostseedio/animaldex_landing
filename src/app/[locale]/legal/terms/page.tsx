import {remark} from "remark";
import html from "remark-html";
import terms from "@/data/terms-of-service.md";
import logo from "@/app/[locale]/_assets/logos/logo.svg";
import Image from "next/image";
import {Metadata} from "next";
import {getLocale, getTranslations} from "next-intl/server";
import {getLocalePath, getMetadataLocale} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {DatabaseIcon, ShieldUserIcon} from "@/app/[locale]/_components/icons";
import {loadLocaleMessages} from "@/loaders/locale";

export default async function TermsOfService() {
    const processedContent = await remark()
        .use(html)
        .process(terms);
    const contentHtml = processedContent.toString();

    return (
        <div className="w-full text-center max-w-3xl px-4 mx-auto my-16 text-ink-200">
            <aside className="flex items-center justify-center gap-4 text-primary-500 mb-8">
                <Image src={logo} alt="AnimalDex logo" width={64} height={64} />
                <ShieldUserIcon size={64} />
                <DatabaseIcon size={64} />
            </aside>
            <div
                className="prose prose-invert prose-headings:font-bold prose-headings:font-display prose-headings:text-white
                prose-a:text-primary-200 prose-a:underline prose-strong:text-white marker:text-ink-200 prose-li:text-left
                rounded-4xl border border-line-300 bg-surface-900/80 px-6 py-8 backdrop-blur"
                dangerouslySetInnerHTML={{__html: contentHtml}}
            />
        </div>
    );
}

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const t = await getTranslations("meta");
    const messages = await loadLocaleMessages(locale);
    const keywords = Array.isArray(messages.meta?.keywords) ? messages.meta.keywords : [];

    return {
        title: t("termsTitle"),
        description: t("termsDescription"),
        keywords,
        alternates: {
            canonical: getLocalePath(locale, "/legal/terms"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = `/${localeItem}/legal/terms`;
                return acc;
            }, {
                "x-default": `/${localeConfig.defaultLocale}/legal/terms`
            } as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: `${t("termsTitle")} | AnimalDex`,
            description: t("termsDescription"),
            url: getLocalePath(locale, "/legal/terms"),
            images: [
                {
                    url: "/images/og-animaldex.svg",
                    width: 1200,
                    height: 630,
                    alt: `${t("termsTitle")} | AnimalDex`
                }
            ]
        },
        twitter: {
            card: "summary_large_image",
            title: `${t("termsTitle")} | AnimalDex`,
            description: t("termsDescription"),
            images: ["/images/og-animaldex.svg"]
        },
        robots: {
            index: true,
            follow: true
        }
    };
}
