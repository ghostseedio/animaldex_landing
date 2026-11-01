"use client";

import {useEffect, useRef, useState} from "react";

export type CursorProps = {
    smoothnessCoefficient?: number;
}

/** A fine pointer that can hover, and a reader who has not asked for less motion. */
const CURSOR_QUERY = "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)";

type Target = {
    x: number;
    y: number;
    size: number;
    /** "dot" follows the pointer; "ring" outlines a link without covering it; "pull" is the drag affordance. */
    shape: "dot" | "ring" | "pull" | "hidden";
    text: string;
};

/**
 * The trailing cursor (WEB-17, WEB-37).
 *
 * - Mounted only where it can be seen: a mouse or trackpad, and no reduced
 *   motion. Touch devices and reduced-motion readers run nothing at all.
 * - The hover target is read once per pointer move, never per frame, and the
 *   animation loop stops as soon as the trail has caught up, so an idle page
 *   costs no main-thread time.
 * - Over a link it is a thin ring, not a solid disc, so the label underneath
 *   stays readable; over a text field it steps aside.
 * - No React state per frame: the trail is written to the DOM directly.
 */
export default function Cursor({smoothnessCoefficient = 0.82}: CursorProps) {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        const media = window.matchMedia(CURSOR_QUERY);
        const update = () => setEnabled(media.matches);
        update();
        media.addEventListener("change", update);
        return () => media.removeEventListener("change", update);
    }, []);

    if (!enabled) return null;
    return <CursorTrail smoothnessCoefficient={smoothnessCoefficient} />;
}

function CursorTrail({smoothnessCoefficient}: {smoothnessCoefficient: number}) {
    const trail = useRef<HTMLDivElement>(null);
    const label = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const element = trail.current;
        const text = label.current;
        if (!element || !text) return;

        const position = {x: -100, y: -100};
        let size = 8;
        let opacity = 0;
        let target: Target = {x: -100, y: -100, size: 8, shape: "hidden", text: ""};
        let shape: Target["shape"] = "hidden";
        let frame = 0;
        let pendingRead = 0;
        let pointer = {x: -100, y: -100};

        const readTarget = () => {
            pendingRead = 0;
            const hovered = document.elementFromPoint(pointer.x, pointer.y);
            if (!hovered) {
                target = {...target, x: pointer.x, y: pointer.y, shape: "hidden", text: ""};
                return;
            }
            const custom = hovered.closest("[data-cursor-text]");
            if (custom) {
                const rect = custom.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height) + 16;
                target = {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size, shape: "pull", text: custom.getAttribute("data-cursor-text") || ""};
                return;
            }
            if (hovered.closest("input, textarea, select, [contenteditable='true']")) {
                target = {x: pointer.x, y: pointer.y, size: 8, shape: "hidden", text: ""};
                return;
            }
            const cursor = getComputedStyle(hovered).cursor;
            if (cursor === "grab" || cursor === "grabbing") {
                target = {x: pointer.x, y: pointer.y, size: 64, shape: "pull", text: "PULL"};
            } else if (cursor === "pointer") {
                target = {x: pointer.x, y: pointer.y, size: 30, shape: "ring", text: ""};
            } else {
                target = {x: pointer.x, y: pointer.y, size: 8, shape: "dot", text: ""};
            }
        };

        const applyShape = (next: Target["shape"]) => {
            if (next === shape) return;
            shape = next;
            element.dataset.shape = next;
            text.textContent = next === "pull" ? target.text : "";
        };

        const step = () => {
            frame = 0;
            const keep = smoothnessCoefficient;
            position.x = position.x * keep + target.x * (1 - keep);
            position.y = position.y * keep + target.y * (1 - keep);
            size = size * keep + target.size * (1 - keep);
            const opacityTarget = target.shape === "hidden" ? 0 : 1;
            opacity = opacity * keep + opacityTarget * (1 - keep);
            applyShape(target.shape === "hidden" ? shape : target.shape);
            element.style.transform = `translate3d(${position.x - size / 2}px, ${position.y - size / 2}px, 0)`;
            element.style.width = `${size}px`;
            element.style.height = `${size}px`;
            element.style.opacity = String(opacity < 0.01 ? 0 : opacity);
            const settled = Math.abs(position.x - target.x) < 0.2
                && Math.abs(position.y - target.y) < 0.2
                && Math.abs(size - target.size) < 0.2
                && Math.abs(opacity - opacityTarget) < 0.01;
            if (!settled) frame = requestAnimationFrame(step);
        };

        const wake = () => {
            if (!frame) frame = requestAnimationFrame(step);
        };

        const onMove = (event: MouseEvent) => {
            pointer = {x: event.clientX, y: event.clientY};
            if (position.x < -50) {
                position.x = pointer.x;
                position.y = pointer.y;
            }
            // One hit test per frame at most, however fast the pointer moves.
            if (!pendingRead) {
                pendingRead = requestAnimationFrame(() => {
                    readTarget();
                    wake();
                });
            }
            target = {...target, x: target.shape === "pull" && target.text !== "PULL" ? target.x : pointer.x, y: target.shape === "pull" && target.text !== "PULL" ? target.y : pointer.y};
            wake();
        };
        const onLeave = () => {
            target = {...target, shape: "hidden"};
            wake();
        };
        // Scrolling moves the page under a still pointer.
        const onScroll = () => {
            if (!pendingRead) {
                pendingRead = requestAnimationFrame(() => {
                    readTarget();
                    wake();
                });
            }
        };

        document.addEventListener("mousemove", onMove, {passive: true});
        document.documentElement.addEventListener("mouseleave", onLeave);
        window.addEventListener("scroll", onScroll, {passive: true});
        return () => {
            cancelAnimationFrame(frame);
            cancelAnimationFrame(pendingRead);
            document.removeEventListener("mousemove", onMove);
            document.documentElement.removeEventListener("mouseleave", onLeave);
            window.removeEventListener("scroll", onScroll);
        };
    }, [smoothnessCoefficient]);

    return (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
            <div ref={trail} data-shape="hidden" className="cursor-trail">
                <span ref={label} className="text-sm font-bold text-canvas-950" />
            </div>
        </div>
    );
}
