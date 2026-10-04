"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Nieobowiązkowy e-mail do powiadomień o zgłoszeniu (#65): po wysłaniu, obok prywatnego linku, bo dopiero
 * wtedy jest kod i klucz, którym potwierdzamy, że to autor. Cel i sposób rezygnacji napisane przy polu (RODO).
 */
export function EmailOptIn({ code, accessKey, id = "email-powiadomienia" }: { code: string; accessKey: string; id?: string }) {
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(value: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/kontakt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, key: accessKey, email: value }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Nie udało się zapisać adresu. Spróbuj ponownie za chwilę.");
        return;
      }
      setSaved(value || null);
      setStatus(value ? `Zapisaliśmy. Napiszemy na ${value}, gdy coś się zmieni.` : "Usunęliśmy adres. Nie będziemy pisać.");
      if (!value) setEmail("");
    } catch {
      setError("Brak połączenia. Spróbuj ponownie za chwilę.");
    } finally {
      setBusy(false);
    }
  }

  const describedBy = [`${id}-pomoc`, error && `${id}-blad`].filter(Boolean).join(" ");
  return (
    <form
      className="max-w-2xl space-y-2"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!email.trim()) return setError("Wpisz adres e-mail albo pomiń ten krok.");
        void send(email.trim());
      }}
    >
      <Label htmlFor={id}>Twój e-mail (nieobowiązkowy)</Label>
      <FieldHint id={`${id}-pomoc`}>
        Napiszemy, gdy ROPS albo ekspert odpowie lub zmieni się status. Użyjemy go tylko do tego zgłoszenia,
        a w mailu nie będzie jego treści. Adres usuniesz w każdej chwili, tutaj albo z prywatnego linku.
      </FieldHint>
      <FieldError id={`${id}-blad`}>{error}</FieldError>
      <div className="flex flex-wrap gap-3">
        <Input
          id={id}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className="min-w-0 flex-1 basis-72"
        />
        <Button type="submit" variant="outline" disabled={busy}>Zapisz e-mail</Button>
      </div>
      <p role="status" className="font-bold">{status}</p>
      {saved && (
        <Button type="button" variant="link" className="px-0" disabled={busy} onClick={() => void send("")}>
          Usuń mój e-mail i nie wysyłaj powiadomień
        </Button>
      )}
    </form>
  );
}
