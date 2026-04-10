import {PropsWithChildren} from "react";

export type ButtonProps = PropsWithChildren<{
    className?: string;
    onClick?: () => void;
    disabled?: boolean;
    as?: "button" | "span" | "div";
}>;

export default function Button({className, children, onClick, disabled, as = "button"}: ButtonProps) {
    const Component = as;

    return (
        <Component
            className={`rounded-full font-display font-bold text-2xl text-canvas-950 hover:text-canvas-950 py-4 px-8
                hover:bg-primary-200 bg-primary-500 active:bg-primary-400 duration-300 ease-in-out transition-all
                border border-primary-200/30 shadow-[0_0_40px_rgba(27,196,81,0.18)] disabled:opacity-50
                disabled:pointer-events-none hover:scale-105 active:scale-95
                ${className || ""}`}
            onClick={onClick}
            {...(as === "button" ? {disabled} : {})}
        >
            {children}
        </Component>
    )
}
