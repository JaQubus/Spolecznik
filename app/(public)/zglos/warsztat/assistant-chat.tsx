"use client";

import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { innovationHref } from "@/lib/knowledge/hrefs";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AssistantResponse, Fiszka } from "@/lib/schemas";

type Message = { role: "user" | "assistant"; content: string };

const linkClass = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

/**
 * Asystent Pracowni: pyta, podsuwa kierunki i sprawdza nowość tym samym silnikiem co Dopasuj.
 * Każda odpowiedź idzie do aria-live, więc czytnik ekranu ją odczyta.
 */
export function AssistantChat({ fiszka }: { fiszka: () => Fiszka | undefined }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [similar, setSimilar] = useState<AssistantResponse["similar"]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const history: Message[] = [...messages, { role: "user", content }];
    setMessages(history);
    setDraft("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history.slice(-20), fiszka: fiszka() }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Asystent nie odpowiedział");
      const data = json as AssistantResponse;
      setMessages([...history, { role: "assistant", content: data.reply }]);
      setSimilar(data.similar);
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Coś poszło nie tak"}. Spróbuj ponownie.`);
    } finally {
      setBusy(false);
      field.current?.focus();
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      {messages.length > 0 && (
        <ol aria-label="Rozmowa z asystentem" className="space-y-4">
          {messages.map((m, i) => (
            <li key={i} className={m.role === "assistant" ? "rounded-[16px] bg-secondary px-5 py-4" : "px-5"}>
              <p className="text-base font-bold">{m.role === "assistant" ? "Asystent" : "Ty"}</p>
              <p className="whitespace-pre-line">{m.content}</p>
            </li>
          ))}
        </ol>
      )}

      <div aria-live="polite" className="space-y-2">
        {busy && <p className="text-muted-foreground">Asystent pisze odpowiedź…</p>}
        {error && <p className="font-bold text-destructive">{error}</p>}
        {similar.length > 0 && !busy && (
          <div className="space-y-2">
            <p className="font-bold">Podobne rzeczy, które już są</p>
            <ul className="list-disc space-y-1 pl-6">
              {similar.map((s) => (
                <li key={`${s.kind}:${s.id}`}>
                  {s.kind === "innowacja" && s.slug ? (
                    <Link href={innovationHref(s.slug)} className={linkClass}>{s.title}</Link>
                  ) : s.kind === "innowacja" ? (
                    <span>{s.title}</span>
                  ) : (
                    <span>{s.title} <span className="text-muted-foreground">(pomysł w toku)</span></span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(draft); }}
        className="space-y-3"
      >
        <Label htmlFor="asystent-wiadomosc">Napisz do asystenta</Label>
        <FieldHint id="asystent-pomoc">Np. „Czy coś takiego już istnieje?” albo „Jak sprawdzić, czy to zadziała?”.</FieldHint>
        <Textarea
          ref={field}
          id="asystent-wiadomosc"
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-describedby="asystent-pomoc"
        />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" variant="outline" disabled={busy}><PaperAirplaneIcon aria-hidden className="size-4" /> Wyślij</Button>
          {messages.length === 0 && (
            <Button type="button" variant="link" disabled={busy} onClick={() => send("Czy podobne rozwiązanie już istnieje? Czym mój pomysł może się wyróżnić?")}>
              Sprawdź, czy to coś nowego
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
