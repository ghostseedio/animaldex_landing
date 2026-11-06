"use client";

/**
 * The gate before a chat (SPEC 3.1, lib/ai-chat-gate): mounted once in the
 * root layout, so every chat surface (the drawer, /talk, the home demo, the
 * web app) asks through the same one.
 *
 * `request()` resolves true when the chat may go ahead. On the way it asks
 * what is still to be asked, once: an account's birth year ("a quick age
 * check"), then the AI consent (an account's through `record_ai_consent`, a
 * guest's in this browser). Under 13, AnimalDex is closed (6 Nov 2026): a
 * full-page "AnimalDex is for ages 13 and up" with no way out, the account
 * deleted at once (`close_under_13`) and this browser marked, so the app,
 * sign-in and every chat show the same page afterwards. "Not now" on the
 * consent resolves false and the chat stays locked until they agree.
 *
 * Nothing here blocks a chat because the backend is behind: with the
 * migration missing there is no age check and the consent is kept in the
 * browser; a failed read is treated the same way.
 */

import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from "react";
import {createPortal} from "react-dom";
import {usePathname} from "next/navigation";
import Link from "@/app/[locale]/_components/link";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {
    AI_CONSENT_GUEST_KEY,
    AI_CONSENT_VERSION,
    aiConsentAccountKey,
    aiGateStep,
    ageBandFor,
    birthYearOptions,
    hasAgeRestrictedMark,
    isAgeBand,
    isAgeRestrictedPath,
    isCurrentConsent,
    type AgeBand,
    type AiGateStep
} from "@/lib/ai-chat-gate";

export type AiGateWords = {
    consentTitle: string;
    consentBody: string;
    /** "See {privacy} and {safety}." */
    consentMore: string;
    consentPrivacy: string;
    consentSafety: string;
    consentAgree: string;
    consentNotNow: string;
    ageTitle: string;
    ageBody: string;
    ageYearLabel: string;
    ageContinue: string;
    ageNote: string;
    ageFailed: string;
    under13Title: string;
    under13Body: string;
    under13Closing: string;
    under13Failed: string;
    under13Retry: string;
    /** "Entered the wrong year? Email support@animaldex.app." */
    under13Support: string;
    close: string;
};

const SUPPORT_EMAIL = "support@animaldex.app";

export const AI_SAFETY_HREF = "/legal/ai-and-safety";
export const PRIVACY_HREF = "/legal/privacy";

type Account = {userId: string; birthYear: number | null; band: AgeBand; consented: boolean; available: boolean};
type Sheet = Exclude<AiGateStep, "open">;

export type AiChatGate = {
    /** The chat may go ahead without asking anything. */
    ready: boolean;
    /**
     * Asks whatever is still to be asked; true when the chat may go ahead.
     * `ownWords: false` (the home demo's chips, our words): a guest is not
     * asked for consent, an account still is.
     */
    request: (options?: {ownWords?: boolean}) => Promise<boolean>;
    /** The account's band once known; "teen" adds the break to the long-session notice. */
    band: AgeBand;
    /** Talk is closed for this account (under 13). */
    blocked: boolean;
    /** "Not now" was chosen this session: the chat stays locked until they agree. */
    declined: boolean;
};

const OPEN_GATE: AiChatGate = {ready: true, request: async () => true, band: "unknown", blocked: false, declined: false};
const AiChatGateContext = createContext<AiChatGate>(OPEN_GATE);

/** The gate, or an open one outside the provider (a surface rendered without the root layout). */
export function useAiChatGate(): AiChatGate {
    return useContext(AiChatGateContext);
}

function storage(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

function signedIn(): boolean {
    return typeof document !== "undefined" && requestHasSupabaseAuthCookie(document.cookie);
}

async function readAccount(): Promise<Account | null> {
    try {
        const response = await fetch("/api/app/ai-gate", {headers: {Accept: "application/json"}, cache: "no-store"});
        if (!response.ok) return null;
        const body = await response.json() as {signedIn?: boolean; userId?: unknown; birthYear?: unknown; band?: unknown; consented?: unknown; available?: unknown};
        if (!body.signedIn || typeof body.userId !== "string") return null;
        const birthYear = typeof body.birthYear === "number" ? body.birthYear : null;
        const local = isCurrentConsent(storage()?.getItem(aiConsentAccountKey(body.userId)));
        return {
            userId: body.userId,
            birthYear,
            band: isAgeBand(body.band) ? body.band : ageBandFor(birthYear),
            consented: body.consented === true || local,
            available: body.available === true
        };
    } catch {
        return null;
    }
}

async function post(body: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    try {
        const response = await fetch("/api/app/ai-gate", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(body)});
        return await response.json() as Record<string, unknown>;
    } catch {
        return null;
    }
}

export function AiChatGateProvider({words, children}: {words: AiGateWords; children: ReactNode}) {
    const [account, setAccount] = useState<Account | null>(null);
    const [guestConsented, setGuestConsented] = useState(false);
    const [sheet, setSheet] = useState<Sheet | null>(null);
    const [declined, setDeclined] = useState(false);
    const [mounted, setMounted] = useState(false);
    // Under 13: this browser's mark, whether a chat asked for the block, and the account's closing.
    const [restricted, setRestricted] = useState(false);
    const [blockAsked, setBlockAsked] = useState(false);
    const [closing, setClosing] = useState<ClosingState>("idle");
    const pathname = usePathname() ?? "";
    const pending = useRef<((allowed: boolean) => void) | null>(null);
    const loading = useRef<Promise<Account | null> | null>(null);

    const loadAccount = useCallback(() => {
        if (!loading.current) {
            loading.current = readAccount().then((loaded) => {
                if (loaded) {
                    setAccount(loaded);
                    // Agreed in this browser before the backend could keep it: keep it there now.
                    if (loaded.available && isCurrentConsent(storage()?.getItem(aiConsentAccountKey(loaded.userId)))) void post({action: "consent"});
                }
                return loaded;
            });
        }
        return loading.current;
    }, []);

    useEffect(() => {
        setMounted(true);
        setGuestConsented(isCurrentConsent(storage()?.getItem(AI_CONSENT_GUEST_KEY)));
        setRestricted(hasAgeRestrictedMark(document.cookie));
        // An account's band is known before its first message, so an under-13 account is closed at once.
        if (signedIn()) void loadAccount();
    }, [loadAccount]);

    /** Deletes the under-13 account (the route checks the band again), signs out and marks this browser. */
    const closeAccount = useCallback(async () => {
        setClosing("closing");
        const result = await post({action: "close_under_13"});
        if (result?.ok === true) {
            loading.current = Promise.resolve(null);
            setAccount(null);
            setRestricted(true);
            setClosing("closed");
        } else {
            setClosing("failed");
        }
    }, []);

    const accountUnder13 = mounted && account?.band === "under_13" && signedIn();
    useEffect(() => {
        if (accountUnder13 && closing === "idle") void closeAccount();
    }, [accountUnder13, closing, closeAccount]);

    const finish = useCallback((allowed: boolean) => {
        setSheet(null);
        const resolve = pending.current;
        pending.current = null;
        resolve?.(allowed);
    }, []);

    const request = useCallback(async ({ownWords = true}: {ownWords?: boolean} = {}) => {
        // A browser marked under 13 never chats again, signed in or not.
        if (hasAgeRestrictedMark(document.cookie)) {
            setRestricted(true);
            setBlockAsked(true);
            return false;
        }
        if (!signedIn()) {
            if (!ownWords || isCurrentConsent(storage()?.getItem(AI_CONSENT_GUEST_KEY))) return true;
            return new Promise<boolean>((resolve) => {
                pending.current?.(false);
                pending.current = resolve;
                setSheet("consent");
            });
        }
        // Unreadable (offline, or the route failed): only the consent is asked, and kept in this browser.
        const facts = await loadAccount();
        const step = aiGateStep({
            signedIn: true,
            birthYear: facts?.birthYear ?? null,
            band: facts?.band ?? "unknown",
            ageCheckAvailable: facts?.available ?? false,
            consented: facts?.consented ?? isCurrentConsent(storage()?.getItem(AI_CONSENT_GUEST_KEY))
        });
        if (step === "open") return true;
        // Under 13 the full page is already up (the account is being closed): no sheet.
        if (step === "blocked") {
            setBlockAsked(true);
            return false;
        }
        return new Promise<boolean>((resolve) => {
            pending.current?.(false);
            pending.current = resolve;
            setSheet(step);
        });
    }, [loadAccount]);

    /** The account as it now stands, for this render and for the next request (which reads the cached load). */
    const keepAccount = useCallback((next: Account) => {
        loading.current = Promise.resolve(next);
        setAccount(next);
    }, []);

    const afterAge = useCallback((next: Account) => {
        keepAccount(next);
        const step = aiGateStep({signedIn: true, birthYear: next.birthYear, band: next.band, ageCheckAvailable: next.available, consented: next.consented});
        if (step === "open") finish(true);
        else if (step === "blocked") {
            // The route marked this browser; the full page takes over and closes the account.
            setRestricted(true);
            setBlockAsked(true);
            finish(false);
        } else setSheet(step);
    }, [finish, keepAccount]);

    const agree = useCallback(async () => {
        const store = storage();
        if (account && signedIn()) {
            try {
                store?.setItem(aiConsentAccountKey(account.userId), AI_CONSENT_VERSION);
            } catch {
                // Kept on the account below, when the backend has it.
            }
            if (account.available) await post({action: "consent"});
            keepAccount({...account, consented: true});
        } else {
            try {
                store?.setItem(AI_CONSENT_GUEST_KEY, AI_CONSENT_VERSION);
            } catch {
                // Private mode: agreed for this page only.
            }
            setGuestConsented(true);
        }
        setDeclined(false);
        finish(true);
    }, [account, finish, keepAccount]);

    const notNow = useCallback(() => {
        setDeclined(true);
        finish(false);
    }, [finish]);

    const isSignedIn = mounted && signedIn();
    const ready = mounted && (isSignedIn
        ? account !== null && aiGateStep({signedIn: true, birthYear: account.birthYear, band: account.band, ageCheckAvailable: account.available, consented: account.consented}) === "open"
        : guestConsented);
    const band = isSignedIn ? account?.band ?? "unknown" : "unknown";
    const blocked = band === "under_13" || restricted;
    const value = useMemo<AiChatGate>(() => ({ready, request, band, blocked, declined}), [ready, request, band, blocked, declined]);
    // The full page: an under-13 account (while it is closed), or a marked browser on the app, sign-in or a chat.
    const showBlock = mounted && (accountUnder13 || closing !== "idle" || (restricted && (blockAsked || isAgeRestrictedPath(pathname))));

    return (
        <AiChatGateContext.Provider value={value}>
            {children}
            {showBlock ? createPortal(
                <Under13Block words={words} closing={closing} onRetry={() => void closeAccount()} />,
                document.body
            ) : null}
            {mounted && sheet && !showBlock ? createPortal(
                <GateSheet
                    sheet={sheet}
                    words={words}
                    account={account}
                    onAge={afterAge}
                    onAgree={agree}
                    onNotNow={notNow}
                    onClose={() => finish(false)}
                />,
                document.body
            ) : null}
        </AiChatGateContext.Provider>
    );
}

type ClosingState = "idle" | "closing" | "closed" | "failed";

/**
 * "AnimalDex is for ages 13 and up": the whole page, with no way back in.
 * While the account is being closed it says so; if that fails, Try again.
 * Square, like every container; only the button is a capsule.
 */
function Under13Block({words, closing, onRetry}: {words: AiGateWords; closing: ClosingState; onRetry: () => void}) {
    const [before, after] = words.under13Support.split(SUPPORT_EMAIL);
    return (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-canvas-950 px-5" role="alertdialog" aria-modal="true" aria-labelledby="ai-gate-under13-title" data-testid="ai-gate-under13">
            <div className="w-full max-w-[28rem] border border-line-300 bg-canvas-950 p-6">
                <p id="ai-gate-under13-title" className="font-display text-2xl font-bold leading-tight text-white">{words.under13Title}</p>
                <p className="mt-3 text-[15px] leading-6 text-ink-100">{words.under13Body}</p>
                {closing === "closing" ? <p className="mt-4 text-[13px] leading-5 text-ink-300" aria-live="polite">{words.under13Closing}</p> : null}
                {closing === "failed" ? (
                    <>
                        <p className="mt-4 text-[13px] leading-5 text-ink-200" aria-live="polite">{words.under13Failed}</p>
                        <button type="button" onClick={onRetry} className="mt-3 min-h-11 w-full rounded-full bg-primary-400 px-4 text-sm font-black text-canvas-950 transition-colors hover:bg-primary-300">
                            {words.under13Retry}
                        </button>
                    </>
                ) : null}
                <p className="mt-6 text-[12px] leading-5 text-ink-400">
                    {after === undefined ? words.under13Support : (
                        <>
                            {before}
                            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary-200 underline underline-offset-2 hover:text-white">{SUPPORT_EMAIL}</a>
                            {after}
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}

function GateSheet({sheet, words, account, onAge, onAgree, onNotNow, onClose}: {
    sheet: Sheet;
    words: AiGateWords;
    account: Account | null;
    onAge: (next: Account) => void;
    onAgree: () => Promise<void> | void;
    onNotNow: () => void;
    onClose: () => void;
}) {
    const [year, setYear] = useState("");
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);
    const primaryRef = useRef<HTMLButtonElement | HTMLSelectElement | null>(null);
    const years = useMemo(() => birthYearOptions(), []);

    useEffect(() => {
        primaryRef.current?.focus();
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            if (sheet === "consent") onNotNow();
            else onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [sheet, onNotNow, onClose]);

    const submitAge = async () => {
        const value = Number(year);
        if (!account || !Number.isInteger(value)) return;
        setBusy(true);
        setFailed(false);
        const result = await post({action: "birth_year", year: value});
        setBusy(false);
        if (result?.ok === true) {
            const birthYear = typeof result.birthYear === "number" ? result.birthYear : value;
            onAge({...account, birthYear, band: isAgeBand(result.band) ? result.band : ageBandFor(birthYear)});
        } else if (result?.missing === true) {
            // The backend cannot keep it yet: no age check until it can.
            onAge({...account, available: false});
        } else {
            setFailed(true);
        }
    };

    const titleId = `ai-gate-${sheet}-title`;
    const more = words.consentMore.split(/(\{privacy\}|\{safety\})/);
    return (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center" data-testid="ai-gate-sheet" data-sheet={sheet}>
            <button type="button" aria-label={words.close} tabIndex={-1} onClick={sheet === "consent" ? onNotNow : onClose} className="absolute inset-0 bg-black/60" />
            <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative w-full max-w-[28rem] border border-line-300 bg-canvas-950 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 shadow-[0_-18px_60px_rgba(0,0,0,0.45)] sm:pb-5">
                {sheet === "consent" ? (
                    <>
                        <p className="flex items-center gap-2">
                            <span className="inline-flex h-5 items-center border border-primary-300/60 px-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-primary-200">AI</span>
                            <span id={titleId} className="font-display text-xl font-bold leading-tight text-white">{words.consentTitle}</span>
                        </p>
                        <p className="mt-3 text-[15px] leading-6 text-ink-100">{words.consentBody}</p>
                        <p className="mt-2 text-[13px] leading-5 text-ink-300">
                            {more.map((part, index) => part === "{privacy}"
                                ? <Link key={index} href={PRIVACY_HREF} className="text-primary-200 underline underline-offset-2 hover:text-white">{words.consentPrivacy}</Link>
                                : part === "{safety}"
                                    ? <Link key={index} href={AI_SAFETY_HREF} className="text-primary-200 underline underline-offset-2 hover:text-white">{words.consentSafety}</Link>
                                    : <span key={index}>{part}</span>)}
                        </p>
                        <div className="mt-5 grid grid-cols-2 gap-2">
                            <button type="button" onClick={onNotNow} className="min-h-11 rounded-full border border-line-100 px-4 text-sm font-bold text-ink-100 transition-colors hover:border-primary-400 hover:text-white">
                                {words.consentNotNow}
                            </button>
                            <button
                                ref={(node) => {
                                    primaryRef.current = node;
                                }}
                                type="button"
                                disabled={busy}
                                onClick={async () => {
                                    setBusy(true);
                                    await onAgree();
                                    setBusy(false);
                                }}
                                className="min-h-11 rounded-full bg-primary-400 px-4 text-sm font-black text-canvas-950 transition-colors hover:bg-primary-300 disabled:opacity-60"
                                data-testid="ai-gate-agree"
                            >
                                {words.consentAgree}
                            </button>
                        </div>
                    </>
                ) : sheet === "age" ? (
                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                            void submitAge();
                        }}
                    >
                        <p id={titleId} className="font-display text-xl font-bold leading-tight text-white">{words.ageTitle}</p>
                        <label className="mt-3 block text-[15px] leading-6 text-ink-100" htmlFor="ai-gate-year">{words.ageBody}</label>
                        <select
                            id="ai-gate-year"
                            ref={(node) => {
                                primaryRef.current = node;
                            }}
                            aria-label={words.ageYearLabel}
                            value={year}
                            onChange={(event) => setYear(event.target.value)}
                            className="mt-3 min-h-11 w-full border border-line-200 bg-canvas-900 px-3 text-base text-white focus:border-primary-400 focus:outline-none"
                            data-testid="ai-gate-year"
                        >
                            <option value="">{words.ageYearLabel}</option>
                            {years.map((option) => <option key={option} value={option}>{option}</option>)}
                        </select>
                        <p className="mt-2 text-[12px] leading-5 text-ink-400">{failed ? words.ageFailed : words.ageNote}</p>
                        <div className="mt-5 grid grid-cols-2 gap-2">
                            <button type="button" onClick={onClose} className="min-h-11 rounded-full border border-line-100 px-4 text-sm font-bold text-ink-100 transition-colors hover:border-primary-400 hover:text-white">
                                {words.consentNotNow}
                            </button>
                            <button type="submit" disabled={busy || !year} className="min-h-11 rounded-full bg-primary-400 px-4 text-sm font-black text-canvas-950 transition-colors hover:bg-primary-300 disabled:opacity-50" data-testid="ai-gate-continue">
                                {words.ageContinue}
                            </button>
                        </div>
                    </form>
                ) : (
                    <>
                        <p id={titleId} className="font-display text-xl font-bold leading-tight text-white">{words.under13Title}</p>
                        <p className="mt-3 text-[15px] leading-6 text-ink-100">{words.under13Body}</p>
                        <div className="mt-5">
                            <button
                                ref={(node) => {
                                    primaryRef.current = node;
                                }}
                                type="button"
                                onClick={onClose}
                                className="min-h-11 w-full rounded-full border border-line-100 px-4 text-sm font-bold text-ink-100 transition-colors hover:border-primary-400 hover:text-white"
                            >
                                {words.close}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
