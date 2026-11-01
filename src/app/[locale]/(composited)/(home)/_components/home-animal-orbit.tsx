import Image from "next/image";
import Link from "@/app/[locale]/_components/link";

export type HomeOrbitAnimal = {slug: string; name: string; image: string};

/**
 * The home hero's picture (2026-11-01, "95% visual"): one animal talking,
 * the others around it, each a way into its own chat. The bubble is the
 * page's example words, not a reply.
 */

// Where each orbiting animal sits in the square, as the centre of its face (left %, top %).
const ORBIT = [
    {left: 14, top: 13, delay: "0s"},
    {left: 86, top: 13, delay: "1.1s"},
    {left: 7, top: 60, delay: "2.3s"},
    {left: 93, top: 58, delay: "0.6s"},
    {left: 22, top: 90, delay: "1.7s"},
    {left: 78, top: 90, delay: "2.9s"}
] as const;

export default function HomeAnimalOrbit({center, animals, bubble, label}: {
    center: HomeOrbitAnimal;
    animals: HomeOrbitAnimal[];
    bubble: string;
    label: string;
}) {
    return (
        <figure aria-label={label} className="relative mx-auto aspect-square w-full max-w-[34rem]">
            {/* The glow stays inside the square: wider, it scrolled a phone's page sideways. */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-[8%] rounded-full bg-[radial-gradient(circle,rgba(167,244,50,0.22),transparent_68%)] blur-2xl" />

            <Link
                href={`/talk/${center.slug}`}
                aria-label={center.name}
                className="group absolute left-1/2 top-[59%] block aspect-square w-[50%] -translate-x-1/2 -translate-y-1/2"
            >
                <Image
                    src={center.image}
                    alt=""
                    fill
                    priority
                    sizes="(min-width: 1024px) 17rem, 50vw"
                    className="object-contain drop-shadow-[0_24px_50px_rgba(0,0,0,0.5)] transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transition-none"
                />
            </Link>

            {/* What it says, pointing down at it. */}
            <p className="theme-dark absolute left-1/2 top-[19%] w-max max-w-[56%] -translate-x-1/2 border border-white/[0.12] bg-[#070A08]/90 px-4 py-2.5 text-center font-display text-base font-bold leading-snug text-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:text-lg"
                style={{borderRadius: "19px 19px 19px 6px"}}
            >
                {bubble}
            </p>

            {animals.slice(0, ORBIT.length).map((animal, index) => {
                const spot = ORBIT[index];

                return (
                    <Link
                        key={animal.slug}
                        href={`/talk/${animal.slug}`}
                        aria-label={animal.name}
                        title={animal.name}
                        className="group absolute block aspect-square w-[21%] -translate-x-1/2 -translate-y-1/2"
                        style={{left: `${spot.left}%`, top: `${spot.top}%`}}
                    >
                        <span
                            className="relative block h-full w-full motion-safe:animate-[homeFloat_6s_ease-in-out_infinite]"
                            style={{animationDelay: spot.delay}}
                        >
                            <Image
                                src={animal.image}
                                alt=""
                                fill
                                sizes="(min-width: 1024px) 7rem, 21vw"
                                className="object-contain drop-shadow-[0_14px_30px_rgba(0,0,0,0.45)] transition-transform duration-300 ease-out group-hover:scale-110 motion-reduce:transition-none"
                            />
                        </span>
                    </Link>
                );
            })}
        </figure>
    );
}
