"use server";

import { refresh } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { NEED_STATUSES } from "@/lib/schemas";
import { keywordSearch } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";

const TABLES = { potrzeba: "needs", pomysl: "ideas" } as const;

/** Zmiana statusu jednym kliknięciem; autor widzi ją od razu na /status/[kod]. Każda zmiana trafia do audit_log. */
export async function setStatus(formData: FormData) {
  const admin = await requireAdmin();
  const kind = String(formData.get("kind")) as keyof typeof TABLES;
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!(kind in TABLES) || !(NEED_STATUSES as readonly string[]).includes(status)) return;

  const supabase = createAdminClient();
  const table = TABLES[kind];
  const { data: before, error } = await supabase.from(table).select("status").eq("id", id).single();
  if (error) throw error;
  if (before.status === status) return;

  const { error: updateError } = await supabase.from(table).update({ status }).eq("id", id);
  if (updateError) throw updateError;
  await supabase.from("audit_log").insert({
    actor_id: admin.id, action: "zmiana_statusu", entity: table, entity_id: id, diff: { status: [before.status, status] },
  });
  // Zamknięta potrzeba nie liczy się do „inne gminy zgłosiły podobny problem”.
  if (kind === "potrzeba") {
    await supabase.from("search_index").update({ active: status !== "zamkniete" }).eq("kind", "potrzeba").eq("ref_id", id);
  }
  refresh();
}

/**
 * Włącznik naboru. Przy otwarciu: autorzy pasujących pomysłów dostają powiadomienie
 * (README §6, powiadomienia proaktywne).
 */
export async function setCallActive(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";

  const supabase = createAdminClient();
  const { data: call, error } = await supabase.from("calls").update({ active }).eq("id", id).select("id, title").single();
  if (error) throw error;
  await Promise.all([
    supabase.from("search_index").update({ active }).eq("kind", "nabor").eq("ref_id", id),
    supabase.from("audit_log").insert({
      actor_id: admin.id, action: active ? "otwarcie_naboru" : "zamkniecie_naboru", entity: "calls", entity_id: id, diff: { active },
    }),
  ]);

  if (active) {
    try {
      const { data: indexed } = await supabase.from("search_index").select("lemmas").eq("kind", "nabor").eq("ref_id", id).maybeSingle();
      const lemmas = ((indexed?.lemmas as string | undefined) ?? call.title.toLowerCase()).split(/\s+/).filter(Boolean);
      const hits = (await keywordSearch("pomysl", lemmas, 30)).filter((h) => h.similarity >= 0.25);
      if (hits.length) {
        const { data: ideas } = await supabase.from("ideas").select("author_id").in("id", hits.map((h) => h.ref_id)).not("author_id", "is", null);
        const authors = [...new Set((ideas ?? []).map((i) => i.author_id as string))];
        if (authors.length) {
          await supabase.from("notifications").insert(
            authors.map((user_id) => ({ user_id, kind: "nowy_nabor", payload: { callId: call.id, title: call.title } })),
          );
        }
      }
    } catch (e) {
      console.error("[panel] powiadomienia o naborze:", e);
    }
  }
  refresh();
}
