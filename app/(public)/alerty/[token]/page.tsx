import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { unsubscribeAlert } from "./actions";

export const metadata: Metadata = { title: "Alerty o innowacjach", robots: { index: false } };

/** Wypisanie z alertów: link z maila otwiera stronę z przyciskiem (GET niczego nie zmienia, więc skaner linków nie wypisze nikogo). */
export default async function Page(props: PageProps<"/alerty/[token]">) {
  const { token } = await props.params;
  const { wypisano } = await props.searchParams;
  return (
    <section className="max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Alerty o nowych innowacjach</h1>
      {wypisano ? (
        <Alert tone="success" title="Wypisano z alertów">Nie wyślemy już wiadomości o nowych innowacjach na ten adres.</Alert>
      ) : (
        <form action={unsubscribeAlert} className="space-y-4">
          <p className="text-lg">Potwierdź, że nie chcesz już dostawać wiadomości o nowych innowacjach.</p>
          <input type="hidden" name="token" value={token} />
          <Button type="submit">Wypisz mnie</Button>
        </form>
      )}
    </section>
  );
}
