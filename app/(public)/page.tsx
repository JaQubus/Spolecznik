import { ArrowRightIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { brand, org, region } from "@/lib/brand";

const linkClass = "inline-flex min-h-12 items-center gap-2 font-bold underline decoration-1 underline-offset-4 hover:decoration-2";

/**
 * Strona startowa: pytanie z briefu kampanii i dwie drogi — zgłoszenie własnej inicjatywy (jedyny zielony
 * przycisk) albo wskazanie cudzej. „Szukam rozwiązania” i przeglądanie innowacji są drugorzędne, jako zwykłe linki.
 */
export default function Home() {
  return (
    <>
      {/* Kremowy pas pod nagłówkiem: białe pola na kremowym tle najlepiej odróżniają się od strony. */}
      <section className="full-bleed -mt-8 space-y-8 bg-secondary py-12 md:py-16">
        <div className="space-y-4">
          <p className="text-lg font-bold">{brand.name} · {org.name}</p>
          <h1 className="max-w-3xl text-4xl font-bold sm:text-5xl">
            Jak dostrzec lokalne inicjatywy, które mogą zmienić więcej?
          </h1>
          <p className="max-w-2xl text-xl">
            Szkoły, uczelnie, samorządy i instytucje publiczne {region.genitive} robią rzeczy, które warto pokazać
            i przenieść dalej. Zgłoś swoją inicjatywę albo wskaż taką, którą widzisz u siebie.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="w-full sm:w-auto"><Link href="/zglos">Zgłoś inicjatywę</Link></Button>
          <Button asChild size="lg" variant="outline" className="w-full sm:w-auto"><Link href="/wskaz">Wskaż inicjatywę</Link></Button>
        </div>
      </section>

      <section aria-labelledby="jak-to-dziala" className="mt-12 max-w-3xl space-y-4">
        <h2 id="jak-to-dziala" className="text-2xl font-bold">Co się dzieje ze zgłoszeniem</h2>
        <ol className="list-decimal space-y-2 pl-6 text-lg">
          <li>Opisujesz inicjatywę swoimi słowami — tekstem albo głosem. Jeśli czegoś brakuje, dopytamy.</li>
          <li>
            Radar porządkuje opis w kartę i ocenia potencjał według jawnych kryteriów: nowość, wpływ, dojrzałość,
            skalowalność i szanse na komercjalizację lub finansowanie.
          </li>
          <li>
            Dostajesz kod zgłoszenia, ocenę z uzasadnieniem i ścieżkę dalej: wdrożenie, komercjalizację, rozwój, ochronę
            własności intelektualnej albo upowszechnienie, razem z dopasowanymi partnerami.
          </li>
          <li>
            Zespół {org.short} weryfikuje zgłoszenie. Potem inicjatywa trafia do publicznej bazy innowacji, gdzie mogą ją
            znaleźć firmy, inwestorzy i inne instytucje, a z partnerem łączymy Cię tylko za zgodą obu stron.
          </li>
        </ol>
      </section>

      <ul className="mt-10 space-y-1">
        <li>
          <Link href="/szukam" className={linkClass}>
            Szukasz innowacji dla swojej szkoły, uczelni albo urzędu? Opisz problem <ArrowRightIcon aria-hidden className="size-5" />
          </Link>
        </li>
        <li>
          <Link href="/innowacje" className={linkClass}>
            Przeglądaj innowacje z regionu <ArrowRightIcon aria-hidden className="size-5" />
          </Link>
        </li>
        <li>
          <Link href="/status" className={linkClass}>
            Masz już kod zgłoszenia? Sprawdź status <ArrowRightIcon aria-hidden className="size-5" />
          </Link>
        </li>
      </ul>
    </>
  );
}
