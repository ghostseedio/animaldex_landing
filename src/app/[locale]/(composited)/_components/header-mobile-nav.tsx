"use client";

import {useLayoutEffect, useState, type ReactNode} from "react";
import {usePathname} from "next/navigation";
import HeaderLink from "@/app/[locale]/(composited)/_components/header-link";
import {useHeaderMenu} from "@/app/[locale]/(composited)/_components/header-menu";
import {NavCaret} from "@/app/[locale]/(composited)/_components/header-dropdown";
import {DEFAULT_MOBILE_ACCORDION_ID} from "@/data/public-navigation";
import {isNavSectionActive} from "@/lib/nav-active";

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

function AccordionPanel({
    id,
    title,
    open,
    active = false,
    onToggle,
    children
}: {
    id: string;
    title: string;
    open: boolean;
    active?: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    const triggerId = `mobile-nav-trigger-${id}`;
    const panelId = `mobile-nav-panel-${id}`;

    return (
        <div className="border-b border-line-300">
            <button
                id={triggerId}
                type="button"
                className={`relative flex min-h-[3.25rem] w-full items-center justify-between gap-3 px-1 py-2 text-left text-[17px] font-bold leading-tight transition-colors duration-150 hover:text-white focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-primary-300 motion-reduce:transition-none ${
                    open || active ? "text-white" : "text-ink-100"
                }`}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={onToggle}
            >
                <span className="min-w-0 whitespace-normal text-left leading-snug">{title}</span>
                <span className={`shrink-0 transition-colors duration-150 motion-reduce:transition-none ${open ? "text-primary-400" : "text-ink-500"}`}>
                    <NavCaret open={open} />
                </span>
            </button>
            <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                hidden={!open}
                className="nav-panel pb-2"
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
    const pathname = usePathname();
    const [openSection, setOpenSection] = useState<string | null>(DEFAULT_MOBILE_ACCORDION_ID);

    // A plain string, so opening the drawer realigns the accordion but a later
    // re-render never overwrites the section the visitor just chose.
    const moreActive = isNavSectionActive(pathname, moreGroups.flat().map((link) => link.href));
    const activeSectionId = sections.find(
        (section) => isNavSectionActive(pathname, section.links.map((link) => link.href))
    )?.id ?? (moreActive ? "more" : null);

    useLayoutEffect(() => {
        if (!drawerOpen) return;
        setOpenSection(activeSectionId ?? DEFAULT_MOBILE_ACCORDION_ID);
    }, [drawerOpen, activeSectionId]);

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
                        active={activeSectionId === section.id}
                        onToggle={() => toggleSection(section.id)}
                    >
                        <div className="ml-1 flex flex-col border-l border-line-300 pl-3">
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
                active={moreActive}
                onToggle={() => toggleSection("more")}
            >
                <div className="ml-1 flex flex-col border-l border-line-300 pl-3">
                    {moreGroups.map((group, index) => (
                        <div key={index} className={index > 0 ? "mt-2 border-t border-line-300 pt-2" : undefined}>
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
