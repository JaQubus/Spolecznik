import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { rankChallenges, scorePartner, type ChallengeCandidate, type MatchInput, type PartnerCandidate } from "../../lib/pathways/match.ts";
import { conditionHolds, describeCondition, easeOfAdoption, fillTemplate, recommendPathways, type PathwayInput } from "../../lib/pathways/rules.ts";
import { buildPathwaysView, extraMetrics, type PathwaySource } from "../../lib/pathways/view.ts";
import { sameStem, sharedWords } from "../../lib/stems.ts";
import {
  FUNNEL, FUNNEL_KEYS, INNOVATION_KIND_KEYS, PARTNER_KIND_KEYS, PARTNER_SUPPORT_KEYS, PATHWAY_KEYS, PATHWAY_RULES, PATHWAYS, RADAR_KEYS,
  type RadarKey,
} from "../../lib/taxonomy.ts";

// Reguły ścieżek i dopasowanie partnerów bez LLM (6/10). Dane demo: data/out/demo.json (generator seed_initiatives.py).

const radar = (scores: Partial<Record<RadarKey, number>>) =>
  ({ dimensions: Object.fromEntries(RADAR_KEYS.map((k) => [k, { score: scores[k] ?? 3 }])) as Record<RadarKey, { score: number }> });

const base: PathwayInput = {
  innovationKind: "spoleczna", stage: "dziala", trl: null, sectors: ["jakosc_zycia"], ipStatus: null, institutionType: "gmina",
  creatorRoles: [], radar: radar({}), adoptionsCount: 0,
};

describe("ścieżki: konfiguracja", () => {
  test("klucze ścieżek, lejka, wsparcia i rodzajów partnerów zgadzają się z config/taxonomy.json", () => {
    assert.deepEqual([...PATHWAY_KEYS], Object.keys(PATHWAYS.kinds));
    assert.deepEqual([...FUNNEL_KEYS], Object.keys(FUNNEL));
    for (const [k, kind] of Object.entries(PATHWAYS.kinds)) {
      for (const s of kind.partnerSupport) assert.ok((PARTNER_SUPPORT_KEYS as readonly string[]).includes(s), `${k}: wsparcie ${s}`);
      for (const s of kind.partnerKinds) assert.ok((PARTNER_KIND_KEYS as readonly string[]).includes(s), `${k}: rodzaj ${s}`);
      assert.ok(kind.helpers.length > 0, `${k}: kto pomaga`);
      for (const [v, variant] of Object.entries(kind.variants)) {
        assert.ok(variant.metrics.length > 0, `${k}/${v}: mierniki`);
        for (const kk of Object.keys(variant.metricsByKind ?? {})) assert.ok((INNOVATION_KIND_KEYS as readonly string[]).includes(kk), `${k}/${v}: typ ${kk}`);
      }
    }
  });

  test("każda reguła wskazuje istniejącą ścieżkę i wariant, a jej warunek da się opisać zdaniem", () => {
    for (const r of PATHWAY_RULES) {
      assert.ok(PATHWAYS.kinds[r.pathway], `ścieżka ${r.pathway}`);
      assert.ok(PATHWAYS.kinds[r.pathway].variants[r.variant], `wariant ${r.pathway}/${r.variant}`);
      assert.ok(r.points > 0);
      assert.notEqual(describeCondition(r.when), "zawsze");
    }
  });

  test("advance_funnel w migracji 0009 zna te same etapy lejka w tej samej kolejności", () => {
    const sql = readFileSync("supabase/migrations/0009_pathways.sql", "utf8");
    const arr = sql.match(/stages constant text\[\] := array\[([^\]]+)\]/)![1];
    assert.deepEqual(arr.split(",").map((s) => s.trim().replace(/'/g, "")), [...FUNNEL_KEYS]);
  });
});

describe("ścieżki: reguły", () => {
  test("TRL ≥ 6 i sektor PCI ⇒ komercjalizacja (licencja)", () => {
    const rec = recommendPathways({ ...base, innovationKind: "technologiczna", trl: 7, sectors: ["motoryzacja"], stage: "dziala" });
    const p = rec.pathways.find((x) => x.key === "komercjalizacja");
    assert.ok(p, "komercjalizacja");
    assert.equal(p.variant, "licencja");
    assert.ok(p.reasons.some((r) => r.includes("TRL 7 i sektor PCI")));
  });

  test("TRL 7 bez sektora PCI nie daje punktów z reguły o sektorze", () => {
    const rec = recommendPathways({ ...base, innovationKind: "technologiczna", trl: 7, sectors: ["inne"], radar: radar({ komercjalizacja: 2 }) });
    assert.ok(!rec.pathways.some((p) => p.reasons.some((r) => r.includes("sektor PCI"))));
  });

  test("organizacyjna i wysoka skalowalność ⇒ wdrożenie z łatwością wdrożenia", () => {
    const rec = recommendPathways({ ...base, innovationKind: "organizacyjna", radar: radar({ skalowalnosc: 5, dojrzalosc: 4 }) });
    assert.equal(rec.pathways[0].key, "wdrozenie");
    assert.ok(rec.pathways[0].ease);
    assert.ok(rec.pathways[0].ease!.score >= 4);
    assert.equal(rec.pathways.find((p) => p.key !== "wdrozenie")?.ease ?? null, null, "łatwość tylko przy wdrożeniu");
  });

  test("zgłoszenie patentowe ⇒ ochrona IP (decyzja o ochronie za granicą)", () => {
    const rec = recommendPathways({ ...base, innovationKind: "technologiczna", trl: 4, stage: "pilotaz", ipStatus: "zgloszenie", sectors: ["ict"] });
    const ip = rec.pathways.find((p) => p.key === "ochrona_ip");
    assert.ok(ip);
    assert.equal(ip.variant, "rozszerzenie");
  });

  test("nowa technologia bez ochrony ⇒ ochrona IP (zgłoszenie)", () => {
    const rec = recommendPathways({ ...base, innovationKind: "technologiczna", trl: 5, stage: "pilotaz", ipStatus: "brak", radar: radar({ nowosc: 5 }) });
    assert.equal(rec.pathways.find((p) => p.key === "ochrona_ip")?.variant, "zgloszenie");
  });

  test("otwarta licencja ⇒ upowszechnienie open source", () => {
    const rec = recommendPathways({ ...base, ipStatus: "open" });
    assert.equal(rec.pathways.find((p) => p.key === "upowszechnienie")?.variant, "open_source");
  });

  test("najwyżej tyle ścieżek, ile pozwala konfiguracja, od najwyższej sumy punktów", () => {
    const rec = recommendPathways({
      ...base, innovationKind: "technologiczna", trl: 4, stage: "pilotaz", ipStatus: "zgloszenie", sectors: ["lotnictwo_kosmos"],
      institutionType: "uczelnia", creatorRoles: ["student"], radar: radar({ nowosc: 5, komercjalizacja: 5, dojrzalosc: 1, wplyw: 5 }),
    });
    assert.ok(rec.pathways.length <= PATHWAYS.max);
    const pts = rec.pathways.map((p) => p.points);
    assert.deepEqual(pts, [...pts].sort((a, b) => b - a));
  });

  test("bez reguł z punktami: bezpieczny pierwszy krok z pathwayFallback", () => {
    const rec = recommendPathways({ ...base, stage: "pomysl", radar: radar({ wplyw: 1, skalowalnosc: 1, dojrzalosc: 3 }) });
    assert.equal(rec.pathways.length, 1);
    assert.equal(rec.pathways[0].key, "rozwoj");
    assert.equal(rec.pathways[0].variant, "grant");
  });

  test("bez oceny radaru reguły radaru nie działają, a próg jest niższy", () => {
    const rec = recommendPathways({ ...base, innovationKind: "organizacyjna", radar: null });
    assert.equal(rec.withRadar, false);
    assert.ok(!rec.pathways.some((p) => p.reasons.some((r) => r.startsWith("Radar") || r.includes("skalowalności"))));
    assert.ok(rec.ease.estimated);
  });

  test("warunki: pola radaru wymagają oceny, TRL wymaga poziomu", () => {
    const ctx = { ...base, ease: 3, youth: false };
    assert.equal(conditionHolds({ radarMin: { wplyw: 1 } }, { ...ctx, radar: null }), false);
    assert.equal(conditionHolds({ trlMax: 6 }, ctx), false);
    assert.equal(conditionHolds({ notKinds: ["technologiczna"] }, ctx), true);
    assert.equal(conditionHolds({ ipMissing: true }, ctx), true);
    assert.equal(conditionHolds({ sectorPci: true }, { ...ctx, sectors: ["inne"] }), false);
  });

  test("szablon z brakującą zmienną znika zamiast pokazać pustą liczbę", () => {
    assert.equal(fillTemplate("TRL {trlTarget} w 12 miesięcy (teraz TRL {trl})", { trl: "4", trlTarget: "6" }), "TRL 6 w 12 miesięcy (teraz TRL 4)");
    assert.equal(fillTemplate("TRL {trlTarget}", {}), null);
  });

  test("łatwość wdrożenia: jawne składniki, premia za przeniesienie, szacunek bez radaru", () => {
    const moved = easeOfAdoption({ ...base, stage: "przeniesiona", radar: radar({ skalowalnosc: 3, dojrzalosc: 3 }) });
    const here = easeOfAdoption({ ...base, stage: "dziala", radar: radar({ skalowalnosc: 3, dojrzalosc: 3 }) });
    assert.equal(moved.score, here.score + 1);
    assert.ok(moved.factors.some((f) => f.startsWith("Działa już w innym miejscu")));
    assert.equal(easeOfAdoption({ ...base, radar: null }).estimated, true);
    assert.ok(easeOfAdoption({ ...base, innovationKind: "technologiczna", trl: 3, stage: "pomysl", radar: radar({ skalowalnosc: 2, dojrzalosc: 1 }) }).score <= 2);
  });
});

describe("dopasowanie partnerów i wyzwań", () => {
  const partner = (over: Partial<PartnerCandidate>): PartnerCandidate => ({
    id: "00000000-0000-0000-0000-000000000001", slug: "p", name: "Partner", kind: "firma", description: "", sectors: ["lotnictwo_kosmos"],
    domains: ["gospodarka"], support: ["licencja"], trl_min: 4, trl_max: 8, stages: [], keywords: ["kompozyt"], teryt: null, ...over,
  });
  const input = (over: Partial<MatchInput> = {}): MatchInput => ({
    innovationKind: "technologiczna", stage: "pilotaz", trl: 5, sectors: ["lotnictwo_kosmos"], domains: ["gospodarka"], institutionType: "uczelnia",
    teryt: "1863011", keywords: ["kompozyt"], text: "", pathways: recommendPathways({ ...base, innovationKind: "technologiczna", trl: 5, ipStatus: "patent", sectors: ["lotnictwo_kosmos"] }).pathways,
    ...over,
  });

  test("rdzenie słów: odmiana pasuje, krótkie słowo nie łapie innego", () => {
    assert.ok(sameStem("kompozyt", "kompozytu"));
    assert.ok(sameStem("lotnictwo", "lotnicze"));
    assert.ok(!sameStem("staż", "stanowisko"));
    assert.deepEqual(sharedWords("odpady włókna węglowego", ["włókno węglowe", "recykling"]), ["włókno", "węglowe"]);
  });

  test("TRL spoza zakresu partnera albo etap spoza jego listy: partner odpada", () => {
    assert.equal(scorePartner(input({ trl: 2 }), partner({})), null);
    assert.equal(scorePartner(input({ innovationKind: "spoleczna", trl: null, stage: "pomysl" }), partner({ stages: ["dziala"], support: ["pilotaz"] })), null);
  });

  test("partner, który nie pomaga w żadnej ścieżce, odpada", () => {
    // Ścieżki tej innowacji to komercjalizacja i dalszy rozwój: samorząd, który daje tylko pilotaż, w nich nie pomaga.
    assert.deepEqual(input().pathways.map((p) => p.key).sort(), ["komercjalizacja", "rozwoj"]);
    assert.equal(scorePartner(input(), partner({ kind: "jst", support: ["pilotaz"] })), null);
  });

  test("partner bez wspólnego sektora, dziedziny i słów odpada, nawet gdy pasuje dojrzałością i wsparciem", () => {
    assert.equal(scorePartner(input(), partner({ sectors: ["jakosc_zycia"], domains: ["zdrowie"], keywords: ["senior"] })), null);
  });

  test("„dlaczego” wymienia sektor, dojrzałość, wsparcie, słowa i powiat", () => {
    const m = scorePartner(input(), partner({ teryt: "1863011" }))!;
    assert.ok(m.why.some((w) => w.startsWith("Ten sam sektor")));
    assert.ok(m.why.some((w) => w.includes("TRL 5 mieści się")));
    assert.ok(m.why.some((w) => w.startsWith("Oferuje: licencja")));
    assert.ok(m.why.some((w) => w.startsWith("Wspólne słowa: kompozyt")));
    assert.ok(m.why.includes("Siedziba w tym samym powiecie"));
    const far = scorePartner(input(), partner({ teryt: "1816011" }))!;
    assert.ok(m.score > far.score);
  });

  test("te same opisy wyzwań z kilku gmin to jedna pozycja z liczbą instytucji", () => {
    const c = (id: string, county: string): ChallengeCandidate => ({
      id, summary: "Firmy nie mogą znaleźć absolwentów z kompozytów.", keywords: ["kompozyt", "absolwent"], domains: ["gospodarka"], institutionType: "uczelnia", county,
    });
    const out = rankChallenges(input({ keywords: ["kompozyt", "absolwent"] }), [c("a", "mielecki"), c("b", "dębicki")]);
    assert.equal(out.length, 1);
    assert.equal(out[0].count, 2);
    assert.deepEqual(out[0].counties, ["mielecki", "dębicki"]);
  });
});

// ── Przypadki demo (sekcja 6 zadania) na danych syntetycznych ──
type DemoInitiative = PathwaySource & { title: string; id: string };
type DemoPartner = PartnerCandidate & { place?: string };
type DemoChallenge = { id: string; teryt: string; institution_type: string; card: { summary: string; keywords: string[]; domains: string[] } };
const demo = JSON.parse(readFileSync("data/out/demo.json", "utf8")) as { initiatives: DemoInitiative[]; partners: DemoPartner[]; challenges: DemoChallenge[] };
const candidates = {
  partners: demo.partners.map((p) => ({ ...p, keywords: p.keywords ?? [] })),
  challenges: demo.challenges.map((c) => ({
    id: c.id, summary: c.card.summary, keywords: c.card.keywords, domains: c.card.domains, institutionType: c.institution_type, county: c.teryt.slice(0, 4),
  })),
};
const find = (title: string) => {
  const i = demo.initiatives.find((x) => x.title === title);
  assert.ok(i, title);
  return i;
};
const mielec = demo.partners.find((p) => p.slug === "kompozyty-mielec")!.teryt!;

describe("przypadek demo 1: klasa patronacka technikum z Mielca", () => {
  const i = find("Klasa patronacka technikum z lokalnymi firmami lotniczymi");
  const view = buildPathwaysView({ ...i, teryt: mielec }, candidates);

  test("wdrożenie w innej instytucji i upowszechnienie (dobra praktyka)", () => {
    const keys = view.recommendation.pathways.map((p) => p.key);
    assert.deepEqual(keys.slice(0, 2), ["wdrozenie", "upowszechnienie"]);
    assert.equal(view.recommendation.pathways[1].variant, "dobra_praktyka");
  });

  test("mierniki: liczba szkół wdrażających", () => {
    const metrics = view.recommendation.pathways[0].metrics.join(" ");
    assert.match(metrics, /Liczba szkół wdrażających/);
  });

  test("3 szkoły z podobnym wyzwaniem i 2 firmy z sektora lotniczego", () => {
    const schools = view.challenges.filter((c) => c.challenge.institutionType === "szkola_ponadpodstawowa");
    assert.ok(schools.reduce((s, c) => s + c.count, 0) >= 3, `szkoły: ${schools.length}`);
    const firms = view.partners.filter((m) => m.partner.kind === "firma" && demo.partners.find((p) => p.id === m.partner.id)!.sectors.includes("lotnictwo_kosmos"));
    assert.ok(firms.length >= 2, `firmy: ${firms.map((f) => f.partner.name).join(", ")}`);
    assert.ok(view.partners.some((m) => m.partner.name.startsWith("Zakład obróbki kompozytów")), "zakład z Mielca (ten sam powiat)");
    assert.ok(view.partners.every((m) => m.why.length > 0));
  });
});

describe("przypadek demo 2: zgłoszenie patentowe uczelni z Rzeszowa (kompozyt z odpadów włókna węglowego, TRL 4)", () => {
  // Po przejęciu twórca uzupełnia TRL 4, sektor lotniczy i rolę doktorantów.
  const i = find("Wsporniki lotnicze z kompozytu z odzysku");
  const view = buildPathwaysView({ ...i, trl: 4, card: { ...i.card, creatorRoles: ["naukowiec", "student"] } }, candidates);
  const byKey = new Map(view.recommendation.pathways.map((p) => [p.key, p]));

  test("komercjalizacja (licencja) i dalszy rozwój (akcelerator PCI)", () => {
    assert.equal(byKey.get("komercjalizacja")?.variant, "licencja");
    assert.equal(byKey.get("rozwoj")?.variant, "akcelerator");
  });

  test("mierniki: list intencyjny, umowa licencyjna, TRL 6 w 12 miesięcy", () => {
    const all = [...byKey.values()].flatMap((p) => p.metrics).join(" ");
    assert.match(all, /List intencyjny/);
    assert.match(all, /[Uu]mowa licencyjna/);
    assert.match(all, /TRL 6 w 12 miesięcy \(teraz TRL 4\)/);
  });

  test("partnerzy z lotnictwa i motoryzacji oraz fundusz", () => {
    const sectorsOf = (id: string) => demo.partners.find((p) => p.id === id)!.sectors;
    const firms = view.partners.filter((m) => m.partner.kind === "firma");
    assert.ok(firms.some((m) => sectorsOf(m.partner.id).includes("lotnictwo_kosmos")));
    assert.ok(firms.some((m) => sectorsOf(m.partner.id).includes("motoryzacja")));
    assert.ok(view.partners.some((m) => m.partner.kind === "fundusz"));
    assert.ok(view.partners.some((m) => m.partner.kind === "pci" && m.pathway === "rozwoj"), "akcelerator albo laboratorium PCI");
  });
});

describe("mierniki od AI", () => {
  // Odpowiedź modelu z przejścia demo na żywo (przypadek 2): trzy z czterech powtarzały mierniki z konfiguracji.
  test("bez powtórzeń mierników z konfiguracji, nowe zostają", () => {
    const configured = ["List intencyjny z firmą z sektora w 6 miesięcy", "Umowa licencyjna albo umowa o testy u licencjobiorcy w 12 miesięcy"];
    assert.deepEqual(extraMetrics(configured, [
      "List intencyjny od firmy z sektora lotniczego podpisany do 6 miesiąca",
      "Podpisanie umowy licencyjnej lub umowy o testy do 12 miesiąca",
      "Uzyskany prototyp spełniający wymogi wytrzymałościowe w testach laboratoryjnych do 9 miesiąca",
    ]), ["Uzyskany prototyp spełniający wymogi wytrzymałościowe w testach laboratoryjnych do 9 miesiąca"]);
    assert.deepEqual(extraMetrics(["Udział w najbliższym naborze akceleratora PCI"], ["Udział w akceleratorze PCI potwierdzony do 12 miesiąca"]), []);
  });

  test("miernik dopasowany do karty zostaje (przypadek 1)", () => {
    const configured = ["Liczba szkół wdrażających model: 3 w ciągu roku szkolnego", "Plan przeniesienia dla szkoły (program, role nauczycieli, koszty) gotowy w 3 miesiące"];
    const ai = ["Odsetek uczniów zatrudnionych w regionie w nowej szkole: co najmniej 70% w ciągu pierwszego roku"];
    assert.deepEqual(extraMetrics(configured, ai), ai);
  });
});

