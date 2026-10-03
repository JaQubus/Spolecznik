"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageList } from "@/components/rozmowa/message-list";
import { useLiveThread } from "@/components/rozmowa/use-live-thread";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ThreadMessage } from "@/lib/thread-types";

type ThreadView = { threadId: string | null; messages: ThreadMessage[] };

/** Rozmowa autora zgłoszenia z ROPS i ekspertem. Autor wchodzi po kodzie, więc wszystko idzie przez /api/rozmowy. */
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
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);

  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/rozmowy?kod=${encodeURIComponent(code)}`, { cache: "no-store" }).catch(() => null);
    const json = res?.ok ? await res.json().catch(() => null) : null;
    if (json) setThread({ threadId: json.threadId, messages: json.messages });
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
    setBusy(true);
    try {
      const res = await fetch("/api/rozmowy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, body, expertId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Nie udało się wysłać wiadomości");
      setThread({ threadId: json.threadId, messages: json.messages });
      setBody("");
      setNotice(
        json.removedPersonalData
          ? "Wysłano. Usunęliśmy z wiadomości numery telefonów, adresy e-mail i inne dane osobowe."
          : "Wysłano. Odpowiedź pojawi się tutaj — nie musisz odświeżać strony.",
      );
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Coś poszło nie tak"}. Spróbuj ponownie.`);
    } finally {
      setBusy(false);
    }
  }

  const recipient = expertName ? `ekspert (${expertName}) i pracownik ROPS` : "pracownik ROPS";

  return (
    <div className="space-y-8">
      <MessageList
        messages={thread.messages}
        own="autor"
        empty={`Nikt jeszcze nie napisał. Zacznij rozmowę — wiadomość przeczyta ${recipient}.`}
      />

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
          <p role="status" className="font-bold">{busy ? "Wysyłam…" : notice}</p>
          <Button type="submit" disabled={busy} className="w-full sm:w-auto">Wyślij wiadomość</Button>
        </form>
      )}
    </div>
  );
}
