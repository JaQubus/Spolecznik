import "server-only";
import { crossLabel, domainLabel, institutionLabel } from "@/lib/taxonomy";
import { MATERIAL_KIND_LABELS, TYPE_LABELS } from "./labels";
import type { EntityKind, Entity } from "./store";

/** Dziedziny mają klucz tekstowy, a search_index.ref_id to uuid — deterministyczny UUID z klucza. */
export function domainRefId(key: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (const c of `dziedzina:${key}`) {
    h1 = Math.imul(h1 ^ c.charCodeAt(0), 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c.charCodeAt(0), 2246822519) >>> 0;
  }
  const hex = (h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0")).repeat(2);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

type IndexDoc = { kind: "pattern" | "domain" | "material"; refId: string; title: string; body: string; domains: string[]; tags: string[]; active: boolean };

function toDoc<K extends EntityKind>(kind: K, e: Entity[K]): IndexDoc | null {
  if (kind === "rozwiazanie") {
    const p = e as Entity["rozwiazanie"];
    return {
      kind: "pattern", refId: p.id, title: p.title, domains: p.domains, tags: p.crossTopics, active: p.published,
      body: [p.title, p.problem, p.solution, p.beneficiaries, p.whoCanUse, p.etrSummary,
        p.innovationType && TYPE_LABELS[p.innovationType], p.domains.map(domainLabel).join(", "),
        p.crossTopics.map(crossLabel).join(", "), p.institutionTypes.map(institutionLabel).join(", ")]
        .filter(Boolean).join("\n"),
    };
  }
  if (kind === "dziedzina") {
    const d = e as Entity["dziedzina"];
    return {
      kind: "domain", refId: domainRefId(d.key), title: d.name, domains: [d.key], tags: [], active: d.published,
      body: [d.name, d.lead, d.definition, ...d.challenges].join("\n"),
    };
  }
  if (kind === "material") {
    const m = e as Entity["material"];
    return {
      kind: "material", refId: m.id, title: m.title, domains: m.domains, tags: [], active: m.published,
      body: [m.title, MATERIAL_KIND_LABELS[m.kind], m.description].filter(Boolean).join("\n"),
    };
  }
  return null; // fakty nie są osobnymi wynikami wyszukiwania
}

/**
 * Ponowne indeksowanie po zapisie w Panelu: lematy i dziedziny z Groq → search_index (lib/search.ts).
 * Bez bazy nic nie robi: wyszukiwanie po słowach czyta dane bezpośrednio, więc zmiana jest widoczna od razu.
 * Bez klucza Groq też nie: indeks z lematami bez LLM byłby gorszy od tego, który już jest.
 */
export async function indexEntity<K extends EntityKind>(kind: K, entity: Entity[K]): Promise<boolean> {
  const doc = toDoc(kind, entity);
  const hasDb = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!doc || !hasDb || !process.env.GROQ_API_KEY) return false;
  const [{ upsertIndex }, { tagCard }] = await Promise.all([import("@/lib/search"), import("@/lib/llm")]);
  const tags = await tagCard(doc.title, doc.body.slice(0, 6000));
  await upsertIndex({
    kind: doc.kind,
    refId: doc.refId,
    title: doc.title,
    body: doc.body.slice(0, 4000),
    lemmas: tags.lemmas,
    domains: [...new Set([...doc.domains, ...tags.domains])],
    tags: doc.tags,
    active: doc.active,
  });
  return true;
}

/** Usunięty rekord znika z wyszukiwarki. */
export async function unindexEntity(kind: EntityKind, id: string): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const map = { rozwiazanie: "pattern", dziedzina: "domain", material: "material", fakt: null } as const;
  const k = map[kind];
  if (!k) return;
  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient().from("search_index").delete().eq("kind", k).eq("ref_id", kind === "dziedzina" ? domainRefId(id) : id);
}
