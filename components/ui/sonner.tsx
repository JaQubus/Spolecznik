"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// Kolory idą ze zmiennych CSS (--popover itd.), więc toast pasuje do .dark i .a11y-contrast bez next-themes.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{ style: { fontSize: "1rem", boxShadow: "var(--shadow-overlay)" } }}
      icons={{
        success: <CircleCheckIcon aria-hidden className="size-5" />,
        info: <InfoIcon aria-hidden className="size-5" />,
        warning: <TriangleAlertIcon aria-hidden className="size-5" />,
        error: <OctagonXIcon aria-hidden className="size-5" />,
        loading: <Loader2Icon aria-hidden className="size-5 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "16px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
