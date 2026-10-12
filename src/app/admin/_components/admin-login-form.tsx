"use client";

import {FormEvent, useState} from "react";
import {useRouter} from "next/navigation";
import {Alert, Button, Field, fieldClass} from "@/components/admin/ui";

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
        <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_50%_0%,rgba(33,192,94,.10),transparent_40%)] px-4">
            <div className="w-full max-w-sm">
                <div className="mb-6 flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center bg-primary-400 text-lg font-black text-canvas-950">A</span>
                    <span>
                        <span className="block font-display text-lg leading-tight text-white">AnimalDex</span>
                        <span className="block text-[10px] font-black uppercase tracking-[.18em] text-ink-500">Operations</span>
                    </span>
                </div>
                <form onSubmit={submit} className="border border-line-300 bg-surface-900 p-6 shadow-2xl">
                    <h1 className="font-display text-2xl text-white">Sign in</h1>
                    <p className="mt-1 text-sm leading-6 text-ink-400">This area is for AnimalDex operators.</p>
                    <Field label="Password" className="mt-6">
                        <input
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Admin password"
                            autoComplete="current-password"
                            autoFocus
                            className={`${fieldClass} py-2.5`}
                        />
                    </Field>
                    <Button type="submit" variant="primary" size="lg" loading={submitting} disabled={!password} className="mt-4 w-full">
                        {submitting ? "Signing in…" : "Sign in"}
                    </Button>
                    {error ? (
                        <Alert tone="bad" className="mt-4">
                            {error}
                        </Alert>
                    ) : null}
                </form>
            </div>
        </main>
    );
}
