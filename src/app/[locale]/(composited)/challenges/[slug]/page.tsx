import {redirect} from "next/navigation";

type ChallengeRedirectPageProps = {
    params: {
        locale: string;
        slug: string;
    };
};

export default function ChallengeRedirectPage({params}: ChallengeRedirectPageProps) {
    redirect(`/${params.locale}/comparisons/${params.slug}`);
}
