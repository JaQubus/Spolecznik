import { formatPLN, parseAmount } from "@/lib/form-fields";
import type { UwContent } from "@/lib/uw-content";
import { filledRows, indicatorTotals, monthLabel, planTotal, type GrantApplication, type Row } from "@/lib/uw-application";

// Wniosek o grant „Usługa Wrażliwa” w układzie wzoru ROPS (części I–VI i oświadczenia). Ten sam znacznik idzie
// do druku/PDF i do pliku Word (WORD_CSS z /wniosek), dlatego tylko proste klasy .doc z globals.css.

const or = (s: string) => s.trim() || "—";

function Checks({ items, checked }: { items: string[]; checked: (i: number) => boolean }) {
  return (
    <ul className="doc-checks">
      {items.map((item, i) => (
        <li key={item}>
          <span aria-hidden>{checked(i) ? "☒" : "☐"}</span> <span className="sr-only">{checked(i) ? "Zaznaczone: " : "Niezaznaczone: "}</span>{item}
        </li>
      ))}
    </ul>
  );
}

function Kv({ rows }: { rows: [string, string][] }) {
  return (
    <table className="doc-kv">
      <tbody>{rows.map(([k, v], i) => <tr key={i}><th scope="row">{k}</th><td>{or(v)}</td></tr>)}</tbody>
    </table>
  );
}

function RowsTable({ caption, rows }: { caption: string; rows: Row[] }) {
  const filled = filledRows(rows);
  return (
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr><th scope="col">Działanie</th><th scope="col">Termin realizacji</th><th scope="col">Łączny koszt działania</th><th scope="col">Uzasadnienie wysokości kosztu i sposób kalkulacji</th></tr>
      </thead>
      <tbody>
        {filled.length === 0 && <tr><td colSpan={4}>—</td></tr>}
        {filled.map((r, i) => {
          const amount = parseAmount(r.koszt);
          return (
            <tr key={i}>
              <th scope="row" className="font-normal">Działanie {i + 1}: {or(r.dzialanie)}</th>
              <td>{or(r.termin)}</td>
              <td className="doc-num">{amount === null ? or(r.koszt) : formatPLN(amount)}</td>
              <td>{or(r.uzasadnienie)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const Text = ({ children }: { children: string }) => <p className="doc-text">{or(children)}</p>;

export function GrantDocument({ app, content }: { app: GrantApplication; content: UwContent }) {
  const s = content.sections;
  const w = app.wnioskodawca;
  const contact = w.kontaktTenSam ? w.reprezentant : w.kontakt;
  const totals = indicatorTotals(app);
  const total = planTotal(app);
  const amount = parseAmount(app.kwota);
  const de = content.declarations.deMinimis;
  return (
    <article className="doc">
      <p className="doc-right doc-small">Załącznik nr 2 do Ogłoszenia naboru (zarządzenie {content.call.order})</p>
      <h2 className="doc-title">Wniosek o grant</h2>
      <p className="doc-text">{content.intro}</p>

      {/* Numery jawnie, jak we wzorze ROPS (z dwoma punktami „II.”): na nie powołuje się formularz elektroniczny. */}
      <ol className="doc-sections" style={{ listStyle: "none", paddingLeft: 0 }}>
        <li>
          <h3>I. Nazwa wybranej do wdrożenia innowacji społecznej</h3>
          <Checks items={content.innovations.map((i) => i.title)} checked={(i) => content.innovations[i].title === app.innowacja} />
        </li>

        <li>
          <h3>II. Dane wnioskodawcy</h3>
          <p className="doc-sub">a. Status Wnioskodawcy</p>
          <Checks items={content.statuses} checked={(i) => content.statuses[i] === app.status} />
          <p className="doc-sub">b. Dane teleadresowe Wnioskodawcy</p>
          <Kv rows={[
            ["Nazwa podmiotu", w.nazwa],
            ["Adres siedziby podmiotu", w.adresSiedziby],
            ["Adres filii, delegatury, oddziału lub miejsca prowadzenia innej formy działalności na terenie województwa małopolskiego", w.adresFilii],
            ["Adres do korespondencji", w.korespondencjaTaSama ? w.adresSiedziby : w.adresKorespondencji],
            ["Telefon", w.telefon],
            ["E-mail", w.email],
            ["NIP (jeśli dotyczy)", w.nip],
            ["KRS/CEIDG (jeśli dotyczy)", w.krs],
            ["Imię i nazwisko osoby upoważnionej do reprezentowania podmiotu", w.reprezentant.imieNazwisko],
            ["Funkcja", w.reprezentant.funkcja],
            ["Telefon", w.reprezentant.telefon],
            ["E-mail", w.reprezentant.email],
            ["Imię i nazwisko osoby do kontaktów roboczych", contact.imieNazwisko],
            ["Funkcja", contact.funkcja],
            ["Telefon", contact.telefon],
            ["E-mail", contact.email],
            ["Strona internetowa podmiotu (jeśli posiada)", w.www],
            ["Media społecznościowe podmiotu (jeśli posiada)", w.social],
          ]} />
          <p className="doc-sub">c. Dane teleadresowe Realizatora (jeśli dotyczy)</p>
          {app.maRealizatora ? (
            <Kv rows={[
              ["Nazwa podmiotu", app.realizator.nazwa],
              ["Adres podmiotu", app.realizator.adres],
              ["Adres do korespondencji", app.realizator.adresKorespondencji],
              ["Telefon", app.realizator.telefon],
              ["E-mail", app.realizator.email],
              ["NIP (jeśli dotyczy)", app.realizator.nip],
              ["KRS/CEIDG (jeśli dotyczy)", app.realizator.krs],
            ]} />
          ) : <p className="doc-text">Nie dotyczy.</p>}
        </li>

        <li>
          <h3>II. Doświadczenie wnioskodawcy</h3>
          <p className="doc-sub">1. {content.experience.lead}</p>
          <Checks items={content.experience.areas} checked={(i) => app.doswiadczenie.obszary[i]} />
          <p className="doc-sub">2. Opis posiadanego doświadczenia w odniesieniu do wybranego powyżej obszaru:</p>
          <Text>{app.doswiadczenie.opis}</Text>
        </li>

        <li>
          <h3>III. Innowacyjna usługa społeczna</h3>
          <p className="doc-sub">1. {s.tytul.title}</p>
          <Text>{app.tytul}</Text>
          <p className="doc-sub">2. {s.opis.title}</p>
          <Text>{app.opis}</Text>
          <p className="doc-sub">3. {s.daty.title}</p>
          <table className="doc-kv">
            <tbody>
              <tr><th scope="row">Etap 1. Przygotowanie do wdrożenia usługi</th><td>od {monthLabel(app.etap1.od)} do {monthLabel(app.etap1.do)}</td></tr>
              <tr><th scope="row">Etap 2. Wdrażanie innowacyjnej usługi społecznej</th><td>od {monthLabel(app.etap2.od)} do {monthLabel(app.etap2.do)}</td></tr>
            </tbody>
          </table>
          <p className="doc-sub">4. {s.grupy.title}</p>
          <Checks items={content.targetGroups} checked={(i) => app.grupy[i]} />
          <p className="doc-sub">5. {s.diagnoza.title}</p>
          <Text>{app.diagnoza}</Text>
          <p className="doc-sub">6. {s.rekrutacja.title}</p>
          <Text>{app.rekrutacja}</Text>
          <p className="doc-sub">7. {s.liczba.title}</p>
          <Text>{app.liczba}</Text>
          <p className="doc-sub">8. {s.obszar.title}</p>
          <Text>{app.obszar}</Text>
          <p className="doc-sub">9. {s.efekty.title}</p>
          <Text>{app.efekty}</Text>
          <p className="doc-sub">10. {s.plan.title}</p>
          <RowsTable caption="Etap przygotowania do wdrożenia innowacyjnej usługi społecznej" rows={app.przygotowanie} />
          <RowsTable caption="Etap wdrażania innowacyjnej usługi społecznej" rows={app.wdrazanie} />
          <table>
            <caption>{s.wskaznik.title}</caption>
            <thead>
              <tr>
                <th scope="col">Płeć</th>
                {app.wskaznik.lata.map((l) => <th key={l.rok} scope="col">Wartość w {l.rok} r.</th>)}
                <th scope="col">Wartość ogółem</th>
              </tr>
            </thead>
            <tbody>
              <tr><th scope="row">Kobiety</th>{app.wskaznik.lata.map((l) => <td key={l.rok} className="doc-num">{or(l.k)}</td>)}<td className="doc-num">{totals.k}</td></tr>
              <tr><th scope="row">Mężczyźni</th>{app.wskaznik.lata.map((l) => <td key={l.rok} className="doc-num">{or(l.m)}</td>)}<td className="doc-num">{totals.m}</td></tr>
              <tr><th scope="row">Ogółem</th>{app.wskaznik.lata.map((l) => <td key={l.rok} className="doc-num">{(Number(l.k) || 0) + (Number(l.m) || 0)}</td>)}<td className="doc-num">{totals.total}</td></tr>
            </tbody>
          </table>
          <p className="doc-text">Sposób pomiaru: {or(app.wskaznik.pomiar)}</p>
          <p className="doc-sub">11. {s.kwota.title}</p>
          <p className="doc-text">{amount === null ? or(app.kwota) : formatPLN(amount)} (suma kosztów z planu działania: {formatPLN(total)})</p>
          <p className="doc-sub">12. {s.cross.title}</p>
          <p className="doc-text">{app.cross === "tak" ? `Tak: ${or(app.crossLista)}` : "Nie."}</p>
          <p className="doc-sub">13. {s.trwaloscCross.title}</p>
          <Text>{app.cross === "tak" ? app.trwaloscCross : "Nie dotyczy."}</Text>
        </li>

        <li>
          <h3>{s.horyzontalne.n}. {s.horyzontalne.title}</h3>
          <Text>{app.horyzontalne}</Text>
        </li>
        <li>
          <h3>{s.utrzymanie.n}. {s.utrzymanie.title}</h3>
          <Text>{app.utrzymanie}</Text>
        </li>
        <li>
          <h3>{s.deinstytucjonalizacja.n}. {s.deinstytucjonalizacja.title}</h3>
          <Text>{app.deinstytucjonalizacja}</Text>
        </li>
      </ol>

      <section className="doc-clause">
        <h3>{content.declarations.title}</h3>
        <p className="doc-text">{content.declarations.lead}</p>
        {/* Styl w linii, nie klasy Tailwinda: numeracja ma przetrwać eksport do Worda (WORD_CSS nie zna list-decimal). */}
        <ol style={{ listStyleType: "decimal", paddingLeft: "1.5rem" }}>
          {content.declarations.items.map((item, i) => (
            <li key={i}><span className="sr-only">{app.oswiadczenia[i] ? "Potwierdzone: " : "Niepotwierdzone: "}</span>{item}</li>
          ))}
          <li>
            {de.lead}
            <ol type="a" style={{ listStyleType: "lower-alpha", paddingLeft: "1.5rem" }}>
              {de.options.map((option, i) => {
                const chosen = app.deMinimis === (i === 0 ? "a" : "b");
                // Wzór: „należy wykreślić niewłaściwą opcję”. Przy „nie dotyczy” obie zostają przekreślone.
                return <li key={option}>{chosen ? option : <s>{option}</s>}</li>;
              })}
            </ol>
            {app.deMinimis === "nie_dotyczy" && <p className="doc-small">Nie dotyczy: podmiot nie prowadzi działalności gospodarczej.</p>}
          </li>
        </ol>
        <div className="doc-signatures">
          <div className="doc-signature"><p>……………………………………</p><p className="doc-small">miejscowość i data</p></div>
          <div className="doc-signature"><p>……………………………………</p><p className="doc-small">podpis osoby upoważnionej do reprezentowania podmiotu</p></div>
        </div>
      </section>
    </article>
  );
}

/**
 * Wniosek jako tekst do schowka, w kolejności formularza elektronicznego ROPS: z niego wkleja się
 * treść pole po polu (instrukcja ROPS zaleca przygotować wniosek wcześniej i przenieść go do formularza).
 */
export function applicationToText(app: GrantApplication, content: UwContent): string {
  const s = content.sections;
  const w = app.wnioskodawca;
  const contact = w.kontaktTenSam ? w.reprezentant : w.kontakt;
  const rows = (rs: Row[]) => filledRows(rs).map((r, i) => `Działanie ${i + 1}: ${r.dzialanie}\n  Termin: ${r.termin}\n  Koszt: ${r.koszt} zł\n  Uzasadnienie: ${r.uzasadnienie}`);
  const totals = indicatorTotals(app);
  const lines: (string | false)[] = [
    "WNIOSEK O GRANT – „Usługa Wrażliwa”",
    "",
    `I. INNOWACJA: ${or(app.innowacja)}`,
    "",
    `II. STATUS WNIOSKODAWCY: ${or(app.status)}`,
    `Nazwa: ${or(w.nazwa)}`, `Adres siedziby: ${or(w.adresSiedziby)}`, !!w.adresFilii.trim() && `Adres filii: ${w.adresFilii}`,
    `Adres do korespondencji: ${or(w.korespondencjaTaSama ? w.adresSiedziby : w.adresKorespondencji)}`,
    `Telefon: ${or(w.telefon)}`, `E-mail: ${or(w.email)}`, `NIP: ${or(w.nip)}`, `KRS/CEIDG: ${or(w.krs)}`,
    `Osoba upoważniona: ${or(w.reprezentant.imieNazwisko)}, ${or(w.reprezentant.funkcja)}, ${or(w.reprezentant.telefon)}, ${or(w.reprezentant.email)}`,
    `Osoba do kontaktów roboczych: ${or(contact.imieNazwisko)}, ${or(contact.funkcja)}, ${or(contact.telefon)}, ${or(contact.email)}`,
    !!w.www.trim() && `Strona internetowa: ${w.www}`, !!w.social.trim() && `Media społecznościowe: ${w.social}`,
    app.maRealizatora && `Realizator: ${app.realizator.nazwa}, ${app.realizator.adres}, ${app.realizator.telefon}, ${app.realizator.email}`,
    "",
    "II. DOŚWIADCZENIE",
    ...content.experience.areas.map((a, i) => `[${app.doswiadczenie.obszary[i] ? "x" : " "}] ${a}`),
    or(app.doswiadczenie.opis),
    "",
    `III.1 ${s.tytul.title.toUpperCase()}`, or(app.tytul), "",
    `III.2 ${s.opis.title.toUpperCase()}`, or(app.opis), "",
    `III.3 ${s.daty.title.toUpperCase()}`,
    `Etap 1. Przygotowanie: od ${monthLabel(app.etap1.od)} do ${monthLabel(app.etap1.do)}`,
    `Etap 2. Wdrażanie: od ${monthLabel(app.etap2.od)} do ${monthLabel(app.etap2.do)}`, "",
    `III.4 ${s.grupy.title.toUpperCase()}`,
    ...content.targetGroups.map((g, i) => `[${app.grupy[i] ? "x" : " "}] ${g}`), "",
    `III.5 ${s.diagnoza.title.toUpperCase()}`, or(app.diagnoza), "",
    `III.6 ${s.rekrutacja.title.toUpperCase()}`, or(app.rekrutacja), "",
    `III.7 ${s.liczba.title.toUpperCase()}`, or(app.liczba), "",
    `III.8 ${s.obszar.title.toUpperCase()}`, or(app.obszar), "",
    `III.9 ${s.efekty.title.toUpperCase()}`, or(app.efekty), "",
    "III.10 PLAN DZIAŁANIA I KOSZTY", "Etap przygotowania:", ...rows(app.przygotowanie), "Etap wdrażania:", ...rows(app.wdrazanie), "",
    "Wskaźnik: liczba osób objętych usługami świadczonymi w społeczności lokalnej",
    ...app.wskaznik.lata.map((l) => `${l.rok}: kobiety ${or(l.k)}, mężczyźni ${or(l.m)}`),
    `Ogółem: kobiety ${totals.k}, mężczyźni ${totals.m}, razem ${totals.total}`,
    `Sposób pomiaru: ${or(app.wskaznik.pomiar)}`, "",
    `III.11 WNIOSKOWANA KWOTA GRANTU: ${or(app.kwota)} zł`, "",
    `III.12 CROSS-FINANCING: ${app.cross === "tak" ? `tak – ${or(app.crossLista)}` : "nie"}`,
    app.cross === "tak" && `III.13 TRWAŁOŚĆ CROSS-FINANCINGU: ${or(app.trwaloscCross)}`, "",
    `IV. ${s.horyzontalne.title.toUpperCase()}`, or(app.horyzontalne), "",
    `V. ${s.utrzymanie.title.toUpperCase()}`, or(app.utrzymanie), "",
    `VI. ${s.deinstytucjonalizacja.title.toUpperCase()}`, or(app.deinstytucjonalizacja),
  ];
  return lines.filter((l): l is string => l !== false).join("\n");
}
