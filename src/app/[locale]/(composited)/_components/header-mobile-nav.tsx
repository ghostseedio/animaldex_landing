"use client";

import {useLayoutEffect, useState, type ReactNode} from "react";
import HeaderLink from "@/app/[locale]/(composited)/_components/header-link";
import {useHeaderMenu} from "@/app/[locale]/(composited)/_components/header-menu";
import {DEFAULT_MOBILE_ACCORDION_ID} from "@/data/public-navigation";

type MobileNavItem = {
    href: string;
    label: string;
};

type MobileNavSection = {
    id: string;
    title: string;
    links: MobileNavItem[];
};

type HeaderMobileNavProps = {
    sections: MobileNavSection[];
    blog: MobileNavItem;
    moreTitle: string;
    moreGroups: MobileNavItem[][];
};

function AccordionChevron({open}: {open: boolean}) {
    return (
        <svg
            viewBox="0 0 16 16"
            className={`h-4 w-4 shrink-0 text-ink-400 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180 text-primary-200" : ""}`}
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M4.2 6.2a.75.75 0 0 1 1.06 0L8 8.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L4.2 7.26a.75.75 0 0 1 0-1.06Z" />
        </svg>
    );
}

function AccordionPanel({
    id,
    title,
    open,
    onToggle,
    children
}: {
    id: string;
    title: string;
    open: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    const triggerId = `mobile-nav-trigger-${id}`;
    const panelId = `mobile-nav-panel-${id}`;

    return (
        <div className="border-b border-white/[0.06]">
            <button
                id={triggerId}
                type="button"
                className="flex min-h-12 w-full items-center justify-between gap-3 px-1 py-2 text-left text-[17px] font-bold leading-tight text-white transition-colors hover:text-primary-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={onToggle}
            >
                <span className="min-w-0 whitespace-normal text-left leading-snug">{title}</span>
                <AccordionChevron open={open} />
            </button>
            <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                hidden={!open}
                className="pb-2"
            >
                {children}
            </div>
        </div>
    );
}

export default function HeaderMobileNav({
    sections,
    blog,
    moreTitle,
    moreGroups
}: HeaderMobileNavProps) {
    const {open: drawerOpen} = useHeaderMenu();
    const [openSection, setOpenSection] = useState<string | null>(DEFAULT_MOBILE_ACCORDION_ID);

    useLayoutEffect(() => {
        if (drawerOpen) {
            setOpenSection(DEFAULT_MOBILE_ACCORDION_ID);
        }
    }, [drawerOpen]);

    function toggleSection(id: string) {
        setOpenSection((current) => (current === id ? null : id));
    }

    return (
        <div className="flex flex-col">
            {sections.map((section) => {
                const open = openSection === section.id;
                return (
                    <AccordionPanel
                        key={section.id}
                        id={section.id}
                        title={section.title}
                        open={open}
                        onToggle={() => toggleSection(section.id)}
                    >
                        <div className="flex flex-col pl-3">
                            {section.links.map((link) => (
                                <HeaderLink key={`${section.id}-${link.href}`} href={link.href} mobile child>
                                    {link.label}
                                </HeaderLink>
                            ))}
                        </div>
                    </AccordionPanel>
                );
            })}

            <HeaderLink href={blog.href} mobile topLevel>
                {blog.label}
            </HeaderLink>

            <AccordionPanel
                id="more"
                title={moreTitle}
                open={openSection === "more"}
                onToggle={() => toggleSection("more")}
            >
                <div className="flex flex-col pl-3">
                    {moreGroups.map((group, index) => (
                        <div key={index} className={index > 0 ? "mt-2 border-t border-white/[0.06] pt-2" : undefined}>
                            {group.map((link) => (
                                <HeaderLink key={`more-${link.href}`} href={link.href} mobile child>
                                    {link.label}
                                </HeaderLink>
                            ))}
                        </div>
                    ))}
                </div>
            </AccordionPanel>
        </div>
    );
}
