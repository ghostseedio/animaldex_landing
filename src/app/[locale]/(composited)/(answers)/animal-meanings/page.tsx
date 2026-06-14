import {redirect} from "next/navigation";

type AnimalMeaningsRedirectPageProps = {
    params: {
        locale: string;
    };
};

export default function AnimalMeaningsRedirectPage({params}: AnimalMeaningsRedirectPageProps) {
    redirect(`/${params.locale}/animal-lessons`);
}
