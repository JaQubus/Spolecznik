"use client";

import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { useActionState, useEffect, useRef } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { InitiativeCard } from "@/lib/schemas";
import {
  CREATOR_ROLE_KEYS, creatorRoleLabel, INNOVATION_KIND_KEYS, INNOVATION_KINDS, innovationKindLabel, IP_STATUS_KEYS, ipStatusLabel,
  SECTOR_KEYS, sectorLabel, STAGE_KEYS, stageLabel, TRL_LEVELS,
} from "@/lib/taxonomy";
import { claim, type ClaimState } from "./actions";

/** Formularz przejęcia: karta z klasyfikatora jako wartości domyślne, twórca poprawia i potwierdza. */
export function ClaimForm({ code, card }: { code: string; card: InitiativeCard }) {
  const [state, action, pending] = useActionState<ClaimState, FormData>(claim, null);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state?.error) errorRef.current?.focus(); }, [state]);
  const invalid = (f: string) => (state?.field === f ? true : undefined);

  return (
    <form action={action} className="max-w-[44rem] space-y-8">
      <input type="hidden" name="code" value={code} />
      {state?.error && <Alert tone="error" title="Nie zapisaliśmy zmian" ref={errorRef} tabIndex={-1}>{state.error}</Alert>}

      <div className="space-y-2">
        <Label htmlFor="title">Nazwa rozwiązania</Label>
        <Input id="title" name="title" defaultValue={card.title} required minLength={3} maxLength={120} aria-invalid={invalid("title")} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="summary">W jednym–dwóch zdaniach: co to jest i komu pomoże</Label>
        <Textarea id="summary" name="summary" defaultValue={card.summary} required rows={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="problem">Jaki problem rozwiązuje</Label>
        <Textarea id="problem" name="problem" defaultValue={card.problem} required rows={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="solution">Na czym polega rozwiązanie</Label>
        <Textarea id="solution" name="solution" defaultValue={card.solution} required rows={4} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="effects">Co już dało (wyniki testów, wdrożenia)</Label>
        <FieldHint id="effects-hint">Zostaw puste, jeśli jeszcze nic nie wiadomo.</FieldHint>
        <Textarea id="effects" name="effects" defaultValue={card.effects ?? ""} rows={3} aria-describedby="effects-hint" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="beneficiaries">Kto skorzysta</Label>
        <Input id="beneficiaries" name="beneficiaries" defaultValue={card.beneficiaries ?? ""} />
      </div>

      <fieldset className="space-y-1">
        <legend className="mb-2 text-lg font-bold">Typ innowacji</legend>
        {INNOVATION_KIND_KEYS.map((k) => (
          <label key={k} className="flex min-h-12 cursor-pointer items-start gap-3 text-lg">
            <input type="radio" name="innovationKind" value={k} defaultChecked={card.innovationKind === k} required className="mt-3 size-6 shrink-0 accent-foreground" />
            <span>{innovationKindLabel(k)}<span className="block text-base text-muted-foreground">{INNOVATION_KINDS[k].description}</span></span>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="mb-2 text-lg font-bold">Sektory PCI (jeden albo dwa)</legend>
        {SECTOR_KEYS.map((k) => (
          <CheckboxField key={k} name="sectors" value={k} label={sectorLabel(k)} defaultChecked={card.sectors?.includes(k)} aria-invalid={invalid("sectors")} />
        ))}
      </fieldset>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="stage">Etap</Label>
          <NativeSelect id="stage" name="stage" defaultValue={card.stage}>
            {STAGE_KEYS.map((k) => <option key={k} value={k}>{stageLabel(k)}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="trl">Gotowość technologii (TRL)</Label>
          <NativeSelect id="trl" name="trl" defaultValue={card.trl ?? ""} aria-describedby="trl-hint">
            <option value="">Nie dotyczy</option>
            {Object.entries(TRL_LEVELS).map(([n, l]) => <option key={n} value={n}>{l.label}: {l.description}</option>)}
          </NativeSelect>
          <FieldHint id="trl-hint">Tylko dla innowacji technologicznej.</FieldHint>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ipStatus">Ochrona własności intelektualnej</Label>
          <NativeSelect id="ipStatus" name="ipStatus" defaultValue={card.ipStatus ?? ""}>
            <option value="">Nie wiem</option>
            {IP_STATUS_KEYS.map((k) => <option key={k} value={k}>{ipStatusLabel(k)}</option>)}
          </NativeSelect>
        </div>
      </div>

      <fieldset className="space-y-1">
        <legend className="mb-2 text-lg font-bold">Kto to tworzy</legend>
        <FieldHint>Same role, bez imion i nazwisk.</FieldHint>
        {CREATOR_ROLE_KEYS.map((k) => (
          <CheckboxField key={k} name="creatorRoles" value={k} label={creatorRoleLabel(k)} defaultChecked={card.creatorRoles?.includes(k)} />
        ))}
      </fieldset>

      <CheckboxField name="confirm" required aria-invalid={invalid("confirm")}
        label="Potwierdzam, że reprezentuję twórców albo instytucję, w której powstało to rozwiązanie" />

      <Button type="submit" disabled={pending}>
        <CheckCircleIcon aria-hidden className="size-5" /> {pending ? "Zapisywanie…" : "Potwierdź i zgłoś"}
      </Button>
    </form>
  );
}
