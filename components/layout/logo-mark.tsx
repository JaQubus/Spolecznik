/**
 * Znak Społecznika: litera S z dwóch łuków, których końce to dwie połączone osoby — potrzeba i rozwiązanie.
 * Ozdoba obok nazwy (aria-hidden): dostępną nazwą linku zostaje tekst „Społecznik”. Stałe kolory (zieleń marki,
 * biały znak, kontrast 6,4:1), więc wygląda tak samo w trybie ciemnym i wysokiego kontrastu. Pliki: public/logo/.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden focusable="false" className={className}>
      <rect width="64" height="64" rx="14" fill="#1b7343" />
      <path d="M38.93 20A8 8 0 1 0 32 32A8 8 0 1 1 25.07 44" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
      <circle cx="38.93" cy="20" r="5" fill="#fff" />
      <circle cx="25.07" cy="44" r="5" fill="#fff" />
    </svg>
  );
}
