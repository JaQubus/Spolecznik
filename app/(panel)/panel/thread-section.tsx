import { FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupOption } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { MessageList } from "@/components/rozmowa/message-list";
import { NEED_STATUS_LABELS } from "@/lib/need-status";
import type { NeedThread, ReportKind } from "@/lib/threads";
import { ActionForm, SubmitButton } from "./action-form";
import { replyInThread } from "./actions";
import { ThreadLive } from "./thread-live";

const WHO: Record<ReportKind, { title: string; empty: string }> = {
  potrzeba: {
    title: "Rozmowa ze zgłaszającym",
    empty: "Nikt jeszcze nie napisał. Zgłaszający zobaczy Twoją wiadomość po wpisaniu kodu na stronie „Zapytaj eksperta”.",
  },
  pomysl: {
    title: "Rozmowa z autorem pomysłu",
    empty: "Nikt jeszcze nie napisał. Autor zobaczy Twoją wiadomość w rozmowie o pomyśle (strona „Zapytaj eksperta”).",
  },
};

/** Rozmowa o zgłoszeniu albo pomyśle w Panelu: wątek na żywo i odpowiedź jako ROPS albo w imieniu eksperta. */
export function ThreadSection({
  kind,
  id,
  thread,
  closed,
}: {
  kind: ReportKind;
  id: string;
  /** null, gdy rozmowy nie udało się wczytać (np. baza bez migracji 0011) — reszta strony działa dalej. */
  thread: NeedThread | null;
  closed: boolean;
}) {
  return (
    <section aria-labelledby="rozmowa" className="space-y-4">
      <h2 id="rozmowa" className="text-2xl font-bold">{WHO[kind].title}</h2>
      <ThreadLive threadId={thread?.threadId ?? null} />
      {thread?.waiting && (
        <p className="font-bold">
          {thread.waiting === "pilne"
            ? "Pilne: autor oznaczył odpowiedź asystenta jako niepomocną. Czeka na Twoją odpowiedź."
            : "Asystent przekazał pytanie — rozmowa czeka na odpowiedź człowieka."}
        </p>
      )}
      <MessageList messages={thread?.messages ?? []} empty={WHO[kind].empty} />
      {closed ? (
        <p className="text-muted-foreground">Zgłoszenie jest zamknięte — w rozmowie nie można już pisać.</p>
      ) : (
        <ActionForm action={replyInThread} className="max-w-2xl space-y-4">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="id" value={id} />
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
              Pierwsza odpowiedź zmienia status na „{NEED_STATUS_LABELS.odpowiedz}”, a rozmowa przestaje czekać na człowieka. Kontakt do instytucji możesz podać;
              nie wpisuj danych osobowych {kind === "pomysl" ? "autora" : "zgłaszającego"} ani innych osób.
            </FieldHint>
            <Textarea id="reply" name="body" required minLength={2} maxLength={2000} aria-describedby="reply-pomoc" className="min-h-24" />
          </div>
          <SubmitButton variant="outline" pendingText="Wysyłanie…">Wyślij odpowiedź</SubmitButton>
        </ActionForm>
      )}
    </section>
  );
}
