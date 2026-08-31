"use client";

import {ReactNode, useCallback, useEffect, useRef, useState} from "react";

export type DragSliderProps = {
    children: ReactNode;
    showHint?: boolean;
};

export default function DragSlider({children, showHint = false}: DragSliderProps) {
    const [dragged, setDragged] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const currentTouch = useRef<{ x: number, y: number } | null>(null);
    const velX = useRef(0);
    const accX = useRef(0);
    const decelerationCoefficient = useRef(0.92);

    const startDrag = useCallback((x: number, y: number) => {
        if (!root.current) return;
        const clickedElement = document.elementFromPoint(x, y);
        if (clickedElement?.closest("[data-drag-slider-ignore]")) return;
        setDragged(true)
    }, [])
    const stopDrag = useCallback(() => {
        setDragged(false);
        currentTouch.current = null;
    }, [])
    const updateDrag = useCallback((movX: number) => {
        if (!dragged || !root.current) return;
        accX.current = -movX;
    }, [dragged])

    useEffect(() => {
        let currentFrame = 0;
        const update = () => {
            if (root.current) {
                velX.current += accX.current;
                if (dragged && Math.abs(velX.current) > Math.abs(accX.current)) velX.current = accX.current;
                root.current.scrollLeft += velX.current;
                accX.current = 0;
                velX.current *= decelerationCoefficient.current;
            }
            currentFrame = requestAnimationFrame(update);
        }
        currentFrame = requestAnimationFrame(update);
        return () => cancelAnimationFrame(currentFrame);
    }, [dragged])

    return (
        <div className="flex w-full max-w-full flex-col gap-5">
            <div
                className={`grid w-full max-w-full grid-flow-col items-center gap-5 overflow-x-hidden px-5 select-none md:gap-6 md:px-8 ${
                    dragged ? "cursor-grabbing" : "cursor-default"
                }`}

                onMouseDown={e => {
                    startDrag(e.clientX, e.clientY);
                }}
                onTouchStart={e => {
                    const touch = e.touches[0];
                    startDrag(touch.clientX, touch.clientY);
                }}

                onMouseUp={stopDrag}
                onTouchEnd={stopDrag}
                onMouseLeave={stopDrag}

                onMouseMove={e => updateDrag(e.movementX)}
                ref={root}
                onTouchMove={e => {
                    const touch = e.touches[0];
                    if (currentTouch.current) {
                        const movX = touch.pageX - currentTouch.current.x;
                        updateDrag(movX);
                    }

                    currentTouch.current = {
                        x: touch.pageX,
                        y: touch.pageY
                    }
                }}
            >
                <div className={`contents ${dragged ? "pointer-events-none" : ""}`}>
                    {children}
                </div>
            </div>
            {showHint ? (
                <div
                    aria-hidden="true"
                    className="flex items-center justify-center gap-3 px-8 text-ink-500"
                >
                    <div className="h-px w-10 bg-gradient-to-r from-transparent to-line-300/80 sm:w-16" />
                    <svg viewBox="0 0 24 12" className="h-3 w-6 fill-none stroke-current stroke-[1.5]">
                        <path d="M1 6h14" strokeLinecap="round" />
                        <path d="M11 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M23 6H15" strokeLinecap="round" opacity="0.45" />
                    </svg>
                    <div className="h-px w-10 bg-gradient-to-l from-transparent to-line-300/80 sm:w-16" />
                </div>
            ) : null}
        </div>
    );
}
