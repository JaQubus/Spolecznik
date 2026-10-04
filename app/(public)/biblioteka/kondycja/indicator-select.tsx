"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

/**
 * Wskaźnik z wybranej kategorii. Zmiana od razu przełącza mapę (zmienia treść, nie przenosi na inną stronę).
 * Strona podaje key={value}, żeby lista wróciła do wartości z adresu.
 */
export function IndicatorSelect({ options, value, hint, query }: {
  options: { key: string; label: string }[];
  value: string;
  /** Krótki opis nad listą, np. „8 wskaźników w kategorii Ludność”. */
  hint: string;
  /** Pozostałe parametry adresu (poziom, wybrana jednostka). */
  query: Record<string, string>;
}) {
  const router = useRouter();
  return (
    <div className="grid gap-2 md:row-span-3 md:grid-rows-subgrid">
      <Label htmlFor="kondycja-lista">Co pokazać</Label>
      <p id="kondycja-lista-opis" className="text-base text-muted-foreground">{hint}</p>
      <NativeSelect
        id="kondycja-lista"
        aria-describedby="kondycja-lista-opis"
        defaultValue={value}
        onChange={(e) => {
          const q = new URLSearchParams({ ...query, wskaznik: e.target.value });
          router.replace(`/biblioteka/kondycja?${q}`, { scroll: false });
        }}
      >
        {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </NativeSelect>
    </div>
  );
}
