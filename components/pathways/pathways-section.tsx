import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import type { ChallengeMatch, PartnerMatch } from "@/lib/pathways/match";
import { PARTNER_GROUPS } from "@/lib/pathways/match";
import type { PathwaysView } from "@/lib/pathways/view";
import { institutionLabel, partnerKindLabel, PATHWAYS } from "@/lib/taxonomy";
import { plural } from "@/lib/pl";

/**
 * Ścieżki rozwoju, dopasowani partnerzy i instytucje z podobnym problemem (6/10). Bez hooków i importów serwerowych:
 * ten sam komponent renderuje karta publiczna, Panel i rozmowa twórcy (serwer) oraz wynik zgłoszenia (klient).
 *
 * audience: public — wyzwania tylko jako liczby (opis z gminą mógłby wskazać konkretną szkołę); author i panel —
 * opisy wyzwań z powiatem. `partnerAction` dokłada przycisk przy partnerze (prośba o kontakt, propozycja w Panelu).
 */
export type PathwaysAudience = "public" | "author" | "panel";

const HEADING = {
  page: { h2: "text-3xl font-bold", h3: "text-2xl font-bold", h4: "text-xl font-bold" },
  panel: { h2: "text-2xl font-bold", h3: "text-xl font-bold", h4: "text-lg font-bold" },
  result: { h2: "text-xl font-bold", h3: "text-lg font-bold", h4: "text-lg font-bold" },
} as const;

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";

export function PathwaysSection({
  view, audience, size = "page", idPrefix = "sciezki", partnerAction, contactNote,
}: {
  view: PathwaysView;
  audience: PathwaysAudience;
  size?: keyof typeof HEADING;
  idPrefix?: string;
  partnerAction?: (m: PartnerMatch) => ReactNode;
  /** Zdanie pod partnerami: jak działa kontakt dla tego odbiorcy. */
  contactNote?: ReactNode;
}) {
  const h = HEADING[size];
  const { recommendation, narrative } = view;
  return (
    <div className="space-y-12">
      <section aria-labelledby={`${idPrefix}-naglowek`} className="max-w-[68ch] space-y-4">
        <h2 id={`${idPrefix}-naglowek`} className={h.h2}>
          {recommendation.pathways.length > 1 ? "Rekomendowane ścieżki rozwoju" : "Rekomendowana ścieżka rozwoju"}
        </h2>
        <p className="text-lg">
          Ścieżki wybierają jawne reguły: typ innowacji, etap, poziom TRL, ochrona własności intelektualnej i ocena radaru.
          {!recommendation.withRadar && " To wstępna propozycja przed oceną radaru — po ocenie ścieżki mogą się zmienić."}{" "}
          <Link href="/metodologia#sciezki" className={linkClass}>Jak wybieramy ścieżki</Link>
        </p>
        <ol className="border-t">
          {recommendation.pathways.map((p, n) => {
            const story = narrative[p.key];
            const metrics = [...p.metrics, ...(story?.metrics ?? [])];
            return (
              <li key={p.key} className="space-y-4 border-b py-6">
                <h3 className={h.h3}>
                  {n + 1}. {p.label}
                  {Object.keys(PATHWAYS.kinds[p.key].variants).length > 1 && `: ${p.variantLabel.charAt(0).toLowerCase()}${p.variantLabel.slice(1)}`}
                </h3>
                <p>{story?.why ?? p.description}</p>
                {p.alsoVariants.length > 0 && (
                  <p className="text-muted-foreground">Warto rozważyć także: {p.alsoVariants.map((v) => v.label.toLowerCase()).join(", ")}.</p>
                )}

                <div className="space-y-1">
                  <h4 className={h.h4}>{p.fallback ? "Dlaczego ta ścieżka" : "Dlaczego: reguły, które zadziałały"}</h4>
                  <ul className="list-disc space-y-1 pl-6">{p.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                </div>

                {p.ease && (
                  <div className="space-y-1">
                    <h4 className={h.h4}>Łatwość wdrożenia: {p.ease.score} na 5 ({p.ease.label})</h4>
                    <ul className="list-disc space-y-1 pl-6 text-muted-foreground">{p.ease.factors.map((f) => <li key={f}>{f}</li>)}</ul>
                  </div>
                )}

                {story && story.nextSteps.length > 0 && (
                  <div className="space-y-1">
                    <h4 className={h.h4}>Kolejne kroki</h4>
                    <ol className="list-decimal space-y-1 pl-6">{story.nextSteps.map((s) => <li key={s}>{s}</li>)}</ol>
                  </div>
                )}

                {metrics.length > 0 && (
                  <div className="space-y-1">
                    <h4 className={h.h4}>Oczekiwane mierniki skuteczności</h4>
                    <ul className="list-disc space-y-1 pl-6">{metrics.map((m) => <li key={m}>{m}</li>)}</ul>
                  </div>
                )}

                <div className="space-y-1">
                  <h4 className={h.h4}>Kto pomaga</h4>
                  <ul className="list-disc space-y-1 pl-6">{p.helpers.map((x) => <li key={x}>{x}</li>)}</ul>
                </div>
              </li>
            );
          })}
        </ol>
        {Object.keys(narrative).length > 0 ? (
          <p className="text-muted-foreground">Uzasadnienie, kolejne kroki i część mierników napisało AI na podstawie karty i reguł. Ścieżki i powody to wynik reguł.</p>
        ) : recommendation.withRadar && audience !== "public" ? (
          <p className="text-muted-foreground">Uzasadnienie i kolejne kroki od AI jeszcze się nie przygotowały. Powody i mierniki powyżej pochodzą z reguł.</p>
        ) : null}
      </section>

      <PartnerList view={view} h={h} idPrefix={idPrefix} partnerAction={partnerAction} contactNote={contactNote} />

      <ChallengeList items={view.challenges} audience={audience} h={h} idPrefix={idPrefix} />
    </div>
  );
}

function PartnerList({
  view, h, idPrefix, partnerAction, contactNote,
}: {
  view: PathwaysView; h: (typeof HEADING)[keyof typeof HEADING]; idPrefix: string;
  partnerAction?: (m: PartnerMatch) => ReactNode; contactNote?: ReactNode;
}) {
  const id = `${idPrefix}-partnerzy`;
  if (view.partners.length === 0) {
    return (
      <section aria-labelledby={id} className="max-w-[68ch] space-y-3">
        <h2 id={id} className={h.h2}>Kto może pomóc</h2>
        <p>Nie znaleźliśmy jeszcze partnera, który pasuje do tych ścieżek. Zespół poszuka go w rozmowie.</p>
      </section>
    );
  }
  return (
    <section aria-labelledby={id} className="max-w-[68ch] space-y-4">
      <h2 id={id} className={h.h2}>Kto może pomóc: dopasowani partnerzy</h2>
      <p>Firmy, inwestorzy, centra transferu technologii, programy PCI i samorządy, które pasują do sektora, dojrzałości i ścieżek tej innowacji.</p>
      {contactNote}
      {PARTNER_GROUPS.map((g) => {
        const items = view.partners.filter((m) => (g.kinds as string[]).includes(m.partner.kind));
        if (items.length === 0) return null;
        return (
          <div key={g.label} className="space-y-2">
            <h3 className={h.h3}>{g.label}</h3>
            <ul className="border-t">
              {items.map((m) => (
                <li key={m.partner.id} className="space-y-2 border-b py-4">
                  <p className="font-bold">{m.partner.name}</p>
                  <p className="text-muted-foreground">
                    {partnerKindLabel(m.partner.kind)} · dopasowanie {m.score} na 100
                  </p>
                  <p>{m.partner.description}</p>
                  <p className="font-bold">Dlaczego pasuje</p>
                  <ul className="list-disc space-y-1 pl-6">{m.why.map((w) => <li key={w}>{w}</li>)}</ul>
                  {partnerAction?.(m)}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

function ChallengeList({
  items, audience, h, idPrefix,
}: { items: ChallengeMatch[]; audience: PathwaysAudience; h: (typeof HEADING)[keyof typeof HEADING]; idPrefix: string }) {
  if (items.length === 0) return null;
  const id = `${idPrefix}-wyzwania`;
  const total = items.reduce((s, c) => s + c.count, 0);
  if (audience === "public") {
    const byType = new Map<string, number>();
    for (const c of items) {
      const k = c.challenge.institutionType ?? "inna";
      byType.set(k, (byType.get(k) ?? 0) + c.count);
    }
    return (
      <section aria-labelledby={id} className="max-w-[68ch] space-y-3">
        <h2 id={id} className={h.h2}>Kto szuka podobnego rozwiązania</h2>
        <p>
          W „Szukam rozwiązania” podobny problem {plural(total, "opisała", "opisały", "opisało")} {total}{" "}
          {plural(total, "instytucja", "instytucje", "instytucji")} z regionu:
        </p>
        <ul className="list-disc space-y-1 pl-6">
          {[...byType].map(([k, n]) => <li key={k}>{institutionLabel(k)}: {n}</li>)}
        </ul>
        <p className="text-muted-foreground">Nie pokazujemy, które to instytucje. Zespół może je połączyć z twórcami.</p>
      </section>
    );
  }
  return (
    <section aria-labelledby={id} className="max-w-[68ch] space-y-3">
      <h2 id={id} className={h.h2}>Instytucje z podobnym problemem</h2>
      <p>
        {audience === "author"
          ? "Opisały go w „Szukam rozwiązania”. To kandydaci do wdrożenia Twojej innowacji — zespół może was połączyć."
          : "Wyzwania z „Szukam rozwiązania” (karty zanonimizowane). Kandydaci do wdrożenia u siebie."}
      </p>
      <ul className="border-t">
        {items.map((c) => (
          <li key={c.challenge.id} className="space-y-2 border-b py-4">
            <p>{c.challenge.summary}</p>
            <p className="text-muted-foreground">
              {c.challenge.institutionType ? institutionLabel(c.challenge.institutionType) : "Instytucja publiczna"}
              {c.counties.length > 0 && ` · powiat ${c.counties.join(", ")}`}
              {c.count > 1 && ` · ${c.count} ${plural(c.count, "instytucja", "instytucje", "instytucji")} z tym samym problemem`}
              {` · dopasowanie ${c.score} na 100`}
            </p>
            <ul className={cn("list-disc space-y-1 pl-6")}>{c.why.map((w) => <li key={w}>{w}</li>)}</ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
