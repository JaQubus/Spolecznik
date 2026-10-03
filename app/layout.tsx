import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Mono, Atkinson_Hyperlegible_Next } from "next/font/google";
import { A11Y_INIT_SCRIPT } from "@/components/a11y/init-script";
import { SiteHeader } from "@/components/layout/site-header";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// latin-ext jest potrzebne dla polskich znaków.
// Atkinson Hyperlegible: projektowany dla osób słabowidzących (patrz docs/design-system).
// Next nie ma metryk tych krojów do wyliczenia zastępczego fontu, więc fallback podajemy wprost.
const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson", subsets: ["latin", "latin-ext"], weight: ["400", "700"], style: ["normal", "italic"],
  adjustFontFallback: false, fallback: ["system-ui", "Arial", "sans-serif"],
});
const atkinsonMono = Atkinson_Hyperlegible_Mono({
  variable: "--font-atkinson-mono", subsets: ["latin", "latin-ext"], weight: ["500"],
  adjustFontFallback: false, fallback: ["ui-monospace", "Consolas", "monospace"],
});

export const metadata: Metadata = {
  title: { default: "Społecznik", template: "%s · Społecznik" },
  description: "Łączymy potrzeby Małopolski z rozwiązaniami, które już działają.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className={`${atkinson.variable} ${atkinsonMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: A11Y_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <span aria-hidden className="block h-1 border-t-2 border-[var(--flag-white)] bg-[var(--flag-red)]" />
        <a
          href="#tresc"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-foreground focus:px-4 focus:py-3 focus:font-bold focus:text-background"
        >
          Przejdź do treści
        </a>
        <SiteHeader />
        <main id="tresc" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-5">
          {children}
        </main>
        <footer className="bg-secondary px-4 py-8 text-center text-base text-muted-foreground">
          Społecznik · Małopolski Hub Innowacji Społecznych · dane demonstracyjne są syntetyczne
        </footer>
        <Toaster />
      </body>
    </html>
  );
}
