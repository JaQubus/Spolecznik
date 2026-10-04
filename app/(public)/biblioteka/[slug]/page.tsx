import { permanentRedirect } from "next/navigation";
import { innovationHref } from "@/components/knowledge/tiles";

/**
 * Stary adres opisu innowacji. Jedna strona opisu to /biblioteka/innowacja/[slug] (Zasobnik i pipeline
 * dopasowań); stare linki i zakładki przekierowujemy na stałe. Segmenty kondycja, obszar, innowacja
 * i ucz-sie są statyczne, więc mają pierwszeństwo przed tym [slug].
 */
export default async function Page(props: PageProps<"/biblioteka/[slug]">) {
  permanentRedirect(innovationHref((await props.params).slug));
}
