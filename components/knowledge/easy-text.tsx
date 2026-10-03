"use client";

import { useEffect, useState } from "react";
import { FilterChip } from "@/components/ui/chip";

/**
 * Przełącznik „Łatwy tekst”: streszczenie w tekście łatwym do czytania (pole etr_summary).
 * Gdy ktoś ma włączony „Tryb prosty” w pasku dostępności, streszczenie jest od razu rozwinięte.
 */
export function EasyText({ text }: { text: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    // Odczyt klasy z <html> dopiero po hydracji — na serwerze jej nie znamy.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- jednorazowa synchronizacja z ustawieniem dostępności
    if (document.documentElement.classList.contains("a11y-simple")) setOn(true);
  }, []);

  return (
    <div className="space-y-4">
      <FilterChip pressed={on} onClick={() => setOn(!on)} aria-controls="latwy-tekst">
        Łatwy tekst
      </FilterChip>
      <div id="latwy-tekst" hidden={!on} className="max-w-[44rem] rounded-[16px] bg-secondary px-5 py-4">
        <p className="text-xl leading-relaxed">{text}</p>
      </div>
    </div>
  );
}
