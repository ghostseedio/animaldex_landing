import Link from "@/app/[locale]/_components/link";
import AppIcon from "@/app/[locale]/(authenticated)/app/_components/app-icon";

type TrainBackLinkProps = {
    href?: string;
    label?: string;
};

export default function TrainBackLink({href = "/app/train", label = "Back to Train"}: TrainBackLinkProps) {
    return (
        <Link href={href} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-bold text-primary-200 transition hover:bg-white/[0.04] hover:text-primary-100">
            <AppIcon name="back" className="h-4 w-4" />
            {label}
        </Link>
    );
}
