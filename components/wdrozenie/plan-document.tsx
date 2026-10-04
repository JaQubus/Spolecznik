import { PrintNote } from "@/components/layout/print-note";
import { Alert } from "@/components/ui/alert";
import { formatFact, monthRange, STAGE_LABELS, zl } from "@/lib/implementation-plan";
import { BUDGET_LABELS, GRANT, INSTITUTION_LABELS, PLAN_STAGES, type PlanDocument as Doc } from "@/lib/schemas";

// Szkic planu wdrożenia (#99) w kolejności części III–VI „Wniosku o grant” z naboru „Usługa Wrażliwa”.
// Ten sam znacznik idzie na ekran, do druku (globals.css: [data-print-root], .doc) i do Panelu → Wdrożenia.

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
  const people = p.peopleSupported.women + p.peopleSupported.men;
  return (
    <article data-print-root className="doc max-w-[80ch] space-y-8">
      <div className="space-y-2">
        <PrintNote dated>Szkic planu wdrożenia · Społecznik</PrintNote>
        <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none">
          {doc.innovation.title} w gminie {doc.gmina.nazwa}
        </h2>
        <p className="doc-text">
          Szkic pod nabór „Usługa Wrażliwa” Regionalnego Ośrodka Polityki Społecznej w Krakowie: grant do {zl(GRANT.maxPln)} na
          wdrożenie usługi społecznej opartej na innowacji, najwyżej {GRANT.maxMonths} miesięcy.
        </p>
        <table className="doc-kv">
          <tbody>
            <tr><th scope="row">Wnioskodawca</th><td>{INSTITUTION_LABELS[doc.input.institutionType]}</td></tr>
            <tr><th scope="row">Obszar wdrażania</th><td>{doc.gmina.label}</td></tr>
            <tr><th scope="row">Budżet orientacyjny</th><td>{BUDGET_LABELS[doc.input.budget]}</td></tr>
            {doc.input.audienceSize && <tr><th scope="row">Liczba odbiorców podana w formularzu</th><td>{doc.input.audienceSize.toLocaleString("pl-PL")}</td></tr>}
            {doc.input.staff && <tr><th scope="row">Dostępna kadra</th><td>{doc.input.staff}</td></tr>}
          </tbody>
        </table>
        <p className="doc-text text-muted-foreground">
          Liczby o gminie mają podane źródło (Bank Danych Lokalnych GUS). Liczby oznaczone „szacunek” przygotowała sztuczna
          inteligencja na podstawie opisu innowacji — sprawdź je przed złożeniem wniosku.
        </p>
      </div>

      {p.warnings.length > 0 && (
        <Alert title="Do poprawy przed złożeniem wniosku" className="print:border-2 print:border-black">
          <ul className="list-disc space-y-1 pl-6">{p.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Alert>
      )}

      <Section id="plan-cel" title="Cel usługi"><Text>{p.goal}</Text></Section>
      <Section id="plan-opis" title="Na czym polega usługa"><Text>{p.description}</Text></Section>
      <Section id="plan-forma" title="Forma usługi"><Text>{p.serviceForm}</Text></Section>

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

      <Section id="plan-osoby" title="Liczba osób objętych wsparciem" estimate>
        <table className="doc-kv max-w-md">
          <tbody>
            <tr><th scope="row">Kobiety</th><td className="doc-num">{p.peopleSupported.women.toLocaleString("pl-PL")}</td></tr>
            <tr><th scope="row">Mężczyźni</th><td className="doc-num">{p.peopleSupported.men.toLocaleString("pl-PL")}</td></tr>
            <tr><th scope="row"><strong>Ogółem</strong></th><td className="doc-num"><strong>{people.toLocaleString("pl-PL")}</strong></td></tr>
          </tbody>
        </table>
        <Text>{p.peopleSupported.basis}</Text>
      </Section>

      <Section id="plan-rekrutacja" title="Rekrutacja odbiorców"><Text>{p.recruitment}</Text></Section>

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
        <p className="doc-text"><strong>Suma kosztów działań: {zl(p.totalPln)}</strong> (limit grantu: {zl(GRANT.maxPln)})</p>
      </Section>

      <Section id="plan-kadra" title="Kadra i zasoby"><Text>{p.staffAndResources}</Text></Section>

      <Section id="plan-koszty" title="Widełki kosztów całego wdrożenia" estimate>
        <p className="doc-text">Od <strong>{zl(p.costEstimate.minPln)}</strong> do <strong>{zl(p.costEstimate.maxPln)}</strong>. {p.costEstimate.basis}</p>
      </Section>

      {p.partners.length > 0 ? (
        <Section id="plan-partnerzy" title="Kto może pomóc">
          <p className="doc-text text-muted-foreground">Eksperci i organizacje z bazy Społecznika.</p>
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

      <Section id="plan-horyzontalne" title="Zgodność z zasadami horyzontalnymi"><Text>{p.horizontalPrinciples}</Text></Section>
      <Section id="plan-trwalosc" title="Utrzymanie efektów po zakończeniu grantu"><Text>{p.sustainability}</Text></Section>
      <Section id="plan-dei" title="Deinstytucjonalizacja"><Text>{p.deinstitutionalization}</Text></Section>

      {p.assumptions.length > 0 && (
        <Alert title="Założenia, których nie sprawdziliśmy" className="print:border-2 print:border-black">
          <p>Tego nie było w opisie innowacji ani w danych o gminie. Sprawdź przed złożeniem wniosku.</p>
          <ul className="list-disc space-y-1 pl-6">{p.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
        </Alert>
      )}

      <PrintNote>
        Wygenerowano w Społeczniku z opisu innowacji z Biblioteki i danych BDL GUS o gminie. Liczby oznaczone „szacunek”
        i założenia trzeba sprawdzić przed złożeniem wniosku.
      </PrintNote>
    </article>
  );
}
