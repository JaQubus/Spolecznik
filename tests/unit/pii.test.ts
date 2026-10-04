import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { anonymize } from "../../lib/pii.ts";

/** Każdy przypadek: [opis, wejście, oczekiwany tekst po anonimizacji]. */
type Case = [string, string, string];

function check(cases: Case[]) {
  for (const [name, input, expected] of cases) {
    test(name, () => {
      const { text, found } = anonymize(input);
      assert.equal(text, expected);
      assert.equal(found, text !== input);
    });
  }
}

describe("PESEL", () => {
  check([
    ["sam numer", "PESEL 85010112345", "PESEL [PESEL]"],
    ["w zdaniu", "mój pesel to 85010112345, proszę o pomoc", "mój pesel to [PESEL], proszę o pomoc"],
  ]);
});

describe("telefony", () => {
  check([
    ["komórka ze spacjami", "tel. 600 123 456", "tel. [TELEFON]"],
    ["komórka bez spacji", "dzwonić 600123456", "dzwonić [TELEFON]"],
    ["z kierunkowym +48", "+48 600-123-456", "[TELEFON]"],
    ["stacjonarny z nawiasem", "(12) 345 67 89", "[TELEFON]"],
    ["stacjonarny bez nawiasu", "12 345 67 89 po 16", "[TELEFON] po 16"],
  ]);
});

describe("e-maile", () => {
  check([
    ["prosty", "pisz na jan.kowalski@wp.pl", "pisz na [EMAIL]"],
    ["z plusem i cyframi", "ola+gops2024@gmina-wieliczka.pl.", "[EMAIL]."],
  ]);
});

describe("adresy", () => {
  check([
    ["ulica z numerem mieszkania", "mieszkam przy ul. Długa 5/3 w Krakowie", "mieszkam przy [ADRES] w Krakowie"],
    ["osiedle z nazwą dwuczłonową", "os. Złotego Wieku 12", "[ADRES]"],
    ["ulica od liczebnika", "kontakt: ul. 3 Maja 10", "kontakt: [ADRES]"],
    ["aleja od liczebnika", "al. 29 Listopada 46a", "[ADRES]"],
    ["ulica z cyfrą rzymską", "ul. Jana Pawła II 12", "[ADRES]"],
    ["kod pocztowy", "kod 31-123 Kraków", "kod [KOD] Kraków"],
  ]);
});

describe("inne numery identyfikujące", () => {
  check([
    ["NIP ciągiem", "NIP 6762468893", "NIP [NIP]"],
    ["NIP z kreskami", "NIP 676-246-88-93", "NIP [NIP]"],
    ["NIP z kreskami 3-2-2-3", "NIP 676-24-68-893", "NIP [NIP]"],
    ["numer konta ciągiem", "nr konta 12345678901234567890123456", "nr konta [KONTO]"],
    ["numer konta w grupach", "konto PL 12 3456 7890 1234 5678 9012 3456", "konto [KONTO]"],
    ["dowód osobisty", "dowód ABC123456", "dowód [DOWÓD]"],
    ["długi numer (REGON 14 cyfr)", "REGON 12345678901234", "REGON [NUMER]"],
  ]);
});

describe("bez danych osobowych — tekst bez zmian", () => {
  check([
    ["rok i liczba osób", "w 2023 r. 120 osób", "w 2023 r. 120 osób"],
    ["kwota", "budżet 1500000 zł", "budżet 1500000 zł"],
    ["kwota ze spacjami", "dotacja 250 000 zł na 2 lata", "dotacja 250 000 zł na 2 lata"],
    ["plac zabaw", "brakuje placu zabaw dla 30 dzieci", "brakuje placu zabaw dla 30 dzieci"],
    ["godziny i daty", "spotkania 12.05 o 16:30", "spotkania 12.05 o 16:30"],
  ]);
});
