// Mapowanie wierszy (snake_case z JSON-a i z Postgresa) na typy aplikacji i z powrotem.
// Pliki content/knowledge/*.json i tabele z migracji 0005 mają te same nazwy kolumn,
// z dwoma wyjątkami: fakt ma `area` w JSON-ie i `area_key` w bazie, innowacja `groups` / `target_groups`.
import type { Area, AreaKey, Fact, GroupKey, Innovation, InnovationType, Material, MaterialKind, Persona } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- surowe wiersze z JSON-a i Supabase
type Row = Record<string, any>;

export const areaFromRow = (r: Row): Area => ({
  key: r.key,
  slug: r.slug,
  name: r.name,
  icon: r.icon,
  lead: r.lead,
  definition: r.definition,
  challenges: r.challenges ?? [],
  challengesSource: r.challenges_source ?? null,
  reading: r.reading ?? [],
  personaKeys: r.persona_keys ?? [],
  sort: r.sort ?? 0,
  published: r.published ?? true,
});

export const areaToRow = (a: Area): Row => ({
  key: a.key, slug: a.slug, name: a.name, icon: a.icon, lead: a.lead, definition: a.definition,
  challenges: a.challenges, challenges_source: a.challengesSource, reading: a.reading,
  persona_keys: a.personaKeys, sort: a.sort, published: a.published,
});

export const factFromRow = (r: Row): Fact => ({
  id: r.id,
  area: (r.area_key ?? r.area) as AreaKey,
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

export const factToRow = (f: Fact, column: "area" | "area_key"): Row => ({
  id: f.id, [column]: f.area, value: f.value, unit: f.unit, display_value: f.displayValue, sentence: f.sentence,
  data_year: f.dataYear, source_title: f.sourceTitle, source_publisher: f.sourcePublisher, source_url: f.sourceUrl,
  source_year: f.sourceYear, source_page: f.sourcePage, quote: f.quote, is_example: f.isExample,
  sort: f.sort, published: f.published,
});

export const materialFromRow = (r: Row): Material => ({
  id: r.id,
  kind: r.kind as MaterialKind,
  title: r.title,
  description: r.description ?? null,
  url: r.url,
  format: r.format ?? null,
  sizeBytes: r.size_bytes == null ? null : Number(r.size_bytes),
  language: r.language ?? "pl",
  areas: r.areas ?? [],
  year: r.year ?? null,
  signLanguage: r.sign_language ?? undefined,
  captions: r.captions ?? undefined,
  sort: r.sort ?? 0,
  published: r.published ?? true,
});

export const materialToRow = (m: Material): Row => ({
  id: m.id, kind: m.kind, title: m.title, description: m.description, url: m.url, format: m.format,
  size_bytes: m.sizeBytes, language: m.language, areas: m.areas, year: m.year, sort: m.sort, published: m.published,
});

/**
 * Innowacje pipeline'u dopasowań mają film jako zwykły adres (video_url), a karta Zasobnika czyta obiekt
 * `video`. YouTube zamieniamy na ten obiekt; innych serwisów karta nie osadza.
 */
function videoFromUrl(url: unknown, title: unknown): Innovation["video"] {
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

export const innovationFromRow = (r: Row): Innovation => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  groups: (r.groups ?? r.target_groups ?? []) as GroupKey[],
  areas: r.areas ?? [],
  areasAuto: !!r.areas_auto,
  innovationType: (r.innovation_type ?? null) as InnovationType | null,
  typeAuto: !!r.type_auto,
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
  dissemination: !!r.dissemination,
  published: r.published ?? true,
  synthetic: !!r.synthetic,
  testsCount: Number(r.tests_count ?? 0),
  avgRating: r.avg_rating == null ? null : Number(r.avg_rating),
});

export const innovationToRow = (i: Innovation, groupsColumn: "groups" | "target_groups"): Row => ({
  id: i.id, slug: i.slug, title: i.title, [groupsColumn]: i.groups, areas: i.areas, areas_auto: i.areasAuto,
  innovation_type: i.innovationType, type_auto: i.typeAuto, problem: i.problem, solution: i.solution,
  evidence: i.evidence, who_can_use: i.whoCanUse, how_to_use: i.howToUse ?? null, components: i.components ?? null,
  beneficiaries: i.beneficiaries, etr_summary: i.etrSummary,
  video: i.video && {
    youtube_id: i.video.youtubeId, title: i.video.title, thumbnail_url: i.video.thumbnailUrl,
    sign_language: i.video.signLanguage, captions: i.video.captions,
  },
  pdf_url: i.pdfUrl,
  materials_zip: i.materialsZip && { url: i.materialsZip.url, size_bytes: i.materialsZip.sizeBytes, link_ok: i.materialsZip.linkOk },
  license_url: i.licenseUrl, source_url: i.sourceUrl, dissemination: i.dissemination,
  published: i.published, synthetic: i.synthetic,
});

export const personaFromRow = (r: Row): Persona => ({
  key: r.key,
  name: r.name,
  age: r.age ?? null,
  area: r.area,
  about: r.about ?? [],
  needs: r.needs ?? [],
  query: r.query,
  innovationSlugs: r.innovation_slugs ?? [],
  gap: r.gap ?? null,
});
