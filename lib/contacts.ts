import "server-only";
import { emailAuthor } from "./author-contact";
import { notify } from "./notifications";
import { logChange } from "./panel/initiatives";
import { advanceFunnel } from "./funnel";
import { createAdminClient } from "./supabase/admin";
import { partnerKindLabel, pathwayLabel, PATHWAY_KEYS, type PathwayKey } from "./taxonomy";
import { initiativeThread, postStaffMessage } from "./threads";
import { org } from "@/lib/brand";

/**
 * „Poproś o kontakt” (6/10): kontakt twórcy z partnerem wymaga zgody obu stron (tabela contact_requests, 0009).
 * Twórca zgadza się po kluczu zgłoszenia (wywołujący sprawdza go przez authorizedThread), zgodę partnera zapisuje
 * zespół w Panelu — partnerzy nie mają jeszcze kont, a zespół i tak z nimi rozmawia. Po obu zgodach zespół pisze
 * w wątku inicjatywy, a lejek przechodzi na „w realizacji”. Do tego czasu partner nie widzi zgłoszenia.
 */

export type ContactStatus = "oczekuje" | "polaczone" | "odrzucone";

export type ContactRequest = {
  id: string;
  partnerId: string;
  partnerName: string;
  partnerKind: string;
  pathway: PathwayKey | null;
  initiatedBy: "author" | "pci";
  authorConsent: boolean;
  partnerConsent: boolean;
  status: ContactStatus;
  declinedBy: "author" | "partner" | null;
  threadId: string | null;
  createdAt: string;
};

type Row = {
  id: string; initiative_id: string; partner_id: string; pathway: string | null; initiated_by: "author" | "pci";
  author_consent_at: string | null; partner_consent_at: string | null; status: ContactStatus; declined_by: "author" | "partner" | null;
  thread_id: string | null; created_at: string; partners: { name: string; kind: string } | null;
};

const COLUMNS = "id, initiative_id, partner_id, pathway, initiated_by, author_consent_at, partner_consent_at, status, declined_by, thread_id, created_at, partners(name, kind)";

const toRequest = (r: Row): ContactRequest => ({
  id: r.id,
  partnerId: r.partner_id,
  partnerName: r.partners?.name ?? "Partner usunięty",
  partnerKind: r.partners?.kind ?? "",
  pathway: (PATHWAY_KEYS as readonly string[]).includes(r.pathway ?? "") ? (r.pathway as PathwayKey) : null,
  initiatedBy: r.initiated_by,
  authorConsent: r.author_consent_at != null,
  partnerConsent: r.partner_consent_at != null,
  status: r.status,
  declinedBy: r.declined_by,
  threadId: r.thread_id,
  createdAt: r.created_at,
});

export const pathwayKeyOrNull = (v: unknown): PathwayKey | null =>
  typeof v === "string" && (PATHWAY_KEYS as readonly string[]).includes(v) ? (v as PathwayKey) : null;

export async function initiativeContacts(initiativeId: string): Promise<ContactRequest[]> {
  const { data, error } = await createAdminClient()
    .from("contact_requests").select(COLUMNS).eq("initiative_id", initiativeId).order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as Row[]).map(toRequest);
}

async function loadRow(by: { id: string } | { initiativeId: string; partnerId: string }): Promise<Row | null> {
  let query = createAdminClient().from("contact_requests").select(COLUMNS);
  query = "id" in by ? query.eq("id", by.id) : query.eq("initiative_id", by.initiativeId).eq("partner_id", by.partnerId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return (data as unknown as Row | null) ?? null;
}

async function partnerOf(partnerId: string): Promise<{ name: string; kind: string } | null> {
  const { data, error } = await createAdminClient().from("partners").select("name, kind").eq("id", partnerId).eq("active", true).maybeSingle();
  if (error) throw error;
  return (data as { name: string; kind: string } | null) ?? null;
}

async function update(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await createAdminClient().from("contact_requests").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export type ContactOutcome =
  | { ok: true; state: "czeka_na_partnera" | "czeka_na_tworce" | "polaczone" | "odrzucone" }
  | { ok: false; reason: "brak_partnera" | "partner_odmowil" | "brak_prosby" | "zamknieta" };

/**
 * Po obu zgodach: status „połączone” (warunek w update pilnuje, żeby zrobić to raz), wiadomość zespołu w wątku
 * inicjatywy, lejek „w realizacji” i wpis w historii.
 */
async function connect(row: Row, source: "author" | "panel", actorId: string | null): Promise<void> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("contact_requests")
    .update({ status: "polaczone", updated_at: new Date().toISOString() })
    .eq("id", row.id).eq("status", "oczekuje").not("author_consent_at", "is", null).not("partner_consent_at", "is", null)
    .select("id");
  if (error) throw error;
  if (!data?.length) return; // ktoś połączył równolegle

  const partner = row.partners?.name ?? "partner";
  const kind = row.partners?.kind ? partnerKindLabel(row.partners.kind).toLowerCase() : "partner";
  const pathway = row.pathway ? ` Ścieżka: ${pathwayLabel(row.pathway)}.` : "";
  const thread = await initiativeThread({ id: row.initiative_id });
  if (thread) {
    const threadId = await postStaffMessage(thread, {
      role: "staff",
      actorId,
      body: `Obie strony zgodziły się na kontakt: ${partner} (${kind}).${pathway} W tej rozmowie zespół ${org.short} przedstawi was sobie i umówi pierwsze spotkanie. Partner nie dostaje Twoich danych kontaktowych — o tym, co mu przekazać, decydujesz Ty.`,
    });
    await update(row.id, { thread_id: threadId });
  }
  await advanceFunnel(row.initiative_id, "w_realizacji", source, { refId: row.id, note: `Kontakt: ${partner}`, actorId });
  await logChange(actorId, "initiative.contact_connected", "initiative", row.initiative_id, { partner, pathway: row.pathway })
    .catch((e) => console.error("[kontakt] historia:", e));
}

/**
 * Twórca prosi o kontakt (albo przyjmuje propozycję zespołu dla tego samego partnera). Gdy partner już się zgodził,
 * od razu łączy. Prośby po odmowie partnera nie ponawiamy — zespół może zaproponować ją ponownie w Panelu.
 */
export async function authorRequestContact(
  initiative: { id: string; code: string }, partnerId: string, pathway: PathwayKey | null,
): Promise<ContactOutcome> {
  const partner = await partnerOf(partnerId);
  if (!partner) return { ok: false, reason: "brak_partnera" };
  const now = new Date().toISOString();
  let row = await loadRow({ initiativeId: initiative.id, partnerId });
  if (row?.status === "polaczone") return { ok: true, state: "polaczone" };
  if (row?.declined_by === "partner") return { ok: false, reason: "partner_odmowil" };

  if (row) {
    await update(row.id, { author_consent_at: row.author_consent_at ?? now, status: "oczekuje", declined_by: null });
  } else {
    const { error } = await createAdminClient().from("contact_requests").insert({
      initiative_id: initiative.id, partner_id: partnerId, pathway, initiated_by: "author", author_consent_at: now,
    });
    // 23505: równoległa prośba o tego samego partnera — wystarczy ta, która już jest.
    if (error && error.code !== "23505") throw error;
  }
  row = await loadRow({ initiativeId: initiative.id, partnerId });
  if (!row) throw new Error("Nie zapisano prośby o kontakt");

  if (row.partner_consent_at) {
    await connect(row, "author", null);
    return { ok: true, state: "polaczone" };
  }
  await advanceFunnel(initiative.id, "skierowana", "author", { refId: row.id, note: `Prośba o kontakt: ${partner.name}` });
  await notify({
    role: "admin",
    kind: row.initiated_by === "pci" ? "kontakt_zgoda_tworcy" : "prosba_o_kontakt",
    payload: { initiativeId: initiative.id, statusCode: initiative.code, partner: partner.name },
  }).catch((e) => console.error("[kontakt] powiadomienie:", e));
  return { ok: true, state: "czeka_na_partnera" };
}

/** Twórca odmawia propozycji zespołu (albo wycofuje swoją prośbę). */
export async function authorDeclineContact(initiativeId: string, requestId: string): Promise<ContactOutcome> {
  const row = await loadRow({ id: requestId });
  if (!row || row.initiative_id !== initiativeId) return { ok: false, reason: "brak_prosby" };
  if (row.status !== "oczekuje") return { ok: false, reason: "zamknieta" };
  await update(row.id, { status: "odrzucone", declined_by: "author", author_consent_at: null });
  return { ok: true, state: "odrzucone" };
}

/**
 * Zespół proponuje kontakt z partnerem z dopasowania. `partnerAgreed`: zespół już zapytał partnera i ten się zgodził
 * — wtedy, jeśli twórca też się już zgodził, od razu łączymy. Ponowna propozycja po odmowie otwiera prośbę od nowa.
 */
export async function pciProposeContact(
  initiativeId: string, partnerId: string, pathway: PathwayKey | null, partnerAgreed: boolean, actorId: string | null,
): Promise<ContactOutcome> {
  const partner = await partnerOf(partnerId);
  if (!partner) return { ok: false, reason: "brak_partnera" };
  const now = new Date().toISOString();
  const existing = await loadRow({ initiativeId, partnerId });
  if (existing?.status === "polaczone") return { ok: true, state: "polaczone" };

  if (existing) {
    await update(existing.id, {
      partner_consent_at: partnerAgreed ? (existing.partner_consent_at ?? now) : existing.partner_consent_at,
      status: "oczekuje", declined_by: null,
    });
  } else {
    const { error } = await createAdminClient().from("contact_requests").insert({
      initiative_id: initiativeId, partner_id: partnerId, pathway, initiated_by: "pci", partner_consent_at: partnerAgreed ? now : null,
    });
    if (error && error.code !== "23505") throw error;
  }
  const row = await loadRow({ initiativeId, partnerId });
  if (!row) throw new Error("Nie zapisano propozycji kontaktu");
  await logChange(actorId, "initiative.contact_proposed", "initiative", initiativeId, { partner: partner.name, pathway, partnerAgreed })
    .catch((e) => console.error("[kontakt] historia:", e));

  if (row.author_consent_at && row.partner_consent_at) {
    await connect(row, "panel", actorId);
    return { ok: true, state: "polaczone" };
  }
  await advanceFunnel(initiativeId, "skierowana", "panel", { refId: row.id, note: `Propozycja kontaktu: ${partner.name}`, actorId });
  const { data: initiative } = await createAdminClient().from("initiatives").select("status_code, author_id").eq("id", initiativeId).maybeSingle();
  if (initiative?.author_id) {
    await notify({ user_id: initiative.author_id as string, kind: "propozycja_kontaktu", payload: { initiativeId, code: initiative.status_code, partner: partner.name } })
      .catch((e) => console.error("[kontakt] powiadomienie:", e));
  }
  await emailAuthor(initiativeId, "Zespół proponuje kontakt z partnerem — zgódź się albo odmów w rozmowie");
  return { ok: true, state: row.author_consent_at ? "czeka_na_partnera" : "czeka_na_tworce" };
}

/** Zespół zapisuje odpowiedź partnera na prośbę twórcy (albo na własną propozycję). */
export async function pciRecordPartnerAnswer(requestId: string, agreed: boolean, actorId: string | null): Promise<ContactOutcome> {
  const row = await loadRow({ id: requestId });
  if (!row) return { ok: false, reason: "brak_prosby" };
  if (row.status !== "oczekuje") return { ok: false, reason: "zamknieta" };
  const partner = row.partners?.name ?? "partner";
  if (!agreed) {
    await update(row.id, { status: "odrzucone", declined_by: "partner", partner_consent_at: null });
    await logChange(actorId, "initiative.contact_declined", "initiative", row.initiative_id, { partner })
      .catch((e) => console.error("[kontakt] historia:", e));
    return { ok: true, state: "odrzucone" };
  }
  const now = new Date().toISOString();
  await update(row.id, { partner_consent_at: row.partner_consent_at ?? now });
  await logChange(actorId, "initiative.contact_partner_consent", "initiative", row.initiative_id, { partner })
    .catch((e) => console.error("[kontakt] historia:", e));
  if (row.author_consent_at) {
    await connect({ ...row, partner_consent_at: now }, "panel", actorId);
    return { ok: true, state: "polaczone" };
  }
  return { ok: true, state: "czeka_na_tworce" };
}
