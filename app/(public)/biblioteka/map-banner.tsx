import { ArrowRightIcon } from "@heroicons/react/24/outline";
import Link from "next/link";

/**
 * Wejście do Kondycji Małopolski: przyciemniona mapa gmin w tle i jeden biały przycisk.
 * Pas jest zawsze ciemny (stałe kolory, nie tokeny), więc biały tekst ma kontrast w każdym motywie.
 * Cały baner klika się przez rozciągnięty link w przycisku — jeden link, jedna nazwa dla czytnika.
 */
export function MapBanner() {
  return (
    <section
      aria-labelledby="kondycja"
      className="relative isolate overflow-hidden rounded-[16px] bg-[#15181c] text-white focus-within:outline-3 focus-within:outline-offset-4 focus-within:outline-ring"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- statyczne SVG z route handlera, bez optymalizacji */}
      <img
        src="/biblioteka/kondycja/tlo.svg"
        alt=""
        className="absolute top-1/2 right-[-10%] -z-10 h-[150%] max-w-none -translate-y-1/2 opacity-45 md:right-[2%] md:h-[112%] md:opacity-60"
      />
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[#15181c] from-25% via-[#15181c]/75 to-[#15181c]/10 max-md:via-[#15181c]/85" />
      <div className="max-w-xl space-y-4 px-6 py-10 md:px-12 md:py-16">
        <h2 id="kondycja" className="text-3xl font-bold">Kondycja Małopolski</h2>
        <p className="text-lg text-white/90">
          Liczby o mieszkańcach każdej gminy i każdego powiatu: ludność, praca, pomoc społeczna, szkoły i usługi. Zobacz, jak wypada Twoja okolica.
        </p>
        <Link
          href="/biblioteka/kondycja"
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 text-lg font-bold text-[#15181c] outline-none after:absolute after:inset-0 hover:bg-white/85"
        >
          Otwórz mapę
          <ArrowRightIcon aria-hidden className="size-5 shrink-0" />
        </Link>
      </div>
    </section>
  );
}
