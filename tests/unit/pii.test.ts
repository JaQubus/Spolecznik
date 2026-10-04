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

describe("hasła i dane logowania", () => {
  check([
    ["hasło z dwukropkiem", "hasło: Kotek123!", "hasło: [SEKRET]"],
    ["hasło to …", "moje hasło to Kotek123!, proszę o pomoc", "moje hasło to [SEKRET], proszę o pomoc"],
    ["hasło do czegoś", "hasło do ePUAP: zima2024", "hasło do ePUAP: [SEKRET]"],
    ["hasło w cudzysłowie po dwukropku", 'hasło: "ala ma kota"', "hasło: [SEKRET]"],
    ["hasło bez dwukropka, z cyfrą", "haslo Kotek123", "haslo [SEKRET]"],
    ["password po angielsku", "password is hunter2", "password is [SEKRET]"],
    ["login i hasło", "login: jkowalski, hasło: Tajne1", "login: [SEKRET], hasło: [SEKRET]"],
    ["PIN", "PIN 4821 do karty", "PIN [SEKRET] do karty"],
    ["kod BLIK", "kod BLIK 123456", "kod BLIK [SEKRET]"],
    ["kod SMS", "kod sms to 998877", "kod sms to [SEKRET]"],
    ["CVV", "CVV: 123", "CVV: [SEKRET]"],
    ["klucz w zapytaniu", "api_key=abc123def", "api_key=[SEKRET]"],
    ["adres z loginem i hasłem", "postgres://admin:S3cret@db.example.com:5432/app", "postgres://[SEKRET]@db.example.com:5432/app"],
  ]);
});

describe("klucze i tokeny", () => {
  check([
    ["OpenAI", "klucz sk-proj-abc123XYZdef456ghi789", "klucz [KLUCZ]"],
    ["Groq", "GROQ_API_KEY gsk_abcdefghijklmnopqrstuvwxyz0123", "GROQ_API_KEY [KLUCZ]"],
    ["GitHub", "ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789", "[KLUCZ]"],
    ["AWS", "AKIAIOSFODNN7EXAMPLE", "[KLUCZ]"],
    ["Google", "AIzaSyD-abcdefghijklmnopqrstuvwxyz12345", "[KLUCZ]"],
    ["JWT", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U", "[KLUCZ]"],
    ["Bearer", "Authorization: Bearer abc.def-ghi_123", "Authorization: Bearer [KLUCZ]"],
    ["losowy ciąg po słowie kluczowym", "sekret: 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08", "sekret: [SEKRET]"],
    ["losowy ciąg bez słowa kluczowego", "wklejam 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b", "wklejam [KLUCZ]"],
    ["klucz prywatny PEM", "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg\n-----END PRIVATE KEY-----", "[KLUCZ]"],
  ]);
});

describe("karty płatnicze", () => {
  check([
    ["ze spacjami", "karta 4111 1111 1111 1111", "karta [KARTA]"],
    ["z kreskami", "4111-1111-1111-1111 ważna do 12/27", "[KARTA] ważna do 12/27"],
    ["ciągiem", "nr karty 4111111111111111", "nr karty [KARTA]"],
    ["Amex", "3782 822463 10005", "[KARTA]"],
  ]);
});

describe("bez sekretów — tekst bez zmian", () => {
  check([
    ["klucz do sukcesu", "klucz do sukcesu to współpraca", "klucz do sukcesu to współpraca"],
    ["link", "zobacz https://www.gov.pl/web/rodzina/program-wsparcia-seniorow-2024-edycja", "zobacz https://www.gov.pl/web/rodzina/program-wsparcia-seniorow-2024-edycja"],
    ["slug", "program-wsparcia-seniorow-2024-edycja-druga", "program-wsparcia-seniorow-2024-edycja-druga"],
    ["UUID", "id 3f2b8c1e-9a4d-4e6f-b7a2-1c5d8e9f0a3b", "id 3f2b8c1e-9a4d-4e6f-b7a2-1c5d8e9f0a3b"],
    ["pinezki", "pinezki 5 sztuk", "pinezki 5 sztuk"],
  ]);
});
