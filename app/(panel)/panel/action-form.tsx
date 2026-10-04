"use client";

import { CheckCircleIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
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

const DELETED = {
  need: { noun: "zgłoszenie", done: "usunięte" },
  idea: { noun: "pomysł", done: "usunięty" },
  call: { noun: "nabór", done: "usunięty" },
} as const;

/**
 * Trwałe usunięcie: skutki, pole „Rozumiem…” (sprawdzane też w akcji) i przycisk.
 * Na liście (`collapsed`) schowane pod „Usuń”, żeby nie powtarzać formularza w każdym wierszu.
 * Bez czerwieni — `danger` jest tylko dla błędów (docs/design-system/README.md).
 */
export function DeleteForm({
  entity,
  id,
  label,
  consequence,
  collapsed = false,
}: {
  entity: keyof typeof DELETED;
  id: string;
  /** Co usuwamy, np. „zgłoszenie SPL-4K7Q” — do etykiet przycisków. */
  label: string;
  consequence: React.ReactNode;
  collapsed?: boolean;
}) {
  const { noun, done } = DELETED[entity];
  const form = (
    <ActionForm action={deleteRecord} className="max-w-2xl space-y-4">
      <input type="hidden" name="entity" value={entity} />
      <input type="hidden" name="id" value={id} />
      <p>Usunięcia nie można cofnąć. {consequence}</p>
      <CheckboxField name="confirm" required label={`Rozumiem, że ${noun} zostanie ${done} na zawsze`} />
      <SubmitButton variant="outline" pendingText="Usuwanie…" aria-label={`Usuń ${label}`}>
        <TrashIcon aria-hidden className="size-5" /> Usuń {noun}
      </SubmitButton>
    </ActionForm>
  );
  if (!collapsed) return form;
  return (
    <details className="space-y-3">
      <summary className="inline-flex min-h-12 cursor-pointer items-center gap-2 text-base underline decoration-1 underline-offset-4 hover:decoration-2">
        <TrashIcon aria-hidden className="size-5" /> Usuń <span className="sr-only">{label}</span>
      </summary>
      {form}
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
