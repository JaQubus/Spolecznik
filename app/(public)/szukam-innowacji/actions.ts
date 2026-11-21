"use server";

import { headers } from "next/headers";
import { createPublicClient, publicClientConfigured } from "@/lib/supabase/public";
import { createAdminClient } from "@/lib/supabase/admin";
import { alertMatches } from "@/lib/innovations/alerts";
import { PartnerProfileInput, profileFromForm } from "@/lib/innovations/partner-profile";
import { anonymize } from "@/lib/pii";
import { rateLimit } from "@/lib/rate-limit";
import { slugify } from "@/lib/pl";
import { initiativeHref } from "@/lib/knowledge/hrefs";

export type PartnerMatchPreview = { title: string; summary: string; href: string; signal: number | null };

export type PartnerFormState =
  | null
  | { ok: false; message: string; errors?: Record<string, string> }
  | { ok: true; name: string; alert: boolean; alertFailed: boolean; matches: PartnerMatchPreview[] };

const FAILED: PartnerFormState = { ok: false, message: "Nie udało się zapisać profilu. Spróbuj ponownie za chwilę." };

/** Innowacje, które już teraz pasują do profilu — odpowiedź na „co tu dla mnie jest”, zanim przyjdzie pierwszy alert. */
async function currentMatches(profile: PartnerProfileInput): Promise<PartnerMatchPreview[]> {
  if (!publicClientConfigured()) return [];
  const { data, error } = await createPublicClient()
    .from("public_initiatives")
    .select("slug, id, title, summary, sectors, innovation_kind, trl, signal")
    .overlaps("sectors", profile.sectors)
    .order("signal", { ascending: false, nullsFirst: false })
    .limit(60);
  if (error) throw error;
  const target = { sectors: profile.sectors, kinds: [] as string[], trlMin: profile.trlMin ?? null, trlMax: profile.trlMax ?? null };
  return (data ?? [])
    .filter((r) => alertMatches(target, { sectors: r.sectors as string[], innovation_kind: r.innovation_kind as string | null, trl: r.trl as number | null }))
    .slice(0, 5)
    .map((r) => ({
      title: r.title as string, summary: r.summary as string, signal: r.signal as number | null,
      href: initiativeHref((r.slug as string | null) ?? (r.id as string)),
    }));
}

/**
 * „Szukam innowacji do wdrożenia lub finansowania”: profil organizacji (partners, nieaktywny do zatwierdzenia
 * przez zespół PCI) i, jeśli partner poda adres, alert o nowych innowacjach. Bez danych osób: nazwa organizacji,
 * opis potrzeb, adres e-mail organizacji. Opis przechodzi przez maskowanie danych osobowych jak każdy wolny tekst.
 */
export async function submitPartnerProfile(_prev: PartnerFormState, formData: FormData): Promise<PartnerFormState> {
  // Pole-pułapka dla botów: człowiek go nie widzi i nie wypełnia.
  if (formData.get("website")) return FAILED;
  const limited = rateLimit(new Request("http://lokalnie", { headers: await headers() }), "profil-partnera", 5);
  if (limited) return { ok: false, message: "Za dużo prób naraz. Spróbuj ponownie za minutę." };

  const parsed = PartnerProfileInput.safeParse(profileFromForm(formData));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { ok: false, message: "Popraw zaznaczone pola.", errors };
  }
  const profile = parsed.data;

  try {
    const supabase = createAdminClient();
    const description = anonymize(profile.description).text;
    const suffix = () => Math.random().toString(36).slice(2, 6);
    let partnerId: string | null = null;
    for (let attempt = 0; attempt < 3 && !partnerId; attempt++) {
      const { data, error } = await supabase
        .from("partners")
        .insert({
          slug: `${slugify(profile.name, 50) || "partner"}-${suffix()}`, name: profile.name, kind: profile.kind, description,
          sectors: profile.sectors, domains: [], support: profile.support, trl_min: profile.trlMin ?? null, trl_max: profile.trlMax ?? null,
          stages: [], active: false, synthetic: false,
        })
        .select("id")
        .single();
      if (!error) partnerId = data.id as string;
      else if (error.code !== "23505") throw error; // 23505: slug zajęty, próbujemy z innym końcem
    }
    if (!partnerId) return FAILED;

    let alertFailed = false;
    if (profile.email) {
      const { error } = await supabase.from("innovation_alerts").insert({
        partner_id: partnerId, email: profile.email, sectors: profile.sectors, kinds: [], trl_min: profile.trlMin ?? null, trl_max: profile.trlMax ?? null,
      });
      if (error) { console.error("[partner] alert:", error); alertFailed = true; }
    }
    const matches = await currentMatches(profile).catch((e) => { console.error("[partner] dopasowania:", e); return []; });
    return { ok: true, name: profile.name, alert: !!profile.email && !alertFailed, alertFailed, matches };
  } catch (e) {
    console.error("[partner] profil:", e);
    return FAILED;
  }
}
