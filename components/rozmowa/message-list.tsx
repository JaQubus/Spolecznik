import Link from "next/link";
import { formatTime, type ThreadMessage } from "@/lib/thread-types";

const LINK = /\[([^\]\n]+)\]\((\/[^)\s]*|https:\/\/[^)\s]+)\)/g;
const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

/**
 * Odnośniki [tytuł](adres) z odpowiedzi asystenta AI (lib/rops-first-line.ts). Tylko ścieżki w serwisie i https —
 * wiadomości ludzi zostają zwykłym tekstem.
 */
function withLinks(body: string) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of body.matchAll(LINK)) {
    parts.push(body.slice(last, m.index));
    const [, text, href] = m;
    parts.push(
      href.startsWith("/")
        ? <Link key={m.index} href={href} className={linkClass}>{text}</Link>
        : <a key={m.index} href={href} className={linkClass}>{text}</a>,
    );
    last = m.index + m[0].length;
  }
  parts.push(body.slice(last));
  return parts;
}

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
              <p className="max-w-[68ch] whitespace-pre-wrap">{m.role === "ai" ? withLinks(m.body) : m.body}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
