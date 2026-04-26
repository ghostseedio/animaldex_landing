import {redirect} from "next/navigation";

type ChallengesRedirectPageProps = {
    params: {
        locale: string;
    };
    searchParams?: Record<string, string | string[] | undefined>;
};

function buildQueryString(searchParams?: ChallengesRedirectPageProps["searchParams"]) {
    const params = new URLSearchParams();

    Object.entries(searchParams || {}).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item) => params.append(key, item));
            return;
        }

        if (value !== undefined) {
            params.set(key, value);
        }
    });

    const queryString = params.toString();
    return queryString ? `?${queryString}` : "";
}

export default function ChallengesRedirectPage({params, searchParams}: ChallengesRedirectPageProps) {
    redirect(`/${params.locale}/comparisons${buildQueryString(searchParams)}`);
}
