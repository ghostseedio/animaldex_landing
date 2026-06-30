"use client";

import {useState} from "react";

type FaqSectionProps = {
    title: string;
    description: string;
    trustItems: string[];
    items: {
        question: string;
        answer: string;
    }[];
}

export default function FaqSection({title, description, trustItems, items}: FaqSectionProps) {
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <div className="w-full max-w-5xl pt-14 md:pt-24">
            <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
                <h3 className="font-display text-5xl font-bold leading-[0.95] text-white md:text-6xl lg:text-7xl">
                    {title}
                </h3>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-200 md:text-xl md:leading-9">
                    {description}
                </p>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-2.5 md:mt-10 md:gap-3">
                {trustItems.map((item) => (
                    <span
                        key={item}
                        className="inline-flex items-center gap-2 rounded-full border border-line-300/70 bg-surface-900/45 px-4 py-2 text-sm font-semibold text-ink-200 backdrop-blur md:text-base"
                    >
                        <span className="grid h-4 w-4 place-items-center rounded-full bg-primary-400/15 text-[10px] font-black text-primary-200">
                            ✓
                        </span>
                        {item}
                    </span>
                ))}
            </div>

            <div className="mt-12 border-y border-line-300/70 md:mt-16">
                {items.map((item, index) => {
                    const isOpen = openIndex === index;
                    const panelId = `home-faq-panel-${index}`;
                    const buttonId = `home-faq-button-${index}`;

                    return (
                        <div
                            key={item.question}
                            className={`border-t first:border-t-0 transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                                isOpen ? "border-primary-400/35" : "border-line-300/70"
                            }`}
                        >
                            <button
                                id={buttonId}
                                type="button"
                                aria-expanded={isOpen}
                                aria-controls={panelId}
                                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                                className="group -mx-3 flex w-[calc(100%+1.5rem)] cursor-pointer items-center justify-between gap-5 rounded-2xl px-3 py-7 text-left transition-[background-color,box-shadow,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:py-10 md:hover:bg-primary-400/[0.035] md:hover:shadow-[0_0_44px_rgba(50,219,101,0.06)]"
                            >
                                <span className="font-display text-[1.38rem] font-bold leading-[1.08] text-white md:text-[2.1rem]">
                                    {item.question}
                                </span>
                                <span
                                    aria-hidden="true"
                                    className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:h-12 md:w-12 ${
                                        isOpen
                                            ? "rotate-180 border-primary-400/70 bg-primary-400/12 text-primary-100"
                                            : "border-line-300 bg-surface-900/55 text-primary-200 group-hover:border-primary-400/55"
                                    }`}
                                >
                                    <span className="absolute h-0.5 w-4 rounded-full bg-current" />
                                    <span
                                        className={`absolute h-4 w-0.5 rounded-full bg-current transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                                            isOpen ? "scale-y-0 opacity-0" : "scale-y-100 opacity-100"
                                        }`}
                                    />
                                </span>
                            </button>
                            <div
                                id={panelId}
                                role="region"
                                aria-labelledby={buttonId}
                                className={`grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                                }`}
                            >
                                <div className="overflow-hidden">
                                    <p
                                        className={`max-w-3xl pb-10 text-lg leading-8 text-ink-200 transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] md:pb-12 md:text-xl md:leading-9 ${
                                            isOpen ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
                                        }`}
                                    >
                                        {item.answer}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
