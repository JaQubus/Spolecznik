// Bez zależności, żeby testy jednostkowe (node --test) importowały plik bezpośrednio.

/**
 * Pytania o własną sprawę: status, etap, termin, decyzję, kod zgłoszenia. Na nie asystent nigdy nie odpowiada
 * z Zasobnika — raporty o tym nie mówią, a zgadywanie terminu czy decyzji szkodzi. Sprawdzamy przed wywołaniem LLM,
 * więc nie zależy to od modelu. Lepiej przekazać za dużo niż zmyślić.
 */
const CASE_QUESTION = new RegExp(
  [
    "status", "etap", "termin", "decyzj", "rozpatr", "czeka(?:m|my|ć|cie)",
    "kiedy (?:dostan|otrzyma|będzie|ktoś|się (?:ktoś )?odezw|odpowie|rozpatrz|zajm)", "jak długo", "ile (?:jeszcze )?(?:czasu|dni|tygodni)", "spl-",
    "moje(?:go)? zgłoszeni", "mój pomysł", "mojej sprawie", "moja sprawa", "moją sprawą",
  ].map((w) => `(?<!\\p{L})${w}`).join("|"),
  "iu",
);

export function asksAboutOwnCase(text: string): boolean {
  return CASE_QUESTION.test(text);
}
