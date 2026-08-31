"use client";

import Link from "@/app/[locale]/_components/link";
import InstagramSettingsRow from "@/app/[locale]/(authenticated)/app/import/instagram/instagram-settings-row";
import type {ProfileContentLabels} from "@/app/[locale]/(composited)/u/[handle]/profile-content";
import type {ProfileCreditsSummary} from "@/data/profile-authenticated";

const CANVAS = "#07100B";
const CHROME = "#12351C";

type SettingsActivityDrawerProps = {
    labels: ProfileContentLabels;
    localePrefix: string;
    appStoreUrl: string;
    credits: ProfileCreditsSummary | null;
    onClose: () => void;
    signOutButton?: React.ReactNode;
};

function DrawerIcon({children}: {children: React.ReactNode}) {
    return (
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center text-primary-200" aria-hidden="true">
            {children}
        </span>
    );
}

function ActivityRow({
    href,
    external,
    onClick,
    icon,
    title,
    subtitle
}: {
    href?: string;
    external?: boolean;
    onClick?: () => void;
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
}) {
    const className =
        "flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-200";

    const body = (
        <>
            <DrawerIcon>{icon}</DrawerIcon>
            <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-white">{title}</span>
                {subtitle ? <span className="mt-0.5 block text-[11px] leading-snug text-white/40">{subtitle}</span> : null}
            </span>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-white/25" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                <path d="m9 5 7 7-7 7" />
            </svg>
        </>
    );

    if (href) {
        return external ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
                {body}
            </a>
        ) : (
            <Link href={href} className={className} onClick={onClick}>
                {body}
            </Link>
        );
    }

    return (
        <button type="button" className={className} onClick={onClick}>
            {body}
        </button>
    );
}

function SettingsSection({title, children}: {title: string; children: React.ReactNode}) {
    return (
        <section className="mt-3">
            <h3 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-white/35">{title}</h3>
            <div className="overflow-hidden rounded-2xl border border-white/[0.08]" style={{backgroundColor: CHROME}}>
                {children}
            </div>
        </section>
    );
}

function SettingsRow({
    href,
    external,
    title,
    detail,
    value,
    onClick
}: {
    href?: string;
    external?: boolean;
    title: string;
    detail?: string;
    value?: string;
    onClick?: () => void;
}) {
    const className = "flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition hover:bg-white/[0.04]";
    const inner = (
        <>
            <span className="min-w-0">
                <span className="block text-sm font-semibold text-white">{title}</span>
                {detail ? <span className="mt-0.5 block text-xs leading-5 text-white/40">{detail}</span> : null}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-white/35">
                {value ? <span className="text-xs font-semibold text-white/45">{value}</span> : null}
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    <path d="m9 5 7 7-7 7" />
                </svg>
            </span>
        </>
    );

    if (href) {
        return external ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className={className} onClick={onClick}>
                {inner}
            </a>
        ) : (
            <Link href={href} className={className} onClick={onClick}>
                {inner}
            </Link>
        );
    }

    return (
        <button type="button" className={className} onClick={onClick}>
            {inner}
        </button>
    );
}

function RowDivider() {
    return <div className="h-px bg-white/[0.08]" />;
}

export default function SettingsActivityDrawer({
    labels,
    localePrefix,
    appStoreUrl,
    credits,
    onClose,
    signOutButton
}: SettingsActivityDrawerProps) {
    const creditsTitle = credits?.hasProAccess
        ? labels.settingsCreditsUnlocks
        : labels.settingsCreditsUnlocksCount.replace("{count}", String(credits?.balance ?? 0));

    return (
        <div className="fixed inset-0 z-50">
            <button type="button" aria-label={labels.settingsClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
            <aside
                className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-white/[0.08] shadow-2xl"
                style={{backgroundColor: CANVAS}}
            >
                <header className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-4 py-3.5">
                    <h2 className="font-display text-[17px] font-bold text-white">{labels.settingsActivity}</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={labels.settingsDone}
                        className="grid h-9 w-9 place-items-center rounded-full text-primary-200 transition hover:bg-white/[0.06]"
                    >
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                            <path d="m6 6 12 12M18 6 6 18" />
                        </svg>
                    </button>
                </header>

                <div className="flex-1 overflow-y-auto px-4 py-2 pb-8">
                    <div className="space-y-1">
                        <ActivityRow
                            href={`${localePrefix}/app/collection`}
                            onClick={onClose}
                            title={labels.settingsEndorsements}
                            subtitle={labels.settingsEndorsementsDetail}
                            icon={
                                <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="currentColor" aria-hidden="true">
                                    <path d="M7 10v8.5H4.5A1.5 1.5 0 0 1 3 16V10.8c0-.55.22-1.08.62-1.47l3.1-3.1A1.5 1.5 0 0 1 8.5 6V4.5A2 2 0 0 1 10.5 2.5h.2A2 2 0 0 1 12.5 4.4l.6 2.4c.2.8.9 1.4 1.7 1.5l2.7.4A1.5 1.5 0 0 1 18 10v8.5h-3.5" />
                                </svg>
                            }
                        />
                        <ActivityRow
                            href={`${localePrefix}/app/missions`}
                            onClick={onClose}
                            title={labels.settingsMissions}
                            subtitle={labels.settingsMissionsDetail}
                            icon={
                                <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="currentColor" aria-hidden="true">
                                    <path d="M12 2.5 14.8 8l6.2.9-4.5 4.4 1.1 6.3L12 17.2 6.4 19.6l1.1-6.3L3 8.9 9.2 8z" />
                                </svg>
                            }
                        />
                        <ActivityRow
                            href={`${localePrefix}/app/credits`}
                            onClick={onClose}
                            title={creditsTitle}
                            subtitle={labels.settingsCreditsDetail}
                            icon={
                                <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="currentColor" aria-hidden="true">
                                    <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
                                </svg>
                            }
                        />
                        <ActivityRow
                            href={`${localePrefix}/app/earnings`}
                            onClick={onClose}
                            title={labels.earnings}
                            subtitle={labels.settingsEarningsDetail}
                            icon={
                                <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <rect x="2" y="6" width="20" height="12" rx="2" />
                                    <circle cx="12" cy="12" r="2.5" />
                                    <path d="M6 10h.01M18 10h.01" strokeLinecap="round" />
                                </svg>
                            }
                        />
                        <ActivityRow
                            href={`${localePrefix}/app/guides`}
                            onClick={onClose}
                            title="Wildlife Guides"
                            subtitle="Apply, publish experiences, and manage bookings."
                            icon={
                                <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <path d="M12 3 4 9v12h5v-7h6v7h5V9z" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            }
                        />
                        <ActivityRow
                            href={appStoreUrl}
                            external
                            onClick={onClose}
                            title={labels.settingsWidgets}
                            subtitle={labels.settingsWidgetsDetail}
                            icon={
                                <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                    <rect x="3" y="3" width="8" height="8" rx="1.5" />
                                    <rect x="13" y="3" width="8" height="8" rx="1.5" />
                                    <rect x="3" y="13" width="8" height="8" rx="1.5" />
                                    <rect x="13" y="13" width="8" height="8" rx="1.5" />
                                </svg>
                            }
                        />
                    </div>

                    <SettingsSection title={labels.settingsPreferences}>
                        <SettingsRow
                            href={`${localePrefix}/app/notifications`}
                            onClick={onClose}
                            title={labels.settingsNotifications}
                            detail={labels.settingsActivityDetail}
                        />
                        <RowDivider />
                        <SettingsRow title={labels.settingsLanguage} detail={labels.settingsLanguageDetail} value={labels.settingsLanguageValue} />
                        <RowDivider />
                        <SettingsRow title={labels.settingsCurrency} detail={labels.settingsCurrencyDetail} value={labels.settingsCurrencyValue} />
                    </SettingsSection>

                    <SettingsSection title={labels.settingsPrivacyData}>
                        <SettingsRow
                            href={`${localePrefix}/app/profile`}
                            onClick={onClose}
                            title={labels.settingsLocationPrivacy}
                            detail={labels.settingsLocationPrivacyDetail}
                        />
                        <RowDivider />
                        <SettingsRow
                            href={`${localePrefix}/app/collection`}
                            onClick={onClose}
                            title={labels.settingsDataUploads}
                            detail={labels.settingsDataUploadsDetail}
                        />
                    </SettingsSection>

                    <SettingsSection title={labels.settingsConnectedServices}>
                        <div onClick={onClose}>
                            <InstagramSettingsRow localePrefix={localePrefix} />
                        </div>
                    </SettingsSection>

                    <SettingsSection title={labels.settingsSupportAbout}>
                        <SettingsRow href={`${localePrefix}/support`} onClick={onClose} title={labels.settingsHelpSupport} />
                        <RowDivider />
                        <SettingsRow href={`${localePrefix}/legal/privacy`} onClick={onClose} title={labels.settingsPrivacyPolicy} />
                        <RowDivider />
                        <SettingsRow href={`${localePrefix}/legal/terms`} onClick={onClose} title={labels.settingsTerms} />
                    </SettingsSection>

                    <SettingsSection title={labels.settingsAccount}>
                        <SettingsRow
                            href={`${localePrefix}/account`}
                            onClick={onClose}
                            title={labels.settingsAccount}
                            detail={labels.settingsAccountDetail}
                        />
                    </SettingsSection>

                    {signOutButton ? <div className="mt-5 px-1">{signOutButton}</div> : null}
                </div>
            </aside>
        </div>
    );
}
