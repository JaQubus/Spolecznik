"use client"

import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// Kolory idą ze zmiennych CSS (--popover itd.), więc toast pasuje do .dark i .a11y-contrast bez next-themes.
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      toastOptions={{ style: { fontSize: "1rem", boxShadow: "var(--shadow-overlay)" } }}
      icons={{
        success: <CheckCircleIcon aria-hidden className="size-5" />,
        info: <InformationCircleIcon aria-hidden className="size-5" />,
        warning: <ExclamationTriangleIcon aria-hidden className="size-5" />,
        error: <XCircleIcon aria-hidden className="size-5" />,
        loading: <ArrowPathIcon aria-hidden className="size-5 animate-spin" />,
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
