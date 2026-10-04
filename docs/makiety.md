# Makiety UX/UI — Społecznik

Kluczowe ekrany wszystkich 7 modułów z briefu, w widoku telefonu (390 px) i komputera (1440 px), ułożone według
**pętli innowacji** z README §3: potrzeba → dopasowanie → wdrożenie → próba → biblioteka, a gdy rozwiązania nie ma:
luka → pomysł → rozmowa → nabór. Przy każdym ekranie: moduł z briefu (I–VII) i decyzje dostępności.

**Demo:** <https://spolecznik.vercel.app> · **Jak przejść scenariusz:** [README, „Demo i makiety”](../README.md#demo-i-makiety)

| Moduł z briefu | W interfejsie | Ekrany |
|---|---|---|
| I. Matchmaking społeczny (obligatoryjny) | „Opisz problem”, „Sprawdź status” | [1](#1-potrzeba--dopasowanie-modu%C5%82-i) |
| VII. Middleman Innowacji | „Jak to wdrożyć u nas?” | [2](#2-jest-rozwi%C4%85zanie--wdro%C5%BCenie-modu%C5%82-vii) |
| IV. Tester innowacji | „Przetestuj rozwiązanie” | [3](#3-pr%C3%B3ba-i-ocena-modu%C5%82-iv) |
| II. Zasobnik wiedzy | „Biblioteka i wiedza” | [4](#4-biblioteka-i-wiedza-modu%C5%82-ii) |
| III. Kreator pomysłów | „Zgłoś pomysł”, wniosek | [5](#5-brak-rozwi%C4%85zania--luka--pracownia-modu%C5%82y-i-i-iii) |
| V. Platforma komunikacji | „Zapytaj eksperta” | [6](#6-rozmowy-modu%C5%82-v) |
| VI. Panel administratora | Panel ROPS | [7](#7-panel-rops-modu%C5%82-vi) |

## Skąd są zrzuty

- Generuje je skrypt Playwright: [`tests/makiety/makiety.spec.ts`](../tests/makiety/makiety.spec.ts).
  Po zmianach w UI wystarczy `bun run makiety` (lokalny serwer na :3000, razem z Panelem) albo
  `E2E_BASE_URL=https://spolecznik.vercel.app bun run makiety` (produkcja, bez Panelu). Pliki trafiają do [`docs/makiety/`](makiety/).
- Ekrany publiczne pochodzą z produkcji (`spolecznik.vercel.app`, 4.10.2026), Panel z wersji lokalnej z kontem testowym.
- **Tylko dane syntetyczne (§9 briefu).** Opis problemu to scenariusz z README §13 (postać fikcyjna), ekspert
  i nabory pochodzą z `data/seed_synthetic.py` i mają dopisek „(demo)”. Innowacje to publiczne karty Biblioteki ROPS.
- **Ekrany z odpowiedzią AI** (dopytanie, wyniki, luka, karta wdrożeniowa, asystent) mają odpowiedź podstawioną
  w skrypcie ([`fixtures.ts`](../tests/makiety/fixtures.ts)) — skrypt nie woła Groq. Układ i komponenty są prawdziwe,
  treść uzasadnień jest przykładowa.

**Wspólne dla wszystkich ekranów** (sprawdzane w `tests/e2e/screens-a11y.spec.ts`): axe bez naruszeń WCAG 2.1 AA, także
w trybie wysokiego kontrastu; przy 320 px bez przewijania w poziomie; jeden `h1` i nagłówki bez przeskoków.
Nad menu przełączniki „Większy tekst”, „Wysoki kontrast”, „Czytaj na głos” (na telefonie zwinięte w „Dostępność”).
Font Atkinson Hyperlegible, tekst od 16 px, jeden zielony przycisk na widok, ikony zawsze z podpisem.

---

## 1. Potrzeba → dopasowanie (moduł I)

### Strona startowa · I
<img src="makiety/01-start-390.jpg" width="240" alt="Strona startowa na telefonie: hasło i pole „Opisz problem”"> <img src="makiety/01-start-1440.jpg" width="560" alt="Strona startowa na komputerze">

- Jedno pole i jeden zielony przycisk: od razu wiadomo, co zrobić. Etykiety to czasowniki, bez nazw modułów.
- Link do testowania rozwiązań jest widoczny także tu, bo w menu mieści się 6 pozycji.

### Opisz problem · I
<img src="makiety/02-opisz-390.jpg" width="240" alt="Formularz „Opisz problem” z wpisanym opisem samotności seniorów"> <img src="makiety/02-opisz-1440.jpg" width="560" alt="Formularz „Opisz problem” na komputerze">

- „Opowiedz problem” — mikrofon dla osób, którym łatwiej mówić niż pisać. Transkrypcja trafia do pola, można ją poprawić.
- Mikrofon ma obrys, zielony jest tylko „Znajdź rozwiązania”. Gmina nieobowiązkowa, z podpowiedziami.
- Ostrzeżenie przed danymi osobowymi wprost pod tytułem; dane, które ktoś mimo to wpisze, ukrywamy przed wysłaniem do AI.

### Jedno pytanie doprecyzowujące · I
<img src="makiety/03-dopytanie-390.jpg" width="240" alt="Pytanie doprecyzowujące z polem odpowiedzi i przyciskiem „Pomiń pytanie”"> <img src="makiety/03-dopytanie-1440.jpg" width="560" alt="Pytanie doprecyzowujące na komputerze">

- Najwyżej jedno pytanie, zawsze z „Pomiń pytanie”. Pytanie jest etykietą pola, więc czytnik czyta je razem z polem.
- Odpowiedź też można powiedzieć głosem.

### Wyniki dopasowania · I
<img src="makiety/04-wyniki-390.jpg" width="240" alt="Trzy dopasowane rozwiązania z ocenami dopasowania i kodem zgłoszenia SPL-4K7Q"> <img src="makiety/04-wyniki-1440.jpg" width="560" alt="Wyniki dopasowania na komputerze">

- Po wynikach fokus przechodzi na nagłówek „Znaleźliśmy 3 rozwiązania”, a postęp („Szukam rozwiązań…”) jest w `aria-live`.
- Dopasowanie słowami i liczbą („Bardzo dobrze pasuje · dopasowanie 86 na 100”); pasek jest tylko ozdobą.
- „Dlaczego pasuje” i „Co dostosować u Ciebie” jako lista definicji. Przy dziesięciu wynikach nie ma dziesięciu zielonych przycisków:
  jedna akcja z obrysem, reszta jako linki.
- Kod zgłoszenia jak numer paczki (font Mono, bez liter O/0 i I/1), prywatny link do rozmowy, e-mail nieobowiązkowy.
- „Czy to pomocne?” to przyciski z `aria-pressed`, nie same ikony.

### Gdy AI nie odpowiada · I
<img src="makiety/06-ai-zajete-390.jpg" width="240" alt="Komunikat „Za dużo zapytań do AI naraz. Spróbuj ponownie za chwilę.” nad formularzem"> <img src="makiety/06-ai-zajete-1440.jpg" width="560" alt="Komunikat o zajętym AI na komputerze">

- Limit Groq (503) kończy się komunikatem, co zrobić, a nie błędem technicznym. Opis zostaje w polu, nic nie trzeba wpisywać od nowa.
- Komunikat ma `role="alert"` i dostaje fokus. Gdy padnie cała strona, `app/error.tsx` pokazuje „Coś poszło nie tak”
  z przyciskiem „Spróbuj ponownie” i linkami dalej.

### Sprawdź status · I
<img src="makiety/07-status-390.jpg" width="240" alt="Pole na kod zgłoszenia"> <img src="makiety/07-status-1440.jpg" width="560" alt="Sprawdź status na komputerze">

- Bez konta: wystarczy kod. Oś czasu zgłoszenia (`/status/SPL-…`) to lista kroków z `aria-current="step"` przy bieżącym
  i opisem słownym „(zakończone)” / „(jeszcze nie)”.

---

## 2. Jest rozwiązanie → wdrożenie (moduł VII)

### Jak to wdrożyć u nas? · VII
<img src="makiety/10-wdrozenie-390.jpg" width="240" alt="Formularz z wybranym rozwiązaniem Senior CUDER i polem gminy"> <img src="makiety/10-wdrozenie-1440.jpg" width="560" alt="Formularz wdrożenia na komputerze">

- Z wyników przychodzi z wybranym rozwiązaniem i gminą ze zgłoszenia. Zwykły `select` zamiast własnej listy — działa z każdym czytnikiem.
- Walidacja przy wysłaniu: błąd przy polu i fokus na nim, przycisk nigdy nie jest „martwy”.

### Karta wdrożeniowa · VII
<img src="makiety/11-karta-wdrozeniowa-390.jpg" width="240" alt="Karta wdrożeniowa Senior CUDER w gminie Kamienica: cel, odbiorcy, koszt, kroki, ryzyka, założenia"> <img src="makiety/11-karta-wdrozeniowa-1440.jpg" width="560" alt="Karta wdrożeniowa na komputerze">

- Koszt zawsze jako „szacunek”, a założenia w osobnej ramce „Założenia, których nie sprawdziliśmy”.
- Fokus na tytule karty po jej przygotowaniu; „Wydrukuj kartę” daje czysty wydruk (do PDF) dla rady gminy.
- Dalej w pętli: „Chcę przetestować”.

---

## 3. Próba i ocena (moduł IV)

### Przetestuj rozwiązanie · IV
<img src="makiety/20-przetestuj-390.jpg" width="240" alt="Formularz zgłoszenia testu: rozwiązanie, gmina, kto testuje, kiedy"> <img src="makiety/20-przetestuj-1440.jpg" width="560" alt="Formularz testu na komputerze">

### Ocena po teście · IV
<img src="makiety/21-ocena-390.jpg" width="240" alt="Ocena 1–5 jako opisane przyciski radiowe i pola „Co zadziałało”, „Co poprawić”"> <img src="makiety/21-ocena-1440.jpg" width="560" alt="Ocena testu na komputerze">

- Ocena to opisane przyciski radiowe w `fieldset` z `legend`, nie gwiazdki — każda wartość ma słowa.
- Jeden formularz na dwa etapy (plan testu i ocena), wybór etapu też jako radio.
- Oceny wracają do Biblioteki i wyników: „Przetestowano 4 razy, średnia ocena 4,3 na 5”.

---

## 4. Biblioteka i wiedza (moduł II)

### Start Biblioteki · II
<img src="makiety/30-biblioteka-390.jpg" width="240" alt="Biblioteka: wyszukiwarka, obszary z ikonami i podpisami"> <img src="makiety/30-biblioteka-1440.jpg" width="560" alt="Biblioteka na komputerze">

### Obszar „Seniorzy” · II
<img src="makiety/31-obszar-390.jpg" width="240" alt="Strona obszaru Seniorzy: liczby z Małopolski, innowacje, materiały"> <img src="makiety/31-obszar-1440.jpg" width="560" alt="Obszar Seniorzy na komputerze">

- Liczby prostym językiem („To prawie co czwarta osoba w regionie”), zawsze ze źródłem, stroną i rokiem danych.
- Wyzwania z Mapy Wyzwań z dopiskiem, że dane są ogólnopolskie; okruszki nad tytułem.

### Karta innowacji · II
<img src="makiety/32-innowacja-390.jpg" width="240" alt="Karta Senior CUDER: historia w 4 krokach i film"> <img src="makiety/32-innowacja-1440.jpg" width="560" alt="Karta innowacji na komputerze">

- Historia w 4 krokach: problem → rozwiązanie → skąd wiemy, że działa → jak skorzystać.
- Film ładuje się dopiero po kliknięciu (youtube-nocookie, ramka z `title`).

### Filtry · II
<img src="makiety/33-filtry-390.jpg" width="240" alt="Lista innowacji z filtrem „Dla kogo: seniorzy”"> <img src="makiety/33-filtry-1440.jpg" width="560" alt="Filtry na komputerze">

- Filtry jako zwykły formularz z przyciskiem „Pokaż wyniki”; liczba wyników w `role="status"`. Stan w adresie, więc da się go wysłać linkiem.

### Kondycja Małopolski · II
<img src="makiety/34-kondycja-390.jpg" width="240" alt="Mapa gmin Małopolski z kategoriami wskaźników"> <img src="makiety/34-kondycja-1440.jpg" width="560" alt="Kondycja Małopolski na komputerze">

- Mapa nie jest jedyną drogą: wyszukiwarka gmin (działa bez polskich znaków), tabele „5 gmin z najwyższą / najniższą wartością”.
- Po wyborze gminy fokus na nagłówku jej karty.

### Ucz się · II
<img src="makiety/35-ucz-sie-390.jpg" width="240" alt="Materiały do nauki"> <img src="makiety/35-ucz-sie-1440.jpg" width="560" alt="Ucz się na komputerze">

- Każdy materiał opisany w kilku zdaniach: dla kogo, kto wydał, rok. Link mówi, co się otworzy („Otwórz PDF”, „Przejdź na stronę ROPS”).
- W zakładce materiałów Biblioteki link podaje typ, rozmiar i język pliku („PDF, 7,7 MB, po polsku”).

---

## 5. Brak rozwiązania → luka → Pracownia (moduły I i III)

### Luka · I
<img src="makiety/05-luka-390.jpg" width="240" alt="„Nie znaleźliśmy jeszcze gotowego rozwiązania” z przyciskiem „Zgłoś pomysł”"> <img src="makiety/05-luka-1440.jpg" width="560" alt="Luka na komputerze">

- Brak wyniku to poprawny wynik: komunikat mówi, że zgłoszenie trafiło na mapę potrzeb, i daje jeden zielony krok — „Zgłoś pomysł”.
- „4 inne gminy zgłosiły podobny problem” — wejście do partnerstwa.

### Zgłoś pomysł: fiszka · III
<img src="makiety/40-pomysl-390.jpg" width="240" alt="Fiszka pomysłu: krótki opis, problem, na czym polega, dla kogo, etap"> <img src="makiety/40-pomysl-1440.jpg" width="560" alt="Fiszka na komputerze">

- Z luki fiszka jest częściowo wypełniona. Canvas INNO AGH jest schowany w `details` jako nieobowiązkowy — formularz nie przytłacza.

### Asystent sprawdza nowość · III
<img src="makiety/41-asystent-390.jpg" width="240" alt="Asystent: „Podobne rozwiązanie już działa: Senior CUDER” i lista podobnych"> <img src="makiety/41-asystent-1440.jpg" width="560" alt="Asystent na komputerze">

- Rozmowa jako lista z podpisami „Ty” / „Asystent”; odpowiedzi w `aria-live`. Gotowe pytanie „Sprawdź, czy to coś nowego” dla osób, które nie wiedzą, o co zapytać.

### Wniosek do naboru · III
<img src="makiety/42-wniosek-390.jpg" width="240" alt="„Nabór jest zamknięty”"> <img src="makiety/42-wniosek-1440.jpg" width="560" alt="Wniosek na komputerze">

- Na zrzucie stan pusty: żaden nabór nie jest otwarty, więc strona mówi to wprost i co się stanie dalej. Formularz wniosku
  pojawia się po otwarciu naboru w Panelu (ekran „Nabory” niżej).

---

## 6. Rozmowy (moduł V)

### Zapytaj eksperta · V
<img src="makiety/50-zapytaj-390.jpg" width="240" alt="Zapytaj eksperta: zgłoszenia zapamiętane na tym urządzeniu i podpowiedź, jak wrócić do rozmowy"> <img src="makiety/50-zapytaj-1440.jpg" width="560" alt="Zapytaj eksperta na komputerze">

- Bez konta: rozmowę otwiera prywatny link pokazany po wysłaniu zgłoszenia, a przeglądarka ją zapamiętuje. Ekspert odpowiada w wątku, ROPS widzi rozmowę.
- Stan pusty mówi, co zrobić dalej („Opisz problem”, „zgłoś pomysł”), zamiast pustej strony.

---

## 7. Panel ROPS (moduł VI)

### Logowanie · VI
<img src="makiety/60-logowanie-390.jpg" width="240" alt="Logowanie linkiem z e-maila albo hasłem"> <img src="makiety/60-logowanie-1440.jpg" width="560" alt="Logowanie na komputerze">

- Link z e-maila zamiast hasła; hasło schowane w `details`. Mieszkaniec nie potrzebuje konta — strona mówi to na początku.

### Zgłoszenia · VI
<img src="makiety/61-panel-390.jpg" width="240" alt="Panel: filtry statusów i lista zgłoszeń do przejrzenia"> <img src="makiety/61-panel-1440.jpg" width="560" alt="Panel zgłoszeń na komputerze">

- Dzwonek powiadomień z liczbą w nazwie przycisku, `aria-expanded`, zamyka się Esc i oddaje fokus.
- Filtry statusów jako linki z `aria-current`.

### Pomysły · VI
<img src="makiety/63-pomysly-390.jpg" width="240" alt="Lista pomysłów ze zmianą statusu"> <img src="makiety/63-pomysly-1440.jpg" width="560" alt="Pomysły na komputerze">

### Nabory · VI
<img src="makiety/64-nabory-390.jpg" width="240" alt="Nabory z przyciskiem „Otwórz nabór”"> <img src="makiety/64-nabory-1440.jpg" width="560" alt="Nabory na komputerze">

- Otwarcie naboru jednym przyciskiem; autorzy pasujących pomysłów dostają powiadomienie.

### Trendy i mapa luk · VI
<img src="makiety/65-trendy-390.jpg" width="240" alt="Trendy potrzeb: wykresy według obszaru i tabela"> <img src="makiety/65-trendy-1440.jpg" width="560" alt="Trendy i mapa luk na komputerze">

- Każdy wykres ma tabelę z tymi samymi liczbami; eksport CSV. Mapa luk mówi, w jakich obszarach otworzyć nabór.

### Wiedza (CRUD Biblioteki) · VI
<img src="makiety/66-wiedza-390.jpg" width="240" alt="Lista innowacji, obszarów i materiałów do edycji"> <img src="makiety/66-wiedza-1440.jpg" width="560" alt="Wiedza w Panelu na komputerze">

- Dodana innowacja trafia do wyszukiwarki bez programisty. Formularz z podsumowaniem błędów, które dostaje fokus.

---

## Czego jeszcze brakuje na zrzutach

Skrypt ma te ekrany, ale przy obecnych danych je pomija — wystarczy uruchomić go ponownie po zasileniu bazy:

- **Oś czasu zgłoszenia** (`08-status-os-czasu`) i **szczegóły zgłoszenia w Panelu** (`62-zgloszenie`) — potrzebują
  zgłoszeń z `data/seed_synthetic.py`; dziś w bazie są tylko testowe wpisy zespołu, których nie publikujemy.
- **Widok eksperta** (`51-ekspert`) — logowanie testowe eksperta działa tylko lokalnie.
- **Formularz wniosku** (`42-wniosek`) — po otwarciu naboru „jesienny 2026 (demo)” w Panelu.
