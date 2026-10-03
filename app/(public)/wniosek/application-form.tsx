"use client";

import { Check, ChevronLeft, ChevronRight, Download, Plus, Printer, Trash2 } from "lucide-react";
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
import { ApplicationDocument, WORD_CSS } from "./application-document";
import type { CallFormContent, CallFormSchema } from "@/lib/call-schema";
import {
  type Application, type ApplicantType, type Errors, type PlanRow,
  MAX_PARTNERS, STEPS, declarationSets, emptyApplication, emptyPartner, emptyRow, fieldId,
  applicationFromPrefill, firstInvalidStep, formatPLN, getAt, parseAmount, planTotal, restore, setAt, validateStep,
  type ApplicationPrefill,
} from "./model";

// localStorage pozostaje szybką kopią UX; właściwy szkic zapisujemy przez /api/wniosek/draft.
// Klucz per nabór: szkic jednego naboru nie pasuje do treści innego.
const storageKey = (callId: string) => `wniosek-${callId}`;

type Ctx = { app: Application; errors: Errors; content: CallFormContent; update: (path: string, value: unknown) => void };
const FormCtx = createContext<Ctx | null>(null);
const useForm = () => useContext(FormCtx)!;

/** Fokus na polu z błędem; dla grup (np. oświadczenia) na pierwszym niezaznaczonym polu w grupie. */
function focusField(path: string) {
  const id = fieldId(path);
  const el = document.getElementById(id) ?? document.querySelector<HTMLElement>(`input[id^="${id}-"]:not(:checked)`);
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
        ? <Textarea {...common} rows={6} onChange={(e) => update(path, e.target.value)} />
        : <Input {...common} {...input} onChange={(e) => update(path, e.target.value)} />}
    </div>
  );
}

// ---- Dane wnioskodawcy

function PersonFields({ base, own }: { base: string; own?: boolean }) {
  const ac = (v: string) => (own ? v : "off");
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField path={`${base}.imie`} label="Imię" autoComplete={ac("given-name")} />
        <TextField path={`${base}.nazwisko`} label="Nazwisko" autoComplete={ac("family-name")} />
      </div>
      <AddressFields base={base} street="Adres korespondencyjny" own={own} />
    </div>
  );
}

function AddressFields({ base, street, own }: { base: string; street: string; own?: boolean }) {
  const ac = (v: string) => (own ? v : "off");
  return (
    <>
      <TextField path={`${base}.adres`} label={street} hint="Ulica, numer budynku i lokalu." autoComplete={ac("street-address")} />
      <div className="grid gap-6 sm:grid-cols-[12rem_1fr]">
        <TextField path={`${base}.kod`} label="Kod pocztowy" placeholder="30-070" inputMode="numeric" autoComplete={ac("postal-code")} />
        <TextField path={`${base}.miejscowosc`} label="Miejscowość" autoComplete={ac("address-level2")} />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField path={`${base}.telefon`} label="Telefon" type="tel" autoComplete={ac("tel")} />
        <TextField path={`${base}.email`} label="E-mail" type="email" autoComplete={ac("email")} />
      </div>
    </>
  );
}

function ContactFields({ base, legend }: { base: string; legend: string }) {
  return (
    <fieldset className="grid gap-6">
      <legend className="mb-2 text-xl font-bold">{legend}</legend>
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField path={`${base}.imieNazwisko`} label="Imię i nazwisko" />
        <TextField path={`${base}.funkcja`} label="Funkcja" placeholder="np. prezes zarządu" />
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField path={`${base}.telefon`} label="Telefon" type="tel" />
        <TextField path={`${base}.email`} label="E-mail" type="email" />
      </div>
    </fieldset>
  );
}

function EntityFields({ base, own }: { base: string; own?: boolean }) {
  const { app, update } = useForm();
  const sameContact = getAt(app, `${base}.kontaktTenSam`) as boolean;
  return (
    <div className="grid gap-8">
      <div className="grid gap-6">
        <TextField path={`${base}.nazwa`} label="Nazwa organizacji" autoComplete={own ? "organization" : "off"} />
        <div className="grid gap-6 sm:grid-cols-3">
          <TextField path={`${base}.nip`} label="NIP" inputMode="numeric" />
          <TextField path={`${base}.regon`} label="REGON" inputMode="numeric" />
          <TextField path={`${base}.krs`} label="KRS (jeśli jest)" inputMode="numeric" />
        </div>
        <AddressFields base={base} street="Adres siedziby" own={own} />
      </div>
      <ContactFields base={`${base}.reprezentant`} legend="Osoba upoważniona do reprezentowania" />
      <div className="grid gap-6">
        <CheckboxOption
          id={fieldId(`${base}.kontaktTenSam`)}
          checked={sameContact}
          onChange={(e) => update(`${base}.kontaktTenSam`, e.target.checked)}
          label="Ta sama osoba odpowiada za kontakty robocze"
        />
        {!sameContact && <ContactFields base={`${base}.kontakt`} legend="Osoba do kontaktów roboczych" />}
      </div>
    </div>
  );
}

function GroupFields() {
  const { app, update } = useForm();
  function add() {
    update("partnerzy", [...app.partnerzy, emptyPartner()]);
    setTimeout(() => focusField(`partnerzy.${app.partnerzy.length}.rodzaj.osoba`), 0);
  }
  return (
    <div className="grid gap-10">
      {app.partnerzy.map((p, i) => (
        <fieldset key={i} className="grid gap-6 border-t pt-6">
          <legend className="float-left mb-2 w-full text-2xl font-bold">Partner {i + 1}</legend>
          <fieldset className="space-y-2">
            <legend className="font-bold">Kim jest partner {i + 1}?</legend>
            <RadioGroup value={p.rodzaj} onValueChange={(v) => update(`partnerzy.${i}.rodzaj`, v)}>
              <RadioGroupOption id={fieldId(`partnerzy.${i}.rodzaj.osoba`)} value="osoba" label="Osoba prywatna" />
              <RadioGroupOption id={fieldId(`partnerzy.${i}.rodzaj.podmiot`)} value="podmiot" label="Organizacja lub instytucja" />
            </RadioGroup>
          </fieldset>
          {p.rodzaj === "osoba" ? <PersonFields base={`partnerzy.${i}.osoba`} /> : <EntityFields base={`partnerzy.${i}.podmiot`} />}
          {app.partnerzy.length > 2 && (
            <Button type="button" variant="link" className="justify-self-start px-0"
              onClick={() => update("partnerzy", app.partnerzy.filter((_, j) => j !== i))}>
              <Trash2 aria-hidden /> Usuń partnera {i + 1}
            </Button>
          )}
        </fieldset>
      ))}
      {app.partnerzy.length < MAX_PARTNERS && (
        <Button type="button" variant="outline" className="justify-self-start" onClick={add}>
          <Plus aria-hidden /> Dodaj partnera
        </Button>
      )}
      <fieldset className="grid gap-6 border-t pt-6">
        <legend className="float-left mb-2 w-full text-2xl font-bold">Kto z grupy jest osobą do kontaktu?</legend>
        <TextField path="reprezentantGrupy.imieNazwisko" label="Imię i nazwisko" />
        <div className="grid gap-6 sm:grid-cols-2">
          <TextField path="reprezentantGrupy.telefon" label="Telefon" type="tel" />
          <TextField path="reprezentantGrupy.email" label="E-mail" type="email" />
        </div>
      </fieldset>
    </div>
  );
}

// ---- Plan działania

function PlanRows({ path, legend, hint, example, termExample, required }: {
  path: "przygotowanie" | "faza1" | "faza2"; legend: string; hint?: string; example: string; termExample: string; required?: boolean;
}) {
  const { app, update } = useForm();
  const rows = app[path] as PlanRow[];
  function add() {
    update(path, [...rows, emptyRow()]);
    setTimeout(() => focusField(`${path}.${rows.length}.dzialanie`), 0);
  }
  return (
    <fieldset className="grid gap-6">
      <legend className="mb-2 text-xl font-bold">{legend}{!required && " (jeśli planujesz)"}</legend>
      {hint && <FieldHint>{hint}</FieldHint>}
      {rows.map((_, i) => (
        <div key={i} role="group" aria-label={`${legend}: działanie ${i + 1}`} className="grid gap-4 border-l-4 border-border pl-4">
          <p className="font-bold">Działanie {i + 1}</p>
          <TextField path={`${path}.${i}.dzialanie`} label="Co zrobisz?" hint={i === 0 ? example : undefined} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField path={`${path}.${i}.termin`} label="Kiedy?" placeholder={termExample} />
            <TextField path={`${path}.${i}.koszt`} label="Ile to kosztuje (zł)?" inputMode="decimal" placeholder="np. 2500" />
          </div>
          {rows.length > 1 && (
            <Button type="button" variant="link" className="justify-self-start px-0"
              onClick={() => update(path, rows.filter((_, j) => j !== i))}>
              <Trash2 aria-hidden /> Usuń działanie {i + 1}
            </Button>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={add}>
        <Plus aria-hidden /> Dodaj działanie
      </Button>
    </fieldset>
  );
}

function PlanStep() {
  const { app, update, content: { plan } } = useForm();
  const total = planTotal(app);
  const amount = parseAmount(app.kwota);
  const differs = amount !== null && total > 0 && Math.abs(amount - total) >= 0.01;
  return (
    <div className="grid gap-10">
      <p className="max-w-[68ch]">{plan.intro} Wpisuj kwoty w złotych. Sumę policzymy za Ciebie.</p>
      <section className="grid gap-6">
        <h3 className="text-2xl font-bold">{plan.preparation.title}: {plan.preparation.limit}</h3>
        <FieldHint>{plan.preparation.questions}</FieldHint>
        <PlanRows path="przygotowanie" legend="Działania przygotowawcze" example={plan.preparation.example} termExample={plan.preparation.termExample} required />
      </section>
      <section className="grid gap-6">
        <h3 className="text-2xl font-bold">{plan.testing.title}: {plan.testing.limit}</h3>
        <FieldHint>{plan.testing.questions}</FieldHint>
        <PlanRows path="faza1" legend="Faza I testu" example={plan.testing.example} termExample={plan.testing.termExample} required />
        <PlanRows path="faza2" legend="Faza II testu" example={plan.testing.example} termExample={plan.testing.termExample} />
      </section>
      <section className="grid gap-4 border-t pt-6">
        <h3 className="text-2xl font-bold">{plan.amount.title}</h3>
        <p aria-live="polite" className="text-lg">Suma kosztów z planu: <strong>{formatPLN(total)}</strong></p>
        <TextField path="kwota" label="Jakiej kwoty grantu potrzebujesz (zł)?" hint={plan.amount.questions} inputMode="decimal" className="max-w-md" />
        {differs && (
          <div aria-live="polite" className="space-y-2">
            <p>Ta kwota różni się od sumy z planu o {formatPLN(Math.abs(amount - total))}. Sprawdź, czy tak ma być.</p>
            <Button type="button" variant="link" className="px-0" onClick={() => update("kwota", total.toFixed(2).replace(".", ","))}>
              Wpisz sumę z planu: {formatPLN(total)}
            </Button>
          </div>
        )}
        {amount === null && total > 0 && (
          <Button type="button" variant="link" className="justify-self-start px-0" onClick={() => update("kwota", total.toFixed(2).replace(".", ","))}>
            Wpisz sumę z planu: {formatPLN(total)}
          </Button>
        )}
      </section>
    </div>
  );
}

// ---- Pytania opisowe

function Questions({ id, items }: { id: string; items: string[] }) {
  return (
    <details className="text-base">
      <summary className="cursor-pointer font-bold underline underline-offset-4">Pytania ze wzoru wniosku</summary>
      <ul id={id} className="mt-2 list-disc space-y-1 pl-6 text-muted-foreground">
        {items.map((q) => <li key={q}>{q}</li>)}
      </ul>
    </details>
  );
}

function DescribedTextarea({ path, n, title, tip, questions }: { path: string; n: number; title: string; tip: string; questions: string[] }) {
  const { app } = useForm();
  const length = String(getAt(app, path) ?? "").length;
  return (
    <section className="grid gap-2">
      <TextField path={path} multiline label={`${n}. ${title}`} hint={tip} />
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <Questions id={`${fieldId(path)}-pytania`} items={questions} />
        <p className="text-base text-muted-foreground">{length} znaków</p>
      </div>
    </section>
  );
}

// ---- Oświadczenia

function DeclarationsStep() {
  const { app, errors, update, content } = useForm();
  const sets = declarationSets(app);
  return (
    <div className="grid gap-10">
      {app.typ === "grupa" && (
        <p className="max-w-[68ch]">
          W grupie nieformalnej każdy partner podpisuje swoje oświadczenia: osoby prywatne część A, organizacje część B.
        </p>
      )}
      {sets.map((set) => {
        const decl = content.declarations[set];
        const values = app.oswiadczenia[set];
        const error = errors[`oswiadczenia.${set}`];
        return (
          <fieldset key={set} className="grid gap-4" aria-describedby={error ? `${fieldId(`oswiadczenia.${set}`)}-blad` : undefined}>
            <legend className="mb-2 text-2xl font-bold">{decl.title}</legend>
            <Alert title="W skrócie: co potwierdzasz">
              <ul className="list-disc space-y-1 pl-6">{decl.summary.map((s) => <li key={s}>{s}</li>)}</ul>
              <p className="pt-1">Pełna treść jest poniżej. Zaznacz tylko to, co jest prawdą: za fałszywe oświadczenie grozi kara.</p>
            </Alert>
            <p className="max-w-[68ch] font-bold">{decl.lead}</p>
            <FieldError id={`${fieldId(`oswiadczenia.${set}`)}-blad`}>{error}</FieldError>
            <div className="grid max-w-[68ch] gap-2">
              {decl.items.map((item, i) => (
                <CheckboxOption
                  key={i}
                  id={fieldId(`oswiadczenia.${set}.${i}`)}
                  checked={values[i]}
                  aria-invalid={!!error && !values[i]}
                  onChange={(e) => update(`oswiadczenia.${set}.${i}`, e.target.checked)}
                  label={item}
                />
              ))}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

// ---- Gotowy wniosek

function slug(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "wniosek";
}

function FinishStep({ goTo }: { goTo: (step: number) => void }) {
  const { app, content } = useForm();
  const doc = useRef<HTMLDivElement>(null);
  const invalid = firstInvalidStep(app, content);

  function downloadWord() {
    const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><title>${app.tytul}</title><style>${WORD_CSS}</style></head><body>${doc.current?.innerHTML ?? ""}</body></html>`;
    const url = URL.createObjectURL(new Blob(["﻿", html], { type: "application/msword" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `wniosek-${slug(app.tytul)}.doc` });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-8">
      <div className="grid gap-4 print:hidden">
        {invalid !== null ? (
          <Alert tone="error" title="Wniosek nie jest jeszcze kompletny">
            <p>Brakuje danych w kroku „{STEPS[invalid].title}”. Możesz pobrać szkic, ale przed wysłaniem uzupełnij braki.</p>
            <Button type="button" variant="link" className="px-0" onClick={() => goTo(invalid)}>Przejdź do kroku „{STEPS[invalid].title}”</Button>
          </Alert>
        ) : (
          <Alert tone="success" title="Wniosek jest gotowy">
            <p>Zapisz go jako PDF albo plik Word, wydrukuj i podpisz, a potem wyślij tak, jak mówi ogłoszenie naboru.</p>
          </Alert>
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button type="button" variant={invalid === null ? "default" : "outline"} onClick={() => window.print()}>
            <Printer aria-hidden /> Zapisz jako PDF lub wydrukuj
          </Button>
          <Button type="button" variant="outline" onClick={downloadWord}>
            <Download aria-hidden /> Pobierz plik Word
          </Button>
        </div>
        <p className="text-base text-muted-foreground">
          W oknie drukowania wybierz „Zapisz jako PDF”. Plik Word możesz jeszcze poprawić przed wysłaniem.
        </p>
        <h3 className="pt-4 text-2xl font-bold">Podgląd wniosku</h3>
      </div>
      <div ref={doc} className="max-w-[52rem] rounded-[16px] border border-border-strong bg-background p-5 sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0">
        <ApplicationDocument app={app} content={content} />
      </div>
    </div>
  );
}

// ---- Formularz

type Saved = { app: Application; step: number; reached: number };

function readSaved(callId: string, content: CallFormContent, prefill?: ApplicationPrefill): Saved {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(callId)) ?? "null");
    if (saved) {
      const step = Math.min(Math.max(Number(saved.step) || 0, 0), STEPS.length - 1);
      const reached = Math.min(Math.max(step, Number(saved.reached) || 0), STEPS.length - 1);
      return { app: restore(saved.app, content), step, reached };
    }
  } catch {}
  return { app: prefill ? applicationFromPrefill(prefill, content) : emptyApplication(content), step: 0, reached: 0 };
}

type Call = { id: string; title: string; formSchema: CallFormSchema; content: CallFormContent };

const noSubscribe = () => () => {};

/** localStorage nie istnieje na serwerze: formularz renderujemy dopiero w przeglądarce, od razu ze szkicem. */
export function ApplicationForm({ call, prefill }: { call: Call; prefill?: ApplicationPrefill }) {
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  if (!hydrated) return <p className="text-muted-foreground">Wczytuję formularz…</p>;
  return <Form initial={readSaved(call.id, call.content, prefill)} call={call} />;
}

function Form({ initial, call }: { initial: Saved; call: Call }) {
  const { content } = call;
  const [app, setApp] = useState(initial.app);
  const [step, setStep] = useState(initial.step);
  const [reached, setReached] = useState(initial.reached);
  const [errors, setErrors] = useState<Errors>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const applicationId = useRef<string | undefined>(undefined);

  useEffect(() => {
    try { localStorage.setItem(storageKey(call.id), JSON.stringify({ app, step, reached })); } catch {}
    try {
      applicationId.current ??= localStorage.getItem(`wniosek-application-${call.id}`) ?? undefined;
    } catch {}
    const timer = window.setTimeout(() => {
      void fetch("/api/wniosek/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: applicationId.current,
          callId: call.id,
          // Same pola wystarczą do odtworzenia szkicu; treść naboru jest w calls.form_schema.
          draft: { app, formSchema: { fields: call.formSchema.fields } },
          step,
          reached,
        }),
      }).then((response) => response.ok ? response.json() : null).then((result) => {
        if (result?.applicationId) {
          applicationId.current = result.applicationId;
          try { localStorage.setItem(`wniosek-application-${call.id}`, result.applicationId); } catch {}
        }
      }).catch(() => {});
    }, 700);
    return () => window.clearTimeout(timer);
  }, [app, step, reached, call.id, call.formSchema.fields]);

  // Po zmianie kroku fokus na nagłówek kroku, żeby czytnik ekranu zaczął od początku.
  useEffect(() => {
    if (!moved.current) return;
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: "start" });
  }, [step]);

  useEffect(() => { if (Object.keys(errors).length) summary.current?.focus(); }, [errors]);

  function update(path: string, value: unknown) {
    setApp((a) => setAt(a, path, value));
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
    if (Object.keys(e).length) return setErrors(e);
    goTo(step + 1);
  }

  function reset() {
    setApp(emptyApplication(content));
    setConfirmReset(false);
    setReached(0);
    goTo(0);
  }

  const current = STEPS[step];
  const errorList = Object.entries(errors);

  return (
    <FormCtx.Provider value={{ app, errors, content, update }}>
      <div className="grid gap-8">
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
                      {i < reached && <Check aria-hidden className="size-5" />}
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
              {current.id === "pomysl" && (
                <>
                  <TextField path="tytul" label="Tytuł pomysłu"
                    hint="Krótki i kojarzący się z tym, co robisz, np. „Sąsiedzka taksówka dla seniorów”." />
                  <fieldset className="space-y-2">
                    <legend className="text-lg font-bold">Kto składa wniosek?</legend>
                    <FieldHint>Od tego zależy, o jakie dane i oświadczenia zapytamy.</FieldHint>
                    <RadioGroup value={app.typ} onValueChange={(v) => update("typ", v as ApplicantType)}>
                      <RadioGroupOption id="typ-osoba" value="osoba" label="Osoba prywatna" hint="Składasz wniosek we własnym imieniu." />
                      <RadioGroupOption id="typ-podmiot" value="podmiot" label="Organizacja lub instytucja" hint="Np. stowarzyszenie, fundacja, spółdzielnia, firma." />
                      <RadioGroupOption id="typ-grupa" value="grupa" label="Grupa nieformalna" hint="Od 2 do 5 partnerów: osób albo organizacji." />
                    </RadioGroup>
                  </fieldset>
                </>
              )}

              {current.id === "dane" && (
                <>
                  {app.typ === "osoba" && <PersonFields base="osoba" own />}
                  {app.typ === "podmiot" && <EntityFields base="podmiot" own />}
                  {app.typ === "grupa" && <GroupFields />}
                </>
              )}

              {current.id === "opis" && (
                <>
                  <p className="max-w-[68ch]">
                    Odpowiedz własnymi słowami. Pod każdym polem są pytania ze wzoru wniosku: nie musisz odpowiadać na wszystkie po kolei, ale komisja będzie ich szukać.
                  </p>
                  {content.sections.map((s) => (
                    <DescribedTextarea key={s.key} path={`opisy.${s.key}`} n={s.n} title={s.title} tip={s.tip} questions={s.questions} />
                  ))}
                </>
              )}

              {current.id === "plan" && <PlanStep />}

              {current.id === "zespol" && (
                <DescribedTextarea path="zespol" {...content.team} />
              )}

              {current.id === "oswiadczenia" && <DeclarationsStep />}

              {current.id === "gotowe" && <FinishStep goTo={goTo} />}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center print:hidden">
              {step > 0 && (
                <Button type="button" variant="outline" onClick={() => goTo(step - 1)}>
                  <ChevronLeft aria-hidden /> Wstecz
                </Button>
              )}
              {current.id !== "gotowe" && (
                <Button type="submit">
                  {step === STEPS.length - 2 ? "Sprawdź wniosek" : "Dalej"} <ChevronRight aria-hidden />
                </Button>
              )}
            </div>
          </form>
        </div>

        <div className="grid gap-2 text-base text-muted-foreground print:hidden">
          <p>Wpisy są zapisywane na serwerze jako szkic oraz lokalnie w tej przeglądarce. Możesz przerwać i wrócić później.</p>
          {confirmReset ? (
            <div role="group" aria-label="Potwierdź wyczyszczenie" className="flex flex-wrap items-center gap-3">
              <span>Usunąć wszystko, co wpisano?</span>
              <Button type="button" variant="outline" size="sm" onClick={reset}>Tak, wyczyść</Button>
              <Button type="button" variant="link" size="sm" onClick={() => setConfirmReset(false)}>Nie, zostaw</Button>
            </div>
          ) : (
            <Button type="button" variant="link" size="sm" className="justify-self-start px-0" onClick={() => setConfirmReset(true)}>
              <Trash2 aria-hidden /> Wyczyść formularz
            </Button>
          )}
        </div>
      </div>
    </FormCtx.Provider>
  );
}
