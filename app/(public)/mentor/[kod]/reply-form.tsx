"use client";

import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { useActionState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { replyAsExpert, type ReplyResult } from "../actions";

/** Odpowiedź eksperta: wynik ogłaszany w role="status", pole czyszczone po wysłaniu. */
export function ReplyForm({ code, name }: { code: string; name: string }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: ReplyResult, fd: FormData) => {
    const result = await replyAsExpert(prev, fd);
    if (result?.ok) form.current?.reset();
    return result;
  }, null);
  return (
    <form ref={form} action={action} className="max-w-2xl space-y-4">
      <input type="hidden" name="code" value={code} />
      <div className="space-y-2">
        <Label htmlFor="odpowiedz">Twoja odpowiedź</Label>
        <FieldHint id="odpowiedz-pomoc">
          Podpiszemy ją: {name}. Możesz podać kontakt do instytucji; nie wpisuj danych osobowych autora ani innych osób.
        </FieldHint>
        <Textarea id="odpowiedz" name="body" required minLength={2} maxLength={2000} aria-describedby="odpowiedz-pomoc" className="min-h-28" />
      </div>
      <Button type="submit" disabled={pending}>{pending ? "Wysyłanie…" : "Wyślij odpowiedź"}</Button>
      <div role="status">
        {state?.ok && (
          <p className="flex items-start gap-2 font-bold">
            <CheckCircleIcon aria-hidden className="mt-1 size-5 shrink-0 text-primary" />
            {state.message}
          </p>
        )}
        {state && !state.ok && <FieldError>{state.message}</FieldError>}
      </div>
    </form>
  );
}
