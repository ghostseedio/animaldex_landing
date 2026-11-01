import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import type {DisagreeExample} from "@/data/animal-perspective";

/**
 * One question, two animals facing each other across it (2026-11-01): the
 * home page's picture of "two animals, two lessons", drawn large.
 * The words are the spec's illustrative copy (DisagreeStill's), and each
 * animal opens its own chat.
 */
export default function HomeSides({example}: {example: DisagreeExample}) {
    return (
        <figure aria-label={example.label} className="flex w-full min-w-0 flex-col items-center gap-8 md:gap-10">
            <p
                className="max-w-[min(100%,36rem)] px-5 py-3 text-center font-display text-2xl font-bold leading-tight text-white md:px-7 md:py-4 md:text-4xl"
                style={{backgroundColor: "var(--ask-bubble-out)", borderRadius: "24px 24px 8px 24px"}}
            >
                {example.question}
            </p>
            <div className="relative grid w-full grid-cols-2 gap-4 sm:gap-8 md:gap-16">
                <span
                    aria-hidden="true"
                    className="absolute left-1/2 top-[22%] z-10 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary-400 font-display text-lg font-black text-canvas-950 shadow-[0_0_40px_rgba(167,244,50,0.35)] md:top-[28%] md:h-16 md:w-16 md:text-2xl"
                >
                    VS
                </span>
                {example.animals.map((animal, index) => (
                    <Link key={animal.slug} href={`/talk/${animal.slug}`} className="group flex min-w-0 flex-col items-center gap-3 text-center md:gap-4">
                        <span className={`relative block aspect-square w-full max-w-[18rem] ${index === 1 ? "-scale-x-100" : ""}`}>
                            <span aria-hidden="true" className="absolute inset-[10%] rounded-full bg-[radial-gradient(circle,rgba(167,244,50,0.16),transparent_70%)] blur-xl" />
                            <Image
                                src={animal.image}
                                alt=""
                                fill
                                sizes="(min-width: 768px) 18rem, 45vw"
                                className="object-contain drop-shadow-[0_24px_50px_rgba(0,0,0,0.45)] transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none"
                            />
                        </span>
                        <span className="min-w-0">
                            <span className="block font-display text-xl font-bold leading-tight text-white md:text-3xl">{animal.name}</span>
                            <span className="mt-1 block text-[11px] font-semibold text-primary-200 md:text-xs">{animal.power}</span>
                        </span>
                        <span
                            className="w-full max-w-[22rem] px-4 py-3 text-left text-sm leading-6 text-white md:text-base md:leading-7"
                            style={{backgroundColor: "var(--ask-bubble-in)", borderRadius: index === 0 ? "6px 19px 19px 19px" : "19px 6px 19px 19px"}}
                        >
                            {animal.reply}
                        </span>
                    </Link>
                ))}
            </div>
            <figcaption className="text-center text-xs leading-5 text-ink-400">{example.caption}</figcaption>
        </figure>
    );
}
