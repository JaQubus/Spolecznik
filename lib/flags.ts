// Linki do modułów, których jeszcze nie ma (strony-szkielety). Włączamy je zmienną środowiskową,
// gdy moduł będzie gotowy — do tego czasu przyciski są ukryte, żeby nie prowadziły donikąd.
export const flags = {
  /** „Jak to wdrożyć u nas?” → /wdrozenie (Middleman Innowacji). */
  middleman: process.env.NEXT_PUBLIC_FLAG_MIDDLEMAN === "1",
  /** „Chcę przetestować” → /przetestuj (Tester innowacji). */
  tester: process.env.NEXT_PUBLIC_FLAG_TESTER === "1",
  /** „Moja gmina” i mapa gmin — osobne zadanie. */
  mojaGmina: process.env.NEXT_PUBLIC_FLAG_MOJA_GMINA === "1",
};
