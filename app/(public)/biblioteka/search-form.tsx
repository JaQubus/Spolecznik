import { Search } from "lucide-react";
import Form from "next/form";
import { Button } from "@/components/ui/button";
import { FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

/**
 * Wejście do Zasobnika przez pytanie. Zwykły formularz GET (działa bez JavaScriptu); z JavaScriptem
 * next/form przechodzi bez przeładowania strony. Jedyny zielony przycisk na stronie.
 */
export function SearchForm({ defaultValue }: { defaultValue: string }) {
  return (
    <Form action="/biblioteka" role="search" aria-label="Szukaj w bibliotece" scroll={false} className="flex flex-col gap-4 md:flex-row md:items-end">
      <div className="flex flex-1 flex-col gap-2">
        <label htmlFor="pytanie" className="text-2xl font-bold">O czym chcesz się dowiedzieć?</label>
        <FieldHint id="pytanie-pomoc">Np. samotność starszych osób na wsi, praca dla osób z niepełnosprawnością, pomoc dla dzieci z Ukrainy.</FieldHint>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-muted-foreground" />
          <Input id="pytanie" name="q" type="search" defaultValue={defaultValue} maxLength={300} aria-describedby="pytanie-pomoc" className="pl-13" />
        </div>
      </div>
      <Button type="submit" className="w-full md:w-auto">Szukaj</Button>
    </Form>
  );
}
