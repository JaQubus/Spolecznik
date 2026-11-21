"use client";

import { ArrowRightIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { SELF_SERVICE_PARTNER_KINDS } from "@/lib/innovations/partner-profile";
import { PARTNER_KINDS, PARTNER_SUPPORT_KEYS, SECTOR_KEYS, TRL_MAX, TRL_MIN, partnerSupportLabel, sectorLabel } from "@/lib/taxonomy";
import { submitPartnerProfile, type PartnerFormState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return <Button type="submit" size="lg" disabled={pending}>{pending ? "Zapisywanie…" : "Zapisz profil"}</Button>;
}

const trlOptions = Array.from({ length: TRL_MAX - TRL_MIN + 1 }, (_, i) => TRL_MIN + i);

/** Profil partnera: organizacja, sektory, formy wsparcia, TRL i (opcjonalnie) e-mail na alerty. Wynik ogłasza aria-live. */
export function PartnerForm() {
  const [state, action] = useActionState<PartnerFormState, FormData>(submitPartnerProfile, null);
  const errors = state && !state.ok ? state.errors ?? {} : {};
  const summary = useRef<HTMLDivElement>(null);
  const result = useRef<HTMLDivElement>(null);

  // Po wysłaniu fokus na komunikat: błąd albo potwierdzenie, żeby czytnik ekranu go odczytał.
  useEffect(() => {
    if (state && !state.ok) summary.current?.focus();
    if (state?.ok) result.current?.focus();
  }, [state]);

  if (state?.ok) {
    return (
      <div ref={result} tabIndex={-1} className="space-y-6 outline-none" role="status">
        <Alert tone="success" title={`Zapisaliśmy profil: ${state.name}`}>
          <p>Zespół sprawdzi go i zatwierdzi. Dopiero wtedy organizacja trafi na listy dopasowań do innowacji.</p>
          {state.alert && <p>Alerty będą przychodzić na podany adres. W każdej wiadomości jest link do wypisania się.</p>}
          {state.alertFailed && <p>Nie udało się włączyć alertów e-mail. Profil jest zapisany, spróbuj ustawić alerty później.</p>}
        </Alert>
        <section aria-labelledby="pasuje" className="space-y-3">
          <h2 id="pasuje" className="text-2xl font-bold">Już teraz pasuje do Twojego profilu</h2>
          {state.matches.length === 0 ? (
            <p className="max-w-[68ch]">Na razie nic nie pasuje do wybranych sektorów i zakresu TRL. <Link href="/innowacje" className="underline decoration-1 underline-offset-4 hover:decoration-2">Przejrzyj całą bazę innowacji</Link>.</p>
          ) : (
            <ul className="max-w-[56rem] divide-y border-y">
              {state.matches.map((m) => (
                <li key={m.href} className="space-y-1 py-4">
                  <h3 className="text-xl font-bold"><Link href={m.href} className="underline decoration-1 underline-offset-4 hover:decoration-2">{m.title}</Link></h3>
                  <p>{m.summary}</p>
                </li>
              ))}
            </ul>
          )}
          <p><Link href="/innowacje" className="inline-flex min-h-12 items-center gap-2 font-bold underline decoration-1 underline-offset-4 hover:decoration-2">Wszystkie innowacje <ArrowRightIcon aria-hidden className="size-5" /></Link></p>
        </section>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="max-w-2xl space-y-8">
      <div ref={summary} tabIndex={-1} className="outline-none">
        {state && !state.ok && <Alert tone="error" title={state.message} />}
      </div>

      {/* Pole-pułapka dla botów: poza ekranem i poza kolejnością Tab, bez etykiety dla czytnika. */}
      <div aria-hidden className="absolute -left-[9999px]">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="p-name">Nazwa organizacji</Label>
        <FieldHint id="p-name-pomoc">Firma, fundusz, centrum transferu technologii albo samorząd. Bez imion i nazwisk.</FieldHint>
        <Input id="p-name" name="name" required maxLength={120} autoComplete="organization" aria-describedby="p-name-pomoc p-name-blad" aria-invalid={!!errors.name} />
        <FieldError id="p-name-blad">{errors.name}</FieldError>
      </div>

      <div className="space-y-2">
        <Label htmlFor="p-kind">Rodzaj organizacji</Label>
        <NativeSelect id="p-kind" name="kind" required defaultValue="" aria-describedby="p-kind-blad" aria-invalid={!!errors.kind}>
          <option value="" disabled>Wybierz</option>
          {SELF_SERVICE_PARTNER_KINDS.map((k) => <option key={k} value={k}>{PARTNER_KINDS[k].label}</option>)}
        </NativeSelect>
        <FieldError id="p-kind-blad">{errors.kind}</FieldError>
      </div>

      <div className="space-y-2">
        <Label htmlFor="p-description">Czego szukasz</Label>
        <FieldHint id="p-description-pomoc">Kilka zdań: jaką innowację chcesz wdrożyć albo sfinansować i do czego jej potrzebujesz. Nie wpisuj danych osobowych.</FieldHint>
        <Textarea id="p-description" name="description" required minLength={20} maxLength={600} aria-describedby="p-description-pomoc p-description-blad" aria-invalid={!!errors.description} className="min-h-32" />
        <FieldError id="p-description-blad">{errors.description}</FieldError>
      </div>

      <fieldset className="space-y-1" aria-describedby="p-sectors-blad">
        <legend className="mb-1 text-lg font-bold">Sektory</legend>
        {SECTOR_KEYS.map((k) => <CheckboxField key={k} name="sectors" value={k} label={sectorLabel(k)} />)}
        <FieldError id="p-sectors-blad">{errors.sectors}</FieldError>
      </fieldset>

      <fieldset className="space-y-1" aria-describedby="p-support-blad">
        <legend className="mb-1 text-lg font-bold">Jak możesz pomóc</legend>
        {PARTNER_SUPPORT_KEYS.map((k) => <CheckboxField key={k} name="support" value={k} label={partnerSupportLabel(k)} />)}
        <FieldError id="p-support-blad">{errors.support}</FieldError>
      </fieldset>

      <fieldset className="space-y-3" aria-describedby="p-trl-pomoc p-trl-blad">
        <legend className="text-lg font-bold">Etap gotowości technologii (nieobowiązkowo)</legend>
        <FieldHint id="p-trl-pomoc">TRL 1–3 to pomysł, 4–6 pilotaż, 7–9 rozwiązanie gotowe do wdrożenia. Innowacje bez TRL (np. organizacyjne) pokażemy niezależnie od zakresu.</FieldHint>
        <div className="flex flex-wrap gap-6">
          <div className="space-y-2">
            <Label htmlFor="p-trl-min">TRL od</Label>
            <NativeSelect id="p-trl-min" name="trlMin" defaultValue="" className="w-40">
              <option value="">dowolny</option>
              {trlOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-trl-max">TRL do</Label>
            <NativeSelect id="p-trl-max" name="trlMax" defaultValue="" className="w-40" aria-invalid={!!errors.trlMax}>
              <option value="">dowolny</option>
              {trlOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </NativeSelect>
          </div>
        </div>
        <FieldError id="p-trl-blad">{errors.trlMax}</FieldError>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="p-email">Adres e-mail organizacji na alerty (nieobowiązkowo)</Label>
        <FieldHint id="p-email-pomoc">Wyślemy wiadomość, gdy pojawi się nowa innowacja z wybranych sektorów i zakresu TRL. Podaj adres organizacji, nie prywatny. Wypiszesz się jednym kliknięciem.</FieldHint>
        <Input id="p-email" name="email" type="email" maxLength={254} autoComplete="email" aria-describedby="p-email-pomoc p-email-blad" aria-invalid={!!errors.email} />
        <FieldError id="p-email-blad">{errors.email}</FieldError>
      </div>

      <Submit />
      <p className="flex items-start gap-2 text-base text-muted-foreground">
        <CheckCircleIcon aria-hidden className="mt-0.5 size-5 shrink-0" />
        Kontakt z twórcą innowacji zestawia zespół, gdy zgodzą się obie strony. Nikt nie dostaje Twoich danych bez Twojej zgody.
      </p>
    </form>
  );
}
