// Ekrany makiet w kolejności pętli innowacji (README §3) i scenariusza demo (README §13).
// live: zrzut działającej aplikacji. static: treść z ./static.mjs wstawiona do <main> strony `url`
// (stan po odpowiedzi LLM albo za logowaniem — bez wywołań Groq i bez konta).

export const FIGMA_URL = "https://www.figma.com/design/EEVUaoyAUdKOpkZviBdtaP/Untitled?node-id=0-1&t=u5tO4QMpFF54DP73-1";
export const DEMO_URL = "https://spolecznik.vercel.app";

export const MODULES = {
  I: "Matchmaking społeczny · Dopasuj",
  II: "Zasobnik wiedzy · Wiedza",
  III: "Kreator pomysłów · Pracownia",
  IV: "Tester innowacji · Próba",
  V: "Platforma komunikacji · Rozmowy",
  VI: "Panel administratora · Panel",
  VII: "Middleman Innowacji · Wdrożenie",
};

export const PATHS = {
  A: "Ścieżka A — jest rozwiązanie",
  B: "Ścieżka B — luka: nie ma rozwiązania",
  P: "Panel ROPS",
  W: "Wiedza zasila pętlę",
};

export const SCREENS = [
  { id: "start", path: "A", module: "I", title: "Strona główna", url: "/",
    what: "Jedno wejście: dwa zwykłe pola (problem, gmina) i jeden zielony przycisk „Szukaj”.",
    a11y: ["Jeden przycisk primary na widok — zieleń zawsze znaczy „następny krok”.", "Pola z etykietą nad polem, przykłady w podpowiedzi, nie w placeholderze.", "Pasek dostępności na samej górze: Większy tekst, Wysoki kontrast."] },
  { id: "opisz", path: "A", module: "I", title: "Opisz problem", url: "/opisz",
    what: "Pani Halina, sołtyska, klika „Opowiedz problem” i mówi; transkrypcję może poprawić.",
    a11y: ["Głos jako alternatywa, nie jedyna droga: pole tekstowe zawsze widoczne.", "Status nagrywania ogłaszany przez aria-live.", "Puls mikrofonu wyłączony przy prefers-reduced-motion."] },
  { id: "wyniki", path: "A", module: "I", title: "Wyniki dopasowania", url: "/opisz", static: "wyniki",
    what: "3 rozwiązania z „dlaczego pasuje” i „co dostosować”, kod zgłoszenia i 4 gminy z podobnym problemem.",
    a11y: ["Dopasowanie zawsze słowami („86 na 100”); pasek jest dekoracyjny (aria-hidden).", "Wyniki jako lista rozdzielona liniami, bez kart; w wierszu najwyżej jeden secondary.", "Region wyników aria-live, fokus przechodzi na nagłówek wyników."] },
  { id: "innowacja", path: "A", module: "II", title: "Karta innowacji", url: "/biblioteka/innowacja/senior-cuder",
    what: "Historia w 4 krokach: problem → rozwiązanie → skąd wiemy, że działa → jak skorzystać.",
    a11y: ["Tekst łatwy do czytania przy każdej innowacji.", "Nagłówki w kolejności, jeden h1.", "Linki podkreślone i pogrubione, nigdy zielone."] },
  { id: "wdrozenie", path: "A", module: "VII", title: "Jak to wdrożyć u nas?", url: "/wdrozenie?innowacja=senior-cuder",
    what: "Wójt wybiera rozwiązanie i swoją gminę.",
    a11y: ["Pole Gmina to combobox z własną listą (autocomplete=off).", "Błędy mówią, co zrobić, i są powiązane z polem (aria-describedby)."] },
  { id: "karta", path: "A", module: "VII", title: "Karta wdrożeniowa", url: "/wdrozenie?innowacja=senior-cuder", static: "karta",
    what: "Cel, odbiorcy z liczbami z BDL, forma usługi, kroki, koszt jako szacunek, partnerzy, ryzyka.",
    a11y: ["Liczby jak w mowie: „co piąta osoba ma 65+ lat”.", "Sekcja = nagłówek i proza, bez ramek.", "Założenia jawnie opisane przy każdej liczbie."] },
  { id: "przetestuj", path: "A", module: "IV", title: "Przetestuj rozwiązanie", url: "/przetestuj?innowacja=senior-cuder",
    what: "„Chcę przetestować” (kto, gdzie, kiedy), po teście ocena 1–5 i co działa, co poprawić.",
    a11y: ["Ocena jako przyciski radiowe 1–5 z opisanymi końcami — nigdy gwiazdki.", "Cały wiersz wyboru to obszar kliknięcia ≥ 48 px."] },
  { id: "luka", path: "B", module: "I", title: "Luka: brak rozwiązania", url: "/opisz", static: "luka",
    what: "Najlepsze dopasowanie 31 na 100: potrzeba trafia na Mapę luk, a użytkownik dostaje drogę do Pracowni.",
    a11y: ["Informacja to Alert na kremowym tle z ikoną i słowami, nie kolor.", "Jedyny primary: „Zgłoś pomysł”."] },
  { id: "pomysl", path: "B", module: "III", title: "Zgłoś pomysł (fiszka)", url: "/pomysl?potrzeba=SPL-5G4N",
    what: "Fiszka wypełniona opisem potrzeby z kodu SPL-5G4N.",
    a11y: ["Etykiety zawsze widoczne nad polami.", "Walidacja przy wysyłce, potem fokus na podsumowanie błędów."] },
  { id: "wniosek", path: "B", module: "III", title: "Asystent i szkic wniosku", url: "/pomysl?potrzeba=SPL-5G4N", static: "wniosek",
    what: "Asystent sprawdza nowość („Podobne już istnieje…”), generator składa szkic z checklistą kryteriów naboru.",
    a11y: ["Checklista w fieldset z legendą; zaznaczenie = ink, nie zieleń.", "Eksport przez druk do PDF — bez dodatkowych wtyczek."] },
  { id: "zapytaj", path: "B", module: "V", title: "Zapytaj eksperta", url: "/zapytaj",
    what: "Wątek przypięty do karty; podpowiedź eksperta z indeksu.",
    a11y: ["Nowe wiadomości ogłaszane przez aria-live.", "Bez limitów czasu."] },
  { id: "status-kod", path: "B", module: "V", title: "Sprawdź status", url: "/status",
    what: "Senior wpisuje kod zgłoszenia — bez zakładania konta.",
    a11y: ["Kod w kroju Atkinson Hyperlegible Mono: O i 0, I i 1 się nie mylą.", "Alfabet kodów bez znaków mylących (bez 0, O, 1, I)."] },
  { id: "status", path: "B", module: "V", title: "Status: oś czasu", url: "/status", static: "status",
    what: "Oś czasu jak śledzenie przesyłki: Zgłoszone → W analizie → Przypisano eksperta → Odpowiedź.",
    a11y: ["Stan czytelny bez koloru: ikona, waga tekstu, słowo „Teraz”.", "Bieżący krok ma aria-current=\"step\"."] },
  { id: "panel", path: "P", module: "VI", title: "Panel: zgłoszenia z triage AI", url: "/status", static: "panel",
    what: "Skrzynka zgłoszeń: obszar, duplikaty, sugerowany ekspert, ostrzeżenie o danych osobowych; przypisanie jednym kliknięciem.",
    a11y: ["Filtry jako przyciski z aria-pressed i ikoną check.", "Dane osobowe anonimizowane przed analizą AI."] },
  { id: "trendy", path: "P", module: "VI", title: "Panel: trendy i mapa luk", url: "/status", static: "trendy",
    what: "Luki wg powiatu i obszaru: „tu otwórzcie nabór”.",
    a11y: ["Dane jako tabela z nagłówkami; wykres tylko dekoracyjny.", "Liczby podane tekstem obok paska."] },
  { id: "biblioteka", path: "W", module: "II", title: "Biblioteka i wiedza", url: "/biblioteka",
    what: "Biblioteka rozwiązań: kafle ze zdjęciem i tekstem, filtry „dla kogo”.",
    a11y: ["Kafel bez ramki; cały klikalny przez jeden link w tytule.", "Filtry z ikoną i słowem."] },
  { id: "kondycja", path: "W", module: "II", title: "Kondycja Małopolski", url: "/biblioteka/kondycja",
    what: "Mapa gmin z BDL z podpisami prostym językiem.",
    a11y: ["Każda liczba z mapy dostępna też jako tekst.", "Kolor nie jest jedynym nośnikiem informacji."] },
];
