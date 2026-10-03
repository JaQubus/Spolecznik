"use client";

import { useActionState, useEffect, useRef } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendMagicLink } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(sendMagicLink, null);
  const input = useRef<HTMLInputElement>(null);
  const error = state && !state.ok ? state.message : null;

  // Po błędzie fokus wraca do pola, a czytnik ekranu odczyta komunikat z aria-describedby.
  useEffect(() => { if (error) input.current?.focus(); }, [error, state]);

  if (state?.ok) {
    return <Alert tone="success" title="Sprawdź skrzynkę e-mail"><p>{state.message}</p></Alert>;
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="next" value={next} />
      <div className="space-y-2">
        <Label htmlFor="email">Adres e-mail</Label>
        <FieldHint id="email-pomoc">Wyślemy na niego link do logowania. Nie potrzebujesz hasła.</FieldHint>
        <FieldError id="email-blad">{error}</FieldError>
        <Input
          ref={input}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state?.email}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "email-pomoc email-blad" : "email-pomoc"}
          className="max-w-md"
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Wysyłanie…" : "Wyślij link do logowania"}
      </Button>
    </form>
  );
}
