/**
 * The app's header controls as icons (iOS AnimalDexCloseButton and friends):
 * × closes or cancels, the save icon saves, a tick finishes. Each keeps its
 * word as the accessible name.
 */

type IconButtonProps = {
    onClick: () => void;
    label?: string;
    disabled?: boolean;
    className?: string;
    /** Defaults to the neon accent. */
    color?: string;
};

const BASE = "inline-grid h-10 w-10 shrink-0 place-items-center rounded-full transition hover:bg-white/[0.08] disabled:opacity-40";

export function CloseIconButton({onClick, label = "Close", disabled, className = "", color = "#A7F432"}: IconButtonProps) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={`${BASE} ${className}`} style={{color}}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
            </svg>
        </button>
    );
}

export function DoneIconButton({onClick, label = "Done", disabled, className = "", color = "#A7F432"}: IconButtonProps) {
    return (
        <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className={`${BASE} ${className}`} style={{color}}>
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
            </svg>
        </button>
    );
}

/** The save glyph on its own, for buttons that also carry the word. */
export function SaveGlyph({className = "h-4 w-4"}: {className?: string}) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 3h11l3 3v15H5z" />
            <path d="M8 3v5h7V3M8 21v-6h8v6" />
        </svg>
    );
}
