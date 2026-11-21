import { EMPTY_GMINA, type GminaValue } from "@/components/gmina-field";
import { GMINA_OPTIONS } from "@/lib/gminy";
import { rememberedInitiatives } from "@/lib/initiatives/access";
import { pickSource, sourceOptions } from "@/lib/patterns";
import { createAdminClient } from "@/lib/supabase/admin";
import { TransferFlow } from "./transfer-flow";

export const metadata = { title: "Przenieś do siebie" };

/** Gmina z ostatniego zgłoszenia z tej przeglądarki, żeby nie wpisywać jej drugi raz. */
async function rememberedGmina(): Promise<GminaValue> {
  const [last] = await rememberedInitiatives();
  if (!last) return EMPTY_GMINA;
  const { data } = await createAdminClient().from("initiatives").select("teryt").eq("status_code", last.code).maybeSingle();
  const option = data?.teryt ? GMINA_OPTIONS.find((g) => g.teryt === data.teryt) : undefined;
  return option ? { text: option.nazwa, teryt: option.teryt } : EMPTY_GMINA;
}

export default async function Page(props: PageProps<"/przenies">) {
  const params = await props.searchParams;
  const [sources, gmina] = await Promise.all([
    sourceOptions().catch(() => []),
    rememberedGmina().catch(() => EMPTY_GMINA),
  ]);
  const source = pickSource({ inicjatywa: params.inicjatywa, rozwiazanie: params.rozwiazanie }, sources);

  return (
    <section className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Przenieś do siebie</h1>
        <p className="max-w-2xl text-lg">
          Wybierz inicjatywę z regionu albo sprawdzone rozwiązanie z Polski i odpowiedz na kilka pytań o swoją instytucję
          i gminę. Przygotujemy szkic planu pilotażu: co zmienić względem oryginału, kto skorzysta, jakie kroki i ile może
          to kosztować. Wszystko, czego nie wiemy na pewno, oznaczymy jako szacunek albo założenie.
        </p>
      </div>
      <TransferFlow sources={sources} gminy={GMINA_OPTIONS} initialSource={source} initialGmina={gmina} />
    </section>
  );
}
