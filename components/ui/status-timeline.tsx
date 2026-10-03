import { CheckIcon } from "@heroicons/react/24/outline";
import { cn } from "cn";

export type TimelineStep = { title: string; note?: string; state: "done" | "current" | "todo" };

/**
 * Oś czasu zgłoszenia jak śledzenie paczki (StatusTimeline.md). Stan czytelny bez koloru:
 * znaczek przy zakończonych, „Teraz” i aria-current przy bieżącym, cieńszy tekst przy przyszłych.
 */
export function StatusTimeline({ steps, className }: { steps: TimelineStep[]; className?: string }) {
  return (
    <ol className={cn("max-w-xl", className)}>
      {steps.map((s, i) => (
        <li
          key={s.title}
          aria-current={s.state === "current" ? "step" : undefined}
          className="relative grid grid-cols-[28px_1fr] gap-x-4 pb-6 last:pb-0"
        >
          {i < steps.length - 1 && (
            <span
              aria-hidden
              className={cn("absolute top-[30px] bottom-0.5 left-[13px] w-0.5", s.state === "done" ? "bg-foreground" : "bg-border-strong")}
            />
          )}
          <span
            aria-hidden
            className={cn(
              "grid size-7 place-content-center rounded-full border-2",
              s.state === "done" && "border-foreground bg-foreground text-background",
              s.state === "current" && "border-foreground bg-background",
              s.state === "todo" && "border-border-strong bg-background"
            )}
          >
            {s.state === "done" && <CheckIcon className="size-[18px]" strokeWidth={3} />}
            {s.state === "current" && <span className="size-3 rounded-full bg-foreground" />}
          </span>
          <div>
            <p className={s.state === "todo" ? "text-muted-foreground" : "font-bold"}>
              {s.title}
              <span className="sr-only">{s.state === "done" ? " (zakończone)" : s.state === "todo" ? " (jeszcze nie)" : ""}</span>
            </p>
            {(s.note || s.state === "current") && (
              <p className="text-base text-muted-foreground">{s.state === "current" ? ["Teraz", s.note].filter(Boolean).join(" · ") : s.note}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
