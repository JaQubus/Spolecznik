"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Logowanie linkiem z e-maila (Supabase Auth). Bez haseł — link działa raz. */
export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);

  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) {
      setFieldError("Wpisz adres e-mail w formacie nazwa@domena.pl.");
      field.current?.focus();
      return;
    }
    setFieldError(null);
    setError(null);
    setBusy(true);
    const { error } = await createClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    setBusy(false);
    if (error) setError("Nie udało się wysłać linku. Sprawdź adres i spróbuj ponownie za chwilę.");
    else setSentTo(email.trim());
  }

  if (sentTo) {
    return (
      <Alert tone="success" title="Sprawdź skrzynkę e-mail">
        <p>Wysłaliśmy link do logowania na adres <strong>{sentTo}</strong>. Kliknij go na tym samym urządzeniu.</p>
        <p>Nie widzisz wiadomości? Zajrzyj do folderu „Spam”.</p>
      </Alert>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-md space-y-6">
      {error && <Alert ref={errorBox} tabIndex={-1} tone="error" title="Coś poszło nie tak"><p>{error}</p></Alert>}
      <div className="space-y-2">
        <Label htmlFor="email">Adres e-mail</Label>
        <FieldHint id="email-pomoc">Wyślemy na niego link. Nie potrzebujesz hasła.</FieldHint>
        <FieldError id="email-blad">{fieldError}</FieldError>
        <Input
          ref={field}
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? "email-pomoc email-blad" : "email-pomoc"}
        />
      </div>
      <Button type="submit" disabled={busy} className="w-full sm:w-auto">
        {busy ? "Wysyłam…" : "Wyślij link do logowania"}
      </Button>
    </form>
  );
}
