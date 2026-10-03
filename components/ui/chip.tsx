import { CheckIcon } from "@heroicons/react/24/outline";
import { cn } from "cn";

/**
 * Filtr-pigułka z aria-pressed (Chip.md). Wciśnięty: wypełnienie kolorem tekstu + znaczek, nie sam kolor.
 * Statyczne etykiety (obszary, grupy) to <Badge>; najwyżej 3 na element.
 */
export function FilterChip({
  pressed,
  className,
  children,
  ...props
}: { pressed: boolean } & Omit<React.ComponentProps<"button">, "aria-pressed">) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex min-h-12 items-center gap-2 rounded-full border border-border-strong bg-background px-4 text-base hover:border-foreground aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:font-bold aria-pressed:text-background",
        className
      )}
      {...props}
    >
      {pressed && <CheckIcon aria-hidden className="size-5" />}
      {children}
    </button>
  );
}
