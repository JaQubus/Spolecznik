import { cn } from "cn";

/**
 * Pole wyboru z etykietą (Choice.md): natywny checkbox, zaznaczony = kolor tekstu (nie zieleń),
 * cały wiersz z etykietą jest celem kliknięcia o wysokości min. 48px.
 */
export function CheckboxField({ label, className, ...props }: { label: React.ReactNode } & Omit<React.ComponentProps<"input">, "type">) {
  return (
    <label className={cn("flex min-h-12 cursor-pointer items-center gap-3 text-lg", className)}>
      <input type="checkbox" className="size-6 shrink-0 cursor-pointer accent-foreground" {...props} />
      <span>{label}</span>
    </label>
  );
}
