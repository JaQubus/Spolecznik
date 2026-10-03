import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getViewer } from "@/lib/auth";
import { formatDate } from "@/lib/pl";
import { anonymize } from "@/lib/pii";
import { NEED_STATUSES } from "@/lib/schemas";
import { keywordSearch, similarNeeds } from "@/lib/search";
import { createAdminClient } from "@/lib/supabase/admin";
import { AREA_LABELS } from "@/lib/taxonomy";
import { setCallActive, setStatus } from "./actions";

export const metadata = { title: "Panel ROPS" };

const STATUS_LABELS: Record<string, string> = {
  zgloszone: "Zgłoszone",
  w_analizie: "W analizie",
  ekspert: "Przypisano eksperta",
  odpowiedz: "Odpowiedź",
  luka: "Luka — brak rozwiązania",
  zamkniete: "Zamknięte",
};

const selectClass = "h-12 rounded-lg border-2 border-input bg-background px-3 text-base hover:border-foreground";

type Triage = { pii: boolean; duplicates: string[]; expert: string | null };
type InboxItem = {
  kind: "potrzeba" | "pomysl";
  id: string;
  code: string;
  createdAt: string;
  summary: string;
  areas: string[];
  gmina: string | null;
  status: string;
  triage: Triage | null;
};

/** Triage AI (README §6, Panel): obszar z karty, duplikaty (zgodność słów kluczowych ≥ 90%), sugerowany ekspert, dane osobowe. */
async function triage(id: string, keywords: string[], rawText: string | null): Promise<Triage | null> {
  try {
    const [dupes, experts] = await Promise.all([similarNeeds(keywords, 0.9), keywordSearch("ekspert", keywords, 1)]);
    const others = dupes.filter((d) => d.need_id !== id).slice(0, 3);
    const codes = others.length
      ? (await createAdminClient().from("needs").select("status_code").in("id", others.map((d) => d.need_id))).data ?? []
      : [];
    return {
      pii: rawText ? anonymize(rawText).found : false,
      duplicates: codes.map((c) => c.status_code as string),
      expert: experts[0]?.title ?? null,
    };
  } catch {
    return null; // bez migracji 0005 skrzynka działa, tylko bez podpowiedzi
  }
}

async function loadInbox(): Promise<InboxItem[]> {
  const supabase = createAdminClient();
  const [needs, ideas] = await Promise.all([
    supabase.from("needs").select("id, status_code, created_at, card, raw_text, status, gminy(nazwa)")
      .neq("status", "zamkniete").order("created_at", { ascending: false }).limit(20),
    supabase.from("ideas").select("id, status_code, created_at, fiszka, status")
      .neq("status", "zamkniete").order("created_at", { ascending: false }).limit(10),
  ]);
  if (needs.error) throw needs.error;
  if (ideas.error) throw ideas.error;

  const needItems = await Promise.all((needs.data ?? []).map(async (n): Promise<InboxItem> => {
    const card = n.card as { summary?: string; areas?: string[]; keywords?: string[] };
    return {
      kind: "potrzeba",
      id: n.id,
      code: n.status_code,
      createdAt: n.created_at,
      summary: card.summary ?? "",
      areas: card.areas ?? [],
      gmina: (n.gminy as unknown as { nazwa: string } | null)?.nazwa ?? null,
      status: n.status,
      triage: await triage(n.id, card.keywords ?? [], n.raw_text),
    };
  }));
  const ideaItems: InboxItem[] = (ideas.data ?? []).map((i) => ({
    kind: "pomysl",
    id: i.id,
    code: i.status_code,
    createdAt: i.created_at,
    summary: (i.fiszka as { krotki_opis?: string }).krotki_opis ?? "",
    areas: [],
    gmina: null,
    status: i.status,
    triage: null,
  }));
  return [...needItems, ...ideaItems].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function loadCalls() {
  const { data, error } = await createAdminClient().from("calls").select("id, title, active, closes_at").order("closes_at");
  if (error) throw error;
  return data ?? [];
}

export default async function Page() {
  const viewer = await getViewer();
  if (!viewer) redirect("/logowanie?next=/panel");
  if (viewer.role !== "admin") {
    return (
      <section className="max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold">Panel ROPS</h1>
        <Alert title="Ten panel jest tylko dla pracowników ROPS">
          <p>Jesteś zalogowany jako {viewer.email}. Jeśli pracujesz w ROPS, poproś administratora o nadanie roli.</p>
        </Alert>
        <Button asChild variant="outline"><Link href="/logowanie">Twoje konto</Link></Button>
      </section>
    );
  }

  let inbox: InboxItem[] = [];
  let calls: Awaited<ReturnType<typeof loadCalls>> = [];
  let unavailable = false;
  try {
    [inbox, calls] = await Promise.all([loadInbox(), loadCalls()]);
  } catch (e) {
    console.error("[panel]", e);
    unavailable = true;
  }

  return (
    <div className="space-y-14">
      <h1 className="text-3xl font-bold">Panel ROPS</h1>
      {unavailable && (
        <Alert tone="error" title="Nie udało się pobrać danych">
          <p>Spróbuj odświeżyć stronę za chwilę.</p>
        </Alert>
      )}

      <section aria-labelledby="skrzynka" className="space-y-4">
        <h2 id="skrzynka" className="text-2xl font-bold">Nowe zgłoszenia</h2>
        {inbox.length === 0 ? (
          <p className="text-muted-foreground">Nie ma otwartych zgłoszeń.</p>
        ) : (
          <ul className="max-w-4xl divide-y border-y">
            {inbox.map((item) => (
              <li key={`${item.kind}:${item.id}`} className="grid gap-3 py-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-mono text-lg font-bold tracking-wider">{item.code}</span>
                  <span className="text-base text-muted-foreground">
                    {item.kind === "pomysl" ? "Pomysł" : "Potrzeba"} · {formatDate(item.createdAt)}
                    {item.gmina && ` · gmina ${item.gmina}`}
                  </span>
                </div>
                <p className="max-w-[68ch]">{item.summary}</p>
                {item.areas.length > 0 && (
                  <ul className="flex flex-wrap gap-2" aria-label="Obszary">
                    {item.areas.slice(0, 3).map((a) => <li key={a}><Badge>{AREA_LABELS[a as keyof typeof AREA_LABELS] ?? a}</Badge></li>)}
                  </ul>
                )}
                {item.triage && (item.triage.pii || item.triage.duplicates.length > 0 || item.triage.expert) && (
                  <ul className="list-disc space-y-1 pl-6 text-base">
                    {item.triage.pii && <li><strong>Dane osobowe w treści</strong> — zamaskowane przed AI, sprawdź oryginał.</li>}
                    {item.triage.duplicates.length > 0 && <li>Możliwy duplikat: <span className="font-mono">{item.triage.duplicates.join(", ")}</span></li>}
                    {item.triage.expert && <li>Sugerowany ekspert: {item.triage.expert}</li>}
                  </ul>
                )}
                <form action={setStatus} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="kind" value={item.kind} />
                  <input type="hidden" name="id" value={item.id} />
                  <label className="grid gap-1 text-base">
                    <span className="font-bold">Status</span>
                    <select name="status" defaultValue={item.status} className={selectClass}>
                      {NEED_STATUSES.filter((s) => item.kind === "potrzeba" || s !== "luka").map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </label>
                  <Button type="submit" variant="outline" size="sm">Zapisz status</Button>
                  <Link href={`/status/${item.code}`} className="text-base underline decoration-1 underline-offset-4 hover:decoration-2">
                    Widok dla autora
                  </Link>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="nabory" className="space-y-4">
        <h2 id="nabory" className="text-2xl font-bold">Nabory</h2>
        {calls.length === 0 ? (
          <p className="text-muted-foreground">Nie ma jeszcze naborów.</p>
        ) : (
          <ul className="max-w-4xl divide-y border-y">
            {calls.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div>
                  <p className="font-bold">{c.title}</p>
                  <p className="text-base text-muted-foreground">
                    {c.active ? "Otwarty" : "Zamknięty"}{c.closes_at && ` · wnioski do ${formatDate(c.closes_at)}`}
                  </p>
                </div>
                <form action={setCallActive}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="active" value={String(!c.active)} />
                  <Button type="submit" variant="outline" size="sm">{c.active ? "Zamknij nabór" : "Otwórz nabór"}</Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
