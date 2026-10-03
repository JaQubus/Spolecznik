import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "cn";

const TONES = {
  info: { ground: "bg-secondary", icon: Info, iconClass: "", titleClass: "" },
  success: { ground: "bg-brand-soft", icon: CircleCheck, iconClass: "text-primary", titleClass: "" },
  error: { ground: "bg-danger-soft", icon: CircleAlert, iconClass: "text-destructive", titleClass: "text-destructive" },
} as const;

/**
 * Komunikat na miękkim tle, bez ramki (docs/design-system/components/Alert.md).
 * Info i sukces: role="status". Błąd po wysłaniu formularza: role="alert" i fokus (przekaż ref + tabIndex={-1}).
 */
export function Alert({
  tone = "info",
  title,
  children,
  className,
  ...props
}: { tone?: keyof typeof TONES; title?: React.ReactNode } & React.ComponentProps<"div">) {
  const t = TONES[tone];
  const Icon = t.icon;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex max-w-[44rem] items-start gap-3 rounded-[16px] px-5 py-4 text-foreground", t.ground, className)}
      {...props}
    >
      <Icon aria-hidden className={cn("mt-1 size-6 shrink-0", t.iconClass)} />
      <div className="space-y-1">
        {title && <p className={cn("font-bold", t.titleClass)}>{title}</p>}
        {children}
      </div>
    </div>
  );
}
