"use client";

import { Search } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Główne wejście ze strony startowej (SearchBar.md): dwa zwykłe pola i jedyny zielony przycisk na stronie.
 * Wysyła GET na /opisz, które od razu zaczyna szukać.
 */
export function SearchBar() {
  const [error, setError] = useState<string | null>(null);
  const problem = useRef<HTMLInputElement>(null);

  return (
    <form
      role="search"
      aria-label="Szukaj rozwiązań"
      action="/opisz"
      method="get"
      noValidate
      onSubmit={(e) => {
        if ((problem.current?.value.trim().length ?? 0) >= 3) return;
        e.preventDefault();
        setError("Napisz w kilku słowach, jaki masz problem, np. „brak transportu dla seniorów”.");
        problem.current?.focus();
      }}
      className="flex flex-col gap-4 md:flex-row md:items-end"
    >
      <div className="flex flex-1 flex-col gap-2">
        <Label htmlFor="problem">Jaki masz problem?</Label>
        <FieldHint id="problem-pomoc">Np. samotność seniorów, brak opieki po szkole, dojazd do lekarza.</FieldHint>
        <FieldError id="problem-blad">{error}</FieldError>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={problem}
            id="problem"
            name="opis"
            maxLength={5000}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "problem-pomoc problem-blad" : "problem-pomoc"}
            onChange={() => error && setError(null)}
            className="pl-13"
          />
        </div>
      </div>
      <div className="flex flex-col gap-2 md:w-64">
        <Label htmlFor="gmina-start">Gmina</Label>
        <FieldHint id="gmina-start-pomoc">Nieobowiązkowo.</FieldHint>
        <Input id="gmina-start" name="gmina" autoComplete="address-level2" aria-describedby="gmina-start-pomoc" />
      </div>
      <Button type="submit" className="w-full md:w-auto">Szukaj</Button>
    </form>
  );
}
