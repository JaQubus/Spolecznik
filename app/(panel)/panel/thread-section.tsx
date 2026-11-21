import { FieldHint } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupOption } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { MessageList } from "@/components/rozmowa/message-list";
import type { InitiativeThread } from "@/lib/threads";
import { ActionForm, SubmitButton } from "./action-form";
import { replyInThread } from "./actions";
import { ThreadLive } from "./thread-live";
import { org } from "@/lib/brand";

const EMPTY = "Nikt jeszcze nie napisał. Autor zobaczy Twoją wiadomość w rozmowie (strona „Rozmowy”).";

/** Rozmowa o inicjatywie w Panelu: wątek na żywo i odpowiedź jako zespół albo w imieniu mentora. */
export function ThreadSection({
  id,
  thread,
  closed,
}: {
  id: string;
  /** null, gdy rozmowy nie udało się wczytać — reszta strony działa dalej. */
  thread: InitiativeThread | null;
  closed: boolean;
}) {
  return (
    <section aria-labelledby="rozmowa" className="space-y-4">
      <h2 id="rozmowa" className="text-2xl font-bold">Rozmowa z autorem</h2>
      <ThreadLive threadId={thread?.threadId ?? null} />
      {thread?.waiting && (
        <p className="font-bold">
          {thread.waiting === "pilne"
            ? "Pilne: autor oznaczył odpowiedź asystenta jako niepomocną. Czeka na Twoją odpowiedź."
            : "Asystent przekazał pytanie — rozmowa czeka na odpowiedź człowieka."}
        </p>
      )}
      <MessageList messages={thread?.messages ?? []} empty={EMPTY} />
      {closed ? (
        <p className="text-muted-foreground">Zgłoszenie jest zamknięte — w rozmowie nie można już pisać.</p>
      ) : (
        <ActionForm action={replyInThread} className="max-w-2xl space-y-4">
          <input type="hidden" name="id" value={id} />
          {thread?.mentor ? (
            <fieldset className="space-y-2">
              <legend className="mb-2 text-lg font-bold">Podpis</legend>
              <RadioGroup name="as" defaultValue="staff">
                <RadioGroupOption id="as-staff" value="staff" label={org.signature} />
                <RadioGroupOption id="as-mentor" value="mentor" label={`W imieniu mentora: ${thread.mentor.name}`} />
              </RadioGroup>
            </fieldset>
          ) : (
            <input type="hidden" name="as" value="staff" />
          )}
          <div className="space-y-2">
            <Label htmlFor="reply">Odpowiedź</Label>
            <FieldHint id="reply-pomoc">
              Pierwsza odpowiedź przesuwa świeże zgłoszenie na „W analizie”, a rozmowa przestaje czekać na człowieka. Kontakt do
              instytucji możesz podać; nie wpisuj danych osobowych autora ani innych osób.
            </FieldHint>
            <Textarea id="reply" name="body" required minLength={2} maxLength={2000} aria-describedby="reply-pomoc" className="min-h-24" />
          </div>
          <SubmitButton variant="outline" pendingText="Wysyłanie…">Wyślij odpowiedź</SubmitButton>
        </ActionForm>
      )}
    </section>
  );
}
