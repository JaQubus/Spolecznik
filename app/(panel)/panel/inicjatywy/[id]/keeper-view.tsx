import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { PathwaysSection } from "@/components/pathways/pathways-section";
import { RadarNotes, RadarTable } from "@/components/radar/radar-table";
import { DomainBadge } from "@/components/taxonomy/icons";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/initiatives/status";
import { initiativeHref } from "@/lib/knowledge/hrefs";
import { effectiveSignal, initiativeCreators, submissionLabel, type CreatorRow, type InitiativeRow } from "@/lib/panel/initiatives";
import { initiativePathwaySource, pathwaysFor, type PathwaysView } from "@/lib/pathways";
import { readAssessment } from "@/lib/radar/score";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/pl";
import {
  creatorRoleLabel, funnelLabel, innovationKindLabel, ipStatusLabel, sectorLabel, signalLevel, stageLabel, trlLabel,
} from "@/lib/taxonomy";

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";

type FunnelRow = { stage: string; source: string; note: string | null; created_at: string };

/**
 * Widok innowacji dla opiekuna instytucji: karta, ocena radaru, ścieżki, etap lejka i twórcy w trybie do odczytu.
 * Bez treści od autora, rozmów, danych kontaktowych i jakichkolwiek akcji — te zostają zespołowi PCI.
 * Wywołujący sprawdził już, że innowacja należy do instytucji opiekuna.
 */
export async function KeeperView({ row }: { row: InitiativeRow }) {
  const admin = createAdminClient();
  const [pathways, creators, events, stage] = await Promise.all([
    initiativePathwaySource(row.id).then((src) => (src ? pathwaysFor(src) : null))
      .catch((e): PathwaysView | null => { console.error("[panel] ścieżki (opiekun):", e); return null; }),
    initiativeCreators(row.id).catch((e) => { console.error("[panel] twórcy (opiekun):", e); return [] as CreatorRow[]; }),
    admin.from("funnel_events").select("stage, source, note, created_at").eq("initiative_id", row.id).order("created_at")
      .then((r) => (r.error ? [] : (r.data ?? [])) as FunnelRow[]),
    admin.from("initiatives").select("funnel_stage").eq("id", row.id).maybeSingle().then((r) => (r.data?.funnel_stage as string | null) ?? null, () => null),
  ]);
  const card = row.card;
  const radar = readAssessment(row.radar);
  const signal = effectiveSignal(row);

  return (
    <article className="max-w-4xl space-y-10">
      <div className="space-y-3">
        <Link href="/panel" className={`inline-flex min-h-12 items-center gap-2 text-lg font-bold ${linkClass}`}>
          <ArrowLeftIcon aria-hidden className="size-5" /> Radar
        </Link>
        <h1 className="text-3xl font-bold">{row.title}</h1>
        <p className="text-muted-foreground">
          <span className="font-mono tracking-wider">{row.status_code}</span>
          {" · "}{submissionLabel(row.submission_kind, true)}
          {" · "}{row.municipalities ? `${row.municipalities.name}, powiat ${row.municipalities.county}` : "gmina nieznana"}
          {" · "}{formatDate(row.created_at)}
          {" · "}<strong className="text-foreground">{statusLabel(row.status)}</strong>
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Sygnał, publikacja i lejek">
          {signal != null && <li><Badge>Sygnał {signal}/100: {signalLevel(signal).label}</Badge></li>}
          <li><Badge variant="outline">{row.published ? "Opublikowana" : "Nieopublikowana"}</Badge></li>
          {stage && <li><Badge variant="outline">Lejek: {funnelLabel(stage)}</Badge></li>}
        </ul>
        {row.published && row.slug && <p><Link href={initiativeHref(row.slug)} className={`font-bold ${linkClass}`}>Zobacz stronę publiczną</Link></p>}
        <Alert title="Widok tylko do odczytu">Zmiany statusu, publikacji i kontaktów z partnerami wprowadza zespół PCI.</Alert>
      </div>

      <section aria-labelledby="karta" className="space-y-3">
        <h2 id="karta" className="text-2xl font-bold">Karta innowacji</h2>
        <p className="max-w-[68ch] text-lg">{card.summary}</p>
        <dl className="grid max-w-[68ch] gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
          <dt className="font-bold">Problem</dt><dd>{card.problem}</dd>
          <dt className="font-bold">Rozwiązanie</dt><dd>{card.solution}</dd>
          {card.effects && (<><dt className="font-bold">Efekty</dt><dd>{card.effects}</dd></>)}
          {card.beneficiaries && (<><dt className="font-bold">Dla kogo</dt><dd>{card.beneficiaries}</dd></>)}
          <dt className="font-bold">Etap</dt><dd>{stageLabel(card.stage)}</dd>
          {row.innovation_kind && (<><dt className="font-bold">Typ innowacji</dt><dd>{innovationKindLabel(row.innovation_kind)}</dd></>)}
          {row.sectors.length > 0 && (<><dt className="font-bold">Sektory PCI</dt><dd>{row.sectors.map(sectorLabel).join(", ")}</dd></>)}
          {row.trl != null && (<><dt className="font-bold">Gotowość technologii</dt><dd>{trlLabel(row.trl)}</dd></>)}
          {row.ip_status && (<><dt className="font-bold">Ochrona IP</dt><dd>{ipStatusLabel(row.ip_status)}</dd></>)}
        </dl>
        <ul className="flex flex-wrap gap-2" aria-label="Dziedziny">{card.domains.map((d) => <li key={d}><DomainBadge domain={d} /></li>)}</ul>
      </section>

      <section aria-labelledby="ocena" className="space-y-4">
        <h2 id="ocena" className="text-2xl font-bold">Ocena radaru</h2>
        {radar ? (
          <>
            <RadarTable radar={radar} id="radar-opiekun" />
            <RadarNotes radar={radar} />
          </>
        ) : (
          <p className="text-muted-foreground">Innowacja nie ma jeszcze oceny według obecnej metodologii.</p>
        )}
        <p><Link href="/metodologia" className={`font-bold ${linkClass}`}>Jak liczymy ocenę</Link></p>
      </section>

      {pathways && <PathwaysSection view={pathways} audience="public" size="panel" idPrefix="sciezki-opiekun" />}

      <section aria-labelledby="lejek" className="space-y-3">
        <h2 id="lejek" className="text-2xl font-bold">Co dzieje się z innowacją</h2>
        {events.length === 0 ? (
          <p className="text-muted-foreground">Nic jeszcze nie zostało zapisane w lejku.</p>
        ) : (
          <ol className="border-t">
            {events.map((e, i) => (
              <li key={i} className="border-b py-3">
                <span className="text-muted-foreground">{formatDate(e.created_at)}</span> · <strong>{funnelLabel(e.stage)}</strong>{e.note && <> — „{e.note}”</>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="tworcy" className="space-y-3">
        <h2 id="tworcy" className="text-2xl font-bold">Twórcy</h2>
        <p className="text-muted-foreground">Role bez danych osobowych. Podpis jest publiczny tylko za zgodą, a u osoby poniżej 18 lat także za zgodą opiekuna.</p>
        {creators.length === 0 ? (
          <p className="text-muted-foreground">Opis nie mówi, kto to tworzy.</p>
        ) : (
          <ul className="max-w-[68ch] divide-y border-y">
            {creators.map((c) => (
              <li key={c.id} className="py-3">
                <span className="font-bold">{creatorRoleLabel(c.role)}</span>
                <span className="block text-muted-foreground">
                  {c.under_18 ? "Poniżej 18 lat. " : ""}
                  {c.show_publicly && (!c.under_18 || c.guardian_consent) ? "Zgoda na pokazanie podpisu." : "Publicznie widać tylko rolę."}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
  );
}
