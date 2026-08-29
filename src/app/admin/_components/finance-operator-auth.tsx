"use client";

import {FormEvent, useCallback, useEffect, useState} from "react";
import {useRouter} from "next/navigation";

export type FinanceActorStatus = {
    kind: "named_email" | "shared_password" | "none";
    email: string | null;
    canActAsFinanceActor: boolean;
};

/**
 * Finance operations are gated on a *named* human operator — a Supabase auth
 * session whose email is in the admin list — never the shared support-password
 * session. This hook surfaces which kind of actor the current request resolves
 * to so the finance UI can prompt for (and disable actions without) a named
 * operator without weakening the server-side boundary.
 */
export function useFinanceActor() {
    const router = useRouter();
    const [actor, setActor] = useState<FinanceActorStatus | null>(null);
    const [loaded, setLoaded] = useState(false);

    const refresh = useCallback(async () => {
        try {
            const response = await fetch("/api/admin/auth/status", {cache: "no-store"});
            const body = await response.json().catch(() => ({}));
            setActor(body.actor ?? null);
        } catch {
            // Leave the previous actor in place on transient failures.
        } finally {
            setLoaded(true);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const signedIn = useCallback(() => {
        router.refresh();
        void refresh();
    }, [refresh, router]);

    return {actor, loaded, refresh, signedIn};
}

export function FinanceOperatorSignInCard({onSignedIn}: {onSignedIn: () => void}) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch("/api/admin/auth/finance/login", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({email: email.trim(), password})
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
                setError(payload.error || "Unable to sign in");
                return;
            }

            setPassword("");
            onSignedIn();
        } catch {
            setError("Unable to sign in");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <form
            onSubmit={submit}
            className="mt-4 grid gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-4 sm:grid-cols-2"
        >
            <p className="text-sm text-amber-100 sm:col-span-2">
                Finance operations require a <strong>named operator</strong> — sign in with your
                operator email to approve payouts. The shared admin password cannot approve payouts.
            </p>
            <label className="text-xs text-ink-400">
                Operator email
                <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 w-full rounded border border-white/15 bg-black px-2 py-1.5 text-sm text-white"
                />
            </label>
            <label className="text-xs text-ink-400">
                Password
                <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Operator password"
                    className="mt-1 w-full rounded border border-white/15 bg-black px-2 py-1.5 text-sm text-white"
                />
            </label>
            {error && <p className="text-sm text-rose-300 sm:col-span-2">{error}</p>}
            <div className="sm:col-span-2">
                <button
                    type="submit"
                    disabled={submitting || !email || !password}
                    className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-bold text-canvas-950 disabled:opacity-50"
                >
                    {submitting ? "Signing in…" : "Sign in as named finance operator"}
                </button>
            </div>
        </form>
    );
}
