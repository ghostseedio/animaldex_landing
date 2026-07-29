"use client";

import {useEffect} from "react";

const recommendations = {
    birds: {
        name: "Merlin Bird ID",
        reason: "Its bird-only focus, Sound ID, Photo ID and downloadable bird packs make it the specialist choice.",
        url: "https://merlin.allaboutbirds.org/",
        linkLabel: "Visit Merlin Bird ID"
    },
    collect: {
        name: "AnimalDex",
        reason: "It turns real animal sightings into a lasting collection, with progression, comparisons, sets and reasons to keep exploring after each scan.",
        url: "https://animaldex.app/",
        linkLabel: "Visit AnimalDex"
    },
    biology: {
        name: "AnimalDex",
        reason: "It connects identification to animal behaviour, adaptations, lessons and memorable ideas rather than ending at a species name.",
        url: "https://animaldex.app/",
        linkLabel: "Visit AnimalDex"
    },
    log: {
        name: "iNaturalist",
        reason: "Its observation records, taxonomy and community identification workflow make it the strongest choice for documenting wildlife over time.",
        url: "https://www.inaturalist.org/",
        linkLabel: "Visit iNaturalist"
    },
    children: {
        name: "Seek by iNaturalist",
        reason: "Its private, beginner-friendly experience, live camera identification, badges and challenges make nature exploration approachable for families and classrooms.",
        url: "https://www.inaturalist.org/seek",
        linkLabel: "Visit Seek"
    },
    hiking: {
        name: "Seek by iNaturalist",
        reason: "Its on-device identification can work away from reception, while its simple camera experience suits quick discoveries on a walk or trail.",
        url: "https://www.inaturalist.org/seek",
        linkLabel: "Visit Seek"
    },
    photography: {
        name: "iNaturalist",
        reason: "It gives wildlife photographs a structured observation record and lets the community help confirm or refine the identification.",
        url: "https://www.inaturalist.org/",
        linkLabel: "Visit iNaturalist"
    },
    growth: {
        name: "AnimalDex",
        reason: "Its lessons, animal qualities and Wild Profile connect real animal strategies to reflection, motivation and personal development.",
        url: "https://animaldex.app/",
        linkLabel: "Visit AnimalDex"
    }
};

const recommendationMap: Record<string, {name: string; reason: string; url: string; linkLabel: string}> = recommendations;

export default function ManagedSectionInteractions() {
    useEffect(() => {
        const cleanups: Array<() => void> = [];
        document.querySelectorAll<HTMLElement>("[data-app-chooser]").forEach((chooser) => {
            const buttons = Array.from(chooser.querySelectorAll<HTMLButtonElement>("[data-task]"));
            const resultInner = chooser.querySelector<HTMLElement>("[data-result-inner]");
            const nameElement = chooser.querySelector<HTMLElement>("[data-recommendation-name]");
            const reasonElement = chooser.querySelector<HTMLElement>("[data-recommendation-reason]");
            const linkElement = chooser.querySelector<HTMLAnchorElement>("[data-recommendation-link]");
            const linkLabelElement = chooser.querySelector<HTMLElement>("[data-recommendation-link-label]");
            if (!buttons.length || !resultInner || !nameElement || !reasonElement || !linkElement || !linkLabelElement) return;

            const selectTask = (task: string | undefined) => {
                const recommendation = task ? recommendationMap[task] : null;
                if (!recommendation) return;
                buttons.forEach((button) => button.setAttribute("aria-pressed", button.dataset.task === task ? "true" : "false"));
                resultInner.classList.add("is-changing");
                window.setTimeout(() => {
                    nameElement.textContent = recommendation.name;
                    reasonElement.textContent = recommendation.reason;
                    linkElement.href = recommendation.url;
                    linkElement.setAttribute("aria-label", `Visit the official ${recommendation.name} website`);
                    linkLabelElement.textContent = recommendation.linkLabel;
                    resultInner.classList.remove("is-changing");
                }, 140);
            };

            buttons.forEach((button) => {
                const onClick = () => selectTask(button.dataset.task);
                button.addEventListener("click", onClick);
                cleanups.push(() => button.removeEventListener("click", onClick));
            });
        });
        return () => cleanups.forEach((cleanup) => cleanup());
    }, []);

    return null;
}
