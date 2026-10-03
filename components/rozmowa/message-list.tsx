import { formatTime, type ThreadMessage } from "@/lib/thread-types";

/**
 * Wiadomości wątku jako wiersze oddzielone liniami (ResultList), bez dymków i ramek.
 * role="log": nowe wiadomości czytnik ekranu ogłasza sam (aria-live polite), bez przerywania.
 * Odpowiedzi ROPS, eksperta i AI na kremowym tle; kto pisze, mówi zawsze podpis, nie kolor.
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
          {messages.map((m) => (
            <li key={m.id} className={`space-y-1 border-b px-3 py-4 ${m.role === "autor" ? "" : "bg-secondary"}`}>
              <p className="flex flex-wrap items-baseline gap-x-3">
                <strong>{m.role === own ? `Ty (${m.name})` : m.name}</strong>
                <span className="text-base text-muted-foreground">
                  <time dateTime={m.createdAt}>{formatTime(m.createdAt)}</time>
                </span>
              </p>
              <p className="max-w-[68ch] whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
