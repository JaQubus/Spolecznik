"use client"

import * as React from "react"
import { cn } from "cn"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-3", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "aspect-square size-[26px] shrink-0 rounded-full border border-border-strong bg-background hover:border-foreground data-[state=checked]:border-[8px] data-[state=checked]:border-foreground disabled:cursor-not-allowed disabled:bg-muted aria-invalid:border-2 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

/** Cały wiersz z etykietą jest polem trafienia, co najmniej 48px (Choice.md). Grupę owiń w fieldset z legend. */
function RadioGroupOption({
  id,
  label,
  hint,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item> & { id: string; label: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <label htmlFor={id} className="flex min-h-12 cursor-pointer items-center gap-3">
      <RadioGroupItem id={id} {...props} />
      <span>
        {label}
        {hint && <span className="block text-base text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}

export { RadioGroup, RadioGroupItem, RadioGroupOption }
