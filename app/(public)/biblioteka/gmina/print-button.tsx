"use client";

import { PrinterIcon } from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";

/** Druk raportu: globals.css ([data-print-root]) zostawia na kartce tylko raport, bez nawigacji i przycisków. */
export function PrintButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()} className="print:hidden">
      <PrinterIcon aria-hidden className="size-5" /> Drukuj albo zapisz PDF
    </Button>
  );
}
