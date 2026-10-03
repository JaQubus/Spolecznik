"""Generator MOCKOWYCH innowacji społecznych i wniosków (formularz aplikacyjny IWS 2.0).

Wszystko tutaj jest fikcyjne: tytuły, opisy, osoby, podmioty, adresy, telefony, e-maile,
KRS/REGON/NIP. Nic nie jest kopiowane z biblioteka_all.json ani z wniosków - zgadza się
tylko struktura (pola), żeby aplikacja mogła działać na mockach zamiast danych osobowych.

Bezpieczne formaty kontaktów:
  - e-mail zawsze w domenach example.com / example.org / example.net (RFC 2606),
  - telefon zawsze "+48 000 ..." (prefiks nieprzydzielany w Polsce),
  - NIP/REGON mają poprawną sumę kontrolną (przejdą walidację), ale są losowe,
    KRS zaczyna się od "00009" - wszystkie są oznaczone jako mock.

Uruchomienie:  python scripts/generuj_mock.py  ->  dane/mock/innowacje_mock.json, wnioski_mock.json
"""
import json
import random
import unicodedata
from datetime import date, timedelta
from pathlib import Path

SEED = 42
LICZBA_WNIOSKOW = 60
WYJSCIE = Path(__file__).resolve().parent.parent / "dane" / "mock"

# --------------------------------------------------------------------------------------
# Wymyślone koncepcje innowacji (kategorie jak w bibliotece ROPS)
# tytul, kategoria, charakter, rozwiazanie, problem, grupa, kto_wdrozy, efekt
# --------------------------------------------------------------------------------------
KONCEPCJE = [
    ("Sąsiedzki Dzwonek", "Dla seniorów", "model pracy",
     "sieć sąsiedzkich wolontariuszy, którzy codziennie o stałej porze dzwonią do samotnie mieszkających seniorów i zgłaszają niepokojące sygnały do OPS",
     "samotność i brak codziennego kontaktu u osób starszych mieszkających samodzielnie, szczególnie na terenach wiejskich",
     "osoby 75+ mieszkające samotnie, bez bliskiej rodziny w okolicy",
     "ośrodki pomocy społecznej, kluby seniora, parafialne zespoły charytatywne, koła gospodyń wiejskich",
     "spadek poczucia osamotnienia mierzonego skalą De Jong Gierveld"),
    ("Pudełko Wspomnień", "Dla seniorów", "produkt",
     "zestaw tematycznych pudełek z przedmiotami codziennego użytku z lat 60.-80. do prowadzenia zajęć reminiscencyjnych",
     "ograniczona liczba prostych narzędzi do stymulacji poznawczej osób z otępieniem w opiece domowej",
     "osoby z łagodnymi zaburzeniami poznawczymi i ich opiekunowie rodzinni",
     "dzienne domy pomocy, DPS, opiekunowie rodzinni, usługi opiekuńcze",
     "poprawa nastroju i zaangażowania uczestników w trakcie zajęć"),
    ("Senior w Sieci Gminy", "Dla seniorów", "usługa",
     "dyżury cyfrowego asystenta w świetlicach wiejskich, który pomaga seniorom załatwiać sprawy urzędowe i medyczne online",
     "wykluczenie cyfrowe seniorów utrudniające dostęp do e-recept, e-wizyt i usług publicznych",
     "osoby 65+ bez umiejętności cyfrowych z małych miejscowości",
     "gminne biblioteki, centra kultury, OPS, organizacje pozarządowe",
     "liczba spraw samodzielnie załatwionych online po zakończeniu wsparcia"),
    ("Opiekun na Zmianę", "Dla seniorów", "model pracy",
     "grafik wzajemnych zastępstw między opiekunami rodzinnymi, koordynowany przez lokalnego animatora i wspierany krótkim szkoleniem",
     "przeciążenie i wypalenie opiekunów rodzinnych, którzy nie mają możliwości odpoczynku",
     "opiekunowie rodzinni osób starszych i przewlekle chorych",
     "OPS, centra usług społecznych, stowarzyszenia opiekunów",
     "liczba godzin wytchnienia uzyskanych przez opiekunów"),
    ("Mapa Ciszy", "Dla osób z niepełnosprawnością intelektualną", "aplikacja",
     "aplikacja mobilna z mapą miejsc przyjaznych sensorycznie (ciche godziny w sklepach, urzędach, przychodniach) uzupełnianą przez użytkowników",
     "przeciążenie sensoryczne utrudniające osobom w spektrum autyzmu samodzielne korzystanie z przestrzeni publicznej",
     "osoby w spektrum autyzmu i z niepełnosprawnością intelektualną oraz ich rodziny",
     "samorządy, organizacje pozarządowe, centra handlowe, instytucje kultury",
     "liczba samodzielnych wyjść użytkowników do miejsc publicznych"),
    ("Krok po Kroku do Pracy", "Dla osób z niepełnosprawnością intelektualną", "model pracy",
     "obrazkowe instrukcje stanowiskowe i trener pracy dostępny w pierwszych tygodniach zatrudnienia",
     "niska aktywność zawodowa osób z niepełnosprawnością intelektualną i szybkie rezygnacje z pracy",
     "dorosłe osoby z niepełnosprawnością intelektualną w stopniu lekkim i umiarkowanym",
     "WTZ, ZAZ, pracodawcy, powiatowe urzędy pracy",
     "odsetek osób utrzymujących zatrudnienie po 3 miesiącach"),
    ("Moje Mieszkanie, Mój Plan", "Dla osób z niepełnosprawnością intelektualną", "produkt",
     "zestaw kart i plansz do nauki samodzielnego prowadzenia gospodarstwa domowego w mieszkaniach treningowych",
     "brak przygotowania do samodzielnego życia osób opuszczających placówki całodobowe",
     "mieszkańcy mieszkań treningowych i wspomaganych",
     "mieszkania treningowe, ŚDS, DPS realizujące deinstytucjonalizację",
     "przyrost samodzielności w codziennych czynnościach"),
    ("Głośny Przystanek", "Dla osób z niepełnosprawnością sensoryczną", "rozwiązanie technologiczne",
     "niskokosztowa nakładka na rozkład jazdy odczytująca na żądanie odjazdy autobusów po zbliżeniu telefonu",
     "brak dostępnej informacji pasażerskiej na przystankach poza dużymi miastami",
     "osoby niewidome i słabowidzące korzystające z komunikacji publicznej",
     "gminy, przewoźnicy, zarządy dróg",
     "liczba samodzielnych podróży zgłoszonych przez testerów"),
    ("Migowy Urząd", "Dla osób z niepełnosprawnością sensoryczną", "usługa",
     "wideotłumacz PJM dostępny z tabletu w okienku urzędu gminy bez wcześniejszej rezerwacji",
     "bariery komunikacyjne osób głuchych w kontaktach z małymi urzędami",
     "osoby głuche i słabosłyszące posługujące się PJM",
     "urzędy gmin, starostwa, OPS, przychodnie",
     "czas załatwienia sprawy i ocena satysfakcji użytkowników"),
    ("Dotykowy Przewodnik", "Dla osób z niepełnosprawnością sensoryczną", "produkt",
     "wydruki 3D lokalnych zabytków z opisem w brajlu i audiodeskrypcją dostępną przez kod QR",
     "ograniczony dostęp osób niewidomych do oferty turystycznej i kulturalnej regionu",
     "osoby niewidome i słabowidzące, w tym dzieci w wieku szkolnym",
     "muzea, centra informacji turystycznej, szkoły",
     "liczba odwiedzin instytucji przez osoby z niepełnosprawnością wzroku"),
    ("Kawa bez Słów", "Dla osób z niepełnosprawnością sensoryczną", "model pracy",
     "cykl spotkań integracyjnych w kawiarniach, w których obsługa i goście uczą się podstaw PJM",
     "izolacja społeczna osób głuchych w małych miejscowościach",
     "osoby głuche, ich rodziny i lokalna społeczność",
     "kawiarnie, domy kultury, organizacje osób głuchych",
     "liczba nowych kontaktów społecznych uczestników"),
    ("Podjazd na Telefon", "Dla osób o ograniczonej mobilności", "usługa",
     "wypożyczalnia mobilnych ramp z dowozem na żądanie, zamawiana przez SMS lub formularz",
     "bariery architektoniczne w starych budynkach uniemożliwiające udział w wydarzeniach",
     "osoby poruszające się na wózkach i z balkonikami",
     "OPS, centra wolontariatu, organizatorzy wydarzeń, wspólnoty mieszkaniowe",
     "liczba wydarzeń, w których uczestniczyli użytkownicy"),
    ("Wspólny Kurs", "Dla osób o ograniczonej mobilności", "model pracy",
     "gminny system współdzielonych przejazdów door-to-door łączący kursy do lekarza, urzędu i na zakupy",
     "wykluczenie transportowe osób z ograniczoną mobilnością na terenach wiejskich",
     "osoby z niepełnosprawnością ruchową i seniorzy bez dostępu do samochodu",
     "gminy, OPS, organizacje pozarządowe, przewoźnicy lokalni",
     "liczba zrealizowanych przejazdów i koszt jednego kursu"),
    ("Ogród na Wysokości", "Dla osób o ograniczonej mobilności", "produkt",
     "modułowe podwyższone grządki z dostępem dla wózka, do montażu na terenie placówek i osiedli",
     "brak dostępnych form aktywności na świeżym powietrzu dla osób na wózkach",
     "osoby poruszające się na wózkach, uczestnicy ŚDS i DDP",
     "spółdzielnie mieszkaniowe, ŚDS, DPS, szkoły specjalne",
     "regularność udziału w zajęciach ogrodniczych"),
    ("Ręka na Klamce", "Dla osób o ograniczonej mobilności", "rozwiązanie technologiczne",
     "otwarty projekt taniego otwieracza drzwi sterowanego przyciskiem, do samodzielnego montażu",
     "brak samodzielności osób z niedowładem kończyn we własnym mieszkaniu",
     "osoby z niedowładem kończyn górnych mieszkające samodzielnie",
     "warsztaty terapii zajęciowej, fablaby, organizacje pozarządowe",
     "liczba czynności wykonywanych bez pomocy osób trzecich"),
    ("Rodzinne Popołudnia", "Dla dzieci, młodzieży i rodziny", "model pracy",
     "cotygodniowe warsztaty dla rodziców i dzieci w świetlicach, oparte na wspólnym gotowaniu i grach",
     "osłabione więzi rodzinne i niska kompetencja wychowawcza w rodzinach objętych wsparciem asystenta",
     "rodziny z dziećmi w wieku 6-12 lat przeżywające trudności opiekuńczo-wychowawcze",
     "placówki wsparcia dziennego, asystenci rodziny, OPS",
     "zmiana wyników w skali kompetencji rodzicielskich"),
    ("Starszy Brat, Starsza Siostra", "Dla dzieci, młodzieży i rodziny", "model pracy",
     "program mentoringu, w którym studenci wspierają wychowanków pieczy zastępczej w nauce i planowaniu przyszłości",
     "słabe przygotowanie usamodzielniających się wychowanków pieczy zastępczej do dorosłości",
     "wychowankowie pieczy zastępczej w wieku 14-18 lat",
     "PCPR, placówki opiekuńczo-wychowawcze, uczelnie",
     "odsetek uczestników kontynuujących naukę po 18 roku życia"),
    ("Kieszonkowy Budżet", "Dla dzieci, młodzieży i rodziny", "aplikacja",
     "gra mobilna ucząca nastolatków planowania wydatków na podstawie realnych scenariuszy usamodzielnienia",
     "niska edukacja finansowa młodzieży z rodzin zagrożonych ubóstwem",
     "młodzież 13-18 lat z rodzin korzystających z pomocy społecznej",
     "szkoły, świetlice środowiskowe, PCPR",
     "wynik testu wiedzy finansowej przed i po grze"),
    ("Bezpieczny Przystanek", "Dla dzieci, młodzieży i rodziny", "usługa",
     "dyżury psychologa w formie czatu dla młodzieży, prowadzone w godzinach wieczornych w lokalnej świetlicy i online",
     "ograniczony dostęp do wsparcia psychologicznego dla młodzieży w kryzysie poza dużymi miastami",
     "młodzież 12-19 lat w kryzysie emocjonalnym",
     "poradnie psychologiczno-pedagogiczne, organizacje pozarządowe, szkoły",
     "liczba skutecznych przekierowań do specjalistycznej pomocy"),
    ("Tata w Akcji", "Dla dzieci, młodzieży i rodziny", "model pracy",
     "grupy wsparcia i warsztaty dla ojców, prowadzone przez ojców-liderów w weekendy",
     "marginalizacja roli ojców w programach wsparcia rodziny",
     "ojcowie z rodzin objętych pracą socjalną",
     "OPS, centra usług społecznych, parafie, kluby sportowe",
     "czas spędzany przez ojców z dziećmi deklarowany w ankiecie"),
    ("Dzień Dobry po Polsku", "Dla cudzoziemców", "produkt",
     "obrazkowy zestaw fiszek z najważniejszymi zwrotami do przychodni, szkoły i urzędu, w kilku językach",
     "bariera językowa utrudniająca cudzoziemcom korzystanie z podstawowych usług",
     "cudzoziemcy w pierwszym roku pobytu, w tym rodziny z dziećmi",
     "szkoły, przychodnie, OPS, organizacje pomocowe",
     "liczba wizyt odbytych bez tłumacza"),
    ("Sąsiad z Daleka", "Dla cudzoziemców", "model pracy",
     "parowanie rodzin cudzoziemskich z lokalnymi rodzinami-przewodnikami na pierwsze pół roku pobytu",
     "izolacja i brak sieci wsparcia cudzoziemców w nowym miejscu zamieszkania",
     "rodziny cudzoziemców osiedlające się w mniejszych miejscowościach",
     "gminy, parafie, stowarzyszenia, szkoły",
     "liczba relacji utrzymanych po zakończeniu programu"),
    ("Pierwszy Etat", "Dla rynku pracy", "usługa",
     "krótkie, płatne staże próbne u lokalnych pracodawców poprzedzone tygodniowym przygotowaniem",
     "długotrwałe bezrobocie i utrata nawyków pracowniczych",
     "osoby bezrobotne powyżej 12 miesięcy, w tym 50+",
     "PUP, CIS, KIS, lokalni przedsiębiorcy",
     "odsetek uczestników zatrudnionych po zakończeniu stażu"),
    ("Spółdzielnia Smaku", "Dla rynku pracy", "model pracy",
     "przedsiębiorstwo społeczne prowadzące catering na bazie lokalnych produktów, zatrudniające osoby po kryzysach",
     "brak miejsc pracy dla osób zagrożonych wykluczeniem po zakończeniu reintegracji",
     "absolwenci CIS i KIS, osoby po kryzysie bezdomności i uzależnieniu",
     "przedsiębiorstwa społeczne, gminy, CIS, OWES",
     "liczba miejsc pracy utrzymanych przez 12 miesięcy"),
    ("Ciepły Kąt", "Dla osób w kryzysie bezdomności", "usługa",
     "mobilny punkt z prysznicem, pralnią i konsultacjami, krążący po mniejszych miejscowościach powiatu",
     "brak podstawowej infrastruktury higienicznej i wsparcia dla osób w kryzysie bezdomności poza miastami",
     "osoby w kryzysie bezdomności i zagrożone bezdomnością",
     "OPS, organizacje pomocowe, schroniska, gminy",
     "liczba osób, które podjęły dalsze wsparcie po kontakcie z punktem"),
    ("Klucz na Start", "Dla osób w kryzysie bezdomności", "model pracy",
     "model „najpierw mieszkanie” w małej skali, z gminnym lokalem i wsparciem streetworkera",
     "powracanie osób do bezdomności po pobycie w schroniskach",
     "osoby w długotrwałym kryzysie bezdomności",
     "gminy, TBS, OPS, organizacje pozarządowe",
     "odsetek osób utrzymujących mieszkanie po 6 miesiącach"),
    ("Zdrowie na Kółkach", "Dla zdrowia i medycyny", "usługa",
     "objazdowy punkt badań przesiewowych i edukacji zdrowotnej w sołectwach bez przychodni",
     "niska zgłaszalność na badania profilaktyczne mieszkańców obszarów wiejskich",
     "mieszkańcy wsi powyżej 50 roku życia",
     "gminy, POZ, organizacje pacjentów, koła gospodyń wiejskich",
     "liczba osób skierowanych na dalszą diagnostykę"),
    ("Apteczka Pamięci", "Dla zdrowia i medycyny", "produkt",
     "dozownik leków z sygnałem świetlnym i dźwiękowym oraz prostym dziennikiem dawek dla opiekuna",
     "błędy w przyjmowaniu leków przez seniorów leczonych wieloma lekami",
     "seniorzy przyjmujący co najmniej 5 leków dziennie",
     "usługi opiekuńcze, apteki, POZ, opiekunowie rodzinni",
     "liczba pominiętych dawek w okresie testu"),
    ("Głowa do Góry", "Dla zdrowia i medycyny", "model pracy",
     "grupy wsparcia prowadzone przez przeszkolonych liderów-rówieśników dla osób po kryzysie psychicznym",
     "długie oczekiwanie na wsparcie psychiatryczne i nawroty kryzysów",
     "dorośli po pierwszym epizodzie kryzysu psychicznego",
     "centra zdrowia psychicznego, ŚDS, organizacje pozarządowe",
     "liczba ponownych hospitalizacji w okresie testu"),
]

POWIATY = {  # powiat -> (miejscowości, kod pocztowy prefiks)
    "powiat bocheński": (["Bochnia", "Nowy Wiśnicz", "Łapanów"], "32-7"),
    "powiat brzeski": (["Brzesko", "Czchów", "Borzęcin"], "32-8"),
    "powiat chrzanowski": (["Chrzanów", "Trzebinia", "Libiąż"], "32-5"),
    "powiat dąbrowski": (["Dąbrowa Tarnowska", "Żabno", "Szczucin"], "33-2"),
    "powiat gorlicki": (["Gorlice", "Biecz", "Bobowa"], "38-3"),
    "powiat krakowski": (["Skawina", "Krzeszowice", "Słomniki"], "32-0"),
    "powiat limanowski": (["Limanowa", "Mszana Dolna", "Tymbark"], "34-6"),
    "powiat m. Kraków": (["Kraków"], "31-"),
    "powiat m. Nowy Sącz": (["Nowy Sącz"], "33-3"),
    "powiat m. Tarnów": (["Tarnów"], "33-1"),
    "powiat miechowski": (["Miechów", "Książ Wielki", "Charsznica"], "32-2"),
    "powiat myślenicki": (["Myślenice", "Dobczyce", "Sułkowice"], "32-4"),
    "powiat nowosądecki": (["Stary Sącz", "Krynica-Zdrój", "Grybów"], "33-3"),
    "powiat nowotarski": (["Nowy Targ", "Rabka-Zdrój", "Szczawnica"], "34-4"),
    "powiat olkuski": (["Olkusz", "Bukowno", "Wolbrom"], "32-3"),
    "powiat oświęcimski": (["Oświęcim", "Kęty", "Brzeszcze"], "32-6"),
    "powiat proszowicki": (["Proszowice", "Koniusza", "Nowe Brzesko"], "32-1"),
    "powiat suski": (["Sucha Beskidzka", "Maków Podhalański", "Jordanów"], "34-2"),
    "powiat tarnowski": (["Tuchów", "Ryglice", "Wojnicz"], "33-1"),
    "powiat tatrzański": (["Zakopane", "Bukowina Tatrzańska", "Poronin"], "34-5"),
    "powiat wadowicki": (["Wadowice", "Andrychów", "Kalwaria Zebrzydowska"], "34-1"),
    "powiat wielicki": (["Wieliczka", "Niepołomice", "Gdów"], "32-0"),
}

IMIONA_K = ["Anna", "Katarzyna", "Magdalena", "Agnieszka", "Joanna", "Monika", "Ewa", "Aleksandra",
            "Natalia", "Karolina", "Barbara", "Marta", "Justyna", "Zofia", "Weronika", "Dorota"]
IMIONA_M = ["Piotr", "Krzysztof", "Tomasz", "Paweł", "Michał", "Marcin", "Jakub", "Łukasz",
            "Adam", "Grzegorz", "Wojciech", "Kamil", "Bartosz", "Mateusz", "Jan", "Rafał"]
NAZWISKA = [("Nowak", "Nowak"), ("Wójcik", "Wójcik"), ("Kowalczyk", "Kowalczyk"),
            ("Mazur", "Mazur"), ("Krawczyk", "Krawczyk"), ("Zając", "Zając"), ("Król", "Król"),
            ("Wróbel", "Wróbel"), ("Pieczara", "Pieczara"), ("Dudek", "Dudek"), ("Bąk", "Bąk"),
            ("Sowa", "Sowa"), ("Kowalski", "Kowalska"), ("Lewandowski", "Lewandowska"),
            ("Zieliński", "Zielińska"), ("Wiśniewski", "Wiśniewska"), ("Kamiński", "Kamińska"),
            ("Jabłoński", "Jabłońska"), ("Michalski", "Michalska"), ("Pawłowski", "Pawłowska"),
            ("Górski", "Górska"), ("Sikora", "Sikora"), ("Baran", "Baran"), ("Kubiak", "Kubiak")]
ULICE = ["Polna", "Leśna", "Słoneczna", "Krótka", "Szkolna", "Ogrodowa", "Lipowa", "Kościelna",
         "Łąkowa", "Kwiatowa", "Spacerowa", "Jasna", "Długa", "Rynek", "Zielona", "Parkowa"]
FORMY = ["Fundacja", "Stowarzyszenie", "Spółdzielnia Socjalna", "Stowarzyszenie na rzecz"]
NAZWY_PODMIOTU = ["Wspólny Krok", "Lepsze Jutro Gminy", "Otwarte Drzwi", "Most Pokoleń",
                  "Zielony Parasol", "Dobry Sąsiad", "Iskra", "Razem Bliżej", "Nowa Ścieżka",
                  "Pod Jednym Dachem", "Kolorowa Wieś", "Promyk", "Horyzont", "Przystań"]
FUNKCJE = ["Prezes Zarządu", "Wiceprezes Zarządu", "Członek Zarządu", "Koordynator projektów",
           "Specjalista ds. projektów", "Kierownik biura"]
STATUSY = ["złożony", "weryfikacja formalna", "ocena merytoryczna", "zaakceptowany",
           "odrzucony", "skierowany do inkubacji"]
BADGE = 'INNOWACJA WYBRANA DO UPOWSZECHNIANIA W RAMACH PROJEKTU "INKUBATOR WŁĄCZENIA SPOŁECZNEGO 2.0" (MOCK)'


def ascii_slug(s):
    s = unicodedata.normalize("NFKD", s.replace("ł", "l").replace("Ł", "L"))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return "-".join("".join(c if c.isalnum() else " " for c in s).split())


def nip(rng):
    wagi = [6, 5, 7, 2, 3, 4, 5, 6, 7]
    while True:
        cyfry = [rng.randint(1, 9)] + [rng.randint(0, 9) for _ in range(8)]
        k = sum(a * b for a, b in zip(cyfry, wagi)) % 11
        if k != 10:
            return "".join(map(str, cyfry + [k]))


def regon(rng):
    wagi = [8, 9, 2, 3, 4, 5, 6, 7]
    cyfry = [rng.randint(0, 9) for _ in range(8)]
    k = sum(a * b for a, b in zip(cyfry, wagi)) % 11 % 10
    return "".join(map(str, cyfry + [k]))


def telefon(rng):
    return f"+48 000 {rng.randint(100, 999)} {rng.randint(100, 999)}"


def email(imie, nazwisko, rng):
    domena = rng.choice(["example.com", "example.org", "example.net"])
    return f"{ascii_slug(imie)}.{ascii_slug(nazwisko)}@{domena}".replace("-", "")


def osoba(rng):
    kobieta = rng.random() < 0.6
    imie = rng.choice(IMIONA_K if kobieta else IMIONA_M)
    m, k = rng.choice(NAZWISKA)
    nazwisko = k if kobieta else m
    return imie, nazwisko


def adres(rng, powiat):
    miejscowosci, prefiks = POWIATY[powiat]
    kod = prefiks + "".join(str(rng.randint(0, 9)) for _ in range(6 - len(prefiks)))  # NN-NNN
    lokal = f"/{rng.randint(1, 40)}" if rng.random() < 0.4 else ""
    return {
        "ulica": f"ul. {rng.choice(ULICE)} {rng.randint(1, 120)}{lokal}",
        "kod_pocztowy": kod,
        "miejscowosc": rng.choice(miejscowosci),
    }


def osoba_kontakt(rng, funkcja=None):
    imie, nazwisko = osoba(rng)
    d = {"imie_nazwisko": f"{imie} {nazwisko}", "telefon": telefon(rng),
         "email": email(imie, nazwisko, rng)}
    return {"funkcja": funkcja, **d} if funkcja else d


def osoba_fizyczna(rng, powiat):
    imie, nazwisko = osoba(rng)
    return {"typ": "osoba fizyczna", "imie": imie, "nazwisko": nazwisko,
            "adres_korespondencyjny": adres(rng, powiat), "telefon": telefon(rng),
            "email": email(imie, nazwisko, rng)}


def podmiot(rng, powiat):
    forma = rng.choice(FORMY)
    nazwa = f"{forma} „{rng.choice(NAZWY_PODMIOTU)}”"
    return {"typ": "podmiot", "nazwa": nazwa,
            "krs": "00009" + "".join(str(rng.randint(0, 9)) for _ in range(5)),
            "regon": regon(rng), "nip": nip(rng), "adres_siedziby": adres(rng, powiat),
            "telefon": telefon(rng),
            "email": f"biuro@{ascii_slug(nazwa.split('„')[1])}.example.org",
            "osoba_reprezentujaca": osoba_kontakt(rng, rng.choice(FUNKCJE[:3])),
            "osoba_do_kontaktu": osoba_kontakt(rng, rng.choice(FUNKCJE[3:]))}


def grupa_nieformalna(rng, powiat):
    partnerzy = [osoba_fizyczna(rng, powiat) if rng.random() < 0.7 else podmiot(rng, powiat)
                 for _ in range(rng.randint(2, 5))]
    return {"typ": "grupa nieformalna", "partnerzy": partnerzy,
            "reprezentant": osoba_kontakt(rng)}


MIESIACE = ["styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec", "lipiec", "sierpień",
            "wrzesień", "październik", "listopad", "grudzień"]


def termin(start, miesiace):
    def m(d):
        return f"{MIESIACE[d.month - 1]} {d.year}"
    koniec = date(start.year + (start.month - 1 + miesiace - 1) // 12,
                  (start.month - 1 + miesiace - 1) % 12 + 1, 1)
    return m(start) if miesiace == 1 else f"{m(start)} - {m(koniec)}"


def dodaj_mies(d, n):
    return date(d.year + (d.month - 1 + n) // 12, (d.month - 1 + n) % 12 + 1, 1)


def plan(rng, k, start):
    tytul, _, charakter = k[0], k[1], k[2]
    koszt = lambda a, b: rng.randrange(a, b, 500)  # noqa: E731
    przyg = [
        {"dzialanie": f"Opracowanie koncepcji i scenariusza testu ({charakter})",
         "termin": termin(start, 1), "koszt": koszt(3000, 9000)},
        {"dzialanie": "Przygotowanie prototypu i materiałów dla uczestników",
         "termin": termin(dodaj_mies(start, 1), 1), "koszt": koszt(8000, 30000)},
        {"dzialanie": "Rekrutacja uczestników testu i partnerów lokalnych",
         "termin": termin(dodaj_mies(start, 2), 1), "koszt": koszt(2000, 6000)},
    ]
    t1 = dodaj_mies(start, 3)
    t2 = dodaj_mies(t1, 4)
    test = {
        "faza_I": [
            {"dzialanie": f"Pilotaż „{tytul}” z pierwszą grupą odbiorców",
             "termin": termin(t1, 3), "koszt": koszt(10000, 35000)},
            {"dzialanie": "Badanie ewaluacyjne i wprowadzenie poprawek",
             "termin": termin(dodaj_mies(t1, 3), 1), "koszt": koszt(3000, 8000)},
        ],
        "faza_II": [
            {"dzialanie": "Test poprawionej wersji z poszerzoną grupą odbiorców",
             "termin": termin(t2, 3), "koszt": koszt(10000, 40000)},
            {"dzialanie": "Opracowanie modelu końcowego i rekomendacji wdrożeniowych",
             "termin": termin(dodaj_mies(t2, 3), 1), "koszt": koszt(4000, 10000)},
        ],
    }
    return przyg, test


def wniosek(i, rng, innowacje):
    k = rng.choice(KONCEPCJE)
    tytul, kategoria, charakter, rozw, problem, grupa, kto, efekt = k
    powiat = rng.choice(list(POWIATY))
    typ = rng.choices(["osoba", "podmiot", "grupa"], weights=[3, 5, 2])[0]
    wnioskodawca = {"osoba": osoba_fizyczna, "podmiot": podmiot,
                    "grupa": grupa_nieformalna}[typ](rng, powiat)
    zlozony = date(2025, 3, 1) + timedelta(days=rng.randint(0, 60))
    przyg, test = plan(rng, k, dodaj_mies(zlozony, 3))
    kwota = sum(d["koszt"] for d in przyg + test["faza_I"] + test["faza_II"])
    testerzy = rng.randint(12, 60)
    wariant = rng.choice(["", " 2.0", " – edycja lokalna", " Plus"])
    return {
        "id": f"MOCK-IWS-2025-{i:03d}",
        "mock": True,
        "data_zlozenia": zlozony.isoformat(),
        "status": rng.choice(STATUSY),
        "powiat": powiat,
        "kategoria": kategoria,
        "powiazana_innowacja_slug": innowacje[KONCEPCJE.index(k)]["slug"],
        "1_tytul": tytul + wariant,
        "2_pomyslodawca": wnioskodawca,
        "3_opis_innowacji": (
            f"Innowacja ma charakter: {charakter}. Polega na tym, że wprowadzamy {rozw}. "
            f"Rozwiązanie wspiera włączenie społeczne, bo pozwala odbiorcom funkcjonować w swoim "
            f"środowisku zamiast w formach instytucjonalnych, co wpisuje się w ideę deinstytucjonalizacji."),
        "4_innowacyjnosc": (
            "Nie znaleźliśmy w regionie rozwiązania łączącego "
            f"{rng.choice(['niski koszt i łatwość powielenia', 'zaangażowanie lokalnej społeczności i specjalistów', 'formę cyfrową i bezpośredni kontakt'])}. "
            "Podobne rozwiązania za granicą działają w dużych miastach; nasza wersja jest projektowana "
            "z myślą o małych miejscowościach."),
        "5_diagnoza_problemu": (
            f"Odpowiadamy na problem: {problem}. Na naszym terenie ({powiat}) problem potwierdzają lokalne diagnozy "
            "pomocy społecznej oraz rozmowy z pracownikami OPS. Temat wpisuje się w Mapę Wyzwań "
            "Społecznych."),
        "6_odbiorcy": (
            f"Odbiorcy: {grupa}. Grupę wyróżnia ograniczony dostęp do usług wsparcia; jej członkowie "
            "są zagrożeni wykluczeniem z powodu barier zdrowotnych, ekonomicznych lub komunikacyjnych."),
        "7_zmiana": (
            f"Zmianę zmierzymy wskaźnikiem: {efekt}. Uczestnicy zyskają większą samodzielność i kontakt "
            "z lokalną społecznością, co zapobiega pogłębianiu się wykluczenia."),
        "8_wizja_przyszlosci": (
            f"Rozwiązanie może być powielone przez: {kto}. Do wdrożenia wystarczy instrukcja "
            "i krótkie szkolenie, dlatego łatwo je przenieść do innych gmin i grup docelowych."),
        "9_plan_dzialania": {
            "okres_przygotowawczy": przyg,
            "okres_testowania": test,
            "liczba_testujacych": testerzy,
        },
        "10_wnioskowana_kwota_grantu": kwota,
        "11_zespol_projektowy": (
            f"Zespół {rng.randint(2, 5)}-osobowy: koordynator, "
            f"{rng.choice(['pracownik socjalny', 'terapeuta zajęciowy', 'psycholog', 'pedagog'])} "
            f"z {rng.randint(3, 15)}-letnim doświadczeniem w pracy z odbiorcami oraz "
            f"{rng.choice(['specjalista ds. ewaluacji', 'projektant', 'programista', 'animator społeczny'])}."),
        "12_oswiadczenia_zaakceptowane": True,
    }


def innowacja(k, rng):
    tytul, kategoria, charakter, rozw, problem, grupa, kto, efekt = k
    slug = ascii_slug(tytul)
    return {
        "slug": slug,
        "url": f"https://example.org/mock/biblioteka-innowacji/{slug}",
        "title": tytul,
        "categories": [kategoria],
        "dissemination_badge": BADGE if rng.random() < 0.25 else None,
        "solution": rozw[0].upper() + rozw[1:] + ".",
        "problem": f"Innowacja odpowiada na problem: {problem}.",
        "target_group": grupa[0].upper() + grupa[1:] + ".",
        "who_can_implement": kto[0].upper() + kto[1:] + ".",
        "evidence": (f"Test z udziałem {rng.randint(12, 60)} osób przyniósł pozytywne wyniki (mierzono: {efekt}). "
                     "Uczestnicy ocenili rozwiązanie jako proste w użyciu."),
        "files": [],
        "mock": True,
    }


def main():
    rng = random.Random(SEED)
    innowacje = [innowacja(k, rng) for k in KONCEPCJE]
    wnioski = [wniosek(i + 1, rng, innowacje) for i in range(LICZBA_WNIOSKOW)]
    for nazwa, dane in [("innowacje_mock.json", innowacje), ("wnioski_mock.json", wnioski)]:
        (WYJSCIE / nazwa).write_text(json.dumps(dane, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Zapisano {nazwa}: {len(dane)} rekordów")


if __name__ == "__main__":
    main()
