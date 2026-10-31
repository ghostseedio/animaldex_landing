import {Fragment, type ReactNode} from "react";
import {diagramRuns} from "@/lib/text-diagram";

type TextDiagramPanelProps = {
    /** Drawn in capitals on the panel's first line, the way a rich answer titles its diagram. */
    title: string;
    /** From `drawGrid` or `drawFlow`. */
    lines: string[];
    /** What the picture shows, for a screen reader; the equivalent follows it. */
    label: string;
    caption?: string;
    /** The disclosure's label: "Read it as a table". */
    equivalentLabel: string;
    /** The same content as a real table or list, for reading, search and screen readers. */
    children: ReactNode;
    className?: string;
};

/**
 * A text diagram on a quiet panel, as the chat draws one in a rich answer
 * (docs/rich-chat/SPEC.md §1.4): monospace at 13 px, a rounded surface a step
 * lighter than the page, crisp box-drawing lines, never wrapped. On a narrow
 * screen the panel scrolls sideways inside itself; the page never does.
 *
 * The drawing is an image to assistive technology (its strokes read as noise),
 * and the same rows follow as a real table or list under "Read it as a table",
 * which is what search and screen readers read.
 */
export default function TextDiagramPanel({title, lines, label, caption, equivalentLabel, children, className = ""}: TextDiagramPanelProps) {
    return (
        <figure className={`text-diagram ${className}`}>
            <div
                role="img"
                aria-label={label}
                // Focusable so a keyboard can scroll a panel that is wider than the screen.
                tabIndex={0}
                className="text-diagram-panel overflow-x-auto overscroll-x-contain rounded-2xl p-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300"
            >
                <pre className="text-diagram-text w-max">
                    <span className="text-diagram-title">{title.toLocaleUpperCase()}</span>
                    {"\n\n"}
                    {lines.map((line, index) => (
                        <Fragment key={index}>
                            {diagramRuns(line).map((run, runIndex) => (
                                run.kind === "text"
                                    ? <Fragment key={runIndex}>{run.text}</Fragment>
                                    : <span key={runIndex} className={run.kind === "arrow" ? "text-diagram-arrow" : "text-diagram-stroke"}>{run.text}</span>
                            ))}
                            {index < lines.length - 1 ? "\n" : null}
                        </Fragment>
                    ))}
                </pre>
            </div>
            <figcaption className="mt-3 flex flex-col gap-2">
                {caption ? <span className="text-diagram-caption">{caption}</span> : null}
                <details className="text-diagram-equivalent group">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
                        <span aria-hidden="true" className="transition-transform group-open:rotate-90">▸</span>
                        {equivalentLabel}
                    </summary>
                    <div className="mt-3">{children}</div>
                </details>
            </figcaption>
        </figure>
    );
}
