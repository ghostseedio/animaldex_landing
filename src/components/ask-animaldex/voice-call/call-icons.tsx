/** The call screen's glyphs, drawn to match the app's (SF Symbols there). */

type IconProps = {size: number};

function stroke(size: number, children: React.ReactNode, width = 2) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {children}
        </svg>
    );
}

function fill(size: number, children: React.ReactNode) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
            {children}
        </svg>
    );
}

export const ChevronDownIcon = ({size}: IconProps) => stroke(size, <path d="M6 9.5l6 6 6-6" />, 2.4);

export const XMarkIcon = ({size}: IconProps) => stroke(size, <path d="M6.5 6.5l11 11m0-11l-11 11" />, 2.6);

export const CaptionsIcon = ({size, filled}: IconProps & {filled: boolean}) => (filled
    ? fill(size, <path d="M5 4h14a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3h-7l-4.5 3.4A.6.6 0 0 1 6.5 21v-3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Zm2.2 6.6c0 1.6 1.1 2.6 2.6 2.6.9 0 1.6-.3 2-.9l-1-.8c-.2.3-.5.5-1 .5-.7 0-1.2-.6-1.2-1.4s.5-1.4 1.2-1.4c.5 0 .8.2 1 .5l1-.8c-.4-.6-1.1-.9-2-.9-1.5 0-2.6 1-2.6 2.6Zm5.6 0c0 1.6 1.1 2.6 2.6 2.6.9 0 1.6-.3 2-.9l-1-.8c-.2.3-.5.5-1 .5-.7 0-1.2-.6-1.2-1.4s.5-1.4 1.2-1.4c.5 0 .8.2 1 .5l1-.8c-.4-.6-1.1-.9-2-.9-1.5 0-2.6 1-2.6 2.6Z" />)
    : stroke(size, <>
        <path d="M5 4.8h14a2.2 2.2 0 0 1 2.2 2.2v8a2.2 2.2 0 0 1-2.2 2.2h-7l-4.5 3.3v-3.3H5A2.2 2.2 0 0 1 2.8 15V7A2.2 2.2 0 0 1 5 4.8Z" />
        <path d="M10.6 9.6a1.6 1.6 0 1 0 0 2.8M16 9.6a1.6 1.6 0 1 0 0 2.8" />
    </>, 1.7));

export const MicIcon = ({size}: IconProps) => fill(size, <>
    <rect x="8.5" y="2.5" width="7" height="12" rx="3.5" />
    <path d="M5.2 11a.9.9 0 0 1 1.8 0 5 5 0 0 0 10 0 .9.9 0 0 1 1.8 0 6.8 6.8 0 0 1-5.9 6.7v2.6h2.6a.9.9 0 0 1 0 1.8H8.5a.9.9 0 0 1 0-1.8h2.6v-2.6A6.8 6.8 0 0 1 5.2 11Z" />
</>);

export const MicSlashIcon = ({size, filled}: IconProps & {filled: boolean}) => (filled
    ? fill(size, <>
        <path d="M8.5 6a3.5 3.5 0 0 1 7 0v5.5c0 .6-.1 1.1-.4 1.6L8.5 6.5Z" />
        <path d="M3.4 3.4a.9.9 0 0 1 1.3 0l15.9 15.9a.9.9 0 0 1-1.3 1.3l-3.1-3.1a6.7 6.7 0 0 1-3.3 1.4v2.4h2.6a.9.9 0 0 1 0 1.8H8.5a.9.9 0 0 1 0-1.8h2.6v-2.4A6.8 6.8 0 0 1 5.2 11a.9.9 0 0 1 1.8 0 5 5 0 0 0 7.6 4.3l-1.3-1.3A3.5 3.5 0 0 1 8.5 11V8.7L3.4 4.7a.9.9 0 0 1 0-1.3Z" />
    </>)
    : stroke(size, <>
        <path d="M15.5 11V6a3.5 3.5 0 0 0-6.7-1.4M8.5 9v2a3.5 3.5 0 0 0 5.6 2.8" />
        <path d="M18.4 11a6.4 6.4 0 0 1-.6 2.7M5.6 11a6.4 6.4 0 0 0 10 5.3M12 17.4V21m-3 0h6M4 4l16 16" />
    </>, 1.8));

export const HandIcon = ({size}: IconProps) => fill(size, <path d="M9.4 3.2a1.3 1.3 0 0 1 2.6 0v7h.6V2.6a1.3 1.3 0 0 1 2.6 0v7.6h.6V4.4a1.3 1.3 0 0 1 2.6 0v9.8c0 4.4-3 7.6-7 7.6-2.6 0-4.4-1.2-5.8-3.4l-2.9-4.8a1.4 1.4 0 0 1 2.3-1.5l1.6 2.1V5.2a1.3 1.3 0 0 1 2.6 0v5h.2Z" />);

export const EllipsisIcon = ({size}: IconProps) => fill(size, <>
    <circle cx="5.5" cy="12" r="2" />
    <circle cx="12" cy="12" r="2" />
    <circle cx="18.5" cy="12" r="2" />
</>);
