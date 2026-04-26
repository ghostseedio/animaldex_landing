import Link from "@/app/[locale]/_components/link";
import Image from "next/image";

export type TeamMemberProps = {
    href: string;
    name: string;
    role: string;
    img: string;
    buttonText: string;
}

export default function TeamMember({href, name, role, img, buttonText}: TeamMemberProps) {
    return (
        <figure
            className="group border-2 border-line-300 bg-surface-900 rounded-4xl p-4 md:p-8 flex flex-col justify-center duration-300 ease-in-out
            items-center w-72 md:w-96 h-96 md:h-[32rem] hover:border-primary-500 overflow-hidden transition-colors relative"
        >
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(27,196,81,0.22),transparent_45%),linear-gradient(180deg,#1b241f_0%,#111714_100%)] opacity-0 group-hover:opacity-100 duration-300 ease-in-out" />
            <div className="w-full flex-1" />
            <Image src={img} alt={name} className="rounded-full aspect-square mb-6 w-24 md:w-36 border border-line-300 bg-surface-800" width={150} height={150} />
            <h6 className="font-display font-bold text-center text-2xl mb-4 md:text-3xl text-white">{name}</h6>
            <p className="text-xl md:text-2xl text-center text-ink-200">{role}</p>
            <div className="w-full flex-1" />
            <Link
                className="can-hover:translate-y-28 group-hover:translate-y-0 transition-transform w-full py-4 md:py-6 text-xl
                md:text-2xl bg-primary-500 text-canvas-950 rounded-xl active:bg-primary-400 active:text-canvas-950 flex justify-center
                items-center duration-300 ease-in-out"
                href={href}
                data-drag-slider-ignore
            >
                {buttonText}
            </Link>
        </figure>
    )
}
