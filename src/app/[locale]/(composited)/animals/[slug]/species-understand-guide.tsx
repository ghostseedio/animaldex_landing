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
        <section id="understand" className="scroll-mt-28 flex flex-col gap-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-100/85">{eyebrow}</p>
                    <h2 className="mt-2 font-display text-3xl font-bold text-white md:text-5xl">
                        {animalName}
                    </h2>
                    <p className="mt-3 max-w-3xl text-base leading-7 text-ink-200 md:text-lg">{description}</p>
                </div>
            </div>

            <nav
                aria-label={eyebrow}
                className="sticky top-16 z-20 -mx-4 overflow-x-auto border-y border-white/[0.08] bg-canvas-950/90 px-4 py-3 backdrop-blur md:top-20 md:mx-0 md:rounded-full md:border md:px-2"
            >
                <ul className="flex min-w-max gap-1">
                    {sections.map((section) => (
                        <li key={section.id}>
                            <a
                                href={`#${section.id}`}
                                className="inline-flex rounded-full px-3 py-2 text-sm font-semibold text-ink-200 transition hover:bg-white/5 hover:text-white"
                            >
                                {section.navLabel}
                            </a>
                        </li>
                    ))}
                </ul>
            </nav>

            <div className="flex flex-col gap-4">
                {sections.map((section) => (
                    <article
                        key={section.id}
                        id={section.id}
                        className="scroll-mt-36 rounded-[1.5rem] border border-white/[0.08] bg-surface-900/55 p-5 md:p-8"
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <h3 className="font-display text-2xl font-bold text-white md:text-3xl">{section.title}</h3>
                            {section.whyQuestion ? (
                                <AskWhyButton
                                    slug={slug}
                                    question={section.whyQuestion}
                                    label={section.whyLabel ?? whyLabel}
                                />
                            ) : null}
                        </div>
                        <div className="mt-5 text-lg leading-8 text-ink-200">{section.content}</div>
                    </article>
                ))}
            </div>
        </section>
    );
}
