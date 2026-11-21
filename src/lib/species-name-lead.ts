/** "Lions are…" → "Lions (Panthera leo) are…"; a sentence that does not open on the name gets "Lion (Panthera leo): " in front. */
export function nameLead(name: string, scientificName: string, sentence: string) {
    // A field-guide sentence that already names the binomial ("The burrowing parrot (Cyanoliseus patagonus) is…") keeps it once.
    const named = scientificName && sentence.toLowerCase().includes(scientificName.toLowerCase());
    const science = scientificName && !named && scientificName.toLowerCase() !== name.toLowerCase() ? ` (${scientificName})` : "";
    const article = sentence.match(/^(?:(?:the|an?) )?/i)![0].length;
    if (sentence.slice(article, article + name.length).toLowerCase() === name.toLowerCase()) {
        const plural = sentence.slice(article + name.length).match(/^(?:e?s)?(?![a-z])/i);
        if (plural) {
            const end = article + name.length + plural[0].length;
            return `${sentence.slice(0, end)}${science}${sentence.slice(end)}`;
        }
    }
    return `${name}${science}: ${sentence}`;
}
