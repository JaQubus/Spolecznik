import { MessageList } from "@/components/rozmowa/message-list";
import { ThreadLive } from "@/components/rozmowa/thread-live";
import { FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupOption } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { NEED_STATUS_LABELS } from "@/lib/need-status";
import type { ReportKind, ReportThread } from "@/lib/threads";
import { ActionForm, SubmitButton } from "./action-form";
import { replyInThread } from "./actions";

const COPY: Record<ReportKind, { heading: string; empty: string; closed: string; author: string }> = {
  potrzeba: {
    heading: "Rozmowa ze zgłaszającym",
    empty: "Nikt jeszcze nie napisał. Zgłaszający zobaczy Twoją wiadomość po wpisaniu kodu na stronie „Zapytaj eksperta”.",
    closed: "Zgłoszenie jest zamknięte — w rozmowie nie można już pisać.",
    author: "zgłaszającego",
  },
  pomysl: {
    heading: "Rozmowa z autorem pomysłu",
    empty: "Nikt jeszcze nie napisał. Autor zobaczy Twoją wiadomość w rozmowie o pomyśle, na urządzeniu, z którego go zgłosił, albo prywatnym linkiem.",
    closed: "Pomysł jest zamknięty — w rozmowie nie można już pisać.",
    author: "autora",
  },
};

/** Rozmowa w Panelu: wiadomości na żywo i odpowiedź jako ROPS albo w imieniu eksperta wątku. */
export function ThreadSection({ kind, id, thread, closed }: { kind: ReportKind; id: string; thread: ReportThread | null; closed: boolean }) {
  const copy = COPY[kind];
  return (
    <section aria-labelledby="rozmowa" className="space-y-4">
      <h2 id="rozmowa" className="text-2xl font-bold">{copy.heading}</h2>
      <ThreadLive threadId={thread?.threadId ?? null} />
      <MessageList messages={thread?.messages ?? []} empty={copy.empty} />
      {closed ? (
        <p className="text-muted-foreground">{copy.closed}</p>
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
              Pierwsza odpowiedź zmienia status na „{NEED_STATUS_LABELS.odpowiedz}”. Kontakt do instytucji możesz podać;
              nie wpisuj danych osobowych {copy.author} ani innych osób.
            </FieldHint>
            <Textarea id="reply" name="body" required minLength={2} maxLength={2000} aria-describedby="reply-pomoc" className="min-h-24" />
          </div>
          <SubmitButton variant="outline" pendingText="Wysyłanie…">Wyślij odpowiedź</SubmitButton>
        </ActionForm>
      )}
    </section>
  );
}
