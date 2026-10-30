import {redirect} from "next/navigation";

type TrainPageProps = {
    params: {locale: string};
};

/** The old Train hub (later Explore's Battles): its links land on Explore's Debates. */
export default function TrainPage({params}: TrainPageProps) {
    redirect(`/${params.locale}/app/debates`);
}
