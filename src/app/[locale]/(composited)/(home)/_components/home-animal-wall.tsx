import Image from "next/image";
import Link from "@/app/[locale]/_components/link";
import {TALK_HREF} from "@/data/public-navigation";

export type HomeWallAnimal = {slug: string; name: string; power: string | null; image: string};

/**
 * Every face a way into its chat (2026-11-01): the animals people talk to
 * most, square tiles like the app's grid, and a last tile for the rest.
 */
export default function HomeAnimalWall({animals, allLabel}: {animals: HomeWallAnimal[]; allLabel: string}) {
    return (
        <ul className="grid grid-cols-3 gap-px border border-line-200 bg-line-200 sm:grid-cols-4 lg:grid-cols-6">
            {animals.map((animal) => (
                <li key={animal.slug} className="bg-canvas-950 light:bg-surface-900">
                    <Link
                        href={`/talk/${animal.slug}`}
                        title={animal.power ? `${animal.name} · ${animal.power}` : animal.name}
                        className="group relative flex aspect-square flex-col items-center justify-end overflow-hidden p-2 pb-3 transition-colors duration-300 hover:bg-primary-400/[0.08] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-300"
                    >
                        <span aria-hidden="true" className="pointer-events-none absolute inset-[18%] rounded-full bg-[radial-gradient(circle,rgba(167,244,50,0.14),transparent_70%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <span className="relative mb-2 block w-[74%] flex-1">
                            <Image
                                src={animal.image}
                                alt=""
                                fill
                                sizes="(min-width: 1024px) 10rem, (min-width: 640px) 18vw, 24vw"
                                className="object-contain transition-transform duration-300 ease-out group-hover:scale-110 motion-reduce:transition-none"
                            />
                        </span>
                        <span className="relative w-full overflow-hidden text-center font-display text-xs font-bold uppercase leading-tight tracking-[0.06em] text-white [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box] sm:text-sm">
                            {animal.name}
                        </span>
                    </Link>
                </li>
            ))}
            <li className="bg-primary-400">
                <Link
                    href={TALK_HREF}
                    className="group flex aspect-square flex-col items-center justify-center gap-2 p-3 text-center text-canvas-950 transition-colors duration-300 hover:bg-primary-300"
                >
                    <span aria-hidden="true" className="font-display text-4xl font-black leading-none transition-transform duration-300 group-hover:translate-x-1 sm:text-5xl">→</span>
                    <span className="font-display text-sm font-black uppercase leading-tight tracking-[0.04em] sm:text-base">{allLabel}</span>
                </Link>
            </li>
        </ul>
    );
}
