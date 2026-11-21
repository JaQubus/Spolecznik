import Link from "next/link";
import { PrintNote } from "@/components/layout/print-note";
import { Alert } from "@/components/ui/alert";
import { formatFact, monthRange, STAGE_LABELS, zl } from "@/lib/transfer-plan";
import { BUDGET_LABELS, PLAN_STAGES, TRANSFER, type PlanDocument as Doc } from "@/lib/schemas";
import { institutionLabel } from "@/lib/taxonomy";
import { brand } from "@/lib/brand";

// Szkic planu przeniesienia inicjatywy albo rozwiązania do wskazanej gminy i instytucji.
// Ten sam znacznik idzie na ekran, do druku (globals.css: [data-print-root], .doc) i do Panelu → Przeniesienia.

/** Etykieta przy liczbach, które przygotował model, a nie BDL. */
function Estimate() {
  return (
    <span className="ml-2 inline-block rounded-full border-2 border-foreground px-2 align-middle text-sm font-bold tracking-wide uppercase">
      szacunek
    </span>
  );
}

function Section({ id, title, estimate, children }: { id: string; title: string; estimate?: boolean; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id}>{title}{estimate && <Estimate />}</h3>
      {children}
    </section>
  );
}

/** Tabela przewija się w poziomie na wąskim ekranie; na wydruku mieści się w szerokości A4. */
function TableRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto">{children}</div>;
}

const Text = ({ children }: { children: string }) => <p className="doc-text">{children}</p>;

export function PlanDocument({ doc, headingRef }: { doc: Doc; headingRef?: React.Ref<HTMLHeadingElement> }) {
  const p = doc.plan;
  const sourceKind = doc.source.kind === "initiative" ? "inicjatywa z regionu" : "sprawdzone rozwiązanie z Polski";
  return (
    <article data-print-root className="doc max-w-[80ch] space-y-8">
      <div className="space-y-2">
        <PrintNote dated>Szkic planu przeniesienia · {brand.name}</PrintNote>
        <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
          {doc.source.title} w gminie {doc.gmina.nazwa}
        </h2>
        <p className="doc-text">
          Pilotaż do {TRANSFER.maxMonths} miesięcy, w tym przygotowanie do {TRANSFER.maxPreparationMonths}. Źródło:{" "}
          <Link href={doc.source.href} className="underline decoration-1 underline-offset-4 hover:decoration-2">{doc.source.title}</Link> ({sourceKind}).
        </p>
        <table className="doc-kv">
          <tbody>
            <tr><th scope="row">Instytucja</th><td>{institutionLabel(doc.input.institutionType)}</td></tr>
            <tr><th scope="row">Gmina</th><td>{doc.gmina.label}</td></tr>
            <tr><th scope="row">Budżet orientacyjny</th><td>{BUDGET_LABELS[doc.input.budget]}</td></tr>
            {doc.input.audienceSize && <tr><th scope="row">Liczba odbiorców podana w formularzu</th><td>{doc.input.audienceSize.toLocaleString("pl-PL")}</td></tr>}
            {doc.input.staff && <tr><th scope="row">Dostępne osoby</th><td>{doc.input.staff}</td></tr>}
          </tbody>
        </table>
        <p className="doc-text text-muted-foreground">
          Liczby o gminie mają podane źródło (Bank Danych Lokalnych GUS). Liczby oznaczone „szacunek” przygotowała sztuczna
          inteligencja na podstawie opisu — sprawdź je, zanim zaczniesz.
        </p>
      </div>

      {p.warnings.length > 0 && (
        <Alert title="Do poprawy" className="print:border-2 print:border-black">
          <ul className="list-disc space-y-1 pl-6">{p.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Alert>
      )}

      <Section id="plan-cel" title="Cel"><Text>{p.goal}</Text></Section>
      <Section id="plan-opis" title="Jak to zadziała u nas"><Text>{p.description}</Text></Section>
      <Section id="plan-zmiany" title="Co zmieniamy względem oryginału"><Text>{p.adaptation}</Text></Section>

      <Section id="plan-odbiorcy" title="Odbiorcy w gminie">
        <Text>{p.audience.summary}</Text>
        {p.audience.facts.length > 0 && (
          <TableRegion label="Dane o gminie">
            <table>
              <caption>Dane o gminie {doc.gmina.nazwa}</caption>
              <thead>
                <tr><th scope="col">Wskaźnik</th><th scope="col">Wartość</th><th scope="col">Dlaczego to ważne</th><th scope="col">Źródło</th></tr>
              </thead>
              <tbody>
                {p.audience.facts.map((f) => (
                  <tr key={f.id}>
                    <th scope="row">{f.label}</th>
                    <td className="doc-num">{formatFact(f)}</td>
                    <td>{f.why}</td>
                    <td className="doc-small">{f.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableRegion>
        )}
      </Section>

      <Section id="plan-osoby" title="Ilu odbiorców obejmie pilotaż" estimate>
        <p className="doc-text"><strong>{p.peopleReached.count.toLocaleString("pl-PL")}</strong>. {p.peopleReached.basis}</p>
      </Section>

      <Section id="plan-harmonogram" title="Harmonogram i koszty działań" estimate>
        {PLAN_STAGES.map((stage) => {
          const steps = p.steps.filter((s) => s.stage === stage);
          if (steps.length === 0) return null;
          return (
            <TableRegion key={stage} label={STAGE_LABELS[stage]}>
              <table>
                <caption>{STAGE_LABELS[stage]}</caption>
                <thead>
                  <tr><th scope="col">Działanie</th><th scope="col">Kiedy</th><th scope="col">Koszt</th><th scope="col">Jak policzono</th></tr>
                </thead>
                <tbody>
                  {steps.map((s) => (
                    <tr key={`${s.title}-${s.monthFrom}`}>
                      <th scope="row"><strong>{s.title}</strong><br /><span className="font-normal">{s.details}</span></th>
                      <td className="whitespace-nowrap">{monthRange(s)}</td>
                      <td className="doc-num">{zl(s.costPln)}</td>
                      <td>{s.costBasis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableRegion>
          );
        })}
        <p className="doc-text"><strong>Suma kosztów działań: {zl(p.totalPln)}</strong></p>
      </Section>

      <Section id="plan-zasoby" title="Ludzie i zasoby"><Text>{p.staffAndResources}</Text></Section>

      <Section id="plan-koszty" title="Widełki kosztów całego pilotażu" estimate>
        <p className="doc-text">Od <strong>{zl(p.costEstimate.minPln)}</strong> do <strong>{zl(p.costEstimate.maxPln)}</strong>. {p.costEstimate.basis}</p>
      </Section>

      {p.partners.length > 0 ? (
        <Section id="plan-partnerzy" title="Kto może pomóc">
          <p className="doc-text text-muted-foreground">Autor inicjatywy i mentorzy z bazy {brand.nameGenitive}.</p>
          <ul className="list-disc space-y-1 pl-6">
            {p.partners.map((x) => <li key={x.id}><strong>{x.name}</strong>: {x.role}</li>)}
          </ul>
        </Section>
      ) : p.partnerTypes.length > 0 && (
        <Section id="plan-partnerzy" title="Jakich partnerów szukać">
          <ul className="list-disc space-y-1 pl-6">{p.partnerTypes.map((t) => <li key={t}>{t}</li>)}</ul>
        </Section>
      )}

      {p.risks.length > 0 && (
        <Section id="plan-ryzyka" title="Ryzyka i jak je ograniczyć">
          <TableRegion label="Ryzyka">
            <table>
              <thead><tr><th scope="col">Ryzyko</th><th scope="col">Jak je ograniczyć</th></tr></thead>
              <tbody>{p.risks.map((r) => <tr key={r.risk}><th scope="row" className="font-normal">{r.risk}</th><td>{r.mitigation}</td></tr>)}</tbody>
            </table>
          </TableRegion>
        </Section>
      )}

      {p.successIndicators.length > 0 && (
        <Section id="plan-wskazniki" title="Po czym poznać, że działa">
          <ul className="list-disc space-y-1 pl-6">{p.successIndicators.map((i) => <li key={i}>{i}</li>)}</ul>
        </Section>
      )}

      <Section id="plan-trwalosc" title="Co zostanie po pilotażu"><Text>{p.sustainability}</Text></Section>

      {p.assumptions.length > 0 && (
        <Alert title="Założenia, których nie sprawdziliśmy" className="print:border-2 print:border-black">
          <p>Tego nie było w opisie ani w danych o gminie. Sprawdź, zanim zaczniesz.</p>
          <ul className="list-disc space-y-1 pl-6">{p.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        </Alert>
      )}

      <PrintNote>
        Wygenerowano w {brand.nameLocative} z opisu {doc.source.kind === "initiative" ? "inicjatywy" : "rozwiązania"} i danych BDL GUS o gminie.
        Liczby oznaczone „szacunek” i założenia trzeba sprawdzić.
      </PrintNote>
    </article>
  );
}
