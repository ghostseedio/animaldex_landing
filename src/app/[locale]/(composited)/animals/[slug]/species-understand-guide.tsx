import type {ReactNode} from "react";
import {AskWhyButton} from "@/app/[locale]/(composited)/animals/[slug]/species-ask-animaldex";

export type UnderstandGuideSection = {
    id: string;
    navLabel: string;
    title: string;
    whyQuestion?: string | null;
    whyLabel?: string | null;
    content: ReactNode;
};

type SpeciesUnderstandGuideProps = {
    animalName: string;
    slug: string;
    eyebrow: string;
    description: string;
    whyLabel: string;
    sections: UnderstandGuideSection[];
};

/**
 * The field guide, as a ruled document rather than a stack of cards.
 *
 * Each section used to be an identical rounded panel holding full-width body text,
 * which gave a long read no hierarchy and a measure well past 120 characters. Here
 * the section label sits in its own column and the prose is capped near 68ch, so
 * the eye returns to a predictable left edge and the reader can see at a glance
 * which part of the guide they are in.
 */
export default function SpeciesUnderstandGuide({
    animalName,
    slug,
    eyebrow,
    description,
    whyLabel,
    sections
}: SpeciesUnderstandGuideProps) {
    if (sections.length === 0) return null;

    return (
        <section id="understand" className="scroll-mt-28 flex flex-col">
            <header className="flex flex-col gap-3 pb-8">
                <span aria-hidden="true" className="h-[3px] w-10 rounded-full bg-gradient-to-r from-primary-400 to-primary-500/20" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-200">{eyebrow}</p>
                <h2 className="font-display text-3xl font-bold tracking-tight text-white md:text-5xl">{animalName}</h2>
                <p className="max-w-[60ch] text-base leading-relaxed text-ink-200 md:text-lg">{description}</p>
            </header>

            <nav
                aria-label={eyebrow}
                className="sticky top-16 z-20 -mx-4 overflow-x-auto border-y border-line-300 bg-canvas-950/92 px-4 backdrop-blur md:top-20 md:mx-0 md:px-0"
            >
                <ul className="flex min-w-max">
                    {sections.map((section) => (
                        <li key={section.id}>
                            <a
                                href={`#${section.id}`}
                                className="inline-flex border-b-2 border-transparent px-3.5 py-3.5 text-sm font-semibold text-ink-300 transition-colors hover:border-primary-400/60 hover:text-white md:px-4"
                            >
                                {section.navLabel}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="flex flex-col">
                {sections.map((section, index) => (
                    <article
                        key={section.id}
                        id={section.id}
                        className="scroll-mt-36 border-b border-line-300 py-9 md:py-12 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12"
                    >
                        <div className="lg:sticky lg:top-36 lg:self-start">
                            <p className="font-mono text-xs tabular-nums text-ink-400">
                                {String(index + 1).padStart(2, "0")}
                            </p>
                            <h3 className="mt-2 font-display text-2xl font-bold tracking-tight text-white md:text-[1.75rem] md:leading-tight">
                                {section.title}
                            </h3>
                        </div>

                        <div className="mt-5 lg:mt-0">
                            <div className="max-w-[68ch] text-[15px] leading-[1.75] text-ink-200 md:text-base [&_h4]:mb-3 [&_h4]:mt-7 [&_h4]:font-display [&_h4]:text-sm [&_h4]:font-bold [&_h4]:uppercase [&_h4]:tracking-[0.12em] [&_h4]:text-white [&_h4:first-child]:mt-0 [&_li]:pl-1 [&_li]:marker:text-primary-400/70 [&_ul]:gap-2.5">
                                {section.content}
                            </div>
                            {section.whyQuestion ? (
                                <div className="mt-6">
                                    <AskWhyButton
                                        slug={slug}
                                        question={section.whyQuestion}
                                        label={section.whyLabel ?? whyLabel}
                                    />
                                </div>
                            ) : null}
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}
