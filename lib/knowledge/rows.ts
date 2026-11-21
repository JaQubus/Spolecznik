// Mapowanie wierszy (snake_case z JSON-a i z Postgresa) na typy aplikacji i z powrotem.
// Pliki content/library/*.json (data/knowledge_seed.py) i tabele z 0001_core.sql mają te same nazwy kolumn,
// z jednym wyjątkiem: fakt ma `domain` w JSON-ie i `domain_key` w bazie.
import type { Domain, DomainKey, Fact, InnovationType, Material, MaterialKind, Pattern } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- surowe wiersze z JSON-a i Supabase
type Row = Record<string, any>;

export const domainFromRow = (r: Row): Domain => ({
  key: r.key,
  slug: r.slug,
  name: r.name,
  icon: r.icon,
  lead: r.lead,
  definition: r.definition,
  challenges: r.challenges ?? [],
  challengesSource: r.challenges_source ?? null,
  reading: r.reading ?? [],
  sort: r.sort ?? 0,
  published: r.published ?? true,
});

export const domainToRow = (d: Domain): Row => ({
  key: d.key, slug: d.slug, name: d.name, icon: d.icon, lead: d.lead, definition: d.definition,
  challenges: d.challenges, challenges_source: d.challengesSource, reading: d.reading, sort: d.sort, published: d.published,
});

export const factFromRow = (r: Row): Fact => ({
  id: r.id,
  domain: (r.domain_key ?? r.domain) as DomainKey,
  value: r.value == null ? null : Number(r.value),
  unit: r.unit ?? null,
  displayValue: r.display_value,
  sentence: r.sentence,
  dataYear: r.data_year ?? null,
  sourceTitle: r.source_title ?? null,
  sourcePublisher: r.source_publisher ?? null,
  sourceUrl: r.source_url ?? null,
  sourceYear: r.source_year ?? null,
  sourcePage: r.source_page ?? null,
  quote: r.quote ?? null,
  isExample: !!r.is_example,
  sort: r.sort ?? 0,
  published: r.published ?? true,
});

export const factToRow = (f: Fact, column: "domain" | "domain_key"): Row => ({
  id: f.id, [column]: f.domain, value: f.value, unit: f.unit, display_value: f.displayValue, sentence: f.sentence,
  data_year: f.dataYear, source_title: f.sourceTitle, source_publisher: f.sourcePublisher, source_url: f.sourceUrl,
  source_year: f.sourceYear, source_page: f.sourcePage, quote: f.quote, is_example: f.isExample,
  sort: f.sort, published: f.published,
});

export const materialFromRow = (r: Row): Material => ({
  id: r.id,
  slug: r.slug ?? r.id,
  kind: r.kind as MaterialKind,
  title: r.title,
  description: r.description ?? null,
  url: r.url,
  format: r.format ?? null,
  sizeBytes: r.size_bytes == null ? null : Number(r.size_bytes),
  language: r.language ?? "pl",
  publisher: r.publisher ?? null,
  domains: r.domains ?? [],
  year: r.year ?? null,
  signLanguage: r.sign_language ?? undefined,
  captions: r.captions ?? undefined,
  sort: r.sort ?? 0,
  published: r.published ?? true,
});

export const materialToRow = (m: Material): Row => ({
  id: m.id, slug: m.slug, kind: m.kind, title: m.title, description: m.description, url: m.url, format: m.format,
  size_bytes: m.sizeBytes, language: m.language, publisher: m.publisher, domains: m.domains, year: m.year,
  sort: m.sort, published: m.published,
});

/**
 * Część rozwiązań ma film jako zwykły adres (video_url), a karta czyta obiekt `video`. YouTube zamieniamy
 * na ten obiekt; innych serwisów karta nie osadza.
 */
function videoFromUrl(url: unknown, title: unknown): Pattern["video"] {
  if (typeof url !== "string") return null;
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  const id = host === "youtu.be" ? u.pathname.slice(1)
    : host === "youtube.com" || host === "youtube-nocookie.com"
      ? u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ?? null
      : null;
  if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
  return { youtubeId: id, title: typeof title === "string" ? title : "", thumbnailUrl: null, signLanguage: false, captions: false };
}

export const patternFromRow = (r: Row): Pattern => ({
  id: r.id,
  slug: r.slug ?? r.id,
  title: r.title,
  category: r.category ?? null,
  domains: r.domains ?? [],
  crossTopics: r.cross_topics ?? [],
  institutionTypes: r.institution_types ?? [],
  domainsAuto: !!r.domains_auto,
  innovationType: (r.innovation_type ?? null) as InnovationType | null,
  problem: r.problem ?? null,
  solution: r.solution ?? null,
  evidence: r.evidence ?? null,
  whoCanUse: r.who_can_use ?? null,
  howToUse: r.how_to_use ?? null,
  components: r.components ?? null,
  beneficiaries: r.beneficiaries ?? null,
  etrSummary: r.etr_summary ?? null,
  video: r.video
    ? {
        youtubeId: r.video.youtube_id,
        title: r.video.title,
        thumbnailUrl: r.video.thumbnail_url ?? null,
        signLanguage: !!r.video.sign_language,
        captions: !!r.video.captions,
      }
    : videoFromUrl(r.video_url, r.title),
  pdfUrl: r.pdf_url ?? null,
  materialsZip: r.materials_zip
    ? { url: r.materials_zip.url, sizeBytes: r.materials_zip.size_bytes ?? null, linkOk: r.materials_zip.link_ok !== false }
    : null,
  licenseUrl: r.license_url ?? null,
  sourceUrl: r.source_url ?? null,
  sourceName: r.source_name ?? null,
  dissemination: !!r.dissemination,
  published: r.published ?? true,
  synthetic: !!r.synthetic,
  adoptionsCount: Number(r.adoptions_count ?? 0),
  avgRating: r.avg_rating == null ? null : Number(r.avg_rating),
});

export const patternToRow = (p: Pattern): Row => ({
  id: p.id, slug: p.slug, title: p.title, category: p.category, domains: p.domains, cross_topics: p.crossTopics,
  institution_types: p.institutionTypes, domains_auto: p.domainsAuto, innovation_type: p.innovationType,
  problem: p.problem, solution: p.solution, evidence: p.evidence, who_can_use: p.whoCanUse, how_to_use: p.howToUse,
  components: p.components, beneficiaries: p.beneficiaries, etr_summary: p.etrSummary,
  video: p.video && {
    youtube_id: p.video.youtubeId, title: p.video.title, thumbnail_url: p.video.thumbnailUrl,
    sign_language: p.video.signLanguage, captions: p.video.captions,
  },
  pdf_url: p.pdfUrl,
  materials_zip: p.materialsZip && { url: p.materialsZip.url, size_bytes: p.materialsZip.sizeBytes, link_ok: p.materialsZip.linkOk },
  license_url: p.licenseUrl, source_url: p.sourceUrl, source_name: p.sourceName, dissemination: p.dissemination,
  published: p.published, synthetic: p.synthetic,
});
