"use client";

import {FormEvent, useEffect, useState} from "react";
import {useRouter, useSearchParams} from "next/navigation";
import Link from "@/app/[locale]/_components/link";

type AccountLoginFormProps = {
    labels: {
        emailLabel: string;
        passwordLabel: string;
        submit: string;
        loading: string;
        errorGeneric: string;
        browseAnimalsLink: string;
        downloadPrompt: string;
        downloadApp: string;
        loginFormTitle: string;
        continueWithGoogle: string;
        continueWithApple: string;
        emailSeparator: string;
    };
    redirectTo: string;
};

/** Square edges throughout, as on the hub pages: no rounded containers. */
const FIELD_CLASS = "flex h-12 items-center gap-3 border border-line-300 bg-transparent px-4 transition-colors focus-within:border-primary-400";
const OAUTH_CLASS = "flex h-12 items-center justify-center gap-3 rounded-[2px] px-5 text-[0.9375rem] font-bold transition-colors disabled:cursor-wait disabled:opacity-60";

function FieldIcon({path}: {path: string}) {
    return (
        <svg aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-ink-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
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

/**
 * Starts OAuth with a POST, not a link: each start writes a new PKCE verifier,
 * so a browser preloading a link on hover (or a second click) would replace the
 * one Google's return needs. Browsers never preload a POST, and it is sent once.
 *
 * The button sits inside the email sign-in <form>, and forms cannot nest, so it
 * submits a form of its own built on <body>.
 */
function OAuthButton({provider, redirectTo, className, children}: {
    provider: "google" | "apple";
    redirectTo: string;
    className: string;
    children: React.ReactNode;
}) {
    const [submitted, setSubmitted] = useState(false);
    // Back from Google restores this page from the back/forward cache with the
    // button still marked as sent; let it be pressed again.
    useEffect(() => {
        const reset = () => setSubmitted(false);
        window.addEventListener("pageshow", reset);
        return () => window.removeEventListener("pageshow", reset);
    }, []);
    return (
        <button
            type="button"
            disabled={submitted}
            onClick={() => {
                if (submitted) return;
                setSubmitted(true);
                const form = document.createElement("form");
                form.method = "post";
                form.action = "/api/auth/oauth";
                form.hidden = true;
                for (const [name, value] of [["provider", provider], ["next", redirectTo]]) {
                    const input = document.createElement("input");
                    input.type = "hidden";
                    input.name = name;
                    input.value = value;
                    form.appendChild(input);
                }
                document.body.appendChild(form);
                form.submit();
            }}
            className={`w-full ${className}`}
        >
            {children}
        </button>
    );
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
        <div className="mx-auto w-full max-w-[28rem]">
            <form onSubmit={handleSubmit} className="flex flex-col border border-line-300 bg-canvas-950">
                <div className="border-b border-line-300 px-6 py-6 sm:px-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-400">Account</p>
                    <h2 className="mt-2 font-display text-3xl leading-tight text-white">{labels.loginFormTitle}</h2>
                </div>

                <div className="flex flex-col gap-3 px-6 pt-6 sm:px-8">
                    <OAuthButton
                        provider="google"
                        redirectTo={redirectTo}
                        className={`${OAUTH_CLASS} border border-line-300 bg-white text-black hover:bg-white/90 light:border-black/15`}
                    >
                        <GoogleMark />
                        {labels.continueWithGoogle}
                    </OAuthButton>
                    <OAuthButton
                        provider="apple"
                        redirectTo={redirectTo}
                        className={`${OAUTH_CLASS} border border-line-300 bg-black text-[#fff] hover:bg-black/80`}
                    >
                        <AppleMark />
                        {labels.continueWithApple}
                    </OAuthButton>
                </div>

                <div className="flex items-center gap-3 px-6 py-6 sm:px-8">
                    <span className="h-px flex-1 bg-line-300" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-400">{labels.emailSeparator}</span>
                    <span className="h-px flex-1 bg-line-300" />
                </div>

                <div className="flex flex-col gap-5 px-6 sm:px-8">
                    <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">{labels.emailLabel}</span>
                        <span className={FIELD_CLASS}>
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

                    <label className="flex flex-col gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-300">{labels.passwordLabel}</span>
                        <span className={FIELD_CLASS}>
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
                        <p role="alert" className="border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-rose-100">
                            {displayedError}
                        </p>
                    ) : null}

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex h-12 items-center justify-center rounded-[2px] bg-primary-400 px-5 text-[0.9375rem] font-black uppercase tracking-[0.04em] text-canvas-950 transition-colors duration-150 hover:bg-primary-100 focus-visible:bg-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
                    >
                        {isSubmitting ? labels.loading : labels.submit}
                    </button>
                </div>

                <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line-300 px-6 py-5 sm:px-8">
                    <p className="w-full text-sm text-ink-300">{labels.downloadPrompt}</p>
                    <Link
                        href="/#download"
                        className="inline-flex h-10 items-center rounded-[2px] border border-line-300 px-4 text-sm font-semibold text-white transition-colors hover:border-primary-400 hover:text-primary-100"
                    >
                        {labels.downloadApp}
                    </Link>
                    <Link
                        href="/animals"
                        className="text-sm font-semibold text-primary-200 underline-offset-4 transition-colors hover:text-primary-100 hover:underline focus-visible:underline"
                    >
                        {labels.browseAnimalsLink}
                    </Link>
                </div>
            </form>
        </div>
    );
}
