import { CircleAlert } from "lucide-react";
import { cn } from "cn";

/** Podpowiedź pod etykietą pola; podłącz przez aria-describedby (TextField.md: etykieta, podpowiedź, błąd, pole). */
export function FieldHint({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-base text-muted-foreground", className)} {...props} />;
}

/** Błąd pola: pogrubiony, z ikoną i ukrytym „Błąd:”, żeby nie polegać na samym kolorze. */
export function FieldError({ className, children, ...props }: React.ComponentProps<"p">) {
  if (!children) return null;
  return (
    <p className={cn("flex items-start gap-2 text-base font-bold text-destructive", className)} {...props}>
      <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
      <span><span className="sr-only">Błąd: </span>{children}</span>
    </p>
  );
}
