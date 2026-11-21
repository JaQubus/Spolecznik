// Adresy stron publicznych — bez zależności, więc importują je też komponenty klienckie.

/** Opublikowana inicjatywa z regionu. */
export const initiativeHref = (slug: string) => `/innowacje/${encodeURIComponent(slug)}`;
