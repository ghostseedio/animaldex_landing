import type {ReactNode} from "react";

export function EarnStatusPill({children}: {children: ReactNode}) {
    return (
        <span className="inline-flex w-fit items-center rounded-full border border-primary-200/30 bg-primary-400/10 px-3 py-1 text-[0.68rem] font-black uppercase tracking-[0.18em] text-primary-200">
            {children}
        </span>
    );
}

export function EarnKicker({children}: {children: ReactNode}) {
    return (
        <p className="text-xs font-black uppercase tracking-[0.24em] text-primary-200">{children}</p>
    );
}

export function EarnPageShell({
    children,
    schema
}: {
    children: ReactNode;
    schema?: Record<string, unknown> | Array<Record<string, unknown>>;
}) {
    return (
        <div className="relative w-full overflow-hidden bg-[#07100B]">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.035]"
                style={{
                    backgroundImage:
                        "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")"
                }}
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] bg-[radial-gradient(ellipse_90%_70%_at_50%_-15%,rgba(33,192,94,0.11),transparent_62%)]"
            />
            {schema ? (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{__html: JSON.stringify(schema).replace(/</g, "\\u003c")}}
                />
            ) : null}
            <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-10 md:gap-20 md:px-8 md:py-16">
                {children}
            </div>
        </div>
    );
}

export function EarnFaqList({
    items
}: {
    items: Array<{question: string; answer: string}>;
}) {
    return (
        <dl className="divide-y divide-white/[0.07] border-t border-white/[0.07]">
            {items.map((item) => (
                <div key={item.question} className="grid gap-3 py-7 md:grid-cols-[minmax(0,18rem)_1fr] md:gap-10">
                    <dt className="font-display text-xl font-bold uppercase leading-tight tracking-[0.03em] text-white">
                        {item.question}
                    </dt>
                    <dd className="text-base leading-relaxed text-ink-200">{item.answer}</dd>
                </div>
            ))}
        </dl>
    );
}
