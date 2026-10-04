import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupOption } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth";
import { NEED_STATUS_LABELS } from "@/lib/need-status";
import { DUPLICATE_MIN, NEED_COLUMNS, needHistory, needNeighbours, type AuditRow, type NeedRow } from "@/lib/panel/needs";
import { anonymize } from "@/lib/pii";
import { formatDate } from "@/lib/pl";
import { NEED_STATUSES } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { AREA_LABELS, CROSS_LABELS, GROUP_LABELS } from "@/lib/taxonomy";
import { MessageList } from "@/components/rozmowa/message-list";
import { needThread } from "@/lib/threads";
import { ActionForm, DeleteForm, SubmitButton } from "../../action-form";
import { assignExpert, removePersonalData, replyInThread, updateNeedStatus } from "../../actions";
import { ThreadLive } from "./thread-live";

export const metadata = { title: "Zgłoszenie · Panel ROPS" };

const linkClass = "underline decoration-1 underline-offset-4 hover:decoration-2";

export default async function Page(props: PageProps<"/panel/zgloszenia/[id]">) {
  await requireAdmin();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.from("needs").select(NEED_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  const need = data as unknown as NeedRow;

  const admin = createAdminClient();
  const [history, experts, neighbours, matches, assigned, thread] = await Promise.all([
    needHistory(id),
    needNeighbours(need, "ekspert", 3),
    needNeighbours(need, "potrzeba", 5),
    supabase.from("matches").select("ref_id, fit, why").eq("need_id", id).eq("kind", "innowacja").order("fit", { ascending: false }),
    need.assigned_expert
      ? admin.from("search_index").select("title").eq("kind", "ekspert").eq("ref_id", need.assigned_expert).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    // Bez migracji 0011 reszta strony ma działać dalej.
    needThread({ needId: id }).catch((e) => { console.error("[panel] rozmowa:", e); return null; }),
  ]);
  if (matches.error) throw matches.error;

  const duplicateHits = neighbours.filter((n) => n.similarity >= DUPLICATE_MIN);
  const innovationIds = (matches.data ?? []).map((m) => m.ref_id);
  const [duplicates, innovations] = await Promise.all([
    duplicateHits.length
      ? supabase.from("needs").select("id, status_code, status, gminy(nazwa)").in("id", duplicateHits.map((d) => d.ref_id))
      : Promise.resolve({ data: [], error: null }),
    innovationIds.length
      ? supabase.from("innovations").select("id, title").in("id", innovationIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const duplicateById = new Map((duplicates.data ?? []).map((d) => [d.id as string, d as unknown as { status_code: string; status: keyof typeof NEED_STATUS_LABELS; gminy: { nazwa: string } | null }]));
  const titleById = new Map((innovations.data ?? []).map((i) => [i.id as string, i.title as string]));

  const card = need.card;
  const pii = !!need.raw_text && anonymize(need.raw_text).found;
  const assignedName = assigned.data?.title as string | undefined;
  // Jeden zielony przycisk na widok: przypisanie eksperta, a gdy nie ma kogo przypisać — zapis statusu.
  const canAssign = need.status !== "ekspert" && experts.length > 0;

  return (
    <article className="max-w-4xl space-y-10">
      <div className="space-y-3">
        <Link href="/panel" className={`inline-flex items-center gap-2 text-lg font-bold ${linkClass}`}>
          <ArrowLeftIcon aria-hidden className="size-5" /> Wszystkie zgłoszenia
        </Link>
        <h1 className="text-3xl font-bold">Zgłoszenie <span className="font-mono tracking-wider">{need.status_code}</span></h1>
        <p className="text-muted-foreground">
          {need.gminy ? `${need.gminy.nazwa}, powiat ${need.gminy.powiat}` : "Gmina nieznana"}
          {" · "}{formatDate(need.created_at)}
          {" · "}<strong className="text-foreground">{NEED_STATUS_LABELS[need.status]}</strong>
          {need.synthetic && " · dane syntetyczne"}
        </p>
      </div>

      <section aria-labelledby="karta" className="space-y-3">
        <h2 id="karta" className="text-2xl font-bold">Jak zrozumiała to AI</h2>
        <p className="max-w-[68ch] text-lg">{card.summary}</p>
        <TagList label="Obszary" items={card.areas.map((a) => AREA_LABELS[a])} />
        <TagList label="Grupy" items={card.groups.map((g) => GROUP_LABELS[g])} />
        <TagList label="Tematy przekrojowe" items={card.cross.map((c) => CROSS_LABELS[c])} />
        {card.alreadyTried && <p><strong>Już próbowano:</strong> {card.alreadyTried}</p>}
      </section>

      <section aria-labelledby="tresc-zgloszenia" className="space-y-3">
        <h2 id="tresc-zgloszenia" className="text-2xl font-bold">Treść od zgłaszającego</h2>
        <FieldHint>Pełną treść widzą tylko zgłaszający i administratorzy. Do AI i statystyk trafia wersja bez danych osobowych.</FieldHint>
        {need.raw_text ? (
          <p className="max-w-[68ch] rounded-[16px] bg-secondary px-5 py-4 whitespace-pre-wrap">{need.raw_text}</p>
        ) : (
          <p className="text-muted-foreground">Brak treści.</p>
        )}
        {pii && (
          <div className="space-y-3">
            <Alert title="Może zawierać dane osobowe">
              <p>W treści są numery, adresy e-mail albo adresy. Nie przekazuj jej dalej. Jeśli nie są potrzebne, usuń je.</p>
              <p>Imion i nazwisk system nie rozpoznaje — sprawdź je ręcznie.</p>
            </Alert>
            <ActionForm action={removePersonalData} className="space-y-2">
              <input type="hidden" name="needId" value={need.id} />
              <SubmitButton variant="outline" pendingText="Usuwanie…">Usuń dane osobowe z treści</SubmitButton>
            </ActionForm>
          </div>
        )}
      </section>

      <section aria-labelledby="ekspert" className="space-y-3">
        <h2 id="ekspert" className="text-2xl font-bold">Ekspert</h2>
        {assignedName && <p>Przypisany ekspert: <strong>{assignedName}</strong></p>}
        {experts.length === 0 ? (
          <p className="text-muted-foreground">Brak sugestii — słowa kluczowe zgłoszenia nie pasują do żadnego eksperta.</p>
        ) : (
          <ul className="border-t">
            {experts.map((e, i) => (
              <li key={e.ref_id} className="flex flex-wrap items-center justify-between gap-3 border-b py-4">
                <div className="min-w-0 flex-1 basis-64">
                  <p className="font-bold">{e.title}{i === 0 && " (najlepiej pasuje)"}</p>
                  <p className="line-clamp-2 text-muted-foreground">{e.body}</p>
                  <p className="text-base text-muted-foreground">Zgodność słów kluczowych {Math.round(e.similarity * 100)} na 100</p>
                </div>
                {e.ref_id !== need.assigned_expert && (
                  <ActionForm action={assignExpert} className="space-y-2">
                    <input type="hidden" name="needId" value={need.id} />
                    <input type="hidden" name="expertId" value={e.ref_id} />
                    <SubmitButton variant={canAssign && i === 0 ? "default" : "outline"} size={canAssign && i === 0 ? "default" : "sm"} aria-label={`Przypisz eksperta: ${e.title}`}>
                      Przypisz eksperta
                    </SubmitButton>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="rozmowa" className="space-y-4">
        <h2 id="rozmowa" className="text-2xl font-bold">Rozmowa ze zgłaszającym</h2>
        <ThreadLive threadId={thread?.threadId ?? null} />
        <MessageList
          messages={thread?.messages ?? []}
          empty="Nikt jeszcze nie napisał. Zgłaszający zobaczy Twoją wiadomość po wpisaniu kodu na stronie „Zapytaj eksperta”."
        />
        {need.status === "zamkniete" ? (
          <p className="text-muted-foreground">Zgłoszenie jest zamknięte — w rozmowie nie można już pisać.</p>
        ) : (
          <ActionForm action={replyInThread} className="max-w-2xl space-y-4">
            <input type="hidden" name="needId" value={need.id} />
            {thread?.expert ? (
              <fieldset className="space-y-2">
                <legend className="mb-2 text-lg font-bold">Podpis</legend>
                <RadioGroup name="as" defaultValue="rops">
                  <RadioGroupOption id="as-rops" value="rops" label="ROPS Kraków" />
                  <RadioGroupOption id="as-ekspert" value="ekspert" label={`W imieniu eksperta: ${thread.expert.name}`} />
                </RadioGroup>
              </fieldset>
            ) : (
              <input type="hidden" name="as" value="rops" />
            )}
            <div className="space-y-2">
              <Label htmlFor="reply">Odpowiedź</Label>
              <FieldHint id="reply-pomoc">
                Pierwsza odpowiedź zmienia status na „{NEED_STATUS_LABELS.odpowiedz}”. Kontakt do instytucji możesz podać;
                nie wpisuj danych osobowych zgłaszającego ani innych osób.
              </FieldHint>
              <Textarea id="reply" name="body" required minLength={2} maxLength={2000} aria-describedby="reply-pomoc" className="min-h-24" />
            </div>
            <SubmitButton variant="outline" pendingText="Wysyłanie…">Wyślij odpowiedź</SubmitButton>
          </ActionForm>
        )}
      </section>

      <section aria-labelledby="status" className="space-y-3">
        <h2 id="status" className="text-2xl font-bold">Status</h2>
        <ActionForm action={updateNeedStatus} className="space-y-6">
          <input type="hidden" name="needId" value={need.id} />
          <fieldset className="space-y-2">
            <legend className="mb-2 text-lg font-bold">Nowy status</legend>
            <RadioGroup name="status" defaultValue={need.status}>
              {NEED_STATUSES.map((s) => (
                <RadioGroupOption key={s} id={`status-${s}`} value={s} label={NEED_STATUS_LABELS[s]} />
              ))}
            </RadioGroup>
          </fieldset>
          <div className="space-y-2">
            <Label htmlFor="note">Wiadomość dla zgłaszającego (nieobowiązkowa)</Label>
            <FieldHint id="note-pomoc">Zobaczy ją na stronie statusu po wpisaniu kodu. Możesz ją wysłać bez zmiany statusu — zastąpi wtedy poprzednią wiadomość przy tym kroku. Nie wpisuj danych osobowych.</FieldHint>
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
              const row = duplicateById.get(d.ref_id);
              return (
                <li key={d.ref_id} className="grid gap-1 border-b py-4">
                  <p>
                    <Link href={`/panel/zgloszenia/${d.ref_id}`} className={`font-bold ${linkClass}`}>{d.title}</Link>
                  </p>
                  <p className="text-base text-muted-foreground">
                    {row && <><span className="font-mono tracking-wider">{row.status_code}</span>{" · "}</>}
                    {row?.gminy?.nazwa ?? "gmina nieznana"}
                    {row && ` · ${NEED_STATUS_LABELS[row.status]}`}
                    {` · zgodność słów kluczowych ${Math.round(d.similarity * 100)} na 100`}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="rozwiazania" className="space-y-3">
        <h2 id="rozwiazania" className="text-2xl font-bold">Rozwiązania pokazane zgłaszającemu</h2>
        {(matches.data ?? []).length === 0 ? (
          <p className="text-muted-foreground">Brak dopasowań — to zgłoszenie jest na mapie luk.</p>
        ) : (
          <ul className="border-t">
            {(matches.data ?? []).map((m) => (
              <li key={m.ref_id} className="grid gap-1 border-b py-4">
                <p className="font-bold">{titleById.get(m.ref_id) ?? "Innowacja usunięta"}</p>
                <p className="text-base text-muted-foreground">Dopasowanie {m.fit} na 100</p>
                {m.why && <p>{m.why}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="historia" className="space-y-3">
        <h2 id="historia" className="text-2xl font-bold">Historia zmian</h2>
        {history.length === 0 ? (
          <p className="text-muted-foreground">Nikt jeszcze nie zmieniał tego zgłoszenia.</p>
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
        <h2 id="usun" className="text-2xl font-bold">Usuń zgłoszenie</h2>
        <DeleteForm
          entity="need"
          id={need.id}
          label={`zgłoszenie ${need.status_code}`}
          consequence={
            <>
              Znikną też rozmowa, dopasowania i powiadomienia, a kod{" "}
              <span className="font-mono tracking-wider">{need.status_code}</span> przestanie działać. Pomysły zgłoszone
              do tej potrzeby zostaną. Używaj do zgłoszeń testowych i spamu — prawdziwe zgłoszenie lepiej zamknąć.
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
  const to = d.to as keyof typeof NEED_STATUS_LABELS | undefined;
  const note = d.note ? ` — „${d.note}”` : "";
  if (h.action === "need.remove_pii") return "Usunięto dane osobowe z treści";
  if (h.action === "need.note") return `Wiadomość dla zgłaszającego${note}`;
  if (to) return `Status: ${NEED_STATUS_LABELS[to]}${note}`;
  return h.action;
}
