"use client";

import { DocumentDuplicateIcon } from "@heroicons/react/24/outline";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { privateLinkPath } from "@/lib/thread-types";

const noSubscribe = () => () => {};

const COPY = {
  potrzeba: {
    label: "Prywatny link do rozmowy",
    hint: "Zapisz go, żeby wrócić do rozmowy z innego telefonu albo komputera. Nie pokazuj go innym — kto ma link, może czytać rozmowę.",
  },
  pomysl: {
    label: "Prywatny link do pomysłu",
    hint: "Zapisz go, żeby wrócić do pomysłu i rozmowy z ROPS z innego telefonu albo komputera. Nie pokazuj go innym — kto ma link, może czytać rozmowę.",
  },
};

/** Prywatny link do zgłoszenia: pole tylko do odczytu + „Kopiuj link” (z tekstem, nie sama ikona). */
export function PrivateLink({
  code,
  accessKey,
  kind = "potrzeba",
  id = "prywatny-link",
}: {
  code: string;
  accessKey: string;
  kind?: keyof typeof COPY;
  id?: string;
}) {
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const [copied, setCopied] = useState<string | null>(null);
  const link = `${origin}${privateLinkPath(code, accessKey)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied("Skopiowano link. Wklej go np. w notatkę albo wiadomość do siebie.");
    } catch {
      setCopied("Nie udało się skopiować. Zaznacz link w polu i skopiuj go ręcznie.");
    }
  }

  return (
    <div className="max-w-2xl space-y-2">
      <Label htmlFor={id}>{COPY[kind].label}</Label>
      <FieldHint id={`${id}-pomoc`}>{COPY[kind].hint}</FieldHint>
      <div className="flex flex-wrap gap-3">
        <Input
          id={id}
          readOnly
          value={link}
          aria-describedby={`${id}-pomoc`}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 basis-72 font-mono text-base"
        />
        <Button type="button" variant="outline" onClick={copy}>
          <DocumentDuplicateIcon aria-hidden className="size-5" /> Kopiuj link
        </Button>
      </div>
      <p role="status" className="font-bold">{copied}</p>
    </div>
  );
}
