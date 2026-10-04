import type { CallFormContent } from "@/lib/call-schema";
import {
  type Application, type Contact, type Entity, type Person, type PlanRow,
  declarationSets, filledRows, formatPLN, formatPostalCode, parseAmount, planTotal,
} from "./model";

// Wypełniony formularz w układzie wzoru (numeracja punktów 1–12). Ten sam znacznik idzie do druku/PDF
// i do pliku Word, dlatego style są proste i zapisane klasami, które mają też odpowiednik w WORD_CSS.

const Row = ({ label, value }: { label: string; value: string }) => (
  <tr>
    <th scope="row">{label}</th>
    <td>{value.trim() || "—"}</td>
  </tr>
);

function PersonTable({ p }: { p: Person }) {
  return (
    <table className="doc-kv">
      <tbody>
        <Row label="Imię" value={p.imie} />
        <Row label="Nazwisko" value={p.nazwisko} />
        <Row label="Adres korespondencyjny" value={p.adres} />
        <Row label="Kod pocztowy" value={formatPostalCode(p.kod)} />
        <Row label="Miejscowość" value={p.miejscowosc} />
        <Row label="Telefon" value={p.telefon} />
        <Row label="E-mail" value={p.email} />
      </tbody>
    </table>
  );
}

const contactRows = (c: Contact) => (
  <>
    <Row label="Funkcja" value={c.funkcja} />
    <Row label="Imię i nazwisko" value={c.imieNazwisko} />
    <Row label="Telefon" value={c.telefon} />
    <Row label="E-mail" value={c.email} />
  </>
);

function EntityTable({ e }: { e: Entity }) {
  const kontakt = e.kontaktTenSam ? e.reprezentant : e.kontakt;
  return (
    <>
      <table className="doc-kv">
        <tbody>
          <Row label="Nazwa podmiotu" value={e.nazwa} />
          <Row label="KRS" value={e.krs} />
          <Row label="REGON" value={e.regon} />
          <Row label="NIP" value={e.nip} />
          <Row label="Adres siedziby" value={e.adres} />
          <Row label="Kod pocztowy" value={formatPostalCode(e.kod)} />
          <Row label="Miejscowość" value={e.miejscowosc} />
          <Row label="Telefon" value={e.telefon} />
          <Row label="E-mail" value={e.email} />
        </tbody>
      </table>
      <p className="doc-sub">Osoba upoważniona do reprezentowania podmiotu</p>
      <table className="doc-kv"><tbody>{contactRows(e.reprezentant)}</tbody></table>
      <p className="doc-sub">Osoba wskazana do kontaktów roboczych</p>
      <table className="doc-kv"><tbody>{contactRows(kontakt)}</tbody></table>
    </>
  );
}

function PlanTable({ caption, groups }: { caption: string; groups: { label?: string; rows: PlanRow[] }[] }) {
  return (
    <table className="doc-plan">
      <caption>{caption}</caption>
      <thead>
        <tr><th scope="col">Działanie</th><th scope="col">Termin realizacji</th><th scope="col">Koszt działania</th></tr>
      </thead>
      <tbody>
        {groups.map((g) => {
          const rows = filledRows(g.rows);
          return [
            g.label && <tr key={`${g.label}-h`}><th scope="rowgroup" colSpan={3}>{g.label}</th></tr>,
            ...(rows.length
              ? rows.map((r, i) => {
                  const cost = parseAmount(r.koszt);
                  return (
                    <tr key={`${g.label ?? ""}${i}`}>
                      <td>{r.dzialanie}</td>
                      <td>{r.termin}</td>
                      <td className="doc-num">{cost === null ? r.koszt : formatPLN(cost)}</td>
                    </tr>
                  );
                })
              : [<tr key={`${g.label ?? ""}-empty`}><td colSpan={3}>—</td></tr>]),
          ];
        })}
      </tbody>
    </table>
  );
}

function Paragraphs({ text }: { text: string }) {
  const parts = text.trim().split(/\n\s*\n/);
  if (!text.trim()) return <p>—</p>;
  // Pojedyncze entery jako <br>: w podglądzie i druku robi to pre-line, ale Word ignoruje white-space.
  return <>{parts.map((p, i) => (
    <p key={i} className="doc-text">
      {p.split("\n").flatMap((line, j) => (j ? [<br key={j} />, line] : [line]))}
    </p>
  ))}</>;
}

/** Kto podpisuje: osoba, reprezentant podmiotu albo każdy partner grupy. */
function signers(app: Application): string[] {
  const name = (p: Person) => `${p.imie} ${p.nazwisko}`.trim();
  if (app.typ === "osoba") return [name(app.osoba)];
  if (app.typ === "podmiot") return [`${app.podmiot.reprezentant.imieNazwisko}, ${app.podmiot.nazwa}`];
  return app.partnerzy.map((p) => (p.rodzaj === "osoba" ? name(p.osoba) : `${p.podmiot.reprezentant.imieNazwisko}, ${p.podmiot.nazwa}`));
}

export function ApplicationDocument({ app, content }: { app: Application; content: CallFormContent }) {
  const { plan, team, declarations } = content;
  const total = planTotal(app);
  const amount = parseAmount(app.kwota);
  return (
    <article className="doc" aria-label="Wypełniony formularz aplikacyjny">
      <p className="doc-right">{content.attachment}</p>
      <h2 className="doc-title">Formularz aplikacyjny</h2>
      <p className="doc-text">{content.intro}</p>

      <ol className="doc-sections">
        <li>
          <h3>Tytuł innowacji</h3>
          <p className="doc-text"><strong>{app.tytul || "—"}</strong></p>
        </li>

        <li>
          <h3>Dane pomysłodawcy</h3>
          {app.typ === "osoba" && (<><p className="doc-sub">Osoba fizyczna</p><PersonTable p={app.osoba} /></>)}
          {app.typ === "podmiot" && (<><p className="doc-sub">Podmiot</p><EntityTable e={app.podmiot} /></>)}
          {app.typ === "grupa" && (
            <>
              <p className="doc-sub">Grupa nieformalna</p>
              {app.partnerzy.map((p, i) => (
                <div key={i}>
                  <p className="doc-sub">Partner {i + 1} ({p.rodzaj === "osoba" ? "osoba fizyczna" : "podmiot"})</p>
                  {p.rodzaj === "osoba" ? <PersonTable p={p.osoba} /> : <EntityTable e={p.podmiot} />}
                </div>
              ))}
              <p className="doc-sub">Reprezentant/ka grupy nieformalnej wskazany/a do kontaktów roboczych</p>
              <table className="doc-kv">
                <tbody>
                  <Row label="Imię i nazwisko" value={app.reprezentantGrupy.imieNazwisko} />
                  <Row label="Telefon" value={app.reprezentantGrupy.telefon} />
                  <Row label="E-mail" value={app.reprezentantGrupy.email} />
                </tbody>
              </table>
            </>
          )}
        </li>

        {/* Numer z treści naboru (n), nie z pozycji: tak samo jak w etykietach formularza. */}
        {content.sections.map((s) => (
          <li key={s.key} value={s.n}>
            <h3>{s.title}</h3>
            <Paragraphs text={app.opisy[s.key] ?? ""} />
          </li>
        ))}

        <li>
          <h3>Plan działania i koszty</h3>
          <p className="doc-text">{plan.intro}</p>
          <PlanTable caption={`${plan.preparation.title} (${plan.preparation.limit})`} groups={[{ rows: app.przygotowanie }]} />
          <PlanTable
            caption={`${plan.testing.title} (${plan.testing.limit})`}
            groups={[{ label: "Faza I testu", rows: app.faza1 }, { label: "Faza II testu", rows: app.faza2 }]}
          />
          <p className="doc-text">Suma kosztów z planu działania: <strong>{formatPLN(total)}</strong></p>
        </li>

        <li>
          <h3>{plan.amount.title}</h3>
          <p className="doc-text"><strong>{amount === null ? app.kwota || "—" : formatPLN(amount)}</strong></p>
        </li>

        <li value={team.n}>
          <h3>{team.title}</h3>
          <Paragraphs text={app.zespol} />
        </li>

        <li>
          <h3>Oświadczenia</h3>
          {declarationSets(app).map((set) => (
            <div key={set}>
              <p className="doc-sub">{declarations[set].title}</p>
              <p className="doc-text">{declarations[set].lead}</p>
              <ul className="doc-checks">
                {declarations[set].items.map((item, i) => (
                  <li key={i}>
                    <span aria-hidden>{app.oswiadczenia[set][i] ? "☒" : "☐"}</span>{" "}
                    <span className="sr-only">{app.oswiadczenia[set][i] ? "Zaznaczone: " : "Niezaznaczone: "}</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </li>
      </ol>

      <div className="doc-signatures">
        {signers(app).map((s, i) => (
          <div key={i} className="doc-signature">
            <p>……………………………………</p>
            <p className="doc-small">miejscowość i data</p>
            <p>……………………………………</p>
            <p className="doc-small">czytelny podpis: {s}</p>
          </div>
        ))}
      </div>

      {content.rodo.map((c) => (
        <section key={c.title} className="doc-clause">
          <h3>{c.title}</h3>
          {c.paragraphs.map((p, i) => <p key={i} className="doc-small">{p}</p>)}
        </section>
      ))}
    </article>
  );
}

/** Style dokumentu w pliku Word (.doc z HTML) — Word nie zna klas Tailwinda, więc dublujemy je tutaj. */
export const WORD_CSS = `
body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.4; }
.doc-right { text-align: right; }
.doc-title { text-align: center; font-size: 16pt; text-transform: uppercase; }
.doc-sections > li { margin-top: 14pt; }
h3 { font-size: 12pt; margin: 0 0 6pt; }
.doc-sub { font-weight: bold; margin: 8pt 0 4pt; }
table { border-collapse: collapse; width: 100%; margin: 4pt 0 8pt; }
th, td { border: 1px solid #000; padding: 4pt 6pt; text-align: left; vertical-align: top; }
.doc-kv th { width: 40%; font-weight: normal; }
caption { text-align: left; font-weight: bold; padding: 4pt 0; }
.doc-num { text-align: right; white-space: nowrap; }
.doc-checks { list-style: none; padding-left: 0; }
.doc-signature { margin-top: 24pt; }
.doc-small { font-size: 9pt; }
.sr-only { display: none; }
`;
