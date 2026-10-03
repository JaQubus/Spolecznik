import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-36 w-full rounded-lg border-2 border-input bg-background px-4 py-3 text-lg transition-colors placeholder:text-muted-foreground hover:border-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-[3px] aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
