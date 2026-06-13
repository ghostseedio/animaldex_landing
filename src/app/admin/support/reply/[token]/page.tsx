import SupportReplyClient from "@/app/admin/support/reply/[token]/support-reply-client";

type SupportReplyPageProps = {
    params: {
        token: string;
    };
};

export default function SupportReplyPage({params}: SupportReplyPageProps) {
    return <SupportReplyClient token={params.token} />;
}

export const dynamic = "force-dynamic";
