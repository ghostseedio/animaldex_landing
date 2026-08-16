"use client";

import {FormEvent, useState} from "react";
import {useRouter} from "next/navigation";

/**
 * The password prompt shown in place of an admin page.
 *
 * On success the page is re-rendered on the server rather than revealed on the
 * client, so the gated content is only ever sent to a request that already
 * carries the session cookie.
 */
export default function AdminLoginForm() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    async function submit(event: FormEvent) {
        event.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            const response = await fetch("/api/admin/support/login", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({password})
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok || !payload.ok) {
                setError(payload.error || "Unable to sign in");
                return;
            }

            setPassword("");
            router.refresh();
        } catch {
            setError("Unable to sign in");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="grid min-h-screen place-items-center px-4">
            <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-line-300 bg-surface-900 p-6">
                <p className="text-xs font-black uppercase tracking-[.2em] text-primary-200">AnimalDex admin</p>
                <h1 className="mt-2 font-display text-3xl text-white">Sign in</h1>
                <p className="mt-2 text-sm leading-6 text-ink-400">This area is for AnimalDex operators.</p>
                <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Admin password"
                    autoFocus
                    className="mt-6 w-full rounded-xl border border-line-300 bg-canvas-900 px-4 py-3 text-white outline-none focus:border-primary-300"
                />
                <button
                    type="submit"
                    disabled={submitting || !password}
                    className="mt-3 w-full rounded-xl bg-primary-500 py-3 font-black text-canvas-950 disabled:opacity-40"
                >
                    {submitting ? "Signing in…" : "Sign in"}
                </button>
                {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
            </form>
        </main>
    );
}
