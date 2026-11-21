import "server-only";
import { createPublicClient } from "../supabase/public";
import type { InstitutionInnovation } from "./institutions";

/** Instytucja z widoku public_institutions (0007, website od 0010): bez REGON i domeny służbowej. */
export type PublicInstitution = {
  id: string;
  slug: string;
  name: string;
  institution_type: string;
  teryt: string | null;
  synthetic: boolean;
  website: string | null;
};

export async function listPublicInstitutions(): Promise<PublicInstitution[]> {
  const { data, error } = await createPublicClient()
    .from("public_institutions")
    .select("id, slug, name, institution_type, teryt, synthetic, website")
    .order("name");
  if (error) throw error;
  return (data ?? []) as PublicInstitution[];
}

export async function getPublicInstitution(slug: string): Promise<PublicInstitution | null> {
  const { data, error } = await createPublicClient()
    .from("public_institutions")
    .select("id, slug, name, institution_type, teryt, synthetic, website")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as PublicInstitution | null) ?? null;
}

export type InstitutionInnovationRow = InstitutionInnovation & {
  id: string; slug: string | null; title: string; summary: string; innovation_kind: string | null; trl: number | null;
  institution_id: string | null;
};

/** Opublikowane innowacje jednej instytucji z etapem lejka (public_initiatives.funnel_stage, 0010). */
export async function listInstitutionInnovations(institutionId: string): Promise<InstitutionInnovationRow[]> {
  const columns = "id, slug, title, summary, innovation_kind, trl, sectors, signal, institution_id";
  const supabase = createPublicClient();
  const withStage = await supabase
    .from("public_initiatives").select(`${columns}, funnel_stage`).eq("institution_id", institutionId)
    .order("signal", { ascending: false, nullsFirst: false }).order("title");
  // Baza sprzed 0010 nie ma funnel_stage w widoku: strona działa, tylko bez licznika „w realizacji”.
  const res = withStage.error
    ? await supabase.from("public_initiatives").select(columns).eq("institution_id", institutionId)
        .order("signal", { ascending: false, nullsFirst: false }).order("title")
    : withStage;
  if (res.error) throw res.error;
  return ((res.data ?? []) as unknown as Partial<InstitutionInnovationRow>[]).map((r) => ({ funnel_stage: null, ...r })) as InstitutionInnovationRow[];
}

/** Podpowiedzi do pola „Nazwa instytucji” w formularzach zgłoszenia. Bez bazy albo przy błędzie: pusta lista, pole działa dalej. */
export type InstitutionOption = { name: string; type: string };

export async function institutionOptions(): Promise<InstitutionOption[]> {
  try {
    return (await listPublicInstitutions()).map((i) => ({ name: i.name, type: i.institution_type }));
  } catch (e) {
    console.error("[instytucje] podpowiedzi:", e);
    return [];
  }
}
