// Adresy stron publicznych — bez zależności, więc importują je też komponenty klienckie.

/** Sprawdzone rozwiązanie z Polski. Rozwiązanie bez sluga — po id. */
export const patternHref = (slugOrId: string) => `/rozwiazania/${encodeURIComponent(slugOrId)}`;
/** Opublikowana inicjatywa z regionu. */
export const initiativeHref = (slug: string) => `/innowacje/${encodeURIComponent(slug)}`;
/** Strona dziedziny w bazie wiedzy. */
export const domainHref = (slug: string) => `/wiedza/dziedzina/${slug}`;
