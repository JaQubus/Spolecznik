"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/chip";
import { FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GROUPS } from "@/lib/schemas";
import { GROUP_LABELS } from "@/lib/taxonomy";
import { GROUP_ICONS } from "./group-icons";

type Group = (typeof GROUPS)[number];

/**
 * Wyszukiwarka i filtr „dla kogo”. Stan żyje w adresie (?dla=seniorzy&q=…), więc link do wyników
 * można wysłać dalej; lista wyników renderuje się po stronie serwera. Nawigacja bez przewijania
 * i bez przeładowania, więc fokus zostaje na naciśniętym filtrze.
 */
export function LibraryFilters({ group, q }: { group: Group | null; q: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [text, setText] = useState(q);
  // Wstecz/dalej w przeglądarce zmienia ?q= — pole ma pokazywać to samo co adres.
  const [shownQ, setShownQ] = useState(q);
  if (q !== shownQ) {
    setShownQ(q);
    setText(q);
  }
  const [pending, startTransition] = useTransition();

  function go(next: { group: Group | null; q: string }) {
    const params = new URLSearchParams();
    if (next.group) params.set("dla", next.group);
    if (next.q.trim()) params.set("q", next.q.trim());
    const qs = params.toString();
    startTransition(() => router.push(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false }));
  }

  return (
    <div className="space-y-6" aria-busy={pending || undefined}>
      <form
        role="search"
        aria-label="Szukaj w bibliotece innowacji"
        onSubmit={(e) => { e.preventDefault(); go({ group, q: text }); }}
        className="flex flex-col gap-4 md:flex-row md:items-end"
      >
        <div className="flex max-w-2xl flex-1 flex-col gap-2">
          <Label htmlFor="szukaj-innowacji">Czego szukasz?</Label>
          <FieldHint id="szukaj-innowacji-pomoc">Np. samotność, dojazd do lekarza, opieka nad dziećmi.</FieldHint>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="szukaj-innowacji"
              name="q"
              type="search"
              value={text}
              maxLength={100}
              onChange={(e) => setText(e.target.value)}
              aria-describedby="szukaj-innowacji-pomoc"
              className="pl-13"
            />
          </div>
        </div>
        <Button type="submit" className="w-full md:w-auto">Szukaj</Button>
      </form>

      <div role="group" aria-labelledby="dla-kogo" className="space-y-3">
        <p id="dla-kogo" className="text-lg font-bold">Dla kogo?</p>
        <ul className="flex flex-wrap gap-2">
          <li>
            <FilterChip pressed={group === null} onClick={() => go({ group: null, q: text })}>Wszystkie</FilterChip>
          </li>
          {GROUPS.map((g) => {
            const Icon = GROUP_ICONS[g];
            const pressed = group === g;
            return (
              <li key={g} className="max-w-full">
                {/* Drugie naciśnięcie wybranego filtra go zdejmuje. */}
                <FilterChip pressed={pressed} className="max-w-full py-2 text-left" onClick={() => go({ group: pressed ? null : g, q: text })}>
                  {!pressed && <Icon aria-hidden className="size-5" />}
                  {GROUP_LABELS[g]}
                </FilterChip>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
