"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import type { FormState } from "@/components/knowledge/admin-fields";
import { getViewer } from "@/lib/auth";
import { knowledge } from "@/lib/knowledge";
import { indexEntity, unindexEntity } from "@/lib/knowledge/indexing";
import { StoreError, type Entity, type EntityKind } from "@/lib/knowledge/store";
import { INNOVATION_TYPES, MATERIAL_KINDS, type Area, type Fact, type Innovation, type Material } from "@/lib/knowledge/types";
import { GROUPS, MWS_AREAS } from "@/lib/schemas";

// ── Pomocnicze ──────────────────────────────────────────────

const text = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optional = (fd: FormData, k: string) => text(fd, k) || null;
const checked = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "1";
const list = (fd: FormData, k: string) => fd.getAll(k).map(String);
const int = (fd: FormData, k: string) => (text(fd, k) ? Number(text(fd, k).replace(/\s/g, "")) : null);
const num = (fd: FormData, k: string) => (text(fd, k) ? Number(text(fd, k).replace(/\s/g, "").replace(",", ".")) : null);

const url = z.string().url("Wpisz pełny adres, np. https://rops.krakow.pl/…");
const optionalUrl = url.nullable();

/** Błędy zod → komunikaty przy polach (nazwa pola = nazwa w formularzu). */
function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "formularz");
    out[key] ??= issue.message;
  }
  return out;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

/** YouTube: pełny link albo samo ID (11 znaków). */
function youtubeId(v: string): string | null {
  const m = v.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/) ?? v.match(/^([\w-]{11})$/);
  return m?.[1] ?? null;
}

async function audit(action: string, kind: EntityKind, id: string, actor: string) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const uuid = /^[0-9a-f-]{36}$/.test(id) ? id : null;
  await createAdminClient().from("audit_log").insert({ action: `${action}:${kind}`, entity: kind, entity_id: uuid, diff: { id, actor } });
}

/**
 * Wspólny przebieg zapisu: rola → walidacja → zapis → indeks w tle → przekierowanie z komunikatem.
 * Rolę sprawdzamy w każdej akcji — Server Action to publiczny POST, nie tylko przycisk w panelu.
 */
async function persist<K extends EntityKind>(kind: K, entity: Entity[K], id: string, back: string): Promise<FormState> {
  const viewer = await getViewer();
  if (viewer?.role !== "admin") return { ok: false, message: "Nie masz uprawnień do zapisu. Zaloguj się jako administrator.", errors: {} };
  const blocker = await knowledge.store.writeBlocker();
  if (blocker) return { ok: false, message: blocker, errors: {} };
  try {
    await knowledge.store.save(kind, entity);
  } catch (e) {
    return { ok: false, message: e instanceof StoreError ? e.message : "Nie udało się zapisać. Spróbuj ponownie za chwilę.", errors: {} };
  }
  // Embedding + lematy + tagi liczą się po wysłaniu odpowiedzi — admin nie czeka na LLM.
  after(async () => {
    try {
      await indexEntity(kind, entity);
      await audit("zapis", kind, id, viewer.label);
    } catch (e) {
      console.error("[panel/wiedza] indeksowanie po zapisie nieudane:", e);
    }
  });
  revalidatePath("/biblioteka", "layout");
  redirect(`${back}?zapisano=1`);
}

// ── Innowacja ───────────────────────────────────────────────

const InnovationInput = z.object({
  title: z.string().min(3, "Wpisz nazwę innowacji (co najmniej 3 znaki)."),
  slug: z.string().regex(/^[a-z0-9-]+$/, "Adres może mieć tylko małe litery bez polskich znaków, cyfry i myślniki."),
  groups: z.array(z.enum(GROUPS)).min(1, "Zaznacz co najmniej jedną grupę „dla kogo”."),
  areas: z.array(z.enum(MWS_AREAS)).max(3, "Zaznacz najwyżej 3 obszary."),
  innovationType: z.enum(INNOVATION_TYPES).nullable(),
  problem: z.string().min(10, "Opisz, jaki problem rozwiązuje innowacja."),
  solution: z.string().min(10, "Opisz, na czym polega rozwiązanie."),
  evidence: z.string().nullable(),
  whoCanUse: z.string().min(5, "Napisz, kto może skorzystać z innowacji albo ją wdrożyć."),
  beneficiaries: z.string().nullable(),
  etrSummary: z.string().nullable(),
  video: z.string().nullable().refine((v) => !v || youtubeId(v), "Wklej link do filmu na YouTube, np. https://www.youtube.com/watch?v=…"),
  pdfUrl: optionalUrl,
  sourceUrl: optionalUrl,
});

export async function saveInnovation(_: FormState, fd: FormData): Promise<FormState> {
  const id = text(fd, "id") || randomUUID();
  const existing = await knowledge.innovation(id, { all: true });
  const parsed = InnovationInput.safeParse({
    title: text(fd, "title"),
    slug: text(fd, "slug") || slugify(text(fd, "title")),
    groups: list(fd, "groups"),
    areas: list(fd, "areas"),
    innovationType: optional(fd, "innovationType"),
    problem: text(fd, "problem"),
    solution: text(fd, "solution"),
    evidence: optional(fd, "evidence"),
    whoCanUse: text(fd, "whoCanUse"),
    beneficiaries: optional(fd, "beneficiaries"),
    etrSummary: optional(fd, "etrSummary"),
    video: optional(fd, "video"),
    pdfUrl: optional(fd, "pdfUrl"),
    sourceUrl: optional(fd, "sourceUrl"),
  });
  if (!parsed.success) return { ok: false, message: "", errors: fieldErrors(parsed.error) };
  const v = parsed.data;
  const clash = (await knowledge.innovations({}, { all: true })).find((i) => i.slug === v.slug && i.id !== id);
  if (clash) return { ok: false, message: "", errors: { slug: `Ten adres ma już innowacja „${clash.title}”. Zmień go.` } };

  const ytId = v.video ? youtubeId(v.video) : null;
  const innovation: Innovation = {
    ...(existing ?? { materialsZip: null, licenseUrl: null, dissemination: false, synthetic: false }),
    id, slug: v.slug, title: v.title, groups: v.groups, areas: v.areas, innovationType: v.innovationType,
    // Admin zatwierdził obszary i typ — nie są już „przypisane automatycznie”.
    areasAuto: false, typeAuto: false,
    problem: v.problem, solution: v.solution, evidence: v.evidence, whoCanUse: v.whoCanUse,
    beneficiaries: v.beneficiaries, etrSummary: v.etrSummary, pdfUrl: v.pdfUrl, sourceUrl: v.sourceUrl,
    video: ytId
      ? {
          youtubeId: ytId,
          title: `Film: ${v.title}`,
          thumbnailUrl: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
          captions: checked(fd, "videoCaptions"),
          signLanguage: checked(fd, "videoSignLanguage"),
        }
      : null,
    dissemination: checked(fd, "dissemination"),
    published: checked(fd, "published"),
  };
  return persist("innowacja", innovation, id, `/panel/wiedza/innowacja/${id}`);
}

// ── Fakt ────────────────────────────────────────────────────

const FactInput = z.object({
  area: z.enum(MWS_AREAS, "Wybierz obszar."),
  displayValue: z.string().min(1, "Wpisz liczbę tak, jak ma się wyświetlić, np. „841,5 tys.”."),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  sentence: z.string().min(10, "Napisz jedno zdanie prostym językiem, co znaczy ta liczba."),
  dataYear: z.number().int().min(1990).max(2100).nullable(),
  isExample: z.boolean(),
  sourceTitle: z.string().nullable(),
  sourcePublisher: z.string().nullable(),
  sourceUrl: optionalUrl,
  sourceYear: z.number().int().min(1990).max(2100, "Wpisz rok, np. 2025.").nullable(),
  sourcePage: z.number().int().positive("Numer strony to liczba większa od zera.").nullable(),
  quote: z.string().nullable(),
}).superRefine((f, ctx) => {
  // Ten sam warunek co CHECK w bazie: bez źródła fakt musi być oznaczony jako przykład.
  if (!f.isExample) {
    if (!f.sourceTitle) ctx.addIssue({ code: "custom", path: ["sourceTitle"], message: "Podaj tytuł źródła albo zaznacz „Liczba przykładowa”." });
    if (!f.sourceUrl) ctx.addIssue({ code: "custom", path: ["sourceUrl"], message: "Podaj adres źródła albo zaznacz „Liczba przykładowa”." });
    if (!f.sourceYear) ctx.addIssue({ code: "custom", path: ["sourceYear"], message: "Podaj rok źródła albo zaznacz „Liczba przykładowa”." });
  }
});

export async function saveFact(_: FormState, fd: FormData): Promise<FormState> {
  const id = text(fd, "id") || randomUUID();
  const parsed = FactInput.safeParse({
    area: text(fd, "area"), displayValue: text(fd, "displayValue"), value: num(fd, "value"), unit: optional(fd, "unit"),
    sentence: text(fd, "sentence"), dataYear: int(fd, "dataYear"), isExample: checked(fd, "isExample"),
    sourceTitle: optional(fd, "sourceTitle"), sourcePublisher: optional(fd, "sourcePublisher"), sourceUrl: optional(fd, "sourceUrl"),
    sourceYear: int(fd, "sourceYear"), sourcePage: int(fd, "sourcePage"), quote: optional(fd, "quote"),
  });
  if (!parsed.success) return { ok: false, message: "", errors: fieldErrors(parsed.error) };
  const existing = (await knowledge.facts(undefined, { all: true })).find((f) => f.id === id);
  const fact: Fact = { ...parsed.data, id, sort: existing?.sort ?? 999, published: checked(fd, "published") };
  return persist("fakt", fact, id, `/panel/wiedza/fakt/${id}`);
}

// ── Materiał ────────────────────────────────────────────────

const MaterialInput = z.object({
  kind: z.enum(MATERIAL_KINDS, "Wybierz rodzaj materiału."),
  title: z.string().min(3, "Wpisz tytuł materiału."),
  description: z.string().nullable(),
  url,
  format: z.string().nullable(),
  sizeMb: z.number().positive("Rozmiar to liczba większa od zera, np. 1,8.").nullable(),
  language: z.enum(["pl", "en", "uk"]),
  areas: z.array(z.enum(MWS_AREAS)),
  year: z.number().int().min(1990).max(2100, "Wpisz rok, np. 2024.").nullable(),
});

export async function saveMaterial(_: FormState, fd: FormData): Promise<FormState> {
  const id = text(fd, "id") || randomUUID();
  const parsed = MaterialInput.safeParse({
    kind: text(fd, "kind"), title: text(fd, "title"), description: optional(fd, "description"), url: text(fd, "url"),
    format: optional(fd, "format"), sizeMb: num(fd, "sizeMb"), language: text(fd, "language") || "pl",
    areas: list(fd, "areas"), year: int(fd, "year"),
  });
  if (!parsed.success) return { ok: false, message: "", errors: fieldErrors(parsed.error) };
  const { sizeMb, ...v } = parsed.data;
  const existing = (await knowledge.materials({}, { all: true })).find((m) => m.id === id);
  const material: Material = {
    ...existing, ...v, id, sizeBytes: sizeMb ? Math.round(sizeMb * 1_000_000) : null,
    sort: existing?.sort ?? 999, published: checked(fd, "published"),
  };
  return persist("material", material, id, `/panel/wiedza/material/${id}`);
}

// ── Obszar ──────────────────────────────────────────────────

const AreaInput = z.object({
  name: z.string().min(3, "Wpisz nazwę obszaru."),
  lead: z.string().min(10, "Napisz jedno zdanie na kafel.").max(120, "Zdanie na kafel może mieć najwyżej 120 znaków."),
  definition: z.string().min(20, "Napisz 2–3 zdania prostym językiem."),
  challenges: z.array(z.string()).min(1, "Wpisz co najmniej jedno wyzwanie (każde w nowej linii)."),
});

export async function saveArea(_: FormState, fd: FormData): Promise<FormState> {
  const key = text(fd, "id");
  const existing = await knowledge.area(key, { all: true });
  if (!existing) return { ok: false, message: "Nie ma takiego obszaru. Obszary wynikają z Mapy Wyzwań i nie można dodawać nowych.", errors: {} };
  const parsed = AreaInput.safeParse({
    name: text(fd, "name"), lead: text(fd, "lead"), definition: text(fd, "definition"),
    challenges: text(fd, "challenges").split("\n").map((l) => l.replace(/^[-•]\s*/, "").trim()).filter(Boolean),
  });
  if (!parsed.success) return { ok: false, message: "", errors: fieldErrors(parsed.error) };
  const area: Area = { ...existing, ...parsed.data, published: checked(fd, "published") };
  return persist("obszar", area, key, `/panel/wiedza/obszar/${key}`);
}

// ── Usuwanie i pełne indeksowanie ───────────────────────────

const KINDS = ["innowacja", "fakt", "material"] as const;

export async function removeEntity(fd: FormData): Promise<void> {
  const viewer = await getViewer();
  if (viewer?.role !== "admin") redirect("/logowanie");
  const kind = z.enum(KINDS).parse(text(fd, "kind"));
  const id = z.string().min(1).parse(text(fd, "id"));
  await knowledge.store.remove(kind, id);
  after(async () => {
    await unindexEntity(kind, id).catch((e) => console.error("[panel/wiedza] usuwanie z indeksu:", e));
    await audit("usuniecie", kind, id, viewer.label).catch(() => {});
  });
  revalidatePath("/biblioteka", "layout");
  redirect(`/panel/wiedza?rodzaj=${kind}&usunieto=1`);
}

/** Przelicza indeks wyszukiwarki dla całego Zasobnika (np. po imporcie seeda). */
export async function reindexAll(): Promise<void> {
  const viewer = await getViewer();
  if (viewer?.role !== "admin") redirect("/logowanie");
  const [innovations, areas, materials] = await Promise.all([
    knowledge.innovations({}, { all: true }), knowledge.areas({ all: true }), knowledge.materials({}, { all: true }),
  ]);
  after(async () => {
    for (const a of areas) await indexEntity("obszar", a).catch((e) => console.error("[reindex] obszar", a.key, e));
    for (const m of materials) await indexEntity("material", m).catch((e) => console.error("[reindex] material", m.id, e));
    for (const i of innovations) await indexEntity("innowacja", i).catch((e) => console.error("[reindex] innowacja", i.slug, e));
  });
  redirect("/panel/wiedza?indeks=1");
}
