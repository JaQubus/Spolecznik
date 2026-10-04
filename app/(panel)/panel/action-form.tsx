"use client";

import { CheckCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { deleteRecord, type ActionResult } from "./actions";

/** Formularz akcji Panelu: wynik zapisu ogłaszany przez role="status" (aria-live). */
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
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

/**
 * Trwałe usunięcie w dwóch krokach: „Usuń…” rozwija wyjaśnienie, dopiero drugi przycisk usuwa.
 * Bez czerwieni — `danger` jest tylko dla błędów (docs/design-system/README.md).
 */
export function DeleteForm({
  entity,
  id,
  label,
  consequence,
}: {
  entity: "need" | "idea" | "call";
  id: string;
  /** Co usuwamy, np. „zgłoszenie SPL-4K7Q” — do etykiet przycisków. */
  label: string;
  consequence: string;
}) {
  return (
    <details>
      <summary className="inline-flex min-h-12 cursor-pointer items-center gap-2 text-base underline decoration-1 underline-offset-4 hover:decoration-2">
        <TrashIcon aria-hidden className="size-5" /> Usuń <span className="sr-only">{label}</span>
      </summary>
      <ActionForm action={deleteRecord} className="mt-2 max-w-[44rem] space-y-3 rounded-[16px] bg-secondary px-5 py-4">
        <input type="hidden" name="entity" value={entity} />
        <input type="hidden" name="id" value={id} />
        <p>{consequence} Tego nie da się cofnąć.</p>
        <SubmitButton variant="outline" size="sm" pendingText="Usuwanie…" aria-label={`Usuń na stałe: ${label}`}>
          <TrashIcon aria-hidden className="size-5" /> Usuń na stałe
        </SubmitButton>
      </ActionForm>
    </details>
  );
}

export function SubmitButton({
  children,
  pendingText = "Zapisywanie…",
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
