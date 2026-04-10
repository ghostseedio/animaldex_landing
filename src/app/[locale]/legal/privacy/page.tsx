import { remark } from 'remark';
import html from 'remark-html';
import policy from "@/data/privacy-policy.md"
import logo from "@/app/[locale]/_assets/logos/logo.svg";
import Image from "next/image";
import {Metadata} from "next";
import {getLocale, getTranslations} from "next-intl/server";
import {getLocalePath} from "@/lib/site";
import {localeConfig} from "@/i18n";
import {DatabaseIcon, ShieldUserIcon} from "@/app/[locale]/_components/icons";

export default async function PrivacyPolicy() {
    const processedContent = await remark()
        .use(html)
        .process(policy);
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
                dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
        </div>
    )
}

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const t = await getTranslations("meta");

    return {
        title: t("privacyTitle"),
        description: t("privacyDescription"),
        alternates: {
            canonical: getLocalePath(locale, "/legal/privacy"),
            languages: localeConfig.locales.reduce((acc, localeItem) => {
                acc[localeItem] = `/${localeItem}/legal/privacy`;
                return acc;
            }, {
                "x-default": `/${localeConfig.defaultLocale}/legal/privacy`
            } as Record<string, string>)
        },
        robots: {
            index: true,
            follow: true
        }
    };
}
