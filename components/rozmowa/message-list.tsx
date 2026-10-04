import { SparklesIcon } from "@heroicons/react/24/outline";
import { AI_DISCLAIMER, formatTime, type MessageSource, type ThreadMessage } from "@/lib/thread-types";

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";

/**
 * Wiadomości wątku jako wiersze oddzielone liniami (ResultList), bez dymków i ramek.
 * role="log": nowe wiadomości czytnik ekranu ogłasza sam (aria-live polite), bez przerywania.
 * Odpowiedzi ROPS, eksperta i AI na kremowym tle; kto pisze, mówi zawsze podpis, nie kolor.
 * Asystent ma dodatkowo ikonę, napis „Odpowiedź automatyczna”, opis pod treścią i listę źródeł.
 * `own` to rola, której wiadomości podpisujemy „Ty”.
 */
export function MessageList({
  messages,
  own,
  empty,
}: {
  messages: ThreadMessage[];
  own?: ThreadMessage["role"];
  empty: string;
}) {
  return (
    <div role="log" aria-label="Wiadomości w rozmowie" className="max-w-3xl">
      {messages.length === 0 ? (
        <p className="text-muted-foreground">{empty}</p>
      ) : (
        <ol className="border-t">
          {messages.map((m) => {
            const ai = m.role === "ai";
            return (
              <li
                key={m.id}
                className={`space-y-1 border-b px-3 py-4 ${m.role === "autor" ? "" : "bg-secondary"} ${ai ? "border-l-4 border-l-border-strong" : ""}`}
              >
                <p className="flex flex-wrap items-baseline gap-x-3">
                  {ai ? (
                    <strong className="inline-flex items-center gap-2">
                      <SparklesIcon aria-hidden className="size-5 self-center" />
                      {m.name} · Odpowiedź automatyczna
                    </strong>
                  ) : (
                    <strong>{m.role === own ? `Ty (${m.name})` : m.name}</strong>
                  )}
                  <span className="text-base text-muted-foreground">
                    <time dateTime={m.createdAt}>{formatTime(m.createdAt)}</time>
                  </span>
                </p>
                <p className="max-w-[68ch] whitespace-pre-wrap break-words">{m.body}</p>
                {ai && m.sources?.length ? <Sources sources={m.sources} /> : null}
                {ai && <p className="max-w-[68ch] text-base text-muted-foreground">{AI_DISCLAIMER}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

function Sources({ sources }: { sources: MessageSource[] }) {
  return (
    <div className="pt-1 text-base">
      <p className="font-bold">Źródła</p>
      <ul className="list-disc space-y-1 pl-6">
        {sources.map((s, n) => {
          const label =
            s.kind === "raport"
              ? `${s.title}${s.year ? ` (${s.year})` : ""}${s.page ? `, strona ${s.page}` : ""}`
              : `Innowacja w Zasobniku: ${s.title}`;
          return (
            <li key={n}>
              {s.href ? (
                s.kind === "raport" ? (
                  <a href={s.href} target="_blank" rel="noreferrer" className={linkClass}>
                    {label}<span className="sr-only"> (PDF, otwiera się w nowej karcie)</span>
                  </a>
                ) : (
                  <a href={s.href} className={linkClass}>{label}</a>
                )
              ) : (
                label
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
