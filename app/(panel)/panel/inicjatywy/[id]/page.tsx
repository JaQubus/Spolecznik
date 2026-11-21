import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DomainBadge } from "@/components/taxonomy/icons";
import { PathwaysSection } from "@/components/pathways/pathways-section";
import { RadarNotes, RadarTable } from "@/components/radar/radar-table";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FieldHint } from "@/components/ui/field";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupOption } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin, viewerClient } from "@/lib/auth";
import { statusLabel, STATUS_LABELS } from "@/lib/initiatives/status";
import { initiativeHref, patternHref } from "@/lib/knowledge/hrefs";
import {
  DUPLICATE_MIN, effectiveSignal, INITIATIVE_COLUMNS, initiativeCreators, initiativeHistory, initiativeNeighbours, submissionLabel,
  type AuditRow, type CreatorRow, type InitiativeRow,
} from "@/lib/panel/initiatives";
import { initiativeContacts, type ContactRequest } from "@/lib/contacts";
import { panelPartnerships, type PanelPartnership } from "@/lib/partnerships";
import { initiativePathwaySource, pathwaysFor, type PathwaysView } from "@/lib/pathways";
import { anonymize } from "@/lib/pii";
import { formatDate } from "@/lib/pl";
import { INITIATIVE_STATUSES } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  creatorRoleLabel, crossLabel, funnelLabel, innovationKindLabel, institutionLabel, ipStatusLabel, partnerKindLabel, pathwayLabel, sectorLabel,
  signalLevel, stageLabel, trlLabel,
} from "@/lib/taxonomy";
import { initiativeThread } from "@/lib/threads";
import { SimilarSources } from "@/components/sources/similar-sources";
import { SOURCE_LABELS, SOURCE_RECORD_KIND_LABELS, type SimilarSource } from "@/lib/schemas";
import { similarSources, sourceRecordOf, type SourceRecordRow } from "@/lib/sources";
import { issueClaimLink } from "../../zrodla/actions";
import { ActionForm, DeleteForm, SubmitButton } from "../../action-form";
import { assignMentor, overrideSignal, reassessRadar, removePersonalData, setCreatorConsent, setPublished, updateInitiativeStatus } from "../../actions";
import { readAssessment } from "@/lib/radar/score";
import { PartnershipSection } from "../../partnership-section";
import { proposeContact, recordPartnerAnswer, regenerateNarrative } from "../../pathway-actions";
import { ThreadSection } from "../../thread-section";
import { panelTitle } from "@/lib/brand";

export const metadata = { title: panelTitle("Inicjatywa") };

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";

export default async function Page(props: PageProps<"/panel/inicjatywy/[id]">) {
  const viewer = await requireAdmin();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await viewerClient(viewer);
  const { data, error } = await supabase.from("initiatives").select(INITIATIVE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  const row = data as unknown as InitiativeRow;

  const admin = createAdminClient();
  const [history, mentors, neighbours, matches, assigned, thread, partnerships, creators] = await Promise.all([
    initiativeHistory(id),
    initiativeNeighbours(row, "mentor", 3),
    initiativeNeighbours(row, "initiative", 5),
    supabase.from("matches").select("target_id, target_kind, fit, why").eq("initiative_id", id).order("fit", { ascending: false }),
    row.assigned_mentor
      ? admin.from("mentors").select("name").eq("id", row.assigned_mentor).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    initiativeThread({ id }).catch((e) => { console.error("[panel] rozmowa:", e); return null; }),
    panelPartnerships(id).catch((e) => { console.error("[panel] partnerstwa:", e); return [] as PanelPartnership[]; }),
    initiativeCreators(id).catch((e) => { console.error("[panel] twórcy:", e); return [] as CreatorRow[]; }),
  ]);
  // Wykryta w źródłach (7/10): rekord źródłowy i podobne rekordy z innych źródeł (sprawdzanie dublowania).
  const sourceRecord = await sourceRecordOf(id).catch((e) => { console.error("[panel] źródło:", e); return null as SourceRecordRow | null; });
  const sameInSources = await similarSources(row.card.keywords ?? [], sourceRecord?.id)
    .catch((e) => { console.error("[panel] podobne w źródłach:", e); return [] as SimilarSource[]; });
  if (matches.error) throw matches.error;
  // Ścieżki, partnerzy, prośby o kontakt i etap lejka (6/10). Baza sprzed 0009 nie ma tych kolumn — wtedy sekcja znika.
  const [pathways, contacts, funnel] = await Promise.all([
    initiativePathwaySource(id).then((src) => (src ? pathwaysFor(src) : null))
      .catch((e): PathwaysView | null => { console.error("[panel] ścieżki:", e); return null; }),
    initiativeContacts(id).catch((e): ContactRequest[] => { console.error("[panel] kontakty:", e); return []; }),
    admin.from("initiatives").select("funnel_stage").eq("id", id).maybeSingle()
      .then(({ data: f, error: fe }) => { if (fe) throw fe; return (f?.funnel_stage as string | null) ?? null; })
      .then((v) => v, (e) => { console.error("[panel] lejek:", e); return null; }),
  ]);

  const duplicateHits = neighbours.filter((n) => n.similarity >= DUPLICATE_MIN);
  const patternIds = (matches.data ?? []).filter((m) => m.target_kind === "pattern").map((m) => m.target_id as string);
  const [duplicates, patterns] = await Promise.all([
    duplicateHits.length
      ? supabase.from("initiatives").select("id, status_code, status, municipalities(name)").in("id", duplicateHits.map((d) => d.ref_id))
      : Promise.resolve({ data: [], error: null }),
    patternIds.length ? supabase.from("patterns").select("id, title, slug").in("id", patternIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const duplicateById = new Map((duplicates.data ?? []).map((d) => [d.id as string, d as unknown as { status_code: string; status: string; municipalities: { name: string } | null }]));
  const patternById = new Map((patterns.data ?? []).map((p) => [p.id as string, { title: p.title as string, href: patternHref((p.slug as string | null) ?? (p.id as string)) }]));

  const card = row.card;
  const pii = !!row.raw_text && anonymize(row.raw_text).found;
  const assignedName = assigned.data?.name as string | undefined;
  const signal = effectiveSignal(row);
  const radar = readAssessment(row.radar);
  // Jeden zielony przycisk na widok: przypisanie mentora, a gdy nie ma kogo przypisać — zapis statusu.
  const canAssign = !row.assigned_mentor && mentors.length > 0;

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
          {row.synthetic && " · dane syntetyczne"}
        </p>
        <ul className="flex flex-wrap gap-2" aria-label="Sygnał i publikacja">
          {signal != null && <li><Badge>Sygnał {signal}/100: {signalLevel(signal).label}{row.signal_override != null && " (korekta)"}</Badge></li>}
          <li><Badge variant="outline">{row.published ? "Opublikowana" : "Nieopublikowana"}</Badge></li>
          {funnel && <li><Badge variant="outline">Lejek: {funnelLabel(funnel)}</Badge></li>}
          {row.nominations_count > 0 && <li><Badge variant="outline">Wskazania: {row.nominations_count}</Badge></li>}
        </ul>
        {row.published && row.slug && (
          <p><Link href={initiativeHref(row.slug)} className={`font-bold ${linkClass}`}>Zobacz stronę publiczną</Link></p>
        )}
      </div>

      <section aria-labelledby="karta" className="space-y-3">
        <h2 id="karta" className="text-2xl font-bold">Jak zrozumiała to AI</h2>
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
          {card.institutionType && (<><dt className="font-bold">Typ instytucji</dt><dd>{institutionLabel(card.institutionType)}</dd></>)}
          {row.institutions && (<><dt className="font-bold">Instytucja</dt><dd>{row.institutions.name}</dd></>)}
          <dt className="font-bold">Jasność opisu</dt><dd>{Math.round(card.clarity * 100)} na 100</dd>
        </dl>
        <ul className="flex flex-wrap gap-2" aria-label="Dziedziny">{card.domains.map((d) => <li key={d}><DomainBadge domain={d} /></li>)}</ul>
        <TagList label="Tematy przekrojowe" items={card.cross.map(crossLabel)} />
        <TagList label="Słowa kluczowe" items={card.keywords} />
      </section>

      {sourceRecord && (
        <section aria-labelledby="zrodlo" className="space-y-3">
          <h2 id="zrodlo" className="text-2xl font-bold">Skąd ją znamy</h2>
          <dl className="grid max-w-[68ch] gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
            <dt className="font-bold">Źródło</dt>
            <dd>{SOURCE_LABELS[sourceRecord.source]}, {SOURCE_RECORD_KIND_LABELS[sourceRecord.kind]}{sourceRecord.synthetic && " (dane przykładowe)"}</dd>
            <dt className="font-bold">Rekord</dt>
            <dd>{sourceRecord.url ? <a href={sourceRecord.url} target="_blank" rel="noopener noreferrer" className={linkClass}>{sourceRecord.title}<span className="sr-only"> (otwiera się w nowej karcie)</span></a> : sourceRecord.title}</dd>
            {sourceRecord.institution && (<><dt className="font-bold">Instytucja</dt><dd>{sourceRecord.institution}</dd></>)}
            <dt className="font-bold">Licencja danych</dt><dd>{sourceRecord.license}</dd>
            {sourceRecord.classification?.reason && (<><dt className="font-bold">Dlaczego kandydatka</dt><dd>{sourceRecord.classification.reason}</dd></>)}
          </dl>
          {row.status === "detected" && (
            <ActionForm action={issueClaimLink} className="max-w-[68ch] space-y-3">
              <input type="hidden" name="initiativeId" value={row.id} />
              <FieldHint>Wyślij link twórcy albo instytucji (np. centrum transferu technologii uczelni). Po potwierdzeniu karty zgłoszenie trafi do „Do przejrzenia”.</FieldHint>
              <SubmitButton variant="outline" pendingText="Tworzenie linku…">Utwórz link do przejęcia</SubmitButton>
            </ActionForm>
          )}
        </section>
      )}

      <SimilarSources items={sameInSources} headingId="podobne-zrodla-panel"
        intro="Rekordy z patentów, publikacji i projektów, które dzielą słowa kluczowe z tą inicjatywą. Sprawdź, czy to nie to samo rozwiązanie." />

      <section aria-labelledby="ocena" className="space-y-4">
        <h2 id="ocena" className="text-2xl font-bold">Ocena radaru</h2>
        {radar ? (
          <>
            <p className="max-w-[68ch]">
              Sygnał radaru: <strong>{radar.signal}/100</strong> ({signalLevel(radar.signal).label})
              {row.signal_override != null && <>. Po korekcie zespołu: <strong>{row.signal_override}/100</strong></>}.
              {" "}<span className="text-muted-foreground">Ocenił {radar.model === "seed" ? "generator danych demo" : `model ${radar.model}`}, {formatDate(radar.assessedAt)}, metodologia {radar.methodology}.</span>
            </p>
            <RadarTable radar={radar} id="radar-panel" showRules />
            <RadarNotes radar={radar} />
          </>
        ) : (
          <p className="max-w-[68ch] text-muted-foreground">
            {row.radar ? "Ocena jest według starej metodologii. Oceń ponownie, żeby zobaczyć wymiary." : "Inicjatywa nie ma jeszcze oceny (AI mogło być zajęte przy zgłoszeniu)."}
          </p>
        )}
        <p><Link href="/metodologia" className={`font-bold ${linkClass}`}>Jak liczymy ocenę</Link></p>
        <ActionForm action={reassessRadar}>
          <input type="hidden" name="initiativeId" value={row.id} />
          <SubmitButton variant="outline" pendingText="Oceniam…">Oceń ponownie</SubmitButton>
        </ActionForm>

        <ActionForm action={overrideSignal} className="space-y-4 border-t pt-4">
          <input type="hidden" name="initiativeId" value={row.id} />
          <h3 className="text-lg font-bold">Korekta sygnału</h3>
          <div className="space-y-2">
            <Label htmlFor="signal-override">Sygnał po korekcie (0–100)</Label>
            <FieldHint id="signal-override-pomoc">Zostaw puste, żeby usunąć korektę. Na listach i stronie publicznej liczy się korekta zamiast oceny radaru.</FieldHint>
            <Input id="signal-override" name="signal" type="number" inputMode="numeric" min={0} max={100} step={1}
              defaultValue={row.signal_override ?? ""} aria-describedby="signal-override-pomoc" className="max-w-40" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signal-reason">Powód korekty</Label>
            <FieldHint id="signal-reason-pomoc">Obowiązkowy. Trafia do historii zmian, żeby każda korekta była jawna. Nie wpisuj danych osobowych.</FieldHint>
            <Textarea id="signal-reason" name="reason" required minLength={10} maxLength={1000} aria-describedby="signal-reason-pomoc" className="max-w-xl min-h-24" />
          </div>
          <SubmitButton variant="outline">Zapisz korektę</SubmitButton>
        </ActionForm>
      </section>

      <section aria-labelledby="kontakty" className="space-y-3">
        <h2 id="kontakty" className="text-2xl font-bold">Prośby o kontakt z partnerami</h2>
        <FieldHint>
          Kontakt wymaga zgody obu stron. Twórca zgadza się w swojej rozmowie, a zgodę partnera zapisujesz tutaj po rozmowie z nim.
          Po obu zgodach w rozmowie z twórcą pojawi się wiadomość o kontakcie, a lejek przejdzie na „w realizacji”.
        </FieldHint>
        {contacts.length === 0 ? (
          <p className="text-muted-foreground">Nikt jeszcze nie prosił o kontakt. Możesz go zaproponować przy partnerze niżej.</p>
        ) : (
          <ul className="max-w-[68ch] border-t">
            {contacts.map((c) => (
              <li key={c.id} className="space-y-2 border-b py-4">
                <p>
                  <span className="font-bold">{c.partnerName}</span>
                  {c.partnerKind && <span className="text-muted-foreground"> · {partnerKindLabel(c.partnerKind)}</span>}
                  {c.pathway && <span className="text-muted-foreground"> · ścieżka „{pathwayLabel(c.pathway)}”</span>}
                </p>
                <p className="text-muted-foreground">
                  {c.initiatedBy === "author" ? "Prośba twórcy" : "Propozycja zespołu"}, {formatDate(c.createdAt)}.
                  {" "}Twórca: {c.authorConsent ? "zgoda" : "bez odpowiedzi"}. Partner: {c.partnerConsent ? "zgoda" : "bez odpowiedzi"}.
                </p>
                {/* Region na żywo: po „Partner się zgodził” formularz znika razem ze swoim komunikatem, a zmianę stanu ogłasza ten wiersz. */}
                <p role="status" className="font-bold">{contactStatus(c)}</p>
                {c.status === "oczekuje" && !c.partnerConsent && (
                  <div className="flex flex-wrap gap-3">
                    <ActionForm action={recordPartnerAnswer}>
                      <input type="hidden" name="requestId" value={c.id} />
                      <input type="hidden" name="answer" value="tak" />
                      <SubmitButton variant="outline" size="sm" aria-label={`Partner się zgodził: ${c.partnerName}`}>Partner się zgodził</SubmitButton>
                    </ActionForm>
                    <ActionForm action={recordPartnerAnswer}>
                      <input type="hidden" name="requestId" value={c.id} />
                      <input type="hidden" name="answer" value="nie" />
                      <SubmitButton variant="outline" size="sm" aria-label={`Partner odmówił: ${c.partnerName}`}>Partner odmówił</SubmitButton>
                    </ActionForm>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {pathways && (
        <div className="space-y-6">
          <PathwaysSection
            view={pathways}
            audience="panel"
            size="panel"
            idPrefix="sciezki-panel"
            partnerAction={(m) => {
              const c = contacts.find((x) => x.partnerId === m.partner.id);
              if (c) return <p className="text-muted-foreground">Prośba o kontakt: {contactStatus(c).toLowerCase()}</p>;
              return (
                <ActionForm action={proposeContact} className="space-y-2">
                  <input type="hidden" name="initiativeId" value={row.id} />
                  <input type="hidden" name="partnerId" value={m.partner.id} />
                  <input type="hidden" name="pathway" value={m.pathway} />
                  <CheckboxField name="partnerAgreed" label="Partner już się zgodził" />
                  <SubmitButton variant="outline" size="sm" aria-label={`Zaproponuj kontakt: ${m.partner.name}`}>Zaproponuj kontakt</SubmitButton>
                </ActionForm>
              );
            }}
          />
          <ActionForm action={regenerateNarrative} className="space-y-2">
            <input type="hidden" name="initiativeId" value={row.id} />
            <FieldHint>
              {pathways.narrativeMeta
                ? `Uzasadnienie od AI: ${pathways.narrativeMeta.model}, ${formatDate(pathways.narrativeMeta.generatedAt)}. Po nowej ocenie radaru przygotuj je ponownie.`
                : "AI napisze uzasadnienie, kolejne kroki i dodatkowe mierniki dla ścieżek z reguł (jedno wywołanie modelu)."}
            </FieldHint>
            <SubmitButton variant="outline" pendingText="Przygotowuję…">Przygotuj uzasadnienie</SubmitButton>
          </ActionForm>
        </div>
      )}

      <section aria-labelledby="tworcy" className="space-y-3">
        <h2 id="tworcy" className="text-2xl font-bold">Twórcy</h2>
        <FieldHint>Bez danych kontaktowych: z twórcami rozmawiasz w wątku inicjatywy. Podpis jest publiczny tylko za zgodą, a u osoby poniżej 18 lat także za zgodą opiekuna.</FieldHint>
        {creators.length === 0 ? (
          <p className="text-muted-foreground">Opis nie mówi, kto to tworzy.</p>
        ) : (
          <ul className="max-w-[68ch] divide-y border-y">
            {creators.map((c, n) => (
              <li key={c.id} className="space-y-3 py-3">
                <p>
                  <span className="font-bold">{creatorRoleLabel(c.role)}</span>
                  {c.display_name && <> · {c.display_name}</>}
                  <span className="block text-muted-foreground">{creatorConsent(c)}</span>
                </p>
                <ActionForm action={setCreatorConsent} className="space-y-2">
                  <input type="hidden" name="initiativeId" value={row.id} />
                  <input type="hidden" name="creatorId" value={c.id} />
                  <Label htmlFor={`creator-name-${n}`}>Podpis (nieobowiązkowy)</Label>
                  <Input id={`creator-name-${n}`} name="displayName" defaultValue={c.display_name ?? ""} maxLength={120} className="max-w-xl" />
                  <CheckboxField name="under18" defaultChecked={c.under_18} label="Osoba poniżej 18 lat" />
                  <CheckboxField name="guardianConsent" defaultChecked={c.guardian_consent} label="Jest zgoda opiekuna" />
                  <CheckboxField name="showPublicly" defaultChecked={c.show_publicly} label="Pokaż podpis publicznie" />
                  <SubmitButton variant="outline" size="sm" aria-label={`Zapisz zgody: ${creatorRoleLabel(c.role)}`}>Zapisz zgody</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="tresc" className="space-y-3">
        <h2 id="tresc" className="text-2xl font-bold">Treść od autora</h2>
        <FieldHint>Pełną treść widzą tylko autor i administratorzy. Do AI i statystyk trafia wersja bez danych osobowych.</FieldHint>
        {row.raw_text ? (
          <p className="max-w-[68ch] rounded-[16px] bg-secondary px-5 py-4 whitespace-pre-wrap">{row.raw_text}</p>
        ) : (
          <p className="text-muted-foreground">Brak treści.</p>
        )}
        {pii && (
          <div className="space-y-3">
            <Alert title="Może zawierać dane osobowe">
              <p>W treści są numery, adresy e-mail, adresy, hasła, klucze albo numery kart. Nie przekazuj jej dalej. Jeśli nie są potrzebne, usuń je.</p>
              <p>Imion i nazwisk system nie rozpoznaje — sprawdź je ręcznie.</p>
            </Alert>
            <ActionForm action={removePersonalData} className="space-y-2">
              <input type="hidden" name="initiativeId" value={row.id} />
              <SubmitButton variant="outline" pendingText="Usuwanie…">Usuń dane osobowe z treści</SubmitButton>
            </ActionForm>
          </div>
        )}
      </section>

      <section aria-labelledby="mentor" className="space-y-3">
        <h2 id="mentor" className="text-2xl font-bold">Mentor</h2>
        {assignedName && <p>Przypisany mentor: <strong>{assignedName}</strong></p>}
        {mentors.length === 0 ? (
          <p className="text-muted-foreground">Brak sugestii — słowa kluczowe inicjatywy nie pasują do żadnego mentora.</p>
        ) : (
          <ul className="border-t">
            {mentors.map((m, i) => (
              <li key={m.ref_id} className="flex flex-wrap items-center justify-between gap-3 border-b py-4">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="font-bold">{m.title}{i === 0 && " (najlepiej pasuje)"}</p>
                  <p className="line-clamp-2 text-muted-foreground">{m.body}</p>
                  <p className="text-base text-muted-foreground">Zgodność słów kluczowych {Math.round(m.similarity * 100)} na 100</p>
                </div>
                {m.ref_id !== row.assigned_mentor && (
                  <ActionForm action={assignMentor} className="space-y-2">
                    <input type="hidden" name="initiativeId" value={row.id} />
                    <input type="hidden" name="mentorId" value={m.ref_id} />
                    <SubmitButton variant={canAssign && i === 0 ? "default" : "outline"} size={canAssign && i === 0 ? "default" : "sm"} aria-label={`Przypisz mentora: ${m.title}`}>
                      Przypisz mentora
                    </SubmitButton>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ThreadSection id={row.id} thread={thread} closed={row.status === "archived"} />

      <PartnershipSection partnerships={partnerships} initiativeId={row.id} />

      <section aria-labelledby="publikacja" className="space-y-3">
        <h2 id="publikacja" className="text-2xl font-bold">Publikacja</h2>
        <p className="max-w-[68ch]">
          {row.published
            ? "Inicjatywa jest w publicznej bazie, w API i w „Przenieś do siebie”."
            : "Inicjatywa jest prywatna: widzą ją tylko autor i zespół. Opublikuj ją po weryfikacji."}
        </p>
        <ActionForm action={setPublished}>
          <input type="hidden" name="initiativeId" value={row.id} />
          <input type="hidden" name="published" value={row.published ? "false" : "true"} />
          <SubmitButton variant="outline" pendingText="Zapisywanie…">{row.published ? "Ukryj z publicznej bazy" : "Opublikuj"}</SubmitButton>
        </ActionForm>
      </section>

      <section aria-labelledby="status" className="space-y-3">
        <h2 id="status" className="text-2xl font-bold">Status</h2>
        <ActionForm action={updateInitiativeStatus} className="space-y-6">
          <input type="hidden" name="initiativeId" value={row.id} />
          <fieldset className="space-y-2">
            <legend className="mb-2 text-lg font-bold">Nowy status</legend>
            <RadioGroup name="status" defaultValue={row.status}>
              {INITIATIVE_STATUSES.map((s) => <RadioGroupOption key={s} id={`status-${s}`} value={s} label={STATUS_LABELS[s]} />)}
            </RadioGroup>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="note">Wiadomość dla autora (nieobowiązkowa)</Label>
            <FieldHint id="note-pomoc">
              Zobaczy ją na stronie statusu po wpisaniu kodu. Możesz ją wysłać bez zmiany statusu. „Wyróżniona” publikuje inicjatywę.
              Nie wpisuj danych osobowych.
            </FieldHint>
            <Textarea id="note" name="note" maxLength={1000} aria-describedby="note-pomoc" className="max-w-xl min-h-24" />
          </div>
          <SubmitButton variant={canAssign ? "outline" : "default"}>Zapisz status</SubmitButton>
        </ActionForm>
      </section>

      {duplicateHits.length > 0 && (
        <section aria-labelledby="duplikaty" className="space-y-3">
          <h2 id="duplikaty" className="text-2xl font-bold">Możliwe duplikaty</h2>
          <ul className="border-t">
            {duplicateHits.map((d) => {
              const dup = duplicateById.get(d.ref_id);
              return (
                <li key={d.ref_id} className="grid gap-1 border-b py-4">
                  <p><Link href={`/panel/inicjatywy/${d.ref_id}`} className={`font-bold ${linkClass}`}>{d.title}</Link></p>
                  <p className="text-base text-muted-foreground">
                    {dup && <><span className="font-mono tracking-wider">{dup.status_code}</span>{" · "}</>}
                    {dup?.municipalities?.name ?? "gmina nieznana"}
                    {dup && ` · ${statusLabel(dup.status)}`}
                    {` · zgodność słów kluczowych ${Math.round(d.similarity * 100)} na 100`}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="inspiracje" className="space-y-3">
        <h2 id="inspiracje" className="text-2xl font-bold">Rozwiązania pokazane autorowi</h2>
        {(matches.data ?? []).length === 0 ? (
          <p className="text-muted-foreground">Brak dopasowanych sprawdzonych rozwiązań.</p>
        ) : (
          <ul className="border-t">
            {(matches.data ?? []).map((m) => {
              const p = patternById.get(m.target_id as string);
              return (
                <li key={m.target_id as string} className="grid gap-1 border-b py-4">
                  <p className="font-bold">{p ? <Link href={p.href} className={linkClass}>{p.title}</Link> : "Pozycja usunięta"}</p>
                  <p className="text-base text-muted-foreground">Dopasowanie {m.fit} na 100</p>
                  {m.why && <p>{m.why}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="historia" className="space-y-3">
        <h2 id="historia" className="text-2xl font-bold">Historia zmian</h2>
        {history.length === 0 ? (
          <p className="text-muted-foreground">Nikt jeszcze nie zmieniał tej inicjatywy.</p>
        ) : (
          <ol className="border-t">
            {history.map((h, i) => (
              <li key={i} className="border-b py-3">
                <span className="text-muted-foreground">{formatDate(h.created_at)}</span> · {describeChange(h)}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="usun" className="max-w-2xl space-y-3 border-t pt-8">
        <h2 id="usun" className="text-2xl font-bold">Usuń inicjatywę</h2>
        <DeleteForm
          entity="inicjatywa"
          id={row.id}
          label={`inicjatywę ${row.status_code}`}
          consequence={
            <>
              Znikną też rozmowa, dopasowania, adopcje i powiadomienia, a kod{" "}
              <span className="font-mono tracking-wider">{row.status_code}</span> przestanie działać. Używaj do zgłoszeń
              testowych i spamu — prawdziwe zgłoszenie lepiej zamknąć.
            </>
          }
        />
      </section>
    </article>
  );
}

function TagList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-base text-muted-foreground">{label}:</span>
      <ul className="flex flex-wrap gap-2" aria-label={label}>
        {items.map((t) => <li key={t}><Badge>{t}</Badge></li>)}
      </ul>
    </div>
  );
}

function describeChange(h: AuditRow): string {
  const d = h.diff ?? {};
  const note = d.note ? ` — „${d.note}”` : "";
  switch (h.action) {
    case "initiative.remove_pii": return "Usunięto dane osobowe z treści";
    case "initiative.note": return `Wiadomość dla autora${note}`;
    case "initiative.publish": return "Opublikowano";
    case "initiative.unpublish": return "Ukryto z publicznej bazy";
    case "initiative.assign_mentor": return `Przypisano mentora${note}`;
    case "initiative.radar": return `Nowa ocena radaru: sygnał ${d.from ?? "brak"} → ${d.to}`;
    case "initiative.pathways": return "Nowe uzasadnienie ścieżek od AI";
    case "initiative.contact_proposed": return `Zespół zaproponował kontakt${d.partner ? ` z: ${d.partner}` : ""}${d.partnerAgreed ? " (partner się zgodził)" : ""}`;
    case "initiative.contact_partner_consent": return `Partner zgodził się na kontakt${d.partner ? `: ${d.partner}` : ""}`;
    case "initiative.contact_declined": return `Partner odmówił kontaktu${d.partner ? `: ${d.partner}` : ""}`;
    case "initiative.contact_connected": return `Połączono z partnerem${d.partner ? `: ${d.partner}` : ""} — obie strony się zgodziły`;
    case "initiative.signal_override":
      return `${d.to == null ? "Usunięto korektę sygnału" : `Korekta sygnału: ${d.to}/100`}${d.reason ? ` — „${d.reason}”` : ""}`;
    default: return d.to ? `Status: ${statusLabel(String(d.to))}${note}` : h.action;
  }
}

/** Stan prośby o kontakt jednym zdaniem. */
function contactStatus(c: ContactRequest): string {
  if (c.status === "polaczone") return "Połączono: obie strony się zgodziły";
  if (c.status === "odrzucone") return c.declinedBy === "partner" ? "Partner odmówił" : "Twórca odmówił";
  if (!c.authorConsent) return "Czeka na zgodę twórcy";
  return "Czeka na zgodę partnera";
}

/** Stan zgód twórcy jednym zdaniem — to samo liczy widok public_initiative_creators (0007). */
function creatorConsent(c: CreatorRow): string {
  const minor = c.under_18 ? "Poniżej 18 lat. " : "";
  if (!c.show_publicly) return `${minor}Bez zgody na pokazanie: publicznie widać tylko rolę.`;
  if (c.under_18 && !c.guardian_consent) return `${minor}Brak zgody opiekuna: publicznie widać tylko rolę.`;
  return `${minor}Zgoda na pokazanie podpisu.`;
}
