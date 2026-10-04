"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageList } from "@/components/rozmowa/message-list";
import { useLiveThread } from "@/components/rozmowa/use-live-thread";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ThreadMessage, ThreadWaiting } from "@/lib/thread-types";

type ThreadView = { threadId: string | null; messages: ThreadMessage[]; waiting: ThreadWaiting };

/** Co mówimy po wysłaniu, zależnie od tego, co zrobił asystent (lib/first-line.ts). */
const SENT: Record<string, string> = {
  odpowiedz: "Wysłano. Asystent odpowiedział na podstawie Zasobnika — źródła są pod odpowiedzią. Pracownik ROPS też ją zobaczy.",
  przekazano: "Wysłano. Pytanie czeka na pracownika ROPS. Odpowiedź pojawi się tutaj — nie musisz odświeżać strony.",
};
const SENT_DEFAULT = "Wysłano. Odpowiedź pojawi się tutaj — nie musisz odświeżać strony.";

/**
 * Rozmowa autora zgłoszenia z ROPS i ekspertem. Autor wchodzi po kodzie, więc wszystko idzie przez /api/rozmowy.
 * Na każdą wiadomość najpierw odpowiada asystent z Zasobnika albo przekazuje ją do ROPS (#20).
 */
export function Conversation({
  code,
  expertId,
  expertName,
  closed,
  initial,
}: {
  code: string;
  expertId?: string;
  expertName: string | null;
  closed: boolean;
  initial: ThreadView;
}) {
  const [thread, setThread] = useState(initial);
  const [body, setBody] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<false | "wiadomosc" | "pilne">(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);

  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/rozmowy?kod=${encodeURIComponent(code)}`, { cache: "no-store" }).catch(() => null);
    const json = res?.ok ? await res.json().catch(() => null) : null;
    if (json) setThread({ threadId: json.threadId, messages: json.messages, waiting: json.waiting });
  }, [code]);

  useLiveThread(thread.threadId, reload);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length < 2) {
      setFieldError("Wpisz wiadomość, np. pytanie do eksperta albo to, co zmieniło się od zgłoszenia.");
      field.current?.focus();
      return;
    }
    setFieldError(null);
    setError(null);
    setNotice(null);
    setBusy("wiadomosc");
    try {
      const res = await fetch("/api/rozmowy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, body, expertId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Nie udało się wysłać wiadomości");
      setThread({ threadId: json.threadId, messages: json.messages, waiting: json.waiting });
      setBody("");
      setNotice(
        `${SENT[json.assistant] ?? SENT_DEFAULT}${json.removedPersonalData ? " Usunęliśmy z wiadomości numery telefonów, adresy e-mail i inne dane osobowe." : ""}`,
      );
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Coś poszło nie tak"}. Spróbuj ponownie.`);
    } finally {
      setBusy(false);
    }
  }

  async function notHelpful() {
    setError(null);
    setNotice(null);
    setBusy("pilne");
    try {
      const res = await fetch("/api/rozmowy/pilne", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Nie udało się przekazać pytania");
      setThread({ threadId: json.threadId, messages: json.messages, waiting: json.waiting });
      setNotice("Przekazaliśmy pytanie pracownikowi ROPS jako pilne. Odpowie tutaj, w tej rozmowie.");
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Coś poszło nie tak"}. Spróbuj ponownie.`);
    } finally {
      setBusy(false);
    }
  }

  // Przycisk tylko pod ostatnią odpowiedzią: gdy po asystencie odpisał już człowiek, nie ma czego zgłaszać.
  const lastReply = thread.messages.findLast((m) => m.role !== "autor");
  const canMarkNotHelpful = lastReply?.role === "ai" && !!lastReply.sources?.length && thread.waiting !== "pilne";

  const recipient = expertName ? `ekspert (${expertName}) i pracownik ROPS` : "pracownik ROPS";

  return (
    <div className="space-y-8">
      <MessageList
        messages={thread.messages}
        own="autor"
        empty={`Nikt jeszcze nie napisał. Zacznij rozmowę — najpierw odpowie asystent z Zasobnika, potem ${recipient}.`}
      />

      {!closed && canMarkNotHelpful && (
        <div className="max-w-2xl space-y-2">
          <p>Odpowiedź asystenta nie pomogła? Przekażemy pytanie pracownikowi ROPS jako pilne.</p>
          <Button type="button" variant="outline" disabled={!!busy} onClick={notHelpful}>
            To nie odpowiada na moje pytanie
          </Button>
        </div>
      )}
      {!closed && thread.waiting === "pilne" && (
        <p className="max-w-2xl font-bold">Twoje pytanie czeka na pracownika ROPS jako pilne.</p>
      )}

      {closed ? (
        <Alert title="Rozmowa jest zamknięta">
          <p>Zgłoszenie jest zamknięte, więc nie można już pisać. Jeśli problem wrócił, opisz go jeszcze raz.</p>
        </Alert>
      ) : (
        <form onSubmit={submit} noValidate className="max-w-2xl space-y-4">
          {error && <Alert ref={errorBox} tabIndex={-1} tone="error" title="Nie wysłano wiadomości"><p>{error}</p></Alert>}
          <div className="space-y-2">
            <Label htmlFor="wiadomosc">Twoja wiadomość</Label>
            <FieldHint id="wiadomosc-pomoc">
              Przeczyta ją {recipient}. Nie podawaj nazwisk, numerów telefonów ani adresów.
            </FieldHint>
            <FieldError id="wiadomosc-blad">{fieldError}</FieldError>
            <Textarea
              ref={field}
              id="wiadomosc"
              rows={4}
              maxLength={2000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              aria-invalid={!!fieldError}
              aria-describedby={fieldError ? "wiadomosc-pomoc wiadomosc-blad" : "wiadomosc-pomoc"}
            />
          </div>
          <p role="status" className="font-bold">{busy === "pilne" ? "Przekazuję pytanie…" : busy ? "Wysyłam. Asystent szuka odpowiedzi w Zasobniku…" : notice}</p>
          <Button type="submit" disabled={!!busy} className="w-full sm:w-auto">Wyślij wiadomość</Button>
        </form>
      )}
    </div>
  );
}
