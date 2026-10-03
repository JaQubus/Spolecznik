import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { cn } from "cn";

/**
 * Natywna lista wyboru wyglądająca jak pole tekstowe (TextField.md): białe pole, ramka 2px, 56px wysokości.
 * Natywny <select> działa z klawiaturą, czytnikami ekranu i w formularzu GET bez JavaScriptu.
 */
export function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative w-full max-w-xl", className)}>
      <select
        className="h-14 w-full appearance-none rounded-lg border-2 border-input bg-background pr-12 pl-4 text-lg hover:border-foreground aria-invalid:border-[3px] aria-invalid:border-destructive"
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon aria-hidden className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2" />
    </div>
  );
}
