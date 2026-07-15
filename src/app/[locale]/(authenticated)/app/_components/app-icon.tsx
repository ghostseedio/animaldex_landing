export type AppIconName = "home" | "collection" | "arena" | "train" | "profile" | "plus" | "bell" | "message" | "send" | "mission" | "sets" | "matchup" | "trade" | "search" | "filter" | "grid" | "list" | "back" | "camera" | "spark" | "lock" | "check" | "location" | "calendar" | "chevron" | "menu" | "close" | "volume" | "volumeOff" | "boltShield";

export default function AppIcon({name, className = "h-5 w-5"}: {name: AppIconName; className?: string}) {
    const path: Record<AppIconName, React.ReactNode> = {
        home: <><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9v12h13V9M9 21v-6h6v6"/></>,
        collection: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
        train: <><path d="M6 7v10M3 9v6m15-8v10m3-8v6M6 12h12"/></>,
        arena: <><path d="M12 2 4 5v6c0 5.2 3.4 10 8 11 4.6-1 8-5.8 8-11V5l-8-3Z"/><path d="m13.3 6.5-4.1 6h3l-1 5 4.1-6h-3Z"/></>,
        boltShield: <><path d="M12 2 4 5v6c0 5.2 3.4 10 8 11 4.6-1 8-5.8 8-11V5l-8-3Z"/><path d="m13.3 6.5-4.1 6h3l-1 5 4.1-6h-3Z"/></>,
        profile: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
        plus: <path d="M12 5v14M5 12h14"/>,
        bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
        message: <><path d="M7 9h10M7 13h6"/><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"/></>,
        send: <><path d="m22 2-7 8"/><path d="m22 2-10 20-3-9-9Z"/></>,
        mission: <><path d="M9 4h6l1 3h3v14H5V7h3Z"/><path d="m9 14 2 2 4-5"/></>,
        sets: <><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/></>,
        matchup: <><path d="M8 4h8l2 4v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8Z"/><path d="M9 12h6M12 9v6"/></>,
        trade: <><path d="M4 7h14l-3-3m3 3-3 3M20 17H6l3 3m-3-3 3-3"/></>,
        search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
        filter: <path d="M4 6h16M7 12h10m-7 6h4"/>,
        grid: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></>,
        list: <><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
        back: <path d="m15 18-6-6 6-6"/>,
        camera: <><path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="4"/></>,
        spark: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5Z"/><path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z"/></>,
        lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
        check: <path d="m5 12 4 4L19 6"/>,
        location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
        calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4m8-4v4M3 10h18"/></>,
        chevron: <path d="m9 18 6-6-6-6"/>,
        menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
        close: <path d="m6 6 12 12M18 6 6 18"/>,
        volume: <><path d="M4 9v6h4l5 4V5L8 9Z"/><path d="M16 9.5a4 4 0 0 1 0 5M19 7a8 8 0 0 1 0 10"/></>,
        volumeOff: <><path d="M4 9v6h4l5 4V5L8 9Z"/><path d="m16 9 5 5m0-5-5 5"/></>
    };
    return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{path[name]}</svg>;
}
