/**
 * Shared between the server page and the client rail.
 *
 * It cannot live in `article-toc.tsx`: that module is `"use client"`, so Next
 * turns its exports into client references and the server cannot read the
 * value — importing it there fails at render with "Cannot access
 * .Symbol(Symbol.toPrimitive) on the server".
 */
export const MINIMUM_TOC_SECTIONS = 3;
