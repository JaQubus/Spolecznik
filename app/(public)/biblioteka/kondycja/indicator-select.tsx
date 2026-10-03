"use client";

import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

/** Wskaźnik z wybranej kategorii. Zmiana od razu przełącza mapę (zmienia treść, nie przenosi na inną stronę). Strona podaje key={value}, żeby lista wróciła do wartości z adresu. */
export function IndicatorSelect({ options, value, powiat }: {
  options: { key: string; label: string }[];
  value: string;
  powiat: string | null;
}) {
  const router = useRouter();
  return (
    <div className="flex max-w-xl flex-col gap-2">
      <Label htmlFor="kondycja-wskaznik">Co pokazać</Label>
      <NativeSelect
        id="kondycja-wskaznik"
        defaultValue={value}
        onChange={(e) => {
          const q = new URLSearchParams({ poziom: "powiaty", wskaznik: e.target.value, ...(powiat ? { powiat } : {}) });
          router.replace(`/biblioteka/kondycja?${q}`, { scroll: false });
        }}
      >
        {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </NativeSelect>
    </div>
  );
}
