"use client";

import { useActionState, useEffect, useRef } from "react";
import { CheckboxGroup, ErrorSummary, initialFormState, SelectField, TextField, type FormState } from "@/components/knowledge/admin-fields";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { MATERIAL_KIND_LABELS, TYPE_LABELS } from "@/lib/knowledge/labels";
import { INNOVATION_TYPES, MATERIAL_KINDS, type Area, type Fact, type Innovation, type Material } from "@/lib/knowledge/types";
import { GROUPS, MWS_AREAS } from "@/lib/schemas";
import { AREA_LABELS, GROUP_LABELS } from "@/lib/taxonomy";
import { saveArea, saveFact, saveInnovation, saveMaterial } from "./actions";

type Action = (state: FormState, fd: FormData) => Promise<FormState>;

const AREA_OPTIONS = MWS_AREAS.map((a) => ({ value: a, label: AREA_LABELS[a] }));

/** Wspólna rama formularza: podsumowanie błędów z fokusem, komunikat ogólny, przycisk zapisu. */
function EditForm({ action, id, labels, children, submit }: {
  action: Action; id?: string; labels: Record<string, string>; children: (s: FormState) => React.ReactNode; submit: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (Object.keys(state.errors).length) summary.current?.focus();
  }, [state]);

  return (
    <form action={formAction} noValidate className="space-y-8">
      {id && <input type="hidden" name="id" value={id} />}
      <ErrorSummary ref={summary} errors={state.errors} labels={labels} />
      {state.message && <Alert tone="error" title="Nie zapisano"><p>{state.message}</p></Alert>}
      {children(state)}
      <div aria-live="polite">
        <Button type="submit" aria-disabled={pending} disabled={pending}>{pending ? "Zapisuję…" : submit}</Button>
      </div>
    </form>
  );
}

const PublishedField = ({ value }: { value: boolean }) => (
  <CheckboxField name="published" label="Opublikowane (widoczne dla wszystkich)" defaultChecked={value} />
);

// ── Innowacja ───────────────────────────────────────────────

const INNOVATION_LABELS: Record<string, string> = {
  title: "Nazwa", slug: "Adres strony", groups: "Dla kogo", areas: "Obszary", innovationType: "Rodzaj", problem: "Jaki problem rozwiązuje",
  solution: "Na czym polega rozwiązanie", evidence: "Skąd wiemy, że działa", whoCanUse: "Kto może skorzystać",
  beneficiaries: "Grupa docelowa", etrSummary: "Łatwy tekst", video: "Film", pdfUrl: "Opis w PDF", sourceUrl: "Strona źródłowa",
};

export function InnovationForm({ innovation: i }: { innovation: Innovation | null }) {
  return (
    <EditForm action={saveInnovation} id={i?.id} labels={INNOVATION_LABELS} submit="Zapisz innowację">
      {({ errors: e }) => (
        <>
          <TextField name="title" label="Nazwa" required defaultValue={i?.title} error={e.title} />
          <TextField name="slug" label="Adres strony" defaultValue={i?.slug} error={e.slug}
            hint="Końcówka adresu, np. senior-cuder. Zostaw puste, a utworzymy go z nazwy." />
          <CheckboxGroup name="groups" label="Dla kogo" required error={e.groups} defaults={i?.groups ?? []}
            options={GROUPS.map((g) => ({ value: g, label: GROUP_LABELS[g] }))} />
          <CheckboxGroup name="areas" label="Obszary Mapy Wyzwań" error={e.areas} defaults={i?.areas ?? []} options={AREA_OPTIONS}
            hint={i?.areasAuto ? "Obszary przypisano automatycznie. Sprawdź je — po zapisie uznamy je za zatwierdzone." : "Najwyżej 3."} />
          <SelectField name="innovationType" label="Rodzaj rozwiązania" error={e.innovationType} defaultValue={i?.innovationType}
            hint={i?.typeAuto ? "Rodzaj przypisano automatycznie. Sprawdź go." : undefined}
            options={[{ value: "", label: "Nie wybrano" }, ...INNOVATION_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))]} />
          <TextField name="problem" label="1. Jaki problem rozwiązuje" required multiline defaultValue={i?.problem} error={e.problem} />
          <TextField name="beneficiaries" label="Grupa docelowa" multiline rows={3} defaultValue={i?.beneficiaries} error={e.beneficiaries} />
          <TextField name="solution" label="2. Na czym polega rozwiązanie" required multiline defaultValue={i?.solution} error={e.solution} />
          <TextField name="evidence" label="3. Skąd wiemy, że działa" multiline defaultValue={i?.evidence} error={e.evidence}
            hint="Wyniki testu. Jeśli ich nie ma, zostaw puste — pokażemy informację, że ROPS jeszcze ich nie opisał." />
          <TextField name="whoCanUse" label="4. Kto może skorzystać i wdrożyć" required multiline defaultValue={i?.whoCanUse} error={e.whoCanUse} />
          <TextField name="etrSummary" label="Łatwy tekst" multiline rows={3} defaultValue={i?.etrSummary} error={e.etrSummary}
            hint="2–4 krótkie zdania w formie „Ty”, bez trudnych słów. Pokazujemy je po kliknięciu „Łatwy tekst”." />
          <TextField name="video" label="Film na YouTube" type="url" inputMode="url" error={e.video}
            defaultValue={i?.video ? `https://www.youtube.com/watch?v=${i.video.youtubeId}` : ""}
            hint="Wklej link do filmu. Film osadzamy bez ciasteczek, dopiero po kliknięciu." />
          <fieldset className="space-y-1">
            <legend className="text-lg font-bold">Dostępność filmu</legend>
            <CheckboxField name="videoCaptions" label="Film ma napisy" defaultChecked={i?.video?.captions} />
            <CheckboxField name="videoSignLanguage" label="Film ma tłumaczenie na polski język migowy (PJM)" defaultChecked={i?.video?.signLanguage} />
          </fieldset>
          <TextField name="pdfUrl" label="Opis innowacji w PDF (adres)" type="url" inputMode="url" defaultValue={i?.pdfUrl} error={e.pdfUrl} />
          <TextField name="sourceUrl" label="Strona innowacji na rops.krakow.pl" type="url" inputMode="url" defaultValue={i?.sourceUrl} error={e.sourceUrl} />
          <CheckboxField name="dissemination" label="Wybrana do upowszechniania" defaultChecked={i?.dissemination} />
          <PublishedField value={i?.published ?? true} />
        </>
      )}
    </EditForm>
  );
}

// ── Fakt ────────────────────────────────────────────────────

const FACT_LABELS: Record<string, string> = {
  area: "Obszar", displayValue: "Liczba do wyświetlenia", value: "Wartość", unit: "Jednostka", sentence: "Zdanie",
  dataYear: "Rok danych", sourceTitle: "Tytuł źródła", sourcePublisher: "Wydawca", sourceUrl: "Adres źródła",
  sourceYear: "Rok źródła", sourcePage: "Strona", quote: "Cytat",
};

export function FactForm({ fact: f }: { fact: Fact | null }) {
  return (
    <EditForm action={saveFact} id={f?.id} labels={FACT_LABELS} submit="Zapisz fakt">
      {({ errors: e }) => (
        <>
          <SelectField name="area" label="Obszar" required error={e.area} defaultValue={f?.area}
            options={[{ value: "", label: "Wybierz obszar" }, ...AREA_OPTIONS]} />
          <TextField name="displayValue" label="Liczba do wyświetlenia" required defaultValue={f?.displayValue} error={e.displayValue}
            hint="Tak, jak ma ją zobaczyć mieszkaniec, np. „841,5 tys.” albo „co czwarta osoba”." />
          <TextField name="sentence" label="Zdanie prostym językiem" required multiline rows={3} defaultValue={f?.sentence} error={e.sentence}
            hint="Jedno zdanie, co znaczy ta liczba. Pisz sam — nie generuj go automatycznie." />
          <div className="grid max-w-[44rem] gap-6 sm:grid-cols-3">
            <TextField name="value" label="Wartość liczbowa" inputMode="decimal" defaultValue={f?.value} error={e.value} />
            <TextField name="unit" label="Jednostka" defaultValue={f?.unit} error={e.unit} />
            <TextField name="dataYear" label="Rok danych" inputMode="numeric" defaultValue={f?.dataYear} error={e.dataYear} />
          </div>
          <fieldset className="max-w-[44rem] space-y-6 rounded-[16px] bg-secondary p-5">
            <legend className="px-1 text-xl font-bold">Źródło</legend>
            <p>Fakt bez źródła wyświetli się tylko z etykietą „przykład”.</p>
            <TextField name="sourceTitle" label="Tytuł raportu" defaultValue={f?.sourceTitle} error={e.sourceTitle} />
            <TextField name="sourcePublisher" label="Wydawca" defaultValue={f?.sourcePublisher ?? "Regionalny Ośrodek Polityki Społecznej w Krakowie"} error={e.sourcePublisher} />
            <TextField name="sourceUrl" label="Adres raportu" type="url" inputMode="url" defaultValue={f?.sourceUrl} error={e.sourceUrl} />
            <div className="grid gap-6 sm:grid-cols-2">
              <TextField name="sourceYear" label="Rok wydania" inputMode="numeric" defaultValue={f?.sourceYear} error={e.sourceYear} />
              <TextField name="sourcePage" label="Strona" inputMode="numeric" defaultValue={f?.sourcePage} error={e.sourcePage} />
            </div>
            <TextField name="quote" label="Cytat ze źródła" multiline rows={3} defaultValue={f?.quote} error={e.quote}
              hint="Dosłowny fragment raportu z tą liczbą. Pomaga sprawdzić fakt." />
            <CheckboxField name="isExample" label="Liczba przykładowa (bez potwierdzonego źródła)" defaultChecked={f?.isExample} />
          </fieldset>
          <PublishedField value={f?.published ?? true} />
        </>
      )}
    </EditForm>
  );
}

// ── Materiał ────────────────────────────────────────────────

const MATERIAL_LABELS: Record<string, string> = {
  kind: "Rodzaj", title: "Tytuł", description: "Opis", url: "Adres", format: "Format", sizeMb: "Rozmiar", language: "Język", areas: "Obszary", year: "Rok",
};

export function MaterialForm({ material: m }: { material: Material | null }) {
  return (
    <EditForm action={saveMaterial} id={m?.id} labels={MATERIAL_LABELS} submit="Zapisz materiał">
      {({ errors: e }) => (
        <>
          <SelectField name="kind" label="Rodzaj" required error={e.kind} defaultValue={m?.kind}
            options={[{ value: "", label: "Wybierz rodzaj" }, ...MATERIAL_KINDS.map((k) => ({ value: k, label: MATERIAL_KIND_LABELS[k] }))]} />
          <TextField name="title" label="Tytuł" required defaultValue={m?.title} error={e.title} />
          <TextField name="description" label="Opis" multiline rows={3} defaultValue={m?.description} error={e.description}
            hint="Jedno, dwa zdania: czego się z niego dowiem." />
          <TextField name="url" label="Adres pliku lub filmu" required type="url" inputMode="url" defaultValue={m?.url} error={e.url} />
          <div className="grid max-w-[44rem] gap-6 sm:grid-cols-3">
            <TextField name="format" label="Format" defaultValue={m?.format ?? "PDF"} error={e.format} />
            <TextField name="sizeMb" label="Rozmiar w MB" inputMode="decimal" error={e.sizeMb}
              defaultValue={m?.sizeBytes ? String(Math.round(m.sizeBytes / 100_000) / 10).replace(".", ",") : ""} />
            <TextField name="year" label="Rok" inputMode="numeric" defaultValue={m?.year} error={e.year} />
          </div>
          <SelectField name="language" label="Język" defaultValue={m?.language ?? "pl"}
            options={[{ value: "pl", label: "polski" }, { value: "en", label: "angielski" }, { value: "uk", label: "ukraiński" }]} />
          <CheckboxGroup name="areas" label="Obszary" error={e.areas} defaults={m?.areas ?? []} options={AREA_OPTIONS} />
          <PublishedField value={m?.published ?? true} />
        </>
      )}
    </EditForm>
  );
}

// ── Obszar ──────────────────────────────────────────────────

const AREA_LABELS_FORM: Record<string, string> = { name: "Nazwa", lead: "Zdanie na kafel", definition: "Czym jest ten obszar", challenges: "Wyzwania" };

export function AreaForm({ area: a }: { area: Area }) {
  return (
    <EditForm action={saveArea} id={a.key} labels={AREA_LABELS_FORM} submit="Zapisz opis obszaru">
      {({ errors: e }) => (
        <>
          <TextField name="name" label="Nazwa" required defaultValue={a.name} error={e.name} />
          <TextField name="lead" label="Zdanie na kafel" required defaultValue={a.lead} error={e.lead} hint="Najwyżej 120 znaków." />
          <TextField name="definition" label="Czym jest ten obszar" required multiline defaultValue={a.definition} error={e.definition}
            hint="2–3 krótkie zdania prostym językiem." />
          <TextField name="challenges" label="Najważniejsze wyzwania" required multiline rows={6} error={e.challenges}
            defaultValue={a.challenges.join("\n")} hint="Każde wyzwanie w nowej linii." />
          <PublishedField value={a.published} />
        </>
      )}
    </EditForm>
  );
}
