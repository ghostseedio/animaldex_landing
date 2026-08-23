import {Metadata} from "next";
import {getLocale} from "next-intl/server";
import Link from "@/app/[locale]/_components/link";
import {BugIcon, ChecklistIcon, DocumentIcon, HelpCircleIcon, MailIcon, ShieldUserIcon, SparklesIcon} from "@/app/[locale]/_components/icons";
import {getCurrentUserId} from "@/data/direct-messages";
import {getSystemSupportProfile} from "@/lib/in-app-support";
import {localeConfig} from "@/i18n";
import {getAbsoluteUrl, getLocalePath, getMetadataLocale} from "@/lib/site";

const contactPath = "/contact";
const supportEmail = "support@animaldex.app";

function contactDraft(kind: "support" | "bug" | "feature") {
    if (kind === "bug") {
        return "Hi AnimalDex Support,\n\nI found a bug:\n\nWhat happened:\n\nWhat I expected:\n\nSteps to reproduce:\n1.\n2.\n3.\n\nAnimalDex username:\nDevice and OS:\nApp version:\n";
    }
    if (kind === "feature") {
        return "Hi AnimalDex Support,\n\nI would like to request a feature:\n\nFeature idea:\n\nWhy it would help:\n\nAnimalDex username:\n";
    }
    return "Hi AnimalDex Support,\n\nI need help with:\n\n\nAnimalDex username:\nDevice and OS:\nApp version:\n";
}

function mailto(subject: string, kind: "support" | "bug" | "feature") {
    return `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(contactDraft(kind))}`;
}

function messageHref(supportUserId: string | null, signedIn: boolean, kind: "support" | "bug" | "feature") {
    if (!supportUserId) return "/account";
    const thread = `/app/messages/${encodeURIComponent(supportUserId)}?draft=${encodeURIComponent(contactDraft(kind))}`;
    return signedIn ? thread : `/account?next=${encodeURIComponent(thread)}`;
}

function getCopy(locale: string) {
    if (locale === "id") {
        return {
            eyebrow: "Hubungi Kami",
            title: "Hubungi AnimalDex",
            description: "Butuh bantuan dengan aplikasi, ingin melaporkan bug, atau punya ide? Kirim detail yang tepat agar kami dapat membantu lebih cepat.",
            metaTitle: "Hubungi Dukungan AnimalDex",
            metaDescription: "Hubungi Dukungan AnimalDex untuk bantuan akun, scan dan capture, pembelian, privasi, laporan bug, atau permintaan fitur.",
            responseTitle: "Cara tercepat mendapatkan bantuan",
            responseDescription: "Email kami atau kirim pesan langsung di aplikasi. Jangan sertakan password, kode verifikasi, atau informasi pembayaran lengkap.",
            emailAction: "Email",
            messageAction: "Kirim pesan",
            signInToMessage: "Masuk untuk pesan di aplikasi",
            includeTitle: "Sertakan detail berikut",
            includeItems: ["Username AnimalDex dan email akun jika relevan", "Perangkat, versi OS, dan versi aplikasi", "Langkah yang dilakukan sebelum masalah terjadi", "Waktu capture atau pembelian jika relevan", "Screenshot yang tidak menampilkan data sensitif"],
            helpCenter: "Periksa Pusat Bantuan",
            privacy: "Permintaan privasi",
            emailLabel: "Email dukungan"
        };
    }

    return {
        eyebrow: "Contact",
        title: "Contact AnimalDex",
        description: "Need help with the app, want to report a bug, or have an idea? Send the right details so we can help efficiently.",
        metaTitle: "Contact AnimalDex Support",
        metaDescription: "Contact AnimalDex Support for help with accounts, scans and captures, purchases, privacy, bug reports, or feature requests.",
            responseTitle: "The fastest way to get help",
            responseDescription: "Email us or message AnimalDex in the app. Do not include passwords, verification codes, or complete payment information.",
            emailAction: "Email",
            messageAction: "Message us",
            signInToMessage: "Sign in to message us",
        includeTitle: "Include these details",
        includeItems: ["Your AnimalDex username and account email when relevant", "Device model, operating-system version, and app version", "The steps you took before the issue occurred", "Capture or purchase time when relevant", "A screenshot that does not expose sensitive information"],
        helpCenter: "Check the Help Center",
        privacy: "Privacy request",
        emailLabel: "Support email"
    };
}

export async function generateMetadata(): Promise<Metadata> {
    const locale = await getLocale();
    const copy = getCopy(locale);

    return {
        title: copy.metaTitle,
        description: copy.metaDescription,
        alternates: {
            canonical: getLocalePath(locale, contactPath),
            languages: localeConfig.locales.reduce((languages, item) => {
                languages[item] = getLocalePath(item, contactPath);
                return languages;
            }, {"x-default": getLocalePath(localeConfig.defaultLocale, contactPath)} as Record<string, string>)
        },
        openGraph: {
            type: "website",
            locale: getMetadataLocale(locale),
            title: copy.metaTitle,
            description: copy.metaDescription,
            url: getLocalePath(locale, contactPath),
            images: [{url: "/images/og.png", width: 1200, height: 630, alt: copy.title}]
        },
        twitter: {card: "summary_large_image", title: copy.metaTitle, description: copy.metaDescription, images: ["/images/og.png"]}
    };
}

export default async function ContactPage() {
    const locale = await getLocale();
    const copy = getCopy(locale);
    const [currentUserId, supportProfile] = await Promise.all([
        getCurrentUserId(),
        getSystemSupportProfile()
    ]);
    const signedIn = Boolean(currentUserId);
    const supportUserId = supportProfile?.id ?? null;
    const contactOptions = [
        {title: locale === "id" ? "Bantuan aplikasi" : "App support", description: locale === "id" ? "Masalah akun, scan, capture, koleksi, kredit, atau pembelian." : "Account, scan, capture, collection, credit, or purchase issues.", subject: "AnimalDex Support Request", kind: "support" as const, icon: MailIcon},
        {title: locale === "id" ? "Laporkan bug" : "Report a bug", description: locale === "id" ? "Beri tahu apa yang terjadi dan cara mengulanginya." : "Tell us what happened and how to reproduce it.", subject: "AnimalDex Bug Report", kind: "bug" as const, icon: BugIcon},
        {title: locale === "id" ? "Minta fitur" : "Request a feature", description: locale === "id" ? "Jelaskan idemu dan masalah yang ingin diselesaikan." : "Describe your idea and the problem it would solve.", subject: "AnimalDex Feature Request", kind: "feature" as const, icon: SparklesIcon}
    ];
    const schema = {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: copy.title,
        description: copy.description,
        url: getAbsoluteUrl(locale, contactPath),
        inLanguage: locale,
        mainEntity: {
            "@type": "Organization",
            name: "AnimalDex",
            email: supportEmail,
            contactPoint: {"@type": "ContactPoint", contactType: "customer support", email: supportEmail, availableLanguage: ["English", "Indonesian"]}
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto px-4 md:px-8 py-12 md:py-20 flex flex-col gap-14 md:gap-18">
            <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(schema)}} />

            <header className="text-center flex flex-col items-center gap-5">
                <p className="text-primary-200 font-medium uppercase tracking-[0.2em] text-sm">{copy.eyebrow}</p>
                <h1 className="font-display font-bold text-5xl md:text-7xl text-white tracking-tight">{copy.title}</h1>
                <p className="text-xl md:text-2xl text-ink-100 max-w-4xl">{copy.description}</p>
            </header>

            <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {contactOptions.map((option) => {
                    const Icon = option.icon;
                    return <article key={option.title} className="rounded-[2rem] border border-line-300 bg-surface-900/70 p-6 md:p-8 flex flex-col gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary-500/25 bg-primary-500/10 text-primary-200">
                            <Icon size={25} />
                        </div>
                        <h2 className="font-display font-bold text-2xl text-white">{option.title}</h2>
                        <p className="text-ink-200 text-lg flex-1">{option.description}</p>
                        <div className="flex flex-col gap-2">
                            <Link href={mailto(option.subject, option.kind)} className="inline-flex items-center gap-2 text-primary-200 text-lg hover:text-primary-100 transition-colors" underline>
                                <MailIcon size={18} />
                                {copy.emailAction} · {supportEmail}
                            </Link>
                            <Link href={messageHref(supportUserId, signedIn, option.kind)} className="inline-flex items-center gap-2 text-primary-200 text-lg hover:text-primary-100 transition-colors" underline>
                                {signedIn ? copy.messageAction : copy.signInToMessage}
                            </Link>
                        </div>
                    </article>;
                })}
            </section>

            <section className="rounded-[2.5rem] bg-gradient-to-br from-primary-500/20 via-surface-800 to-violet-500/10 px-7 py-10 md:px-12 md:py-14 grid grid-cols-1 lg:grid-cols-2 gap-9 lg:gap-14">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-500/12 text-primary-200"><MailIcon size={23} /></span>
                        <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{copy.responseTitle}</h2>
                    </div>
                    <p className="text-ink-100 text-lg">{copy.responseDescription}</p>
                    <div className="rounded-2xl border border-primary-500/30 bg-canvas-950/40 p-5">
                        <p className="text-xs uppercase tracking-[0.18em] text-ink-400">{copy.emailLabel}</p>
                        <Link href={mailto("AnimalDex Support Request", "support")} className="mt-2 block text-xl md:text-2xl font-bold text-primary-200 break-all hover:text-primary-100 transition-colors">
                            {supportEmail}
                        </Link>
                    </div>
                </div>
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <ChecklistIcon size={26} className="shrink-0 text-primary-200" />
                        <h2 className="font-display font-bold text-2xl md:text-3xl text-white">{copy.includeTitle}</h2>
                    </div>
                    <ul className="flex flex-col gap-3">
                        {copy.includeItems.map((item) => (
                            <li key={item} className="flex gap-3 text-ink-100 text-lg">
                                <ChecklistIcon size={20} className="mt-1 shrink-0 text-primary-300" />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <nav aria-label="Related support links" className="flex flex-wrap justify-center gap-3">
                <Link href="/support" className="inline-flex items-center gap-2 rounded-full border border-line-300 px-5 py-3 text-ink-100 hover:border-primary-400 hover:text-primary-100 transition-colors"><HelpCircleIcon size={19} />{copy.helpCenter}</Link>
                <Link href="/legal/privacy" className="inline-flex items-center gap-2 rounded-full border border-line-300 px-5 py-3 text-ink-100 hover:border-primary-400 hover:text-primary-100 transition-colors"><ShieldUserIcon size={19} />{copy.privacy}</Link>
                <Link href="/legal/terms" className="inline-flex items-center gap-2 rounded-full border border-line-300 px-5 py-3 text-ink-100 hover:border-primary-400 hover:text-primary-100 transition-colors"><DocumentIcon size={19} />Terms of Service</Link>
            </nav>
        </div>
    );
}
