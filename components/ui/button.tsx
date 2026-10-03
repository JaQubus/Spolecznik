import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-3 rounded-full text-lg font-bold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:border-transparent aria-disabled:bg-muted aria-disabled:text-muted-foreground aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-[var(--brand-hover)]",
        destructive:
          "bg-destructive text-background hover:bg-destructive/90",
        outline:
          "border border-foreground bg-background text-foreground hover:bg-secondary",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-muted",
        ghost:
          "underline underline-offset-4 hover:bg-muted",
        link: "text-foreground underline underline-offset-4 decoration-1 hover:decoration-2",
      },
      size: {
        default: "h-14 px-6",
        xs: "h-12 gap-2 px-4 text-base",
        sm: "h-12 gap-2 px-4 text-base",
        lg: "h-16 px-8 text-xl",
        icon: "size-12",
        "icon-xs": "size-12",
        "icon-sm": "size-12",
        "icon-lg": "size-14",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
