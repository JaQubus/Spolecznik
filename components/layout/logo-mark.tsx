/**
 * Znak Radaru Innowacji: dwa łuki fal radaru i punkt — inicjatywa, którą radar właśnie dostrzegł.
 * Ozdoba obok nazwy (aria-hidden): dostępną nazwą linku zostaje tekst nazwy serwisu. Stałe kolory (zieleń marki,
 * biały znak, kontrast 6,4:1), więc wygląda tak samo w trybie ciemnym i wysokiego kontrastu. Pliki: public/logo/.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden focusable="false" className={className}>
      <rect width="64" height="64" rx="14" fill="#1b7343" />
      <path d="M16 48A22 22 0 0 1 38 26" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <path d="M16 36A10 10 0 0 1 26 26" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <circle cx="16" cy="48" r="4" fill="#fff" />
      <circle cx="44" cy="20" r="6" fill="#fff" />
    </svg>
  );
}
