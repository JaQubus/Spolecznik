"use client";

import { CheckCircleIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { declineContact, requestContact, type ContactActionResult } from "@/app/(public)/rozmowy/contact-actions";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";

/** Stan prośby o kontakt widziany przez twórcę (bez dat i danych zespołu). */
export type AuthorContactState = {
  id: string;
  status: "oczekuje" | "polaczone" | "odrzucone";
  authorConsent: boolean;
  declinedBy: "author" | "partner" | null;
};

function Submit({ children, pending, label }: { children: React.ReactNode; pending: string; label: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <Button type="submit" variant="outline" size="sm" disabled={busy} aria-label={label}>
      {busy ? pending : children}
    </Button>
  );
}

function Status({ state }: { state: ContactActionResult }) {
  return (
    <div role="status" aria-live="polite">
      {state?.ok && (
        <p className="flex items-start gap-2 font-bold">
          <CheckCircleIcon aria-hidden className="mt-1 size-5 shrink-0 text-primary" />
          {state.message}
        </p>
      )}
      {state && !state.ok && <FieldError>{state.message}</FieldError>}
    </div>
  );
}

/**
 * Przy partnerze: „Poproś o kontakt” albo odpowiedź na propozycję zespołu. Zgoda twórcy to połowa — kontakt
 * powstaje dopiero po zgodzie partnera (lib/contacts.ts). Wynik ogłasza role="status".
 */
export function ContactButton({
  code, partnerId, partnerName, pathway, existing,
}: { code: string; partnerId: string; partnerName: string; pathway?: string; existing?: AuthorContactState }) {
  const [askState, ask] = useActionState(requestContact, null);
  const [declineState, decline] = useActionState(declineContact, null);
  const state = declineState ?? askState;

  if (existing?.status === "polaczone") {
    return <p className="font-bold">Obie strony się zgodziły. Rozmowa trwa w wątku Twojej inicjatywy.</p>;
  }
  if (existing?.status === "odrzucone" && existing.declinedBy === "partner") {
    return <p className="text-muted-foreground">Ten partner nie może teraz współpracować.</p>;
  }

  const hidden = (
    <>
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="partnerId" value={partnerId} />
      {pathway && <input type="hidden" name="pathway" value={pathway} />}
    </>
  );
  const declineForm = existing && (
    <form action={decline}>
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="requestId" value={existing.id} />
      <Submit pending="Zapisywanie…" label={`${existing.authorConsent ? "Wycofaj prośbę" : "Nie, dziękuję"}: ${partnerName}`}>
        {existing.authorConsent ? "Wycofaj prośbę" : "Nie, dziękuję"}
      </Submit>
    </form>
  );

  if (existing?.status === "oczekuje" && existing.authorConsent) {
    return (
      <div className="space-y-2">
        <p>Czekamy na zgodę partnera. Do tego czasu nie widzi Twojego zgłoszenia.</p>
        {!state && declineForm}
        <Status state={state} />
      </div>
    );
  }

  const proposed = existing?.status === "oczekuje" && !existing.authorConsent;
  return (
    <div className="space-y-2">
      {proposed && <p className="font-bold">Zespół proponuje kontakt z tym partnerem.</p>}
      {!state?.ok && (
        <div className="flex flex-wrap gap-3">
          <form action={ask}>
            {hidden}
            <Submit pending="Wysyłanie…" label={`${proposed ? "Zgadzam się na kontakt" : "Poproś o kontakt"}: ${partnerName}`}>
              <ChatBubbleLeftRightIcon aria-hidden className="size-5" />
              {proposed ? "Zgadzam się na kontakt" : "Poproś o kontakt"}
            </Submit>
          </form>
          {proposed && declineForm}
        </div>
      )}
      <Status state={state} />
    </div>
  );
}
