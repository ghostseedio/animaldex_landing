import Link from "@/app/[locale]/_components/link";

type TakeBridgeProps = {
    eyebrow: string;
    body: string;
    cta: string;
    href: string;
};

/**
 * "The usual answer, or the lion's?": the way from a search landing into an
 * animal's take (Nov 2026 positioning). Square, like every container; only
 * the button is a capsule.
 */
export default function TakeBridge({eyebrow, body, cta, href}: TakeBridgeProps) {
    return (
        <aside className="mt-6 max-w-3xl border border-primary-400/40 bg-surface-900/70 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-primary-200">{eyebrow}</p>
            <p className="mt-2 text-lg leading-7 text-white">{body}</p>
            <Link
                href={href}
                className="mt-4 inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-full bg-primary-400 px-6 font-bold text-canvas-950 transition-colors hover:bg-primary-300"
            >
                {cta} <span aria-hidden="true">→</span>
            </Link>
        </aside>
    );
}
