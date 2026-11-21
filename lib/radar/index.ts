import "server-only";
import { advanceFunnel } from "../funnel";
import { radarAssess, models } from "../llm";
import { createAdminClient } from "../supabase/admin";
import type { RadarKey } from "../taxonomy";
import { buildAssessment, radarCardInput, radarCardLines, type RadarAssessment, type RawDimension } from "./score";

export * from "./score";

/**
 * Ocena radaru jednej inicjatywy: model ocenia wymiary z cytatem z karty, kod stosuje reguły (lib/radar/score.ts)
 * i zapisuje wynik w initiatives.radar oraz initiatives.signal. Ręczna korekta (signal_override) zostaje nietknięta.
 * Wywołania: po zgłoszeniu (after() w lib/initiatives/create.ts) i przycisk „Oceń ponownie” w Panelu.
 */
export async function assessInitiative(initiativeId: string): Promise<RadarAssessment> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("initiatives")
    .select("card, stage, innovation_kind, sectors, trl, ip_status, status")
    .eq("id", initiativeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Nie ma inicjatywy ${initiativeId}`);

  const input = radarCardInput((data.card ?? {}) as Record<string, unknown>, data);

  const result = await radarAssess(input);
  const raw: Partial<Record<RadarKey, RawDimension>> = {};
  for (const d of result.dimensions) raw[d.key] ??= { score: d.score, why: d.why, evidence: d.evidence, basis: d.basis };

  const assessment = buildAssessment(
    raw,
    { stage: data.stage, innovationKind: data.innovation_kind, trl: data.trl, cardText: radarCardLines(input).join("\n") },
    { strengths: result.strengths, risks: result.risks, model: models.quality, assessedAt: new Date().toISOString() },
  );
  const { error: saveError } = await supabase
    .from("initiatives")
    .update({ radar: assessment, signal: assessment.signal, updated_at: new Date().toISOString() })
    .eq("id", initiativeId);
  if (saveError) throw saveError;
  // Lejek: wykryta zostaje wykrytą, dopóki twórca jej nie przejmie.
  if (data.status !== "detected") await advanceFunnel(initiativeId, "oceniona", "system", { note: `Sygnał radaru ${assessment.signal}/100` });
  return assessment;
}
