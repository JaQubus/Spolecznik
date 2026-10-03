"use client";

import { forwardRef } from "react";
import { Alert } from "@/components/ui/alert";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { FieldError, FieldHint } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { plural } from "@/lib/pl";

export type FormState = { ok: boolean; message: string; errors: Record<string, string> };
export const initialFormState: FormState = { ok: false, message: "", errors: {} };

type Base = { name: string; label: string; hint?: string; error?: string; required?: boolean };

const describedBy = (name: string, hint?: string, error?: string) =>
  [hint && `${name}-pomoc`, error && `${name}-blad`].filter(Boolean).join(" ") || undefined;

/** Pole tekstowe według TextField.md: etykieta, podpowiedź, błąd, pole. */
export function TextField({ name, label, hint, error, required, multiline, rows = 4, ...rest }: Base & {
  multiline?: boolean; rows?: number; defaultValue?: string | number | null; type?: string; inputMode?: "numeric" | "decimal" | "url";
}) {
  const props = {
    id: name, name, required, "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy(name, hint, error), defaultValue: rest.defaultValue ?? "",
  };
  return (
    <div className="flex max-w-[44rem] flex-col gap-2">
      <Label htmlFor={name}>{label}{required && <span className="font-normal"> (wymagane)</span>}</Label>
      {hint && <FieldHint id={`${name}-pomoc`}>{hint}</FieldHint>}
      <FieldError id={`${name}-blad`}>{error}</FieldError>
      {multiline
        ? <Textarea {...props} rows={rows} />
        : <Input {...props} type={rest.type ?? "text"} inputMode={rest.inputMode} />}
    </div>
  );
}

export function SelectField({ name, label, hint, error, required, options, defaultValue }: Base & {
  options: { value: string; label: string }[]; defaultValue?: string | null;
}) {
  return (
    <div className="flex max-w-[44rem] flex-col gap-2">
      <Label htmlFor={name}>{label}{required && <span className="font-normal"> (wymagane)</span>}</Label>
      {hint && <FieldHint id={`${name}-pomoc`}>{hint}</FieldHint>}
      <FieldError id={`${name}-blad`}>{error}</FieldError>
      <NativeSelect id={name} name={name} defaultValue={defaultValue ?? ""} aria-invalid={error ? true : undefined} aria-describedby={describedBy(name, hint, error)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </NativeSelect>
    </div>
  );
}

export function CheckboxGroup({ name, label, hint, error, required, options, defaults }: Base & {
  options: { value: string; label: string }[]; defaults: string[];
}) {
  return (
    <fieldset id={name} className="max-w-[44rem] space-y-1" aria-describedby={describedBy(name, hint, error)} aria-invalid={error ? true : undefined}>
      <legend className="text-lg font-bold">{label}{required && <span className="font-normal"> (wymagane)</span>}</legend>
      {hint && <FieldHint id={`${name}-pomoc`}>{hint}</FieldHint>}
      <FieldError id={`${name}-blad`}>{error}</FieldError>
      <div className="grid gap-x-6 sm:grid-cols-2">
        {options.map((o) => (
          <CheckboxField key={o.value} name={name} value={o.value} label={o.label} defaultChecked={defaults.includes(o.value)} />
        ))}
      </div>
    </fieldset>
  );
}

/** Podsumowanie błędów po wysłaniu: role="alert", dostaje fokus, każdy błąd to link do pola. */
export const ErrorSummary = forwardRef<HTMLDivElement, { errors: Record<string, string>; labels: Record<string, string> }>(
  function ErrorSummary({ errors, labels }, ref) {
    const entries = Object.entries(errors);
    if (!entries.length) return null;
    return (
      <Alert ref={ref} tabIndex={-1} tone="error" title={`Popraw ${entries.length} ${plural(entries.length, "pole", "pola", "pól")}, żeby zapisać`}>
        <ul className="list-disc space-y-1 pl-5">
          {entries.map(([field, msg]) => (
            <li key={field}>
              <a href={`#${field}`} className="underline decoration-1 underline-offset-4">{labels[field] ?? field}: {msg}</a>
            </li>
          ))}
        </ul>
      </Alert>
    );
  },
);
