// Adresy stron Zasobnika — bez zależności, więc importują je też komponenty klienckie.

/** Jedna strona opisu innowacji (Zasobnik i pipeline dopasowań). Innowacja bez sluga — po id. */
export const innovationHref = (slugOrId: string) => `/biblioteka/innowacja/${encodeURIComponent(slugOrId)}`;
export const areaHref = (slug: string) => `/biblioteka/obszar/${slug}`;
