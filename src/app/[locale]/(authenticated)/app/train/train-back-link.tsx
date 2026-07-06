import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";

type TrainBackLinkProps = {
    href?: string;
    label?: string;
};

export default function TrainBackLink({href = "/app/arena", label = "Arena"}: TrainBackLinkProps) {
    return (
        <Link href={href} aria-label="Back to Arena" className="inline-flex min-h-10 items-center gap-[5px] rounded-xl px-2 text-sm font-bold text-primary-200 transition hover:bg-white/[0.04] hover:text-primary-100">
            <AppIcon name="back" className="h-3.5 w-3.5 stroke-[2.2]" />
            {label}
        </Link>
    );
}
