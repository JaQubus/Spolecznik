import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { A11Y_INIT_SCRIPT } from "@/components/a11y/init-script";
import { SiteHeader } from "@/components/layout/site-header";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// latin-ext jest potrzebne dla polskich znaków.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: { default: "hubmi.pl", template: "%s · hubmi.pl" },
  description: "Łączymy potrzeby Małopolski z rozwiązaniami, które już działają.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: A11Y_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">
        <a
          href="#tresc"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          Przejdź do treści
        </a>
        <SiteHeader />
        <main id="tresc" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
        <footer className="border-t px-4 py-6 text-center text-sm text-muted-foreground">
          hubmi.pl · Małopolski Hub Innowacji Społecznych · dane demonstracyjne są syntetyczne
        </footer>
        <Toaster />
      </body>
    </html>
  );
}
