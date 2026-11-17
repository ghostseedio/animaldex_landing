"use client";

import {useEffect, useState} from "react";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";
import {createSupabaseBrowserClient} from "@/lib/supabase/client";
import {
    parseTermsStatus,
    rememberTermsAccepted,
    termsGateBlocks,
    type TermsStatus,
    UPDATED_TERMS_WORDS as words
} from "@/lib/updated-terms";

function browserStorage(): Storage | null {
    try {
        return window.localStorage;
    } catch {
        return null;
    }
}

/**
 * Blocks the signed-in app until the current Terms of Use are agreed (server
 * row, `terms_status_v1` / `accept_terms_v1`). No close control: the only way
 * on is "I Agree". Unreadable status never blocks (see updated-terms.ts).
 */
export default function UpdatedTermsGate({preview = null}: {preview?: TermsStatus | null}) {
    const [status, setStatus] = useState<TermsStatus | null>(preview);
    const [userId, setUserId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        if (preview) return;
        const supabase = createSupabaseBrowserClient();
        if (!supabase) return;
        let cancelled = false;
        (async () => {
            const {data: sessionData} = await supabase.auth.getSession();
            const id = sessionData.session?.user.id ?? null;
            if (!id || cancelled) return;
            setUserId(id);
            const {data, error} = await supabase.rpc("terms_status_v1");
            if (cancelled || error) return;
            setStatus(parseTermsStatus(data));
        })().catch(() => {
            // Offline or the RPC is not there yet: let the person in, ask on the next load.
        });
        return () => {
            cancelled = true;
        };
    }, [preview]);

    useEffect(() => {
        if (!termsGateBlocks(status)) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [status]);

    if (!termsGateBlocks(status) || !status) return null;

    async function agree() {
        if (!status || saving) return;
        if (preview) {
            setStatus({...status, accepted: true});
            return;
        }
        setSaving(true);
        setFailed(false);
        const supabase = createSupabaseBrowserClient();
        try {
            const result = await supabase?.rpc("accept_terms_v1", {p_version: status.version, p_platform: "web"});
            if (!result || result.error) {
                if (result?.error?.message?.includes("terms_version_outdated")) {
                    const fresh = await supabase?.rpc("terms_status_v1");
                    const next = parseTermsStatus(fresh?.data);
                    if (next) setStatus(next);
                }
                setFailed(true);
                return;
            }
            const accepted = parseTermsStatus(result.data);
            if (userId) rememberTermsAccepted(browserStorage(), userId, status.version);
            setStatus(accepted ?? {...status, accepted: true});
        } catch {
            setFailed(true);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-[1000] flex items-center justify-center overflow-y-auto bg-[#090909] px-4 py-10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="updated-terms-title"
            data-testid="updated-terms"
        >
            <div className="flex w-full max-w-xl flex-col gap-5">
                <span className="text-primary-400"><AppIcon name="check" className="h-9 w-9"/></span>
                <div className="flex flex-col gap-2.5">
                    <h2 id="updated-terms-title" className="font-display text-3xl font-bold text-white">{words.title}</h2>
                    <p className="text-sm leading-6 text-white/60">{words.lead}</p>
                </div>
                <ul className="flex flex-col gap-3 border-y border-white/10 py-4">
                    {words.rules.map((rule) => (
                        <li key={rule} className="flex gap-2.5 text-sm leading-6 text-white/80">
                            <span className="mt-0.5 shrink-0 text-primary-400"><AppIcon name="check" className="h-4 w-4"/></span>
                            {rule}
                        </li>
                    ))}
                </ul>
                <p className="text-xs leading-5 text-white/50">
                    {words.legalPrefix}{" "}
                    <a href="/legal/terms" target="_blank" rel="noreferrer" className="font-bold text-primary-200 underline underline-offset-2">{words.termsOfUse}</a>
                    {" "}{words.and}{" "}
                    <a href="/legal/privacy" target="_blank" rel="noreferrer" className="font-bold text-primary-200 underline underline-offset-2">{words.privacyPolicy}</a>.
                </p>
                {failed ? <p className="text-sm text-red-300" role="alert">{words.failed}</p> : null}
                <button
                    type="button"
                    onClick={agree}
                    disabled={saving}
                    className="min-h-14 w-full rounded-full bg-primary-400 px-6 text-base font-black text-black/90 disabled:opacity-60"
                    data-testid="updated-terms-agree"
                >
                    {saving ? words.agreeing : words.agree}
                </button>
                <p className="text-center text-xs text-white/40">{words.footnote}</p>
            </div>
        </div>
    );
}
