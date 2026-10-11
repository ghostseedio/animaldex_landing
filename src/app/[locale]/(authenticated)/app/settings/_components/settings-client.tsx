"use client";

import {useEffect, useState} from "react";
import {useRouter} from "next/navigation";
import {
    CURRENCY_PREFERENCE_COOKIE,
    CURRENCY_SYSTEM_VALUE,
    DISPLAY_CURRENCY_CODES,
    LOCATION_VISIBILITY_OPTIONS,
    type LocationVisibility,
    PASSWORD_MAX_LENGTH,
    PUSH_PREFERENCE_ROWS,
    type PushPreferences,
    currencyDisplayName,
    passwordChangeProblem
} from "@/lib/account-settings";
import {connectionStatusLabel, INSTAGRAM_IMPORT_PATH, type ExternalImportConnectionRow} from "@/lib/instagram-import";
import {
    SelectedMark,
    SettingsActionRow,
    SettingsDestructiveRow,
    SettingsDivider,
    SettingsIcons,
    SettingsNavigationRow,
    SettingsSection,
    SettingsToggleRow
} from "@/app/[locale]/(authenticated)/app/settings/_components/settings-ui";

async function postSetting(body: Record<string, unknown>) {
    const response = await fetch("/api/app/settings", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as {error?: string};
        throw new Error(payload.error ?? "Couldn't save that setting.");
    }
}

// MARK: - Root rows

const SOUND_KEY = "animaldex.soundEffectsEnabled";

/** iOS "Sound Effects": the web's matchup sounds read the same switch. */
export function SoundEffectsRow() {
    const [enabled, setEnabled] = useState(true);
    useEffect(() => {
        try {
            setEnabled(window.localStorage.getItem(SOUND_KEY) !== "false");
        } catch {
            // Storage can be unavailable in private windows.
        }
    }, []);
    return (
        <SettingsToggleRow
            icon={SettingsIcons.speaker}
            title="Sound Effects"
            checked={enabled}
            onChange={(next) => {
                setEnabled(next);
                try {
                    window.localStorage.setItem(SOUND_KEY, String(next));
                } catch {
                    // Not remembered; the switch still applies to this page.
                }
            }}
        />
    );
}

/** iOS `InstagramSettingsConnectionRow`. */
export function InstagramRow() {
    const [label, setLabel] = useState("Checking…");
    useEffect(() => {
        let active = true;
        fetch("/api/app/import", {cache: "no-store"})
            .then((response) => response.json() as Promise<{connection?: ExternalImportConnectionRow | null}>)
            .then((payload) => {
                if (active) setLabel(connectionStatusLabel(payload.connection ?? null));
            })
            .catch(() => {
                if (active) setLabel("Not connected");
            });
        return () => {
            active = false;
        };
    }, []);
    return <SettingsNavigationRow href={INSTAGRAM_IMPORT_PATH} icon={SettingsIcons.instagram} title="Instagram" value={label} />;
}

// MARK: - Location privacy

export function LocationPrivacyList({initial}: {initial: LocationVisibility}) {
    const [visibility, setVisibility] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function save(next: LocationVisibility) {
        if (next === visibility || saving) return;
        const previous = visibility;
        setVisibility(next);
        setSaving(true);
        setError(null);
        try {
            await postSetting({action: "locationVisibility", value: next});
        } catch (failure) {
            setVisibility(previous);
            setError(failure instanceof Error ? failure.message : "Couldn't save that setting.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <SettingsSection
            title="WHO CAN SEE CAPTURE LOCATIONS"
            footer={error ?? "This controls the place shown on your public captures. It does not change what AnimalDex stores for your own collection."}
        >
            {LOCATION_VISIBILITY_OPTIONS.map((option, index) => (
                <div key={option.id}>
                    {index > 0 ? <SettingsDivider /> : null}
                    <SettingsActionRow
                        icon={visibility === option.id ? <SelectedMark selected /> : SettingsIcons.pin}
                        title={option.title}
                        onClick={() => void save(option.id)}
                        disabled={saving}
                    />
                </div>
            ))}
        </SettingsSection>
    );
}

// MARK: - Notifications

export function PushPreferencesList({initial}: {initial: PushPreferences}) {
    const [preferences, setPreferences] = useState(initial);
    const [error, setError] = useState<string | null>(null);
    const icons: Record<keyof PushPreferences, React.ReactNode> = {
        captureUpdates: SettingsIcons.photo,
        socialActivity: SettingsIcons.people,
        directMessages: SettingsIcons.message,
        creditBonuses: SettingsIcons.credits
    };

    async function toggle(key: keyof PushPreferences, enabled: boolean) {
        const previous = preferences;
        setPreferences({...preferences, [key]: enabled});
        setError(null);
        try {
            await postSetting({action: "push", key, enabled});
        } catch (failure) {
            setPreferences(previous);
            setError(failure instanceof Error ? failure.message : "Couldn't save that setting.");
        }
    }

    return (
        <SettingsSection
            title="ALERT TYPES"
            footer={error ?? "Turning these off stops the alert only. Capture, activity, and Credit bonus updates still appear in your notifications list. Messages stay in Messages."}
        >
            {PUSH_PREFERENCE_ROWS.map((row, index) => (
                <div key={row.id}>
                    {index > 0 ? <SettingsDivider /> : null}
                    <SettingsToggleRow
                        icon={icons[row.id]}
                        title={row.title}
                        subtitle={row.subtitle}
                        checked={preferences[row.id]}
                        onChange={(next) => void toggle(row.id, next)}
                    />
                </div>
            ))}
        </SettingsSection>
    );
}

// MARK: - Currency

export function CurrencyList({preference, systemCurrency}: {preference: string; systemCurrency: string}) {
    const router = useRouter();
    const [current, setCurrent] = useState(preference.toLowerCase() === CURRENCY_SYSTEM_VALUE ? CURRENCY_SYSTEM_VALUE : preference.toUpperCase());

    function choose(value: string) {
        setCurrent(value);
        document.cookie = `${CURRENCY_PREFERENCE_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
    }

    const isSystem = current === CURRENCY_SYSTEM_VALUE;
    return (
        <>
            <SettingsSection footer="Price estimates are shown in this currency. Values are converted from a fixed reference rate, not a live exchange rate.">
                <SettingsActionRow
                    icon={isSystem ? <SelectedMark selected /> : SettingsIcons.globe}
                    title={`System (${systemCurrency})`}
                    onClick={() => choose(CURRENCY_SYSTEM_VALUE)}
                />
            </SettingsSection>
            <SettingsSection title="ALL CURRENCIES">
                {DISPLAY_CURRENCY_CODES.map((code, index) => (
                    <div key={code}>
                        {index > 0 ? <SettingsDivider /> : null}
                        <SettingsActionRow
                            icon={!isSystem && current === code ? <SelectedMark selected /> : <span className="text-sm font-black">¤</span>}
                            title={`${code} · ${currencyDisplayName(code)}`}
                            onClick={() => choose(code)}
                        />
                    </div>
                ))}
            </SettingsSection>
        </>
    );
}

// MARK: - Account

export function ChangePasswordForm() {
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirm, setConfirm] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    async function submit(event: React.FormEvent) {
        event.preventDefault();
        const problem = passwordChangeProblem({current, next, confirm});
        if (problem) {
            setError(problem);
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const response = await fetch("/api/app/account/password", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({current, next, confirm})
            });
            const payload = await response.json().catch(() => ({})) as {error?: string};
            if (!response.ok) throw new Error(payload.error ?? "Couldn't update your password.");
            setDone(true);
            setCurrent("");
            setNext("");
            setConfirm("");
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Couldn't update your password.");
        } finally {
            setSaving(false);
        }
    }

    const field = "w-full border border-white/10 bg-black/40 px-3.5 py-3 text-[15px] text-white outline-none placeholder:text-white/30 focus:border-primary-400/60";
    return (
        <form onSubmit={submit} className="space-y-3">
            <p className="text-sm text-white/55">Enter your current password, then choose a new one.</p>
            <input type="password" autoComplete="current-password" placeholder="Current password" value={current} onChange={(event) => setCurrent(event.target.value)} className={field} />
            <input type="password" autoComplete="new-password" placeholder="New password" maxLength={PASSWORD_MAX_LENGTH} value={next} onChange={(event) => setNext(event.target.value)} className={field} />
            <input type="password" autoComplete="new-password" placeholder="Confirm new password" maxLength={PASSWORD_MAX_LENGTH} value={confirm} onChange={(event) => setConfirm(event.target.value)} className={field} />
            <p className="text-xs text-white/40">Use 8–128 characters. Avoid obvious passwords.</p>
            {error ? <p className="text-sm text-red-300" role="alert">{error}</p> : null}
            {done ? <p className="text-sm text-primary-200" role="status">Password updated.</p> : null}
            <button type="submit" disabled={saving} className="w-full rounded-full bg-primary-400 py-3 text-[15px] font-black text-black transition hover:brightness-105 disabled:opacity-50">
                {saving ? "Updating…" : "Update password"}
            </button>
        </form>
    );
}

export function SignOutRow() {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return (
        <SettingsSection footer={error ?? undefined}>
            <SettingsDestructiveRow
                icon={SettingsIcons.signOut}
                title={busy ? "Signing out..." : "Sign Out"}
                busy={busy}
                disabled={busy}
                onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                        const response = await fetch("/api/auth/logout", {method: "POST"});
                        if (!response.ok) throw new Error("Couldn't sign out.");
                        router.push("/account");
                        router.refresh();
                    } catch (failure) {
                        setError(failure instanceof Error ? failure.message : "Couldn't sign out.");
                        setBusy(false);
                    }
                }}
            />
        </SettingsSection>
    );
}

export function DeleteAccountRow() {
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function remove() {
        setConfirming(false);
        setBusy(true);
        setError(null);
        try {
            const response = await fetch("/api/app/account/delete", {method: "POST"});
            const payload = await response.json().catch(() => ({})) as {error?: string};
            if (!response.ok) throw new Error(payload.error ?? "Account deletion failed.");
            await fetch("/api/auth/logout", {method: "POST"}).catch(() => undefined);
            router.push("/");
            router.refresh();
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Account deletion failed.");
            setBusy(false);
        }
    }

    return (
        <>
            <SettingsSection footer={error ?? "Deleting your account removes your profile, captures, community content, messages, and associated AnimalDex data from our records unless retention is legally required."}>
                <SettingsDestructiveRow
                    icon={SettingsIcons.trash}
                    title={busy ? "Deleting Account..." : "Delete Account"}
                    prominent
                    busy={busy}
                    disabled={busy}
                    onClick={() => setConfirming(true)}
                />
            </SettingsSection>
            {confirming ? (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 md:items-center" role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title">
                    <div className="w-full max-w-sm border border-white/10 bg-[#1c1c1c] p-5 text-center">
                        <h2 id="delete-account-title" className="text-[17px] font-bold text-white">Delete your AnimalDex account?</h2>
                        <p className="mt-2 text-sm text-white/60">
                            This permanently deletes your profile and associated AnimalDex data. Active App Store subscriptions must be cancelled from your Apple account. A web subscription can be cancelled from Credits &amp; Unlocks → Manage subscription.
                        </p>
                        <div className="mt-5 grid gap-2">
                            <button type="button" onClick={() => void remove()} className="rounded-full bg-red-500 py-3 text-[15px] font-black text-white">Delete Account</button>
                            <button type="button" onClick={() => setConfirming(false)} className="rounded-full border border-white/10 py-3 text-[15px] font-bold text-white">Cancel</button>
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
}
