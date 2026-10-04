"use client";

import {
  ArrowDownTrayIcon, ArrowTopRightOnSquareIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ClipboardDocumentIcon,
  ExclamationTriangleIcon, PlusIcon, PrinterIcon, SparklesIcon, TrashIcon, XCircleIcon,
} from "@heroicons/react/24/outline";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "cn";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxOption } from "@/components/ui/checkbox";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupOption } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { WORD_CSS } from "../wniosek/application-document";
import { fieldId, formatPLN, getAt, parseAmount, setAt } from "@/lib/form-fields";
import { plural } from "@/lib/pl";
import { MERIT_LABELS, type MeritReview, type PlanDocument } from "@/lib/schemas";
import type { SectionKey, UwContent } from "@/lib/uw-content";
import { GrantDocument, applicationToText } from "./grant-document";
import {
  type Errors, type GrantApplication, type Row,
  STEPS, defaultStart, descriptivePaths, emptyApplication, emptyRow, filledRows, firstInvalidStep, formalChecks, fromPlan,
  indicatorTotals, maskSensitive, monthLabel, planTotal, restore, sensitiveFindings, syncYears, validateStep,
} from "@/lib/uw-application";

// Szkic żyje tylko w localStorage tej przeglądarki: dane wnioskodawcy nie trafiają na serwer. Klucz per plan,
// żeby szkic z jednego planu nie nadpisał drugiego. Do oceny merytorycznej idzie tylko część opisowa.
const storageKey = (planId: string | null) => `wniosek-uw-${planId ?? "bez-planu"}`;

type Ctx = { app: GrantApplication; errors: Errors; content: UwContent; update: (path: string, value: unknown) => void };
const FormCtx = createContext<Ctx | null>(null);
const useForm = () => useContext(FormCtx)!;

function focusField(path: string) {
  const id = fieldId(path);
  const el = document.getElementById(id) ?? document.querySelector<HTMLElement>(`[id^="${id}-"]:not(:checked)`);
  el?.focus();
}

function TextField({
  path, label, hint, multiline, className, ...input
}: { path: string; label: string; hint?: React.ReactNode; multiline?: boolean; className?: string } & Omit<React.ComponentProps<"input">, "value" | "onChange" | "id">) {
  const { app, errors, update } = useForm();
  const id = fieldId(path);
  const error = errors[path];
  const describedBy = [hint && `${id}-pomoc`, error && `${id}-blad`].filter(Boolean).join(" ") || undefined;
  const value = String(getAt(app, path) ?? "");
  const common = { id, value, "aria-invalid": !!error, "aria-describedby": describedBy };
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      {hint && <FieldHint id={`${id}-pomoc`}>{hint}</FieldHint>}
      <FieldError id={`${id}-blad`}>{error}</FieldError>
      {multiline
        ? <Textarea {...common} rows={7} onChange={(e) => update(path, e.target.value)} />
        : <Input {...common} {...input} onChange={(e) => update(path, e.target.value)} />}
    </div>
  );
}

/** Punkt opisowy wzoru: numer i tytuł z treści naboru, podpowiedź z instrukcji ROPS, pytania ze wzoru pod polem. */
function Described({ path, section }: { path: string; section: SectionKey }) {
  const { app, content } = useForm();
  const s = content.sections[section];
  const length = String(getAt(app, path) ?? "").length;
  return (
    <section className="grid gap-2">
      <TextField path={path} multiline label={`${s.n}. ${s.title}`} hint={s.tip} />
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        {s.questions.length > 0 ? (
          <details className="text-base">
            <summary className="cursor-pointer font-bold underline underline-offset-4">Pytania ze wzoru wniosku</summary>
            <ul className="mt-2 list-disc space-y-1 pl-6 text-muted-foreground">{s.questions.map((q) => <li key={q}>{q}</li>)}</ul>
          </details>
        ) : <span />}
        <p className="text-base text-muted-foreground">{length} {plural(length, "znak", "znaki", "znaków")}</p>
      </div>
    </section>
  );
}

/** Lista pól wyboru (grupy docelowe, obszary doświadczenia) z jednym błędem dla całej grupy. */
function CheckGroup({ path, legend, hint, items }: { path: string; legend: string; hint?: string; items: string[] }) {
  const { app, errors, update } = useForm();
  const values = getAt(app, path) as boolean[];
  const error = errors[path];
  const id = fieldId(path);
  return (
    <fieldset className="grid gap-2" aria-describedby={[hint && `${id}-pomoc`, error && `${id}-blad`].filter(Boolean).join(" ") || undefined}>
      <legend className="mb-1 text-lg font-bold">{legend}</legend>
      {hint && <FieldHint id={`${id}-pomoc`}>{hint}</FieldHint>}
      <FieldError id={`${id}-blad`}>{error}</FieldError>
      {items.map((item, i) => (
        <CheckboxOption key={item} id={`${id}-${i}`} checked={values[i]} aria-invalid={!!error && !values[i]}
          onChange={(e) => update(`${path}.${i}`, e.target.checked)} label={item} />
      ))}
    </fieldset>
  );
}

// ---- Krok: dane kontaktowe

function ContactStep() {
  const { app, update } = useForm();
  const w = app.wnioskodawca;
  return (
    <div className="grid gap-10">
      <div className="grid gap-6">
        <TextField path="wnioskodawca.nazwa" label="Nazwa podmiotu" autoComplete="organization" />
        <TextField path="wnioskodawca.adresSiedziby" label="Adres siedziby podmiotu" hint="Ulica i numer, kod pocztowy, miejscowość." />
        <TextField path="wnioskodawca.adresFilii" label="Adres filii, oddziału lub innej formy działalności w Małopolsce (jeśli siedziba jest poza województwem)" />
        <CheckboxOption id={fieldId("wnioskodawca.korespondencjaTaSama")} checked={w.korespondencjaTaSama}
          onChange={(e) => update("wnioskodawca.korespondencjaTaSama", e.target.checked)} label="Adres do korespondencji jest taki sam jak adres siedziby" />
        {!w.korespondencjaTaSama && <TextField path="wnioskodawca.adresKorespondencji" label="Adres do korespondencji" />}
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField path="wnioskodawca.telefon" label="Telefon instytucji" type="tel" hint="Sekretariat albo telefon ogólny, nie prywatny." />
          <TextField path="wnioskodawca.email" label="E-mail instytucji" type="email" hint="Np. sekretariat@gmina.pl, nie prywatny adres." />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField path="wnioskodawca.nip" label="NIP (jeśli dotyczy)" inputMode="numeric" />
          <TextField path="wnioskodawca.krs" label="KRS lub CEIDG (jeśli dotyczy)" />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField path="wnioskodawca.www" label="Strona internetowa (jeśli jest)" type="url" />
          <TextField path="wnioskodawca.social" label="Media społecznościowe (jeśli są)" />
        </div>
      </div>
      <Alert title="Bez danych osobowych">
        <p>
          Pytamy tylko o dane instytucji. Imię, nazwisko i kontakt osoby upoważnionej oraz osoby do kontaktów roboczych
          wpiszesz dopiero w formularzu elektronicznym ROPS. We wniosku zostawimy na nie puste miejsce.
        </p>
      </Alert>
      <div className="grid gap-6 border-t pt-6">
        <CheckboxOption id={fieldId("maRealizatora")} checked={app.maRealizatora}
          onChange={(e) => update("maRealizatora", e.target.checked)}
          label="Usługę będzie realizować inny podmiot (realizator)" hint="Np. jednostka gminy albo organizacja, z którą współpracujesz." />
        {app.maRealizatora && (
          <fieldset className="grid gap-6">
            <legend className="mb-2 text-xl font-bold">Dane realizatora</legend>
            <TextField path="realizator.nazwa" label="Nazwa podmiotu" />
            <TextField path="realizator.adres" label="Adres podmiotu" />
            <TextField path="realizator.adresKorespondencji" label="Adres do korespondencji (jeśli inny)" />
            <div className="grid gap-6 sm:grid-cols-2">
              <TextField path="realizator.telefon" label="Telefon instytucji" type="tel" />
              <TextField path="realizator.email" label="E-mail instytucji" type="email" />
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <TextField path="realizator.nip" label="NIP (jeśli dotyczy)" inputMode="numeric" />
              <TextField path="realizator.krs" label="KRS lub CEIDG (jeśli dotyczy)" />
            </div>
          </fieldset>
        )}
      </div>
    </div>
  );
}

// ---- Krok: usługa

function MonthField({ path, label }: { path: string; label: string }) {
  return <TextField path={path} label={label} type="month" placeholder="RRRR-MM" className="max-w-xs" />;
}

function ServiceStep({ start }: { start: string | null }) {
  const { content } = useForm();
  return (
    <div className="grid gap-10">
      <TextField path="tytul" label={`${content.sections.tytul.n}. ${content.sections.tytul.title}`} hint={content.sections.tytul.tip} />
      <Described path="opis" section="opis" />
      <fieldset className="grid gap-4">
        <legend className="mb-1 text-lg font-bold">{content.sections.daty.n}. {content.sections.daty.title}</legend>
        <FieldHint>{content.sections.daty.tip}{start && ` Daty z planu liczymy od ${monthLabel(start)}. Zmień je, jeśli trzeba.`}</FieldHint>
        <div className="grid gap-6 sm:grid-cols-2">
          <MonthField path="etap1.od" label="Etap 1. Przygotowanie: od" />
          <MonthField path="etap1.do" label="Etap 1. Przygotowanie: do" />
          <MonthField path="etap2.od" label="Etap 2. Wdrażanie: od" />
          <MonthField path="etap2.do" label="Etap 2. Wdrażanie: do" />
        </div>
      </fieldset>
      <CheckGroup path="grupy" legend={`${content.sections.grupy.n}. ${content.sections.grupy.title}`} hint={content.sections.grupy.tip} items={content.targetGroups} />
      <Described path="diagnoza" section="diagnoza" />
      <Described path="rekrutacja" section="rekrutacja" />
      <Described path="liczba" section="liczba" />
      <Described path="obszar" section="obszar" />
      <Described path="efekty" section="efekty" />
    </div>
  );
}

// ---- Krok: plan i koszty

function RowsEditor({ path, legend }: { path: "przygotowanie" | "wdrazanie"; legend: string }) {
  const { app, update } = useForm();
  const rows = app[path] as Row[];
  function add() {
    update(path, [...rows, emptyRow()]);
    setTimeout(() => focusField(`${path}.${rows.length}.dzialanie`), 0);
  }
  return (
    <fieldset className="grid gap-6">
      <legend className="mb-2 text-xl font-bold">{legend}</legend>
      {rows.map((_, i) => (
        <div key={i} role="group" aria-label={`${legend}: działanie ${i + 1}`} className="grid gap-4 border-l-4 border-border pl-4">
          <p className="font-bold">Działanie {i + 1}</p>
          <TextField path={`${path}.${i}.dzialanie`} label="Co zrobisz?" multiline
            hint={i === 0 ? "Forma wsparcia, miejsce, częstotliwość i szacowana liczba uczestników." : undefined} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField path={`${path}.${i}.termin`} label="Kiedy?" placeholder="np. lipiec 2027" />
            <TextField path={`${path}.${i}.koszt`} label="Łączny koszt (zł)" inputMode="decimal" placeholder="np. 1200" />
          </div>
          <TextField path={`${path}.${i}.uzasadnienie`} label="Jak policzono koszt?" placeholder="np. 12 h × 100 zł = 1200 zł" />
          {rows.length > 1 && (
            <Button type="button" variant="link" className="justify-self-start px-0" onClick={() => {
              update(path, rows.filter((_, j) => j !== i));
              setTimeout(() => focusField(`${path}.${Math.min(i, rows.length - 2)}.dzialanie`), 0);
            }}>
              <TrashIcon aria-hidden /> Usuń działanie {i + 1}
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={add}>
        <PlusIcon aria-hidden /> Dodaj działanie
      </Button>
    </fieldset>
  );
}

function PlanStep() {
  const { app, update, content } = useForm();
  const s = content.sections;
  const total = planTotal(app);
  const amount = parseAmount(app.kwota);
  const differs = amount !== null && Math.abs(amount - total) >= 0.01;
  const totals = indicatorTotals(app);
  return (
    <div className="grid gap-10">
      <p className="max-w-[68ch]">{s.plan.tip}</p>
      <RowsEditor path="przygotowanie" legend="Etap przygotowania do wdrożenia usługi" />
      <RowsEditor path="wdrazanie" legend="Etap wdrażania usługi" />

      <fieldset className="grid gap-4 border-t pt-6">
        <legend className="mb-1 text-xl font-bold">{s.wskaznik.title}</legend>
        <FieldHint>{s.wskaznik.tip} Lata wynikają z dat etapu wdrażania.</FieldHint>
        {app.wskaznik.lata.length === 0 && <p>Uzupełnij daty etapu wdrażania w kroku „Usługa i odbiorcy”.</p>}
        {app.wskaznik.lata.map((l, i) => (
          <div key={l.rok} role="group" aria-label={`Rok ${l.rok}`} className="grid gap-4 sm:grid-cols-[6rem_1fr_1fr] sm:items-end">
            <p className="text-lg font-bold sm:pb-4">{l.rok}</p>
            <TextField path={`wskaznik.lata.${i}.k`} label={`Kobiety w ${l.rok} r.`} inputMode="numeric" />
            <TextField path={`wskaznik.lata.${i}.m`} label={`Mężczyźni w ${l.rok} r.`} inputMode="numeric" />
          </div>
        ))}
        <p aria-live="polite">Ogółem: <strong>{totals.total}</strong> (kobiety {totals.k}, mężczyźni {totals.m})</p>
        <TextField path="wskaznik.pomiar" label="Sposób pomiaru" multiline hint="Moment pomiaru i dokumenty, z których policzysz osoby, np. listy obecności." />
      </fieldset>

      <section className="grid gap-4 border-t pt-6">
        <h3 className="text-2xl font-bold">{s.kwota.n}. {s.kwota.title}</h3>
        <p aria-live="polite" className="text-lg">Suma kosztów z planu: <strong>{formatPLN(total)}</strong></p>
        <TextField path="kwota" label="Wnioskowana kwota grantu (zł)" hint={s.kwota.tip} inputMode="decimal" className="max-w-md" />
        {(differs || amount === null) && total > 0 && (
          <div aria-live="polite" className="space-y-2">
            {differs && <p>Kwota różni się od sumy kosztów o {formatPLN(Math.abs(amount! - total))}. We wniosku muszą być równe.</p>}
            <Button type="button" variant="link" className="px-0" onClick={() => update("kwota", String(Math.round(total * 100) / 100).replace(".", ","))}>
              Wpisz sumę z planu: {formatPLN(total)}
            </Button>
          </div>
        )}
      </section>

      <fieldset className="grid gap-4 border-t pt-6">
        <legend className="mb-1 text-xl font-bold">{s.cross.n}. {s.cross.title}</legend>
        <FieldHint>{s.cross.tip}</FieldHint>
        <RadioGroup value={app.cross} onValueChange={(v) => update("cross", v)}>
          <RadioGroupOption id={fieldId("cross.nie")} value="nie" label="Nie" />
          <RadioGroupOption id={fieldId("cross.tak")} value="tak" label="Tak" />
        </RadioGroup>
        {app.cross === "tak" && (
          <>
            <TextField path="crossLista" label="Wydatki w ramach cross-financingu" multiline />
            <TextField path="trwaloscCross" label={`${s.trwaloscCross.n}. ${s.trwaloscCross.title}`} multiline />
          </>
        )}
      </fieldset>
    </div>
  );
}

// ---- Krok: oświadczenia

function DeclarationsStep() {
  const { app, errors, update, content } = useForm();
  const d = content.declarations;
  const error = errors.oswiadczenia;
  return (
    <div className="grid gap-8">
      <Alert title="W skrócie: co potwierdzasz">
        <ul className="list-disc space-y-1 pl-6">{d.summary.map((s) => <li key={s}>{s}</li>)}</ul>
        <p className="pt-1">Pełna treść jest poniżej. Zaznacz tylko to, co jest prawdą: za fałszywe oświadczenie grozi kara.</p>
      </Alert>
      <p className="max-w-[68ch]">{d.attachmentNote}</p>
      <fieldset className="grid gap-4" aria-describedby={error ? `${fieldId("oswiadczenia")}-blad` : undefined}>
        <legend className="mb-2 text-2xl font-bold">{d.title}</legend>
        <p className="max-w-[68ch] font-bold">{d.lead}</p>
        <FieldError id={`${fieldId("oswiadczenia")}-blad`}>{error}</FieldError>
        <div className="grid max-w-[68ch] gap-2">
          {d.items.map((item, i) => (
            <CheckboxOption key={i} id={`${fieldId("oswiadczenia")}-${i}`} checked={app.oswiadczenia[i]} aria-invalid={!!error && !app.oswiadczenia[i]}
              onChange={(e) => update(`oswiadczenia.${i}`, e.target.checked)} label={`${i + 1}. ${item}`} />
          ))}
        </div>
      </fieldset>
      <fieldset className="grid max-w-[68ch] gap-2" aria-describedby={errors.deMinimis ? `${fieldId("deMinimis")}-blad` : undefined}>
        <legend className="mb-1 font-bold">{d.items.length + 1}. {d.deMinimis.lead}</legend>
        <FieldError id={`${fieldId("deMinimis")}-blad`}>{errors.deMinimis}</FieldError>
        <RadioGroup value={app.deMinimis} onValueChange={(v) => update("deMinimis", v)}>
          <RadioGroupOption id={fieldId("deMinimis.nie_dotyczy")} value="nie_dotyczy" label="Nie dotyczy: nie prowadzimy działalności gospodarczej" />
          <RadioGroupOption id={fieldId("deMinimis.a")} value="a" label={`a. ${d.deMinimis.options[0]}`} />
          <RadioGroupOption id={fieldId("deMinimis.b")} value="b" label={`b. ${d.deMinimis.options[1]}`} />
        </RadioGroup>
      </fieldset>
    </div>
  );
}

// ---- Krok: sprawdź i pobierz

const VERDICT = {
  mocne: { label: "Mocna strona", icon: CheckIcon },
  do_poprawy: { label: "Do poprawy", icon: ExclamationTriangleIcon },
  slabe: { label: "Słabe miejsce", icon: XCircleIcon },
} as const;

function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "wniosek";
}

function MeritSection({ slugOfInnovation }: { slugOfInnovation: string | null }) {
  const { app, content } = useForm();
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<MeritReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const rows = (rs: Row[]) => filledRows(rs).map((r) => `${r.dzialanie} | ${r.termin} | ${r.koszt} zł | ${r.uzasadnienie}`).join("\n");
    try {
      const res = await fetch("/api/wniosek-uw/ocena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(90_000),
        body: JSON.stringify({
          innovation: app.innowacja,
          innovationSlug: content.innovations.find((i) => i.title === app.innowacja)?.slug ?? slugOfInnovation,
          experienceAreas: app.doswiadczenie.obszary.filter(Boolean).length,
          sections: {
            opis: app.opis, diagnoza: app.diagnoza, rekrutacja: app.rekrutacja, liczba: app.liczba, obszar: app.obszar,
            efekty: app.efekty, plan: `Przygotowanie:\n${rows(app.przygotowanie)}\nWdrażanie:\n${rows(app.wdrazanie)}`.slice(0, 8000),
            kwota: app.kwota.slice(0, 40), utrzymanie: app.utrzymanie, doswiadczenie: app.doswiadczenie.opis,
          },
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Nie udało się ocenić szkicu");
      setReview(json as MeritReview);
    } catch (e) {
      setError(e instanceof DOMException && e.name === "TimeoutError"
        ? "Sztuczna inteligencja nie odpowiedziała w ciągu półtorej minuty. Spróbuj ponownie."
        : `${e instanceof Error ? e.message : "Coś poszło nie tak"}. Spróbuj ponownie za minutę.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="ocena" className="grid gap-4 print:hidden">
      <h3 id="ocena" className="text-2xl font-bold">Jak oceni to komisja?</h3>
      <p className="max-w-[68ch]">
        Sztuczna inteligencja przeczyta część opisową według karty oceny merytorycznej ROPS i podpowie, co poprawić.
        Wysyłamy tylko opis usługi, plan i koszty, bez danych kontaktowych. To podpowiedź, nie ocena komisji.
      </p>
      <Button type="button" variant="outline" className="justify-self-start" onClick={run} disabled={busy}>
        <SparklesIcon aria-hidden /> {review ? "Oceń ponownie" : "Sprawdź szkic pod kartę oceny"}
      </Button>
      <div aria-live="polite" className="grid gap-4">
        {busy && <p className="text-muted-foreground">Czytam szkic. To może potrwać do minuty.</p>}
        {error && <Alert tone="error" title="Nie udało się ocenić szkicu"><p>{error}</p></Alert>}
        {review && !busy && (
          <div className="grid gap-6">
            <ul className="grid max-w-[68ch] gap-5">
              {review.criteria.map((c) => {
                const v = VERDICT[c.verdict];
                return (
                  <li key={c.key} className="grid gap-1 border-l-4 border-border pl-4">
                    <p className="font-bold">{MERIT_LABELS[c.key].title} <span className="font-normal text-muted-foreground">({MERIT_LABELS[c.key].points})</span></p>
                    <p className="flex items-center gap-2"><v.icon aria-hidden className="size-5" /><strong>{v.label}.</strong> {c.why}</p>
                    {c.tips.length > 0 && <ul className="list-disc space-y-1 pl-6">{c.tips.map((t) => <li key={t}>{t}</li>)}</ul>}
                  </li>
                );
              })}
            </ul>
            {review.frameworkGaps.length > 0 && (
              <Alert title="Czego z Ramowego Planu Wdrożenia ROPS brakuje w szkicu">
                <ul className="list-disc space-y-1 pl-6">{review.frameworkGaps.map((g) => <li key={g}>{g}</li>)}</ul>
              </Alert>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function FinishStep({ goTo, today, planSlug }: { goTo: (step: number) => void; today: string; planSlug: string | null }) {
  const { app, content, update } = useForm();
  const doc = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState("");
  const checks = formalChecks(app, content, today);
  const invalid = firstInvalidStep(app, content);
  const failed = checks.filter((c) => c.status === "blad").length;
  const blocking = sensitiveFindings(app).filter((f) => f.block);

  function removeSensitive() {
    const masked = maskSensitive(app);
    for (const path of descriptivePaths(app)) {
      if (getAt(masked, path) !== getAt(app, path)) update(path, getAt(masked, path));
    }
    setCopied(`Usunięto dane osobowe z ${blocking.length} ${plural(blocking.length, "pola", "pól", "pól")}. W ich miejscu jest „[usunięto: …]”.`);
  }

  function downloadWord() {
    const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${app.tytul}</title><style>${WORD_CSS}</style></head><body>${doc.current?.innerHTML ?? ""}</body></html>`;
    const url = URL.createObjectURL(new Blob(["﻿", html], { type: "application/msword" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `wniosek-uw-${slug(app.tytul)}.doc` });
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(applicationToText(app, content));
      setCopied("Skopiowano tekst wniosku. Wklejaj go pole po polu do formularza elektronicznego ROPS.");
    } catch {
      setCopied("Nie udało się skopiować. Pobierz plik Word i skopiuj tekst z niego.");
    }
  }

  return (
    <div className="grid gap-10">
      <div className="grid gap-4 print:hidden">
        {invalid !== null ? (
          <Alert tone="error" title="Wniosek nie jest jeszcze kompletny">
            <p>Brakuje danych w kroku „{STEPS[invalid].title}”. Możesz pobrać szkic, ale przed złożeniem uzupełnij braki.</p>
            <Button type="button" variant="link" className="px-0" onClick={() => goTo(invalid)}>Przejdź do kroku „{STEPS[invalid].title}”</Button>
          </Alert>
        ) : (
          <Alert tone="success" title="Szkic wniosku jest gotowy">
            <p>
              Wniosek składa się tylko przez formularz elektroniczny ROPS. Skopiuj tekst albo pobierz plik Word i przenieś treść
              do formularza. Oświadczenia wydrukuj, podpisz i dołącz jako skan.
            </p>
          </Alert>
        )}

        <section aria-labelledby="formalna" className="grid gap-3">
          <h3 id="formalna" className="text-2xl font-bold">Ocena formalna: sprawdź przed złożeniem</h3>
          <p className="max-w-[68ch]" aria-live="polite">
            {failed === 0 ? "Wszystkie warunki z karty oceny formalnej, które da się sprawdzić tutaj, są spełnione." : `Do poprawy: ${failed} ${plural(failed, "warunek", "warunki", "warunków")}.`}
          </p>
          {blocking.length > 0 && (
            <Button type="button" variant="outline" className="justify-self-start" onClick={removeSensitive}>
              <TrashIcon aria-hidden /> Usuń te dane z opisów automatycznie
            </Button>
          )}
          <ul className="grid max-w-[68ch] gap-2">
            {checks.map((c) => {
              const Icon = c.status === "ok" ? CheckIcon : c.status === "blad" ? XCircleIcon : ExclamationTriangleIcon;
              const word = c.status === "ok" ? "Spełnione" : c.status === "blad" ? "Niespełnione" : "Do sprawdzenia";
              return (
                <li key={c.label} className="flex items-start gap-3">
                  <Icon aria-hidden className={cn("mt-1 size-5 shrink-0", c.status === "blad" && "text-destructive")} />
                  <span><strong>{word}: {c.label}.</strong> {c.detail}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <MeritSection slugOfInnovation={planSlug} />

      <div className="grid gap-4 print:hidden">
        <h3 className="text-2xl font-bold">Pobierz i złóż</h3>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button asChild variant={invalid === null ? "default" : "outline"}>
            <a href={content.call.formUrl} target="_blank" rel="noreferrer">
              <ArrowTopRightOnSquareIcon aria-hidden /> Otwórz formularz ROPS<span className="sr-only"> (w nowej karcie)</span>
            </a>
          </Button>
          <Button type="button" variant="outline" onClick={copy}><ClipboardDocumentIcon aria-hidden /> Kopiuj tekst</Button>
          <Button type="button" variant="outline" onClick={downloadWord}><ArrowDownTrayIcon aria-hidden /> Pobierz plik Word</Button>
          <Button type="button" variant="outline" onClick={() => window.print()}><PrinterIcon aria-hidden /> Drukuj / zapisz PDF</Button>
        </div>
        <p aria-live="polite" className="text-base">{copied}</p>
        <p className="text-base text-muted-foreground">Pytania do naboru: {content.call.contact}.</p>
        <h3 className="pt-4 text-2xl font-bold">Podgląd wniosku</h3>
      </div>
      {/* Własne przewijanie: tabele wniosku są szersze niż telefon, a strona nie może się przewijać w poziomie. */}
      <div ref={doc} data-print-root role="region" aria-label="Podgląd wniosku (przewija się w poziomie)" tabIndex={0}
        className="max-w-[52rem] overflow-x-auto rounded-[16px] border border-border-strong bg-background p-5 sm:p-10 print:max-w-none print:overflow-visible print:rounded-none print:border-0 print:p-0">
        <GrantDocument app={app} content={content} />
      </div>
    </div>
  );
}

// ---- Formularz

type Props = { content: UwContent; plan: PlanDocument | null; planSlug: string | null; today: string };

const noSubscribe = () => () => {};

/** localStorage nie istnieje na serwerze: formularz renderujemy dopiero w przeglądarce, od razu ze szkicem. */
export function GrantForm(props: Props) {
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  if (!hydrated) return <p className="text-muted-foreground">Wczytuję formularz…</p>;
  return <Form {...props} />;
}

function readSaved({ content, plan, planSlug, today }: Props) {
  const start = defaultStart(today);
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(plan?.id ?? null)) ?? "null");
    if (saved) {
      const step = Math.min(Math.max(Number(saved.step) || 0, 0), STEPS.length - 1);
      return { app: restore(saved.app, content, start), step, reached: Math.max(step, Number(saved.reached) || 0), fromSaved: true };
    }
  } catch {}
  return { app: plan ? fromPlan(plan, content, planSlug, start) : emptyApplication(content, start), step: 0, reached: 0, fromSaved: false };
}

function Form(props: Props) {
  const { content, plan, planSlug, today } = props;
  const [initial] = useState(() => readSaved(props));
  const [app, setApp] = useState(initial.app);
  const [step, setStep] = useState(initial.step);
  const [reached, setReached] = useState(Math.min(initial.reached, STEPS.length - 1));
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const resetButton = useRef<HTMLButtonElement>(null);
  const keepButton = useRef<HTMLButtonElement>(null);
  const moved = useRef(false);
  const dirty = useRef(initial.fromSaved);
  const focusSummary = useRef(false);

  useEffect(() => {
    if (!dirty.current) return;
    try { localStorage.setItem(storageKey(plan?.id ?? null), JSON.stringify({ app, step, reached })); } catch {}
  }, [app, step, reached, plan?.id]);

  useEffect(() => {
    if (!moved.current) return;
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: "start" });
  }, [step]);

  useEffect(() => {
    if (!focusSummary.current || !Object.keys(errors).length) return;
    focusSummary.current = false;
    summary.current?.focus();
  }, [errors]);

  function update(path: string, value: unknown) {
    dirty.current = true;
    setApp((a) => {
      const next = setAt(a, path, value);
      // Lata wskaźnika idą za datami wdrażania.
      return path.startsWith("etap2.") ? { ...next, wskaznik: { ...next.wskaznik, lata: syncYears(next.wskaznik.lata, next.etap2) } } : next;
    });
    setErrors((e) => {
      const stale = Object.keys(e).filter((k) => k === path || k.startsWith(`${path}.`) || path.startsWith(`${k}.`));
      if (!stale.length) return e;
      const next = { ...e };
      for (const k of stale) delete next[k];
      return next;
    });
  }

  function goTo(s: number) {
    moved.current = true;
    setErrors({});
    setStep(s);
    setReached((r) => Math.max(r, s));
  }

  function next() {
    const e = validateStep(step, app, content);
    if (Object.keys(e).length) {
      focusSummary.current = true;
      return setErrors(e);
    }
    goTo(step + 1);
  }

  function reset() {
    try { localStorage.removeItem(storageKey(plan?.id ?? null)); } catch {}
    dirty.current = false;
    const start = defaultStart(today);
    setApp(plan ? fromPlan(plan, content, planSlug, start) : emptyApplication(content, start));
    setConfirmReset(false);
    setReached(0);
    goTo(0);
    setStatus(plan ? "Przywrócono wniosek wypełniony z planu wdrożenia." : "Formularz wyczyszczony.");
    setTimeout(() => heading.current?.focus(), 0);
  }

  const current = STEPS[step];
  const errorList = Object.entries(errors);

  return (
    <FormCtx.Provider value={{ app, errors, content, update }}>
      <div className="grid gap-8">
        <p role="status" className="sr-only">{status}</p>
        <nav aria-label="Kroki wniosku" className="print:hidden">
          <ol className="flex flex-wrap gap-2">
            {STEPS.map((s, i) => {
              const label = `${i + 1}. ${s.title}`;
              const isCurrent = i === step;
              return (
                <li key={s.id}>
                  {i <= reached && !isCurrent ? (
                    <button type="button" onClick={() => goTo(i)}
                      className="inline-flex min-h-12 items-center gap-2 rounded-full border border-border-strong px-4 text-base hover:border-foreground">
                      {i < reached && <CheckIcon aria-hidden className="size-5" />}
                      {label}
                    </button>
                  ) : (
                    <span aria-current={isCurrent ? "step" : undefined}
                      className={cn("inline-flex min-h-12 items-center rounded-full px-4 text-base",
                        isCurrent ? "bg-foreground font-bold text-background" : "text-muted-foreground")}>
                      {label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="grid gap-6">
          <h2 ref={heading} tabIndex={-1} className="scroll-mt-4 text-3xl font-bold outline-none print:hidden">
            <span className="block text-lg font-normal text-muted-foreground">Krok {step + 1} z {STEPS.length}</span>
            {current.title}
          </h2>

          {errorList.length > 0 && (
            <Alert ref={summary} tabIndex={-1} tone="error" title={`Popraw ${errorList.length === 1 ? "1 pole" : `pola (${errorList.length})`}, żeby przejść dalej`}>
              <ul className="list-disc space-y-1 pl-6">
                {errorList.map(([path, msg]) => (
                  <li key={path}>
                    <a href={`#${fieldId(path)}`} className="font-bold underline underline-offset-4"
                      onClick={(e) => { e.preventDefault(); focusField(path); }}>
                      {msg}
                    </a>
                  </li>
                ))}
              </ul>
            </Alert>
          )}

          <form noValidate onSubmit={(e) => { e.preventDefault(); next(); }} className="grid gap-10">
            <div className={cn("grid gap-8", current.id !== "gotowe" && "max-w-2xl")}>
              {current.id === "innowacja" && (
                <>
                  <fieldset className="grid gap-2" aria-describedby={errors.innowacja ? `${fieldId("innowacja")}-blad` : undefined}>
                    <legend className="mb-1 text-lg font-bold">I. Nazwa wybranej do wdrożenia innowacji społecznej</legend>
                    <FieldHint>W tym naborze można wdrożyć jedną z tych innowacji. Wybierz tę, na której oprzesz usługę.</FieldHint>
                    <FieldError id={`${fieldId("innowacja")}-blad`}>{errors.innowacja}</FieldError>
                    <RadioGroup value={app.innowacja} onValueChange={(v) => update("innowacja", v)}>
                      {content.innovations.map((inn, i) => (
                        <RadioGroupOption key={inn.slug} id={`${fieldId("innowacja")}-${i}`} value={inn.title} label={inn.title} />
                      ))}
                    </RadioGroup>
                  </fieldset>
                  <fieldset className="grid gap-2" aria-describedby={errors.status ? `${fieldId("status")}-blad` : undefined}>
                    <legend className="mb-1 text-lg font-bold">II a. Status wnioskodawcy</legend>
                    <FieldHint>Gmina, powiat i ich jednostki (OPS, PCPR, CUS) to jednostki sektora finansów publicznych. Fundacja i stowarzyszenie rejestrowe to zwykle osoby prawne.</FieldHint>
                    <FieldError id={`${fieldId("status")}-blad`}>{errors.status}</FieldError>
                    <RadioGroup value={app.status} onValueChange={(v) => update("status", v)}>
                      {content.statuses.map((st, i) => (
                        <RadioGroupOption key={st} id={`${fieldId("status")}-${i}`} value={st} label={st} />
                      ))}
                    </RadioGroup>
                  </fieldset>
                </>
              )}

              {current.id === "dane" && <ContactStep />}

              {current.id === "doswiadczenie" && (
                <>
                  <CheckGroup path="doswiadczenie.obszary" legend={content.experience.lead} hint={content.experience.tip} items={content.experience.areas} />
                  <TextField path="doswiadczenie.opis" multiline label="Opis posiadanego doświadczenia w odniesieniu do wybranych obszarów"
                    hint="Co robicie, od kiedy, dla ilu osób, bez imion i nazwisk. Komisja premiuje tylko doświadczenie wykazane jednoznacznie." />
                </>
              )}

              {current.id === "usluga" && <ServiceStep start={plan ? defaultStart(today) : null} />}

              {current.id === "plan" && <PlanStep />}

              {current.id === "zasady" && (
                <>
                  <Described path="horyzontalne" section="horyzontalne" />
                  <Described path="utrzymanie" section="utrzymanie" />
                  <Described path="deinstytucjonalizacja" section="deinstytucjonalizacja" />
                </>
              )}

              {current.id === "oswiadczenia" && <DeclarationsStep />}

              {current.id === "gotowe" && <FinishStep goTo={goTo} today={today} planSlug={planSlug} />}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center print:hidden">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={() => goTo(step - 1)}>
                  <ChevronLeftIcon aria-hidden /> Wstecz
                </Button>
              )}
              {current.id !== "gotowe" && (
                <Button type="submit">
                  {step === STEPS.length - 2 ? "Sprawdź wniosek" : "Dalej"} <ChevronRightIcon aria-hidden />
                </Button>
              )}
            </div>
          </form>
        </div>

        <div className="grid gap-2 text-base text-muted-foreground print:hidden">
          <p>Wpisy zapisują się tylko w tej przeglądarce, na tym urządzeniu. Możesz przerwać i wrócić później.</p>
          {confirmReset ? (
            <div role="group" aria-label="Potwierdź wyczyszczenie" className="flex flex-wrap items-center gap-3">
              <span>{plan ? "Usunąć zmiany i wrócić do wniosku wypełnionego z planu?" : "Usunąć wszystko, co wpisano?"}</span>
              <Button type="button" variant="outline" size="sm" onClick={reset}>Tak, wyczyść</Button>
              <Button ref={keepButton} type="button" variant="link" size="sm" onClick={() => {
                setConfirmReset(false);
                setTimeout(() => resetButton.current?.focus(), 0);
              }}>Nie, zostaw</Button>
            </div>
          ) : (
            <Button ref={resetButton} type="button" variant="link" size="sm" className="justify-self-start px-0" onClick={() => {
              setConfirmReset(true);
              setTimeout(() => keepButton.current?.focus(), 0);
            }}>
              <TrashIcon aria-hidden /> Wyczyść formularz
            </Button>
          )}
        </div>
      </div>
    </FormCtx.Provider>
  );
}
