import {AskAnimalFace} from "@/components/ask-animaldex/ask-messenger";
import type {DisagreeExample} from "@/data/animal-perspective";

/**
 * One question and two animals answering it from opposite sides (spec §3.1),
 * in the chat's bubble colours: the person's green, each animal's dark beside
 * its icon art. A still: the words are illustrative copy, not chat replies,
 * and the caption says so.
 */
export default function DisagreeStill({example, className = ""}: {example: DisagreeExample; className?: string}) {
    return (
        <figure aria-label={example.label} className={`flex w-full min-w-0 flex-col gap-4 ${className}`}>
            <div className="flex justify-end pl-12">
                <p
                    className="max-w-full px-4 py-2.5 text-[15px] font-semibold leading-6 text-white"
                    style={{backgroundColor: "var(--ask-bubble-out)", borderRadius: "19px 19px 6px 19px"}}
                >
                    {example.question}
                </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {example.animals.map((animal) => (
                    <div key={animal.slug} className="flex min-w-0 flex-col gap-2">
                        <div className="flex items-center gap-2.5">
                            <AskAnimalFace url={animal.image} size={36} className="ring-1 ring-primary-400/30" />
                            <span className="min-w-0">
                                <span className="block truncate font-display text-base font-bold leading-tight text-white">{animal.name}</span>
                                <span className="block truncate text-[11px] font-semibold text-primary-200">{animal.power}</span>
                            </span>
                        </div>
                        <p
                            className="px-4 py-2.5 text-[15px] leading-6 text-white"
                            style={{backgroundColor: "var(--ask-bubble-in)", borderRadius: "6px 19px 19px 19px"}}
                        >
                            {animal.reply}
                        </p>
                    </div>
                ))}
            </div>
            <figcaption className="text-xs leading-5 text-ink-400">{example.caption}</figcaption>
        </figure>
    );
}
