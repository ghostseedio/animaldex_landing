import React from "react";

type IconProps = {
    className?: string;
    size?: number;
};

export function ArrowSquareUpIcon({className, size = 60}: IconProps) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M14.5 10.5 12 8l-2.5 2.5M12 8v8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="4"
                stroke="currentColor"
                strokeWidth="2"
            />
        </svg>
    );
}

export function ArrowSquareDownIcon({className, size = 60}: IconProps) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M9.5 13.5 12 16l2.5-2.5M12 16V8"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="4"
                stroke="currentColor"
                strokeWidth="2"
            />
        </svg>
    );
}

export function ShieldUserIcon({className, size = 64}: IconProps) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M12 2c.81 0 1.6.27 3.16.8l.57.2c3.01 1.03 4.51 1.54 4.89 2.08.38.54.38 2.14.38 5.34V12c0 5.64-4.24 8.38-6.9 9.53-.72.32-1.08.47-2.1.47-1.02 0-1.38-.15-2.1-.47C7.24 20.38 3 17.64 3 12v-1.58c0-3.2 0-4.8.38-5.34.38-.54 1.88-1.05 4.89-2.08l.57-.2C10.4 2.27 11.19 2 12 2Z"
                stroke="currentColor"
                strokeWidth="1.8"
            />
            <circle cx="12" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.8" />
            <path
                d="M16 15c0 1.1 0 2-4 2s-4-.9-4-2 1.79-2 4-2 4 .9 4 2Z"
                stroke="currentColor"
                strokeWidth="1.8"
            />
        </svg>
    );
}

export function DatabaseIcon({className, size = 64}: IconProps) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <ellipse cx="12" cy="6" rx="8" ry="3.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 6v12c0 1.93 3.58 3.5 8 3.5s8-1.57 8-3.5V6" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 12c0 1.93 3.58 3.5 8 3.5s8-1.57 8-3.5" stroke="currentColor" strokeWidth="1.8" />
        </svg>
    );
}

export function MailIcon({className, size = 24}: IconProps) {
    return (
        <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
            <path d="m4.5 7 6.15 5.12a2.1 2.1 0 0 0 2.7 0L19.5 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function BugIcon({className, size = 24}: IconProps) {
    return (
        <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="7" y="6" width="10" height="13" rx="5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M9 6V4m6 2V4M7 10H4m3 5H4m13-5h3m-3 5h3M9.5 2.8h5M12 10v9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

export function SparklesIcon({className, size = 24}: IconProps) {
    return (
        <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3c.45 3.5 2.5 5.55 6 6-3.5.45-5.55 2.5-6 6-.45-3.5-2.5-5.55-6-6 3.5-.45 5.55-2.5 6-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M19 14.5c.2 1.55.95 2.3 2.5 2.5-1.55.2-2.3.95-2.5 2.5-.2-1.55-.95-2.3-2.5-2.5 1.55-.2 2.3-.95 2.5-2.5ZM5 15c.16 1.2.8 1.84 2 2-1.2.16-1.84.8-2 2-.16-1.2-.8-1.84-2-2 1.2-.16 1.84-.8 2-2Z" fill="currentColor" />
        </svg>
    );
}

export function ChecklistIcon({className, size = 24}: IconProps) {
    return (
        <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="m4 7 1.5 1.5L8.5 5M11 7h9M4 13l1.5 1.5 3-3.5M11 13h9M4 19l1.5 1.5 3-3.5M11 19h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function HelpCircleIcon({className, size = 24}: IconProps) {
    return (
        <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path d="M9.8 9a2.35 2.35 0 1 1 3.25 2.17c-.7.31-1.05.78-1.05 1.58v.25M12 17h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

export function ThumbsUpIcon({className, size = 24}: IconProps) {
    return (
        <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 11v8.5H4.5A1.5 1.5 0 0 1 3 18V11.8c0-.55.22-1.08.62-1.47l3.1-3.1A1.5 1.5 0 0 1 8.5 7V5.5A2 2 0 0 1 10.5 3.5h.2A2 2 0 0 1 12.5 5.4l.6 2.4c.2.8.9 1.4 1.7 1.5l2.7.4A1.5 1.5 0 0 1 18 11v8.5h-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function ThumbsDownIcon({className, size = 24}: IconProps) {
    return (
        <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17 13V4.5h2.5A1.5 1.5 0 0 1 21 6v6.2c0 .55-.22 1.08-.62 1.47l-3.1 3.1A1.5 1.5 0 0 1 15.5 17v1.5a2 2 0 0 1-2 2h-.2a2 2 0 0 1-2-1.9l-.6-2.4a2 2 0 0 0-1.7-1.5l-2.7-.4A1.5 1.5 0 0 1 6 13V4.5h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function CheckCircleIcon({className, size = 24}: IconProps) {
    return (
        <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <path d="m8.2 12.2 2.1 2.1 5.5-5.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function LifeBuoyIcon({className, size = 24}: IconProps) {
    return (
        <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.55 1.55M16.85 16.85l1.55 1.55M18.4 5.6l-1.55 1.55M7.15 16.85 5.6 18.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

export function HandshakeIcon({className, size = 24}: IconProps) {
    return (
        <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 11.5 7.2 8.3c.8-.8 2.1-.8 2.9 0l1.4 1.4c.8.8.8 2.1 0 2.9l-1.1 1.1M20 11.5l-3.2-3.2c-.8-.8-2.1-.8-2.9 0l-1.4 1.4c-.8.8-.8 2.1 0 2.9l1.1 1.1M8.8 14.2 11 16.4c.9.9 2.3.9 3.2 0l1.8-1.8c.9-.9.9-2.3 0-3.2l-1.4-1.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="m9.5 12.5 1.5 1.5M14.5 9.5 13 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

export function MegaphoneIcon({className, size = 24}: IconProps) {
    return (
        <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4.5 10.5h3.4l6.1-3.4v13.8l-6.1-3.4H4.5v-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M16.5 9.2c1.1.8 1.8 2.1 1.8 3.6s-.7 2.8-1.8 3.6M19 6.8c2 1.5 3.2 3.8 3.2 6.2s-1.2 4.7-3.2 6.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

export function CameraIcon({className, size = 24}: IconProps) {
    return (
        <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4.5 8.5h3l1.4-2.2c.3-.5.8-.8 1.4-.8h4.2c.6 0 1.1.3 1.4.8L16.5 8.5H19.5A2 2 0 0 1 21.5 10.5v7a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="3.1" stroke="currentColor" strokeWidth="1.8" />
        </svg>
    );
}

export function NewspaperIcon({className, size = 24}: IconProps) {
    return (
        <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 4.5h11.5A2.5 2.5 0 0 1 20 7v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M8.5 8.5h6M8.5 12h6M8.5 15.5h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

export function MessageCircleIcon({className, size = 24}: IconProps) {
    return (
        <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 6.5A3.5 3.5 0 0 1 8.5 3h7A3.5 3.5 0 0 1 19 6.5v5A3.5 3.5 0 0 1 15.5 15H10l-4.5 3.5V15H8.5A3.5 3.5 0 0 1 5 11.5v-5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M9 8.5h6M9 11.5h3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
    );
}

export function DocumentIcon({className, size = 24}: IconProps) {
    return (
        <svg aria-hidden="true" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 3h7l4 4v14H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M14 3v5h4M8 12h6M8 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function SpeakerOnIcon({className, size = 24}: IconProps) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M5 10.5h3.2L12.8 7v10l-4.6-3.5H5v-3Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="M16 9.25c1.2.83 2 2.22 2 3.75s-.8 2.92-2 3.75"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
            <path
                d="M18.5 6.5c2.04 1.55 3.3 3.96 3.3 6.5s-1.26 4.95-3.3 6.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function SpeakerOffIcon({className, size = 24}: IconProps) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M5 10.5h3.2L12.8 7v10l-4.6-3.5H5v-3Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <path
                d="m16.5 10.5 5 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
            <path
                d="m21.5 10.5-5 5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
    );
}

export function InstagramIcon({className, size = 24}: IconProps) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="5" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="17.3" cy="6.8" r="1.1" fill="currentColor" />
        </svg>
    );
}

export function TikTokIcon({className, size = 24}: IconProps) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M14 4c.45 2.08 1.84 3.62 4 4.07v2.72c-1.47-.04-2.82-.48-4-1.3v5.46a4.95 4.95 0 1 1-4.95-4.95c.36 0 .71.04 1.05.11v2.84a2.22 2.22 0 1 0 1.17 1.95V4H14Z"
                fill="currentColor"
            />
        </svg>
    );
}

export function XIcon({className, size = 24}: IconProps) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M4 4h4.73l4.02 5.65L17.6 4H20l-6.13 7.14L20.5 20h-4.73l-4.3-6.05L6.28 20H3.88l6.47-7.53L4 4Zm3.42 1.8 9.25 12.4h.41L7.83 5.8h-.41Z"
                fill="currentColor"
            />
        </svg>
    );
}

export function YouTubeIcon({className, size = 24}: IconProps) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M21 12c0 2.2-.24 3.67-.46 4.45a2.96 2.96 0 0 1-2.09 2.09C17.67 18.76 16.2 19 12 19s-5.67-.24-6.45-.46a2.96 2.96 0 0 1-2.09-2.09C3.24 15.67 3 14.2 3 12s.24-3.67.46-4.45a2.96 2.96 0 0 1 2.09-2.09C6.33 5.24 7.8 5 12 5s5.67.24 6.45.46a2.96 2.96 0 0 1 2.09 2.09C20.76 8.33 21 9.8 21 12Z"
                stroke="currentColor"
                strokeWidth="1.8"
            />
            <path d="m10 9 5 3-5 3V9Z" fill="currentColor" />
        </svg>
    );
}
export function FacebookIcon({ className, size = 24 }: IconProps) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M13.5 21V13.2H16.1L16.5 10H13.5V7.95c0-.93.26-1.55 1.59-1.55H16.6V3.54c-.26-.03-1.17-.11-2.22-.11-2.2 0-3.71 1.34-3.71 3.8V10H8.2v3.2h2.47V21h2.83Z"
                fill="currentColor"
            />
        </svg>
    );
}

export function SubstackIcon({className, size = 24}: IconProps) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path d="M4 4.5h16M4 8h16M5.5 11.5h13V20L12 16.2 5.5 20v-8.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

export function RedditIcon({className, size = 24}: IconProps) {
    return (
        <svg
            aria-hidden="true"
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path d="M7.2 10.2a8.8 8.8 0 0 1 9.6 0M8.2 17.2c1.05.7 2.32 1.05 3.8 1.05s2.75-.35 3.8-1.05" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            <circle cx="8.5" cy="13.6" r="1.15" fill="currentColor" />
            <circle cx="15.5" cy="13.6" r="1.15" fill="currentColor" />
            <path d="M18.2 9.7a3 3 0 0 1 2.55 2.95c0 .72-.25 1.38-.67 1.9.02.16.03.32.03.48 0 3.31-3.63 5.97-8.11 5.97s-8.11-2.66-8.11-5.97c0-.16.01-.32.03-.48a3 3 0 0 1 2.55-4.85A9.5 9.5 0 0 1 11.2 8.4l1.02-4.25 3.63.86" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="17.3" cy="5.3" r="1.45" stroke="currentColor" strokeWidth="1.7" />
        </svg>
    );
}
