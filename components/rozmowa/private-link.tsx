"use client";

import { CopyIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { privateLinkPath } from "@/lib/thread-types";

const noSubscribe = () => () => {};

/** Prywatny link do rozmowy: pole tylko do odczytu + „Kopiuj link” (z tekstem, nie sama ikona). */
export function PrivateLink({ code, accessKey, id = "prywatny-link" }: { code: string; accessKey: string; id?: string }) {
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
      <Label htmlFor={id}>Prywatny link do rozmowy</Label>
      <FieldHint id={`${id}-pomoc`}>
        Zapisz go, żeby wrócić do rozmowy z innego telefonu albo komputera. Nie pokazuj go innym — kto ma link,
        może czytać rozmowę.
      </FieldHint>
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
          <CopyIcon aria-hidden /> Kopiuj link
        </Button>
      </div>
      <p role="status" className="font-bold">{copied}</p>
    </div>
  );
}
