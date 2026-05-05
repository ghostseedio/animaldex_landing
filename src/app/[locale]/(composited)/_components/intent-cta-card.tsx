import Button from "@/app/[locale]/_components/button";
import Link from "@/app/[locale]/_components/link";

type IntentCtaCardProps = {
    title: string;
    description: string;
    buttonLabel: string;
    buttonHref?: string;
    supportItems?: string[];
    secondaryLinks?: Array<{
        href: string;
        label: string;
    }>;
};

export default function IntentCtaCard({
    title,
    description,
    buttonLabel,
    buttonHref = "https://apps.apple.com/app/6761607780",
    supportItems = [],
    secondaryLinks = []
}: IntentCtaCardProps) {
    return (
        <div className="rounded-4xl border border-line-300 bg-surface-900/80 backdrop-blur px-6 py-8 md:px-10 md:py-10 flex flex-col gap-4 text-center">
            <h2 className="font-display font-bold text-3xl md:text-4xl text-white">{title}</h2>
            <p className="text-ink-200 text-lg md:text-xl">{description}</p>
            <div className="flex justify-center flex-wrap gap-3">
                <Link href={buttonHref}>
                    <Button as="span">{buttonLabel}</Button>
                </Link>
                {secondaryLinks.map((item) => (
                    <Link
                        key={`${item.href}-${item.label}`}
                        href={item.href}
                        className="rounded-full border border-primary-500/30 px-4 py-3 text-primary-200 hover:text-primary-100 text-base md:text-lg"
                    >
                        {item.label}
                    </Link>
                ))}
            </div>
            {supportItems.length > 0 ? (
                <div className="flex justify-center flex-wrap gap-2 pt-1">
                    {supportItems.map((item) => (
                        <span
                            key={item}
                            className="rounded-full border border-line-300/80 px-3 py-1 text-ink-300 text-xs md:text-sm"
                        >
                            {item}
                        </span>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
