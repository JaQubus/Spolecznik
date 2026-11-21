import "server-only";
import { after } from "next/server";
import { GroqBusyError } from "./groq";
import { hashKey, keyMatches, newAccessKey } from "./initiatives/access";
import { classifySource } from "./llm";
import { notify } from "./notifications";
import { slugify } from "./pl";
import {
  normalizeCard, SIMILAR_SOURCE_MIN_SIMILARITY,
  type ClaimRequest, type InitiativeCard, type SimilarSource, type SourceClassification, type SourceKey, type SourceRecordKind,
} from "./schemas";
import { keywordSearch, upsertIndex } from "./search";
import { assessAndExplain } from "./pathways";
import { pickDuplicate } from "./source-records";
import { newStatusCode } from "./status-code";
import { createAdminClient } from "./supabase/admin";

/**
 * Automatyczne wykrywanie (Radar 7/10): rekordy z publicznych źródeł (source_records, importery w data/sources/)
 * → klasyfikator LLM → wykryta inicjatywa (status i submission_kind „detected”, nieopublikowana) → twórca przejmuje
 * zgłoszenie linkiem z kodem i kluczem → status „submitted” i zwykła ścieżka Panelu.
 */

export type SourceRecordRow = {
  id: string;
  source: SourceKey;
  external_id: string;
  kind: SourceRecordKind;
  title: string;
  abstract: string | null;
  institution: string | null;
  institution_type: string | null;
  teryt: string | null;
  published_on: string | null;
  url: string | null;
  license: string;
  keywords: string[];
  classification: SourceClassification | null;
  synthetic: boolean;
};

const RECORD_COLUMNS =
  "id, source, external_id, kind, title, abstract, institution, institution_type, teryt, published_on, url, license, keywords, classification, synthetic";

// ── Sprawdzanie dublowania ──

/** „Podobne rozwiązanie już istnieje”: rekordy ze źródeł, które dzielą słowa kluczowe z kartą (bez LLM). */
export async function similarSources(keywords: string[], excludeId?: string, limit = 5): Promise<SimilarSource[]> {
  const hits = (await keywordSearch("source_record", keywords, limit + 1))
    .filter((h) => h.similarity >= SIMILAR_SOURCE_MIN_SIMILARITY && h.ref_id !== excludeId)
    .slice(0, limit);
  if (hits.length === 0) return [];
  const { data, error } = await createAdminClient()
    .from("source_records")
    .select("id, source, kind, title, institution, url, published_on")
    .in("id", hits.map((h) => h.ref_id));
  if (error) throw error;
  const byId = new Map((data ?? []).map((r) => [r.id as string, r]));
  return hits.flatMap((h) => {
    const r = byId.get(h.ref_id);
    return r ? [{
      id: r.id as string, source: r.source as SourceKey, kind: r.kind as SourceRecordKind, title: r.title as string,
      institution: (r.institution as string | null) ?? null, url: (r.url as string | null) ?? null,
      publishedOn: (r.published_on as string | null) ?? null, similarity: h.similarity,
    }] : [];
  });
}

// ── Skanowanie: klasyfikacja zaległych rekordów ──

export type ScanResult = { classified: number; candidates: number; duplicates: number; left: number; busy: boolean };

/**
 * Jedna porcja skanowania z Panelu: do `limit` rekordów bez klasyfikacji (limit Groq jest mały i wspólny).
 * Przy odmowie Groq kończy porcję i zwraca busy — nic nie zapisuje zastępczo.
 */
export async function scanPending(limit = 3): Promise<ScanResult> {
  const supabase = createAdminClient();
  const { data, error, count } = await supabase
    .from("source_records").select(RECORD_COLUMNS, { count: "exact" })
    .is("classification", null).order("published_on", { ascending: false, nullsFirst: false }).limit(limit);
  if (error) throw error;
  const result: ScanResult = { classified: 0, candidates: 0, duplicates: 0, left: count ?? 0, busy: false };
  for (const row of (data ?? []) as SourceRecordRow[]) {
    let classification: SourceClassification;
    try {
      classification = await classifySource({
        kind: row.kind, title: row.title, abstract: row.abstract, institution: row.institution,
        institutionType: row.institution_type, publishedOn: row.published_on,
      });
    } catch (e) {
      if (e instanceof GroqBusyError) { result.busy = true; break; }
      throw e;
    }
    const { error: updateError } = await supabase
      .from("source_records").update({ classification, classified_at: new Date().toISOString() }).eq("id", row.id);
    if (updateError) throw updateError;
    result.classified++;
    result.left--;
    if (classification.card) {
      const created = await createDetectedInitiative({ ...row, classification });
      result.candidates++;
      if (created.duplicateOf) result.duplicates++;
    }
  }
  return result;
}

/** Karta wykrytej inicjatywy z klasyfikacji: twórca uzupełni ją przy przejęciu, więc clarity zostaje niska. */
function cardFrom(c: NonNullable<SourceClassification["card"]>, municipality: string | null): InitiativeCard {
  return normalizeCard({ ...c, municipality, clarity: 0.5, followUps: [] });
}

/**
 * Wykryta inicjatywa z rekordu: nieopublikowana, bez klucza dostępu (klucz powstaje dopiero, gdy Panel wyśle link
 * do przejęcia). Gdy to samo rozwiązanie wykryto już z innego źródła (np. zgłoszenie PL i jego odpowiednik EP),
 * zapisujemy ją jako duplikat (duplicate_of) — zespół widzi jedno zgłoszenie z kilkoma źródłami.
 */
export async function createDetectedInitiative(row: SourceRecordRow & { classification: SourceClassification }) {
  const c = row.classification.card;
  if (!c) throw new Error("Rekord nie jest kandydatem");
  const supabase = createAdminClient();

  // Słowa z karty (LLM) i z rekordu (źródło) razem: listy z LLM bywają zaszumione, rekord dodaje słowa ze źródła.
  const { data: existing, error: existingError } = await supabase
    .from("initiatives").select("id, card, source_records(keywords)").eq("submission_kind", "detected").is("duplicate_of", null).limit(500);
  if (existingError) throw existingError;
  const duplicateOf = pickDuplicate([...c.keywords, ...row.keywords], (existing ?? []).map((e) => ({
    initiativeId: e.id as string,
    keywords: [
      ...((e.card as { keywords?: string[] } | null)?.keywords ?? []),
      ...((e.source_records as unknown as { keywords?: string[] } | null)?.keywords ?? []),
    ],
  })));

  const { data: gmina } = row.teryt
    ? await supabase.from("municipalities").select("name").eq("teryt", row.teryt).maybeSingle()
    : { data: null };
  const card = cardFrom(c, (gmina?.name as string | undefined) ?? null);

  let created: { id: string; status_code: string } | null = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    const code = newStatusCode();
    const { data, error } = await supabase.from("initiatives").insert({
      status_code: code,
      slug: `${slugify(card.title, 50)}-${code.slice(-4).toLowerCase()}`,
      submission_kind: "detected",
      status: "detected",
      raw_text: [row.title, row.abstract].filter(Boolean).join("\n\n"),
      card,
      title: card.title,
      summary: card.summary,
      domains: card.domains,
      institution_type: card.institutionType ?? row.institution_type,
      stage: card.stage,
      cross_topics: card.cross,
      innovation_kind: card.innovationKind,
      sectors: card.sectors,
      trl: card.trl,
      ip_status: card.ipStatus,
      teryt: row.teryt,
      source_record_id: row.id,
      duplicate_of: duplicateOf,
      synthetic: row.synthetic,
    }).select("id, status_code").single();
    if (error && error.code !== "23505") throw error;
    created = data;
  }
  if (!created) throw new Error("Nie udało się nadać kodu wykrytej inicjatywie");
  if (!duplicateOf) {
    await notify({ role: "admin", kind: "nowa_inicjatywa", payload: { initiativeId: created.id, statusCode: created.status_code, title: card.title, submissionKind: "detected" } })
      .catch((e) => console.error("[wykrywanie] powiadomienie:", e));
  }
  return { id: created.id, statusCode: created.status_code, duplicateOf };
}

/** Rekord ze źródła w indeksie kart — po imporcie na żywo; seed 40_sources.sql robi to sam. */
export async function indexSourceRecord(r: Pick<SourceRecordRow, "id" | "title" | "abstract" | "keywords" | "teryt" | "institution_type" | "classification">) {
  await upsertIndex({
    kind: "source_record", refId: r.id, title: r.title, body: r.abstract ?? r.title,
    lemmas: [...r.keywords, ...(r.classification?.card?.keywords ?? [])],
    domains: r.classification?.card?.domains ?? [], institutionType: r.institution_type, teryt: r.teryt,
  });
}

// ── Przejęcie zgłoszenia ──

/** Link do przejęcia: nowy klucz (w bazie tylko skrót). Poprzedni link przestaje działać. */
export async function issueClaimKey(initiativeId: string): Promise<{ code: string; key: string }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("initiatives").select("status_code, status").eq("id", initiativeId).single();
  if (error) throw error;
  if (data.status !== "detected") throw new ClaimError("Tę inicjatywę już przejęto albo zweryfikowano.");
  const access = newAccessKey();
  const { error: updateError } = await supabase.from("initiatives").update({ access_hash: access.hash }).eq("id", initiativeId);
  if (updateError) throw updateError;
  return { code: data.status_code as string, key: access.key };
}

export class ClaimError extends Error {}

export type ClaimView = {
  id: string;
  code: string;
  card: InitiativeCard;
  source: Pick<SourceRecordRow, "source" | "kind" | "title" | "institution" | "url" | "published_on"> | null;
};

/** Wykryta inicjatywa do przejęcia — tylko z poprawnym kluczem i tylko w statusie „detected”. */
export async function claimView(code: string, key: string | null): Promise<ClaimView | null> {
  const { data, error } = await createAdminClient()
    .from("initiatives")
    .select("id, status_code, status, access_hash, card, source_records(source, kind, title, institution, url, published_on)")
    .eq("status_code", code).maybeSingle();
  if (error) throw error;
  if (!data || data.status !== "detected" || !keyMatches((data.access_hash as string | null) ?? null, key)) return null;
  return {
    id: data.id as string, code: data.status_code as string, card: data.card as InitiativeCard,
    source: (data.source_records as unknown as ClaimView["source"]) ?? null,
  };
}

/** Twórca potwierdza i uzupełnia kartę: status „detected” → „submitted”, zmiana w audit_log. */
export async function claimInitiative(input: ClaimRequest, key: string): Promise<{ code: string }> {
  const view = await claimView(input.code, key);
  if (!view) throw new ClaimError("Link do przejęcia jest nieaktualny albo zgłoszenie już przejęto.");
  const card = normalizeCard({ ...view.card, ...input.card, clarity: Math.max(view.card.clarity ?? 0, 0.8) });
  const supabase = createAdminClient();
  const { error } = await supabase.from("initiatives").update({
    card, title: card.title, summary: card.summary, stage: card.stage, innovation_kind: card.innovationKind,
    sectors: card.sectors, trl: card.trl, ip_status: card.ipStatus, status: "submitted", updated_at: new Date().toISOString(),
  }).eq("id", view.id).eq("status", "detected");
  if (error) throw error;
  // Skrót klucza zostaje: ten sam link prowadzi teraz do rozmowy i statusu zgłoszenia.
  const sideEffects = await Promise.allSettled([
    supabase.from("audit_log").insert({
      actor_id: null, action: "initiative.claim", entity: "initiative", entity_id: view.id,
      diff: { from: "detected", to: "submitted", keyHash: hashKey(key).slice(0, 8) },
    }).then(({ error: e }) => { if (e) throw e; }),
    upsertIndex({
      kind: "initiative", refId: view.id, title: card.title, body: `${card.problem} ${card.solution}`, lemmas: card.keywords,
      domains: [...card.domains], tags: [card.stage, ...card.cross], institutionType: card.institutionType,
    }),
    notify({ role: "admin", kind: "nowa_inicjatywa", payload: { initiativeId: view.id, statusCode: view.code, title: card.title, submissionKind: "detected" } }),
  ]);
  for (const r of sideEffects) if (r.status === "rejected") console.error("[przejęcie] efekt uboczny:", r.reason);
  // Karta uzupełniona przez twórcę (np. TRL) = pierwsza ocena radaru i uzasadnienie ścieżek, jak po zwykłym zgłoszeniu
  // (lib/initiatives/create.ts).
  const assess = () => assessAndExplain(view.id).then(() => undefined, (e) => console.error("[przejęcie] ocena radaru i ścieżki:", e));
  try {
    after(assess);
  } catch {
    void assess();
  }
  return { code: view.code };
}

// ── Panel ──

export type SourceStats = { source: SourceKey; records: number; classified: number; candidates: number; synthetic: number }[];

export async function sourceStats(): Promise<SourceStats> {
  const { data, error } = await createAdminClient().from("source_records").select("source, classification, synthetic").limit(5000);
  if (error) throw error;
  const by = new Map<SourceKey, SourceStats[number]>();
  for (const r of data ?? []) {
    const s = by.get(r.source as SourceKey) ?? { source: r.source as SourceKey, records: 0, classified: 0, candidates: 0, synthetic: 0 };
    s.records++;
    if (r.classification) s.classified++;
    if ((r.classification as SourceClassification | null)?.candidate) s.candidates++;
    if (r.synthetic) s.synthetic++;
    by.set(s.source, s);
  }
  return [...by.values()];
}

export async function sourceRecordOf(initiativeId: string): Promise<SourceRecordRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("initiatives").select("source_record_id").eq("id", initiativeId).maybeSingle();
  if (error) throw error;
  if (!data?.source_record_id) return null;
  const { data: row, error: rowError } = await supabase.from("source_records").select(RECORD_COLUMNS).eq("id", data.source_record_id).maybeSingle();
  if (rowError) throw rowError;
  return (row as SourceRecordRow | null) ?? null;
}
