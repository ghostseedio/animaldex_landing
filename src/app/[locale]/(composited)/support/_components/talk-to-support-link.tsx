import Link from "@/app/[locale]/_components/link";

type TalkToSupportLinkProps = {
    href: string;
    children: React.ReactNode;
    className?: string;
};

export default function TalkToSupportLink({href, children, className}: TalkToSupportLinkProps) {
    return (
        <Link href={href} className={className}>
            {children}
        </Link>
    );
}
