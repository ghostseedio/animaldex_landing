import {AppPage, AppPageHeader, AppSectionTitle} from "@/app/[locale]/(authenticated)/app/_components/app-ui";
import TrainModuleTile from "@/app/[locale]/(authenticated)/app/train/train-module-tile";
import {getTrainModules} from "@/data/train-modules";

type TrainPageProps = {
    params: {locale: string};
};

export default async function TrainPage({params}: TrainPageProps) {
    const localePrefix = `/${params.locale}`;
    const modules = await getTrainModules(localePrefix);

    return (
        <AppPage>
            <AppPageHeader
                eyebrow="Growth suite"
                title="Train"
                description="Daily rituals, progression missions, collector sets, and sealed packs — everything that grows your collection beyond the scan."
            />
            <AppSectionTitle
                icon="train"
                title="Modules"
                detail="Pick a growth path to open missions, sets, journal, and companion tools."
            />
            <section className="grid gap-5 md:grid-cols-2">
                {modules.map((module) => (
                    <TrainModuleTile key={module.id} module={module} />
                ))}
            </section>
        </AppPage>
    );
}
