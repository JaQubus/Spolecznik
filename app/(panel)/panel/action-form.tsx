"use client";

import { CircleCheck } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import type { ActionResult } from "./actions";

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
            <CircleCheck aria-hidden className="mt-1 size-5 shrink-0 text-primary" />
            {state.message}
          </p>
        )}
        {state && !state.ok && <FieldError>{state.message}</FieldError>}
      </div>
    </form>
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
