import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { csvCell, toCsv } from "../../lib/csv.ts";
import { alertMatches } from "../../lib/innovations/alerts.ts";
import { activeFilterCount, filtersHref, parseFilters, signalMinFor } from "../../lib/innovations/filters.ts";
import { institutionStats } from "../../lib/innovations/institutions.ts";
import { COUNT_FILLS, countByCounty, countClass } from "../../lib/innovations/map.ts";
import { PartnerProfileInput, profileFromForm } from "../../lib/innovations/partner-profile.ts";
import { EXPORT_HEADER, exportCsv, type ExportRow } from "../../lib/panel/export.ts";
import { groupByStage, laterStages, type FunnelItem } from "../../lib/panel/funnel-board.ts";
import { mergeProblem } from "../../lib/panel/merge.ts";
import { median, systemMetrics, whiteSpots, type MetricInitiative } from "../../lib/panel/metrics.ts";
import { canSee, scopeFor } from "../../lib/panel/scope.ts";
import { FUNNEL_KEYS } from "../../lib/taxonomy.ts";

describe("CSV", () => {
  test("komórki z średnikiem i cudzysłowem są cytowane, a początek formuły neutralizowany", () => {
    assert.equal(csvCell('Ala; "ma" kota'), '"Ala; ""ma"" kota"');
    assert.equal(csvCell("=HYPERLINK(\"x\")"), '"\'=HYPERLINK(""x"")"');
    assert.equal(csvCell("@cmd"), "'@cmd");
    assert.equal(csvCell(-3), "-3");
    assert.equal(csvCell(true), "tak");
    assert.equal(csvCell(null), "");
  });

  test("plik zaczyna się od BOM i używa CRLF", () => {
    assert.equal(toCsv([["a", 1], ["b", 2]]), "﻿a;1\r\nb;2\r\n");
  });

  test("eksport innowacji ma kolumny w kolejności nagłówka", () => {
    const row: ExportRow = {
      status_code: "RAD-AAAA", title: "=Tytuł", status: "featured", funnel_stage: "oceniona", innovation_kind: "technologiczna", sectors: ["ict"],
      trl: 5, ip_status: "patent", signal: 60, signal_override: 80, institution_name: "PRz", municipality: "Rzeszów", county: "m. Rzeszów",
      partner_name: null, published: true, duplicate_code: null, created_at: "2026-01-02T10:00:00Z", updated_at: "2026-02-03T10:00:00Z", synthetic: false,
    };
    const lines = exportCsv([row], (s) => `S:${s}`).replace("﻿", "").split("\r\n");
    assert.equal(lines[0].split(";").length, EXPORT_HEADER.length);
    assert.equal(lines[1].split(";").length, EXPORT_HEADER.length);
    assert.ok(lines[1].startsWith("RAD-AAAA;'=Tytuł;S:featured;Oceniona"));
    assert.ok(lines[1].includes(";80;80;"), "liczy się korekta sygnału");
  });
});

describe("filtry innowacji", () => {
  test("nieznane wartości w adresie są pomijane", () => {
    const f = parseFilters({ typ: "zmyslony", sektor: "ict", trl: "12", sygnal: "silny", powiat: "18" });
    assert.deepEqual(f, { kind: undefined, sector: "ict", domain: undefined, institution: undefined, stage: undefined, trlMin: undefined, signal: "silny", county: undefined });
    assert.equal(activeFilterCount(f), 2);
  });

  test("TRL, powiat i poziom sygnału", () => {
    const f = parseFilters({ trl: "6", powiat: "1863", sygnal: ["obiecujacy"] });
    assert.equal(f.trlMin, 6);
    assert.equal(f.county, "1863");
    assert.equal(signalMinFor(f.signal), 45);
    assert.equal(signalMinFor("do_rozwiniecia"), null, "najniższy poziom nie jest filtrem");
  });

  test("link z filtrami zmienia tylko wskazany filtr", () => {
    const f = parseFilters({ typ: "technologiczna", trl: "4" });
    assert.equal(filtersHref(f), "/innowacje?typ=technologiczna&trl=4");
    assert.equal(filtersHref(f, { county: "1863" }, "#lista"), "/innowacje?typ=technologiczna&trl=4&powiat=1863#lista");
    assert.equal(filtersHref(f, { trlMin: undefined, kind: undefined }), "/innowacje");
  });
});

describe("mapa innowacji", () => {
  test("liczy innowacje w powiatach i dobiera klasę", () => {
    assert.deepEqual(countByCounty([{ county_teryt: "1801" }, { county_teryt: "1801" }, { county_teryt: null }, { county_teryt: "1863" }]), { "1801": 2, "1863": 1 });
    assert.deepEqual([0, 1, 2, 3, 4, 5, 40].map(countClass), [0, 1, 2, 3, 3, 4, 4]);
    assert.equal(COUNT_FILLS[0], null);
  });
});

describe("alerty dla partnerów", () => {
  const target = { sectors: ["motoryzacja"], innovation_kind: "technologiczna", trl: 5 };
  test("pusty profil dostaje wszystko", () => {
    assert.ok(alertMatches({ sectors: [], kinds: [], trlMin: null, trlMax: null }, target));
  });
  test("sektor, typ i zakres TRL zawężają", () => {
    assert.ok(alertMatches({ sectors: ["motoryzacja", "ict"], kinds: [], trlMin: 4, trlMax: 7 }, target));
    assert.ok(!alertMatches({ sectors: ["ict"], kinds: [], trlMin: null, trlMax: null }, target));
    assert.ok(!alertMatches({ sectors: [], kinds: ["edukacyjna"], trlMin: null, trlMax: null }, target));
    assert.ok(!alertMatches({ sectors: [], kinds: [], trlMin: 6, trlMax: null }, target));
    assert.ok(!alertMatches({ sectors: [], kinds: [], trlMin: null, trlMax: 4 }, target));
  });
  test("innowacja bez TRL nie odpada z powodu zakresu", () => {
    assert.ok(alertMatches({ sectors: [], kinds: [], trlMin: 6, trlMax: 9 }, { ...target, innovation_kind: "edukacyjna", trl: null }));
  });
});

describe("profil partnera", () => {
  const form = (o: Record<string, string | string[]>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
    return f;
  };
  const ok = { name: "Aero Parts", kind: "firma", description: "Szukamy technologii do pilotażu w produkcji części.", sectors: ["lotnictwo_kosmos"], support: ["pilotaz", "licencja"] };

  test("poprawny profil, e-mail opcjonalny", () => {
    const r = PartnerProfileInput.safeParse(profileFromForm(form({ ...ok, trlMin: "4", trlMax: "7", email: " Biuro@Aero.PL " })));
    assert.ok(r.success);
    assert.equal(r.data.email, "biuro@aero.pl");
    assert.equal(r.data.trlMin, 4);
    assert.ok(PartnerProfileInput.safeParse(profileFromForm(form(ok))).success);
  });

  test("odrzuca zły rodzaj, brak sektora, odwrócony TRL i zły e-mail", () => {
    assert.ok(!PartnerProfileInput.safeParse(profileFromForm(form({ ...ok, kind: "pci" }))).success, "akceleratory PCI dodaje tylko zespół");
    assert.ok(!PartnerProfileInput.safeParse(profileFromForm(form({ ...ok, sectors: [] }))).success);
    assert.ok(!PartnerProfileInput.safeParse(profileFromForm(form({ ...ok, trlMin: "8", trlMax: "3" }))).success);
    assert.ok(!PartnerProfileInput.safeParse(profileFromForm(form({ ...ok, email: "nie-adres" }))).success);
  });
});

describe("statystyki instytucji", () => {
  test("liczy sygnał, wdrożenia i sektory", () => {
    const s = institutionStats([
      { signal: 80, sectors: ["ict"], funnel_stage: "w_realizacji" },
      { signal: 40, sectors: ["ict", "motoryzacja"], funnel_stage: "oceniona" },
      { signal: null, sectors: [], funnel_stage: null },
    ]);
    assert.deepEqual({ ...s, sectors: undefined }, { total: 3, strong: 1, inProgress: 1, avgSignal: 60, sectors: undefined });
    assert.deepEqual(s.sectors, [{ sector: "ict", count: 2 }, { sector: "motoryzacja", count: 1 }]);
    assert.equal(institutionStats([]).avgSignal, null);
  });
});

describe("zakres Panelu", () => {
  test("administrator widzi wszystko, opiekun tylko swoją instytucję", () => {
    assert.deepEqual(scopeFor("admin", null), { kind: "all" });
    const keeper = scopeFor("institution", "inst-1")!;
    assert.deepEqual(keeper, { kind: "institution", institutionId: "inst-1" });
    assert.ok(canSee(keeper, { institution_id: "inst-1" }));
    assert.ok(!canSee(keeper, { institution_id: "inst-2" }));
    assert.ok(!canSee(keeper, { institution_id: null }));
    assert.ok(canSee({ kind: "all" }, { institution_id: null }));
  });
  test("opiekun bez instytucji i inne role nie mają wstępu", () => {
    assert.equal(scopeFor("institution", null), null);
    assert.equal(scopeFor("mentor", "inst-1"), null);
    assert.equal(scopeFor("author", null), null);
  });
});

describe("scalanie duplikatów", () => {
  const src = { id: "a", duplicate_of: null, mergedCount: 0 };
  test("poprawne scalenie", () => assert.equal(mergeProblem(src, { id: "b", duplicate_of: null }), null));
  test("zabrania cykli i łańcuchów", () => {
    assert.equal(mergeProblem(src, null), "brak_celu");
    assert.equal(mergeProblem(src, { id: "a", duplicate_of: null }), "samo_w_siebie");
    assert.equal(mergeProblem(src, { id: "b", duplicate_of: "c" }), "cel_jest_duplikatem");
    assert.equal(mergeProblem({ ...src, duplicate_of: "c" }, { id: "b", duplicate_of: null }), "juz_scalona");
    assert.equal(mergeProblem({ ...src, mergedCount: 2 }, { id: "b", duplicate_of: null }), "ma_scalone");
  });
});

describe("lejek", () => {
  const item = (id: string, stage: string | null, signal: number | null): FunnelItem => ({
    id, status_code: id, title: id, funnel_stage: stage, signal, institution_name: null, partner_name: null, updated_at: "2026-01-01T00:00:00Z",
  });
  test("grupuje po etapach w kolejności lejka, bez etapu = pierwszy, sygnał malejąco", () => {
    const cols = groupByStage([item("x", "oceniona", 30), item("y", null, null), item("z", "oceniona", 70), item("q", "nieznany", 1)]);
    assert.deepEqual(cols.map((c) => c.stage), [...FUNNEL_KEYS]);
    assert.deepEqual(cols[0].items.map((i) => i.id), ["q", "y"]);
    assert.deepEqual(cols[2].items.map((i) => i.id), ["z", "x"]);
  });
  test("przesunąć można tylko do przodu", () => {
    assert.deepEqual(laterStages("skomercjalizowana"), ["zarchiwizowana"]);
    assert.deepEqual(laterStages("zarchiwizowana"), []);
    assert.equal(laterStages(null).length, FUNNEL_KEYS.length, "bez etapu: wszystkie");
  });
});

describe("wskaźniki skuteczności", () => {
  const i = (id: string, o: Partial<MetricInitiative> = {}): MetricInitiative => ({
    id, created_at: "2026-01-01T00:00:00Z", status: "submitted", funnel_stage: "oceniona", submission_kind: "own", teryt: "1863011", sectors: ["ict"], duplicate_of: null, ...o,
  });

  test("mediana", () => {
    assert.equal(median([]), null);
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([1, 2, 3, 10]), 2.5);
  });

  test("wykryte i zweryfikowane, odsetek ścieżek w realizacji, czasy kontaktu", () => {
    const m = systemMetrics(
      [
        i("a", { funnel_stage: "w_realizacji" }),
        i("b"),
        i("c", { submission_kind: "detected", status: "detected", funnel_stage: "wykryta" }),
        i("d", { submission_kind: "detected", funnel_stage: "zweryfikowana" }),
        i("e", { funnel_stage: "zarchiwizowana", status: "archived" }),
        i("f", { duplicate_of: "a" }),
      ],
      [
        { initiative_id: "a", created_at: "2026-01-05T00:00:00Z", updated_at: "2026-01-11T00:00:00Z", status: "polaczone" },
        { initiative_id: "a", created_at: "2026-01-20T00:00:00Z", updated_at: "2026-01-20T00:00:00Z", status: "oczekuje" },
        { initiative_id: "b", created_at: "2026-01-03T00:00:00Z", updated_at: "2026-01-03T00:00:00Z", status: "oczekuje" },
        { initiative_id: "f", created_at: "2026-01-02T00:00:00Z", updated_at: "2026-01-02T00:00:00Z", status: "oczekuje" },
      ],
    );
    assert.equal(m.total, 5, "duplikat się nie liczy");
    assert.deepEqual([m.detected, m.detectedVerified], [2, 1]);
    assert.equal(m.assessable, 3, "bez zarchiwizowanej i niepotwierdzonej wykrytej");
    assert.equal(m.withActivePathway, 1);
    assert.equal(m.activePathwayPercent, 33);
    assert.deepEqual(m.firstContact, { medianDays: 3, n: 2 });
    assert.deepEqual(m.connected, { medianDays: 10, n: 1 });
    assert.equal(m.byStage.w_realizacji, 1);
  });

  test("bez danych nie ma odsetka ani czasów", () => {
    const m = systemMetrics([], []);
    assert.equal(m.activePathwayPercent, null);
    assert.equal(m.firstContact, null);
  });

  test("białe plamy: pary powiat × sektor bez innowacji", () => {
    const counties = [{ id: "1801", name: "bieszczadzki" }, { id: "1863", name: "Rzeszów" }];
    const rows = whiteSpots(
      [
        i("a", { teryt: "1863011", sectors: ["ict", "motoryzacja"] }),
        i("b", { teryt: "1863011", sectors: ["ict"] }),
        i("c", { teryt: "1863011", sectors: ["lotnictwo_kosmos"], status: "detected" }),
        i("d", { teryt: "1863011", sectors: ["lotnictwo_kosmos"], duplicate_of: "a" }),
        i("e", { teryt: "1899011", sectors: ["ict"] }),
      ],
      counties,
      ["ict", "motoryzacja", "lotnictwo_kosmos"],
    );
    assert.deepEqual(rows.map((r) => [r.id, r.empty]), [["1801", 3], ["1863", 1]]);
    assert.deepEqual(rows[1].counts, { ict: 2, motoryzacja: 1, lotnictwo_kosmos: 0 });
  });
});
