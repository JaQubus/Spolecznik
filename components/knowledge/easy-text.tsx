"use client";

import { useState } from "react";
import { FilterChip } from "@/components/ui/chip";

/** Przełącznik „Łatwy tekst”: streszczenie w tekście łatwym do czytania (pole etr_summary). */
export function EasyText({ text }: { text: string }) {
  const [on, setOn] = useState(false);

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
