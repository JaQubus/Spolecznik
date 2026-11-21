import type { Metadata } from "next";
import Link from "next/link";
import { brand, org } from "@/lib/brand";
import { models } from "@/lib/llm";
import { QUOTE_WORD_TOLERANCE } from "@/lib/radar/score";
import {
  INNOVATION_KIND_KEYS, innovationKindLabel, RADAR, RADAR_KEYS, STAGE_KEYS, stageLabel, TRL_LEVELS, type RadarWeightsKey,
} from "@/lib/taxonomy";

export const metadata: Metadata = {
  title: "Jak oceniamy innowacje",
  description: `Metodologia radaru ${brand.nameGenitive}: wymiary oceny, kotwice, wagi dla typów innowacji, reguły i ograniczenia AI.`,
};

const link = "font-bold underline decoration-1 underline-offset-4 hover:decoration-2";
const th = "p-3 text-left";
const WEIGHT_SETS: RadarWeightsKey[] = [...INNOVATION_KIND_KEYS, "domyslne"];

/** Cała strona powstaje z config/taxonomy.json → radar, więc nie rozjedzie się z tym, jak liczy kod (lib/radar/score.ts). */
export default function Page() {
  const levels = RADAR.levels;
  return (
    <article className="max-w-4xl space-y-12">
      <header className="space-y-4">
        <h1 className="text-4xl font-bold">Jak oceniamy innowacje</h1>
        <p className="max-w-[68ch] text-xl">
          Każda zgłoszona inicjatywa dostaje wstępną ocenę w pięciu wymiarach i jeden sygnał od 0 do 100. Ocena pomaga zespołowi {org.short}
          {" "}zdecydować, czym zająć się najpierw. Nie jest wyrokiem: ostateczną decyzję zawsze podejmuje człowiek.
        </p>
        <p className="text-muted-foreground">Wersja metodologii: {RADAR.methodologyVersion}.</p>
      </header>

      <section aria-labelledby="kroki" className="space-y-4">
        <h2 id="kroki" className="text-3xl font-bold">Jak powstaje ocena</h2>
        <ol className="max-w-[68ch] list-decimal space-y-2 pl-6 text-lg">
          <li>AI zamienia opis zgłoszenia na kartę: problem, rozwiązanie, efekty, typ innowacji, etap, a dla technologii poziom TRL.</li>
          <li>AI ocenia kartę w każdym wymiarze od 0 do 5 według kotwic poniżej. Przy każdej ocenie musi przepisać fragment karty, na którym ją opiera.</li>
          <li>Program sprawdza ocenę regułami (niżej) — tych reguł AI nie może obejść.</li>
          <li>Program liczy sygnał: suma (waga × ocena / 5) × 100. Wagi zależą od typu innowacji.</li>
          <li>Zespół {org.short} weryfikuje zgłoszenie przed publikacją. Może skorygować sygnał, ale zawsze z zapisanym powodem.</li>
        </ol>
      </section>

      <section aria-labelledby="wymiary" className="space-y-4">
        <h2 id="wymiary" className="text-3xl font-bold">Wymiary i kotwice</h2>
        <p className="max-w-[68ch] text-lg">Kotwice opisują, co znaczy ocena 0, 3 i 5. Oceny 1, 2 i 4 leżą pomiędzy.</p>
        <dl className="space-y-6">
          {RADAR_KEYS.map((k) => {
            const d = RADAR.dimensions[k];
            return (
              <div key={k} className="space-y-2 border-b pb-6">
                <dt className="text-2xl font-bold">{d.label}</dt>
                <dd className="space-y-2">
                  <p className="text-lg">{d.question}</p>
                  <ul className="space-y-1">
                    {(["0", "3", "5"] as const).map((a) => (
                      <li key={a}><strong className="tabular-nums">{a} na 5:</strong> {d.anchors[a]}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section aria-labelledby="wagi" className="space-y-4">
        <h2 id="wagi" className="text-3xl font-bold">Wagi dla typów innowacji</h2>
        <p className="max-w-[68ch] text-lg">
          Innowacja nie zawsze jest produktem do sprzedania. Dla technologii większą wagę ma nowość i potencjał komercjalizacji,
          dla innowacji społecznych i edukacyjnych — wpływ na ludzi, a dla organizacyjnych i procesowych — to, czy da się je powtórzyć gdzie indziej.
        </p>
        <div role="region" aria-labelledby="wagi-caption" tabIndex={0} className="relative overflow-x-auto">
          <table className="w-full border-collapse text-base">
            <caption id="wagi-caption" className="mb-3 text-left text-muted-foreground">Waga wymiaru w sygnale, w procentach. W każdym wierszu suma to 100%.</caption>
            <thead>
              <tr className="border-b border-border-strong">
                <th scope="col" className={th}>Typ innowacji</th>
                {RADAR_KEYS.map((k) => <th key={k} scope="col" className="p-3 text-right">{RADAR.dimensions[k].short}</th>)}
              </tr>
            </thead>
            <tbody>
              {WEIGHT_SETS.map((w) => (
                <tr key={w} className="border-b border-border">
                  <th scope="row" className={`${th} font-normal`}>{w === "domyslne" ? "Typ nieznany" : innovationKindLabel(w)}</th>
                  {RADAR_KEYS.map((k) => <td key={k} className="p-3 text-right tabular-nums">{Math.round(RADAR.weights[w][k] * 100)}%</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="max-w-[68ch]">
          Poziomy sygnału:{" "}
          {levels.map((l, n) => `${l.label} od ${l.min}${n < levels.length - 1 ? "; " : "."}`).join("")}
        </p>
      </section>

      <section aria-labelledby="reguly" className="space-y-4">
        <h2 id="reguly" className="text-3xl font-bold">Reguły, których AI nie obejdzie</h2>
        <ul className="max-w-[68ch] list-disc space-y-3 pl-6 text-lg">
          <li>
            <strong>Dowód z opisu.</strong> Jeśli fragmentu, który AI podało jako podstawę oceny, nie ma w karcie, ocena liczy się
            tak, jakby opis o tym milczał. Dłuższy cytat może różnić się drobną odmianą (do {Math.round(QUOTE_WORD_TOLERANCE * 100)}% słów), parafraza nie przejdzie.
          </li>
          <li>
            <strong>Brak danych.</strong> Wymiar, o którym opis nic nie mówi, dostaje najwyżej {RADAR.noDataMax} na 5. Lepszy opis = pełniejsza ocena.
          </li>
          <li>
            <strong>Dojrzałość według etapu.</strong> Najwyższa ocena dojrzałości:{" "}
            {STAGE_KEYS.map((s) => `${stageLabel(s).toLowerCase()} ${RADAR.maturityCap[s]}`).join(", ")}.
          </li>
          <li>
            <strong>Dojrzałość według TRL</strong> (tylko innowacje technologiczne): {Object.entries(RADAR.trlMaturityCap).map(([t, c]) => `TRL ${t} → ${c}`).join(", ")}.
            {" "}Poziomy TRL: {Object.entries(TRL_LEVELS).map(([t, v]) => `${t} — ${v.description}`).join("; ")}.
          </li>
          <li>
            <strong>Przeniesiona to dowód.</strong> Inicjatywa, która działa już w innym miejscu, dostaje za skalowalność co najmniej {RADAR.transferredMinScalability}.
          </li>
          <li>
            <strong>Korekta zespołu.</strong> Zespół może zmienić sygnał po weryfikacji, ale tylko z powodem zapisanym w historii zmian.
            Na karcie inicjatywy widać, że sygnał skorygowano.
          </li>
        </ul>
      </section>

      <section aria-labelledby="ograniczenia" className="space-y-4">
        <h2 id="ograniczenia" className="text-3xl font-bold">Ograniczenia AI i dane</h2>
        <ul className="max-w-[68ch] list-disc space-y-3 pl-6 text-lg">
          <li>
            Ocenia model językowy <span className="font-mono">{models.quality}</span> uruchamiany przez Groq. Serwery Groq są poza Unią Europejską.
            Zanim tekst trafi do modelu, program maskuje numery PESEL, dowodów, kont, kart, telefony, adresy e-mail, hasła i klucze.
            Imion i nazwisk nie rozpoznaje — dlatego prosimy, żeby ich nie wpisywać.
          </li>
          <li>Model może się mylić i oceniać łagodniej albo surowiej, niż oceniłby ekspert. Ocena opiera się tylko na tym, co napisano w zgłoszeniu.</li>
          <li>Krótki albo ogólny opis daje niską pewność i niższe oceny. To nie znaczy, że pomysł jest słaby — warto go uzupełnić.</li>
          <li>Przy każdej ocenie zapisujemy wersję metodologii, model i datę. Po zmianie metodologii zgłoszenia można ocenić ponownie.</li>
          <li>Dane demonstracyjne w serwisie są syntetyczne; ich oceny przygotował generator danych według tych samych reguł i wag.</li>
        </ul>
        <p>
          Chcesz zgłosić inicjatywę? <Link href="/zglos" className={link}>Zgłoś inicjatywę</Link>.
          {" "}Dane do integracji: <Link href="/api-docs" className={link}>API dla integracji</Link>.
        </p>
      </section>
    </article>
  );
}
