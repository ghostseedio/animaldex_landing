"use client";

import {FormEvent, useState} from "react";
import Image from "next/image";
import {useRouter, useSearchParams} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {getSpeciesArtworkUrl} from "@/data/species-artwork";

type AccountLoginFormProps = {
    labels: {
        eyebrow: string;
        title: string;
        description: string;
        emailLabel: string;
        passwordLabel: string;
        submit: string;
        loading: string;
        errorGeneric: string;
        supportOne: string;
        supportTwo: string;
        supportThree: string;
        browseAnimalsLink: string;
        downloadPrompt: string;
        downloadApp: string;
        backHome: string;
        loginFormTitle: string;
        loginCardLabel: string;
        continueWithGoogle: string;
        continueWithApple: string;
        emailSeparator: string;
    };
    redirectTo: string;
};

const previewCards = [
    {slug: "barn-owl", name: "Barn Owl", rotate: "-rotate-6", offset: "translate-x-0"},
    {slug: "wolf", name: "Wolf", rotate: "rotate-3", offset: "translate-x-6 md:translate-x-10"},
    {slug: "red-fox", name: "Red Fox", rotate: "-rotate-2", offset: "translate-x-3 md:translate-x-6"}
] as const;

function FieldIcon({path}: {path: string}) {
    return (
        <svg aria-hidden="true" className="h-5 w-5 text-ink-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path d={path} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

function GoogleMark() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
            <path fill="#4285F4" d="M21.6 12.23c0-.72-.06-1.41-.18-2.08H12v3.93h5.38a4.6 4.6 0 0 1-1.99 3.02v2.51h3.23c1.89-1.74 2.98-4.3 2.98-7.38z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.39l-3.23-2.51c-.9.6-2.04.95-3.39.95-2.6 0-4.8-1.76-5.59-4.12H3.08v2.59A9.99 9.99 0 0 0 12 22z" />
            <path fill="#FBBC05" d="M6.41 13.93A6 6 0 0 1 6.1 12c0-.67.11-1.32.31-1.93V7.48H3.08A9.99 9.99 0 0 0 2 12c0 1.61.39 3.13 1.08 4.52l3.33-2.59z" />
            <path fill="#EA4335" d="M12 5.95c1.47 0 2.78.5 3.82 1.49l2.87-2.87C16.95 2.95 14.7 2 12 2a9.99 9.99 0 0 0-8.92 5.48l3.33 2.59C7.2 7.71 9.4 5.95 12 5.95z" />
        </svg>
    );
}

function AppleMark() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M16.64 13.04c-.02-2.08 1.7-3.08 1.78-3.13-1-1.45-2.52-1.65-3.04-1.67-1.28-.13-2.52.76-3.17.76-.66 0-1.67-.74-2.75-.72-1.41.02-2.72.83-3.45 2.1-1.48 2.56-.38 6.33 1.04 8.4.71 1.02 1.54 2.16 2.63 2.12 1.06-.04 1.46-.68 2.74-.68 1.27 0 1.64.68 2.75.66 1.15-.02 1.87-1.02 2.55-2.05.82-1.17 1.14-2.32 1.15-2.38-.03-.01-2.21-.85-2.23-3.41z" />
            <path d="M14.54 6.88c.57-.71.96-1.67.85-2.65-.83.04-1.87.58-2.46 1.27-.53.61-1 1.61-.87 2.55.94.07 1.9-.47 2.48-1.17z" />
        </svg>
    );
}

function oauthHref(provider: "google" | "apple", redirectTo: string) {
    const params = new URLSearchParams({provider, next: redirectTo});
    return `/api/auth/oauth?${params.toString()}`;
}

export default function AccountLoginForm({labels, redirectTo}: AccountLoginFormProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [hasDismissedUrlError, setHasDismissedUrlError] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const callbackError = hasDismissedUrlError ? null : searchParams.get("error");
    const displayedError = errorMessage ?? callbackError;

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setHasDismissedUrlError(true);
        setErrorMessage(null);
        setIsSubmitting(true);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    email: email.trim(),
                    password
                })
            });

            const payload = await response.json() as {error?: string; ok?: boolean};

            if (!response.ok) {
                setErrorMessage(payload.error || labels.errorGeneric);
                setIsSubmitting(false);
                return;
            }

            router.push(redirectTo);
            router.refresh();
        } catch {
            setErrorMessage(labels.errorGeneric);
            setIsSubmitting(false);
        }
    }

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
            <Link href="/" className="text-sm text-primary-200 transition-colors hover:text-primary-100 w-fit" underline>
                {labels.backHome}
            </Link>

            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(26,34,28,0.96),rgba(12,17,14,0.98))] shadow-2xl shadow-black/30">
                <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
                    <aside className="relative overflow-hidden border-b border-white/10 p-8 md:p-10 lg:border-b-0 lg:border-r lg:p-12">
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(180,139,72,0.18),transparent_38%),radial-gradient(circle_at_85%_85%,rgba(50,219,101,0.12),transparent_34%)]" />

                        <div className="relative flex h-full flex-col justify-between gap-10">
                            <div className="max-w-md">
                                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-100/85">
                                    {labels.eyebrow}
                                </p>
                                <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-white md:text-5xl">
                                    {labels.title}
                                </h1>
                                <p className="mt-4 text-lg leading-8 text-ink-200">
                                    {labels.description}
                                </p>
                            </div>

                            <div className="relative mx-auto h-56 w-full max-w-sm md:h-64">
                                {previewCards.map((card, index) => (
                                    <div
                                        key={card.slug}
                                        className={`absolute bottom-0 w-[11.5rem] overflow-hidden rounded-[1.35rem] border border-white/15 bg-black/25 shadow-2xl shadow-black/40 md:w-[13rem] ${card.rotate} ${card.offset}`}
                                        style={{left: `${index * 18}%`, zIndex: index + 1}}
                                    >
                                        <div className="relative aspect-[4/5]">
                                            <Image
                                                src={getSpeciesArtworkUrl(card.slug)}
                                                alt={card.name}
                                                fill
                                                unoptimized
                                                className="object-cover"
                                                sizes="208px"
                                            />
                                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/35 to-transparent px-4 pb-4 pt-12">
                                                <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-amber-100">
                                                    {labels.loginCardLabel}
                                                </p>
                                                <p className="mt-1 font-display text-xl font-bold text-white">{card.name}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <ul className="relative flex flex-col gap-3">
                                {[labels.supportOne, labels.supportTwo, labels.supportThree].map((item) => (
                                    <li key={item} className="flex items-start gap-3 text-sm leading-6 text-ink-100 md:text-base">
                                        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-400/15 text-xs font-bold text-primary-100">
                                            ✓
                                        </span>
                                        <span>{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </aside>

                    <form onSubmit={handleSubmit} className="flex flex-col justify-center gap-6 p-8 md:p-10 lg:p-12">
                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-300">
                                Account
                            </p>
                            <h2 className="font-display text-3xl font-bold text-white">
                                {labels.loginFormTitle}
                            </h2>
                        </div>

                        <div className="grid gap-3">
                            <a
                                href={oauthHref("google", redirectTo)}
                                className="flex min-h-[3.25rem] items-center justify-center gap-3 rounded-2xl border border-white/15 bg-white px-5 text-base font-bold text-black transition-colors hover:bg-white/90"
                            >
                                <GoogleMark />
                                {labels.continueWithGoogle}
                            </a>
                            <a
                                href={oauthHref("apple", redirectTo)}
                                className="flex min-h-[3.25rem] items-center justify-center gap-3 rounded-2xl border border-white/15 bg-black px-5 text-base font-bold text-white transition-colors hover:bg-black/80"
                            >
                                <AppleMark />
                                {labels.continueWithApple}
                            </a>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="h-px flex-1 bg-white/[0.08]" />
                            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">{labels.emailSeparator}</span>
                            <span className="h-px flex-1 bg-white/[0.08]" />
                        </div>

                        <label className="flex flex-col gap-2.5">
                            <span className="text-sm font-semibold text-ink-100">{labels.emailLabel}</span>
                            <span className="flex min-h-[3.25rem] items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 transition-colors focus-within:border-primary-400/35 focus-within:bg-black/35">
                                <FieldIcon path="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                <input
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    placeholder="you@example.com"
                                    className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-ink-400"
                                />
                            </span>
                        </label>

                        <label className="flex flex-col gap-2.5">
                            <span className="text-sm font-semibold text-ink-100">{labels.passwordLabel}</span>
                            <span className="flex min-h-[3.25rem] items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 transition-colors focus-within:border-primary-400/35 focus-within:bg-black/35">
                                <FieldIcon path="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                <input
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    className="min-w-0 flex-1 bg-transparent text-base text-white outline-none placeholder:text-ink-400"
                                />
                            </span>
                        </label>

                        {displayedError ? (
                            <p className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-100">
                                {displayedError}
                            </p>
                        ) : null}

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="min-h-[3.5rem] rounded-2xl bg-primary-400 px-5 text-base font-bold text-canvas-950 transition-all hover:bg-primary-300 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSubmitting ? labels.loading : labels.submit}
                        </button>

                        <div className="border-t border-white/[0.08] pt-6">
                            <p className="text-sm text-ink-300">{labels.downloadPrompt}</p>
                            <div className="mt-4 flex flex-wrap gap-3">
                                <Link
                                    href="/#download"
                                    className="inline-flex min-h-[2.75rem] items-center rounded-xl border border-white/15 px-4 text-sm font-semibold text-white transition-colors hover:border-primary-400 hover:text-primary-100"
                                >
                                    {labels.downloadApp}
                                </Link>
                                <Link
                                    href="/animals"
                                    className="inline-flex min-h-[2.75rem] items-center rounded-xl px-1 text-sm font-semibold text-primary-200 transition-colors hover:text-primary-100"
                                    underline
                                >
                                    {labels.browseAnimalsLink}
                                </Link>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
