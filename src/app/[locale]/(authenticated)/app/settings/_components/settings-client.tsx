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
    RECORD_PRIVACY_SECTIONS,
    type RecordPrivacy,
    type RecordPrivacySection,
    currencyDisplayName,
    passwordChangeProblem
} from "@/lib/account-settings";
import {connectionStatusLabel, INSTAGRAM_IMPORT_PATH, type ExternalImportConnectionRow} from "@/lib/instagram-import";
import {setDebateRoster} from "@/components/debates/use-debates";
import {debateProblemText} from "@/lib/debate-words";
import type {CompanionWords} from "@/lib/companion-bond";
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
import {AppRequestError} from "@/lib/user-facing-error";
import {askSessionStore} from "@/components/ask-animaldex/ask-session-store";
import {forgetAllTalkThreads} from "@/components/ask-animaldex/ask-thread-meta";
import {useUserFacingError} from "@/app/[locale]/(authenticated)/app/_components/app-shell-chrome";
import {arkFounderSwitch, decodeArkFounderSettings, type ArkFounderSettings} from "@/lib/ark-founders";
import type {ArkFoundersWords} from "@/lib/ark-words";
import {ArkBroughtByFounder} from "@/components/ark/ark-founder-bits";

async function postSetting(body: Record<string, unknown>) {
    const response = await fetch("/api/app/settings", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as {error?: string};
        throw new AppRequestError(response.status, payload.error ?? null);
    }
}

// MARK: - Root rows

const SOUND_KEY = "animaldex.soundEffectsEnabled";

/** iOS "Sound Effects": the web's own sounds read the same switch. */
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

/**
 * 3.2 Debates (docs/debates/SPEC.md, section 4): "Let my animals join public
 * debates", on by default since the owner's change of 2026-10-31 (no row is
 * opted in), so this is an opt-out. Only animals with their Power earned
 * join; each debate puts a heart on it. The server's answer is what shows,
 * and an unread state is never taken as off.
 */
export function DebateRosterSection({initial, words}: {initial: boolean | null; words: CompanionWords}) {
    const [optedIn, setOptedIn] = useState(initial !== false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    return (
        <SettingsSection title={words.debates.tab.toUpperCase()} footer={error ?? undefined}>
            <SettingsToggleRow
                icon={SettingsIcons.people}
                title={words.roster.optIn}
                subtitle={words.roster.optInNote}
                checked={optedIn}
                disabled={saving}
                onChange={(next) => {
                    setOptedIn(next);
                    setSaving(true);
                    setError(null);
                    void setDebateRoster(next).then((result) => {
                        setSaving(false);
                        if (result.ok) {
                            setOptedIn(result.value);
                        } else {
                            setOptedIn(!next);
                            setError(debateProblemText(result.code, words));
                        }
                    });
                }}
            />
        </SettingsSection>
    );
}

async function saveArkFounderName(show: boolean): Promise<{settings: ArkFounderSettings} | {refusal: "adult_confirmation_required" | "under_18" | null}> {
    try {
        const response = await fetch("/api/ark/founder-settings", {
            method: "POST",
            headers: {"Content-Type": "application/json", Accept: "application/json"},
            body: JSON.stringify({show}),
            cache: "no-store"
        });
        const body = await response.json().catch(() => null) as {settings?: unknown; error?: unknown} | null;
        const settings = response.ok ? decodeArkFounderSettings(body?.settings) : null;
        if (settings) return {settings};
        return {refusal: body?.error === "adult_confirmation_required" || body?.error === "under_18" ? body.error : null};
    } catch {
        return {refusal: null};
    }
}

/**
 * "Show my name on my Ark animals" (founders contract, section 3; owner,
 * 2026-11-11): an opt-out, on by default. Every person with a handle shows on
 * the animals they bring as their @username, linked to their profile (private
 * profiles too), with no 18+ step; turning it off shows them as a Voyager
 * number. Shown only while the server names founders (`enabled`). Blocked (a
 * stored under-18 year, no @handle): off and disabled, with the reason. It
 * calls `set_voyage_founder_name_v1(p_show)` and follows `show_name`.
 */
export function ArkFounderNameSection({initial, title, words, broughtBy}: {initial: ArkFounderSettings; title: string; words: ArkFoundersWords["settings"]; broughtBy: string}) {
    const [settings, setSettings] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);
    const describeError = useUserFacingError();
    const {checked, disabled} = arkFounderSwitch(settings);
    const blockedNote = settings.blocked === "under_18" ? words.under18 : settings.blocked === "no_handle" ? words.noHandle : null;
    const save = (show: boolean) => {
        const previous = settings;
        setSettings({...settings, show_name: show, chosen: true});
        setSaving(true);
        setFailed(false);
        void saveArkFounderName(show).then((result) => {
            setSaving(false);
            if ("settings" in result) {
                setSettings(result.settings);
                return;
            }
            setSettings(previous);
            setFailed(true);
        });
    };
    /** On or off, in one tap: no 18+ step for a name (owner, 2026-11-11). */
    const turnOn = () => save(true);
    return (
        <SettingsSection title={title.toUpperCase()} footer={failed ? describeError(new Error("ark_founder_name")) : undefined}>
            <SettingsToggleRow
                icon={SettingsIcons.person}
                title={words.title}
                subtitle={blockedNote ?? words.note}
                checked={checked}
                disabled={disabled || saving}
                onChange={(next) => (next ? turnOn() : save(false))}
            />
            {checked && settings.founder ? (
                <>
                    <SettingsDivider />
                    <div className="flex min-h-11 items-center px-4 py-2.5 pl-[54px] text-[13px]" data-testid="ark-founder-preview">
                        <ArkBroughtByFounder template={broughtBy} founder={settings.founder} textClassName="text-white/45" />
                    </div>
                </>
            ) : null}
        </SettingsSection>
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
    const describeError = useUserFacingError();
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
            setError(describeError(failure));
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

// MARK: - Chat history

const CHAT_HISTORY_NOTE = "Your conversations with animals are saved to your account so they're on every device. Turn this off to keep new chats on this device only.";
const CHAT_HISTORY_CONFIRM = "Delete every conversation with your animals? This can't be undone.";

/**
 * iOS `AnimalChatHistorySection` (docs/chat-sync/SPEC.md, section 3): keep
 * chats on every device, and delete every thread on the account, then this
 * browser's copy. Shown once the account's answer is in, as iOS does.
 */
export function ChatHistorySection() {
    const [historySync, setHistorySync] = useState<boolean | null>(null);
    const [saving, setSaving] = useState(false);
    const [deletion, setDeletion] = useState<"idle" | "confirming" | "deleting" | "done">("idle");
    const [problem, setProblem] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        void fetch("/api/ask/memory", {headers: {Accept: "application/json"}})
            .then((response) => (response.ok ? response.json() as Promise<{settings?: {historySync?: boolean | null}}> : null))
            .then((payload) => {
                const value = payload?.settings?.historySync;
                if (!cancelled && typeof value === "boolean") setHistorySync(value);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    async function setSync(next: boolean) {
        const previous = historySync;
        setHistorySync(next);
        setSaving(true);
        setProblem(null);
        try {
            const response = await fetch("/api/ask/memory", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "preferences", historySync: next})
            });
            if (!response.ok) throw new Error(String(response.status));
        } catch {
            setHistorySync(previous);
            setProblem("Something went wrong. Try again.");
        } finally {
            setSaving(false);
        }
    }

    async function deleteAll() {
        setDeletion("deleting");
        setProblem(null);
        try {
            const response = await fetch("/api/ask/history", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({action: "deleteAll"})
            });
            const payload = await response.json().catch(() => null) as {ok?: boolean} | null;
            if (!response.ok || payload?.ok !== true) throw new Error(String(response.status));
            askSessionStore.clearAnimalThreads();
            forgetAllTalkThreads();
            setDeletion("done");
        } catch {
            setDeletion("idle");
            setProblem("Something went wrong. Try again.");
        }
    }

    if (historySync === null) return null;
    return (
        <SettingsSection title="Chat history" footer={problem ?? undefined}>
            <SettingsToggleRow
                icon={SettingsIcons.cloud}
                title="Keep my chats on all my devices"
                subtitle={CHAT_HISTORY_NOTE}
                checked={historySync}
                onChange={(next) => void setSync(next)}
                disabled={saving}
            />
            <SettingsDivider />
            {deletion === "confirming" ? (
                <div className="space-y-3 px-4 py-3">
                    <p className="text-[13px] leading-5 text-white/70">{CHAT_HISTORY_CONFIRM}</p>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => void deleteAll()} className="min-h-10 flex-1 rounded-pill bg-red-500/90 px-4 text-sm font-bold text-white">Delete chat history</button>
                        <button type="button" onClick={() => setDeletion("idle")} className="min-h-10 flex-1 rounded-pill border border-white/15 px-4 text-sm font-bold text-white">Cancel</button>
                    </div>
                </div>
            ) : (
                <SettingsDestructiveRow
                    icon={SettingsIcons.trash}
                    title={deletion === "done" ? "Delete chat history · Done" : "Delete chat history"}
                    onClick={() => setDeletion("confirming")}
                    busy={deletion === "deleting"}
                    disabled={deletion === "deleting"}
                />
            )}
        </SettingsSection>
    );
}

// MARK: - Record privacy

/** iOS `SettingsPlayRecordPrivacyView`: one audience per part of the Record. */
export function RecordPrivacyList({initial}: {initial: RecordPrivacy}) {
    const describeError = useUserFacingError();
    const [privacy, setPrivacy] = useState(initial);
    const [saving, setSaving] = useState<RecordPrivacySection | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function save(section: RecordPrivacySection, next: LocationVisibility) {
        if (next === privacy[section] || saving) return;
        const previous = privacy;
        setPrivacy({...privacy, [section]: next});
        setSaving(section);
        setError(null);
        try {
            await postSetting({action: "recordPrivacy", key: section, value: next});
        } catch (failure) {
            setPrivacy(previous);
            setError(describeError(failure));
        } finally {
            setSaving(null);
        }
    }

    return (
        <>
            {RECORD_PRIVACY_SECTIONS.map((section) => (
                <SettingsSection key={section.id} title={section.header} footer={error && saving === null ? error : section.footer}>
                    {LOCATION_VISIBILITY_OPTIONS.map((option, index) => (
                        <div key={option.id}>
                            {index > 0 ? <SettingsDivider /> : null}
                            <SettingsActionRow
                                icon={<SelectedMark selected={privacy[section.id] === option.id} />}
                                title={option.title}
                                onClick={() => void save(section.id, option.id)}
                                disabled={saving !== null}
                            />
                        </div>
                    ))}
                </SettingsSection>
            ))}
        </>
    );
}

// MARK: - Notifications

export function PushPreferencesList({initial}: {initial: PushPreferences}) {
    const describeError = useUserFacingError();
    const [preferences, setPreferences] = useState(initial);
    const [error, setError] = useState<string | null>(null);
    const icons: Record<keyof PushPreferences, React.ReactNode> = {
        captureUpdates: SettingsIcons.photo,
        socialActivity: SettingsIcons.people,
        directMessages: SettingsIcons.message,
        animalMessages: SettingsIcons.message,
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
            setError(describeError(failure));
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
    const describeError = useUserFacingError();
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
            if (!response.ok) throw new AppRequestError(response.status, payload.error ?? null);
            setDone(true);
            setCurrent("");
            setNext("");
            setConfirm("");
        } catch (failure) {
            setError(describeError(failure));
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
    const describeError = useUserFacingError();
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
                        if (!response.ok) throw new AppRequestError(response.status, null);
                        router.push("/account");
                        router.refresh();
                    } catch (failure) {
                        setError(describeError(failure));
                        setBusy(false);
                    }
                }}
            />
        </SettingsSection>
    );
}

export function DeleteAccountRow() {
    const describeError = useUserFacingError();
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
            if (!response.ok) throw new AppRequestError(response.status, payload.error ?? null);
            await fetch("/api/auth/logout", {method: "POST"}).catch(() => undefined);
            router.push("/");
            router.refresh();
        } catch (failure) {
            setError(describeError(failure));
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
