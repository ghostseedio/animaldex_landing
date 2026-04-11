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
