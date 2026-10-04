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

/** Rozmowa gmin w partnerstwie. Jak rozmowa o zgłoszeniu: autor wchodzi po kodzie i kluczu, wszystko przez /api/partnerstwa. */
export function PartnershipConversation({ code, threadId, initial }: { code: string; threadId: string; initial: ThreadMessage[] }) {
  const [messages, setMessages] = useState(initial);
  const [body, setBody] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);

  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);

  const reload = useCallback(async () => {
    const res = await fetch(`/api/partnerstwa?kod=${encodeURIComponent(code)}&watek=${threadId}`, { cache: "no-store" }).catch(() => null);
    const json = res?.ok ? await res.json().catch(() => null) : null;
    if (json) setMessages(json.messages);
  }, [code, threadId]);

  useLiveThread(threadId, reload);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length < 2) {
      setFieldError("Wpisz wiadomość, np. co już próbowaliście albo o jaki nabór chcecie razem wystąpić.");
      field.current?.focus();
      return;
    }
    setFieldError(null);
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch("/api/partnerstwa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, threadId, body }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Nie udało się wysłać wiadomości");
      setMessages(json.messages);
      setBody("");
      setNotice(
        json.removedPersonalData
          ? "Wysłano. Usunęliśmy z wiadomości numery telefonów, adresy e-mail i inne dane osobowe."
          : "Wysłano. Odpowiedzi pojawią się tutaj — nie musisz odświeżać strony.",
      );
    } catch (e) {
      setError(`${e instanceof Error ? e.message : "Coś poszło nie tak"}. Spróbuj ponownie.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <MessageList messages={messages} empty="Nikt jeszcze nie napisał. Przedstaw się i napisz, czego szukacie." />

      <form onSubmit={submit} noValidate className="max-w-2xl space-y-4">
        {error && <Alert ref={errorBox} tabIndex={-1} tone="error" title="Nie wysłano wiadomości"><p>{error}</p></Alert>}
        <div className="space-y-2">
          <Label htmlFor="wiadomosc">Twoja wiadomość</Label>
          <FieldHint id="wiadomosc-pomoc">
            Przeczytają ją gminy w partnerstwie i pracownik ROPS. Podpiszemy ją nazwą Twojej gminy.
            Nie podawaj nazwisk mieszkańców, numerów telefonów ani adresów.
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
    </div>
  );
}
