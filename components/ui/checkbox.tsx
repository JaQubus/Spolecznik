import { cn } from "cn";

/** Natywny checkbox (Choice.md): zaznaczony = wypełnienie `ink`, cały wiersz z etykietą jest polem trafienia ≥48px. */
export function CheckboxOption({
  id,
  label,
  hint,
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type"> & { id: string; label: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label htmlFor={id} className={cn("flex min-h-12 cursor-pointer items-start gap-3 py-1", className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-[26px] shrink-0 cursor-pointer rounded-[6px] border border-border-strong accent-foreground hover:border-foreground aria-invalid:outline-2 aria-invalid:outline-destructive"
        {...props}
      />
      <span>
        {label}
        {hint && <span className="block text-base text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}
