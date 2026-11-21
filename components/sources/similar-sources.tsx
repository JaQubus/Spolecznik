import { ArrowTopRightOnSquareIcon, DocumentMagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { SOURCE_LABELS, SOURCE_RECORD_KIND_LABELS, type SimilarSource } from "@/lib/schemas";

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";

/**
 * „Podobne rozwiązanie już istnieje” (Radar 7/10): patenty, publikacje i projekty ze źródeł, które dzielą słowa kluczowe
 * z kartą. Lista bez kart w wierszach; link do źródła otwiera się w nowej karcie i mówi o tym w tekście.
 */
export function SimilarSources({ items, intro, headingId = "podobne-zrodla" }: { items: SimilarSource[]; intro: string; headingId?: string }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="max-w-3xl space-y-3">
      <h2 id={headingId} className="flex items-center gap-2 text-xl font-bold">
        <DocumentMagnifyingGlassIcon aria-hidden className="size-6 shrink-0" />
        Podobne rozwiązanie już istnieje
      </h2>
      <p className="text-muted-foreground">{intro}</p>
      <ul className="divide-y border-y">
        {items.map((s) => (
          <li key={s.id} className="space-y-1 py-3">
            <p className="font-bold">
              {s.url ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 ${linkClass}`}>
                  {s.title}
                  <ArrowTopRightOnSquareIcon aria-hidden className="size-5 shrink-0" />
                  <span className="sr-only"> (otwiera się w nowej karcie)</span>
                </a>
              ) : s.title}
            </p>
            <p className="text-base text-muted-foreground">
              {[SOURCE_LABELS[s.source], SOURCE_RECORD_KIND_LABELS[s.kind], s.institution, s.publishedOn?.slice(0, 4),
                `zgodność słów kluczowych ${Math.round(s.similarity * 100)}%`].filter(Boolean).join(" · ")}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
