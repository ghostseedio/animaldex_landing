import '@/app/[locale]/_assets/globals.css'
import React, {ReactNode} from "react";
import {notFound} from "next/navigation";
import {fontClassName, fontCssVariables} from "@/app/fonts";
import {localeConfig} from "@/i18n";
import {Metadata} from "next";
import Cursor from "@/app/[locale]/_components/cursor";
import NavigationProgress from "@/app/[locale]/_components/navigation-progress";
import {loadLocaleMessages} from "@/loaders/locale";
import GoogleAnalytics from "@/components/analytics/google-analytics";
import CampaignAttribution from "@/app/[locale]/_components/campaign-attribution";
import {getMetadataLocale, getSiteUrl} from "@/lib/site";
import {appStoreUrl, googlePlayUrl} from "@/lib/store-links";

const brandIconUrl = "/images/logo.webp";
const socialImageUrl = "/images/og.png";

export function generateStaticParams() {
    return localeConfig.locales.map((locale) => ({locale}));
}

type RootLayoutProps = {
    children: ReactNode;
    params: { locale: string };
};

export default function RootLayout(
    {children, params: {locale: reqLocale}}: RootLayoutProps
) {
    if (!localeConfig.locales.includes(reqLocale)) {
        notFound();
    }

    const locale = reqLocale;

    // noinspection HtmlRequiredTitleElement
    return (
        <html lang={locale} className="scroll-smooth selection:bg-primary-200 selection:text-canvas-950">
        <head/>
        <body className={`${fontClassName} font-sans font-medium overscroll-none`} style={fontCssVariables}>
            <GoogleAnalytics />
            <CampaignAttribution />
            <Cursor />
            <NavigationProgress />
            {children}
        </body>
        </html>
    )
}

export async function generateMetadata({params: {locale: reqLocale}}: RootLayoutProps): Promise<Metadata> {
    const locale = localeConfig.locales.includes(reqLocale) ? reqLocale : localeConfig.defaultLocale;
    const messages = await loadLocaleMessages(locale);
    const meta = (messages.meta || {}) as Record<string, unknown>;
    const fullTitle = typeof meta.fullTitle === "string" ? meta.fullTitle : "AnimalDex";
    const title = typeof meta.title === "string" ? meta.title : "AnimalDex";
    const description = typeof meta.description === "string" ? meta.description : fullTitle;
    const keywords = Array.isArray(meta.keywords) ? meta.keywords : [];

    return {
        metadataBase: new URL(getSiteUrl()),
        title: {
            default: fullTitle,
            template: `%s | ${title}`
        },
        description,
        keywords,
        generator: "Next.js",
        other: {
            "apple-itunes-app": "app-id=6761607780",
            "facebook-domain-verification": "hi8zc0bm4dg7qrn95luj9isnn21ldo"
        },
        colorScheme: "dark",
        themeColor: "#21C05E",
        category: "education",
        applicationName: title,
        appLinks: {
            ios: {
                url: appStoreUrl,
                app_store_id: "6761607780",
                app_name: "AnimalDex"
            },
            android: {
                package: "app.animaldex",
                url: googlePlayUrl,
                app_name: "AnimalDex"
            }
        },
        robots: {
            index: true,
            follow: true,
            googleBot: {
                index: true,
                follow: true,
                "max-image-preview": "large",
                "max-snippet": -1,
                "max-video-preview": -1
            }
        },
        formatDetection: {
            telephone: false,
            email: false,
            address: false
        },
        icons: {
            icon: [
                {url: '/favicon.ico'},
                {url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png'},
                {url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png'}
            ],
            shortcut: '/favicon.ico',
            apple: '/apple-touch-icon.png',
            other: [
                {
                    rel: "icon",
                    url: brandIconUrl,
                    type: "image/webp"
                }
            ]
        },
        manifest: "/site.webmanifest",
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: fullTitle,
            description,
            siteName: title,
            images: [
                {
                    url: socialImageUrl,
                    width: 1200,
                    height: 630,
                    alt: fullTitle
                }
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: fullTitle,
            description,
            images: [socialImageUrl],
        }
    };
}
