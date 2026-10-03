"""Wskaźniki mapy Małopolski: kategorie i opis każdego wskaźnika prostym językiem.

Kategorie (klucze) muszą się zgadzać z MAP_CATEGORIES w lib/knowledge/map.ts — tam są nazwy i ikony.
Powiaty: wszystkie wskaźniki z IOSS ROPS (../dane/powiaty/wszystkie_powiaty.csv) poza tymi, których
już się nie aktualizuje. Gminy: GUS BDL — bazowe trzy z bdl.py i dodatkowe z bdl_wskazniki.py.
`scale`: sequential (więcej = ciemniej) albo diverging (wartości na plus i na minus wokół zera).
"""
import re

CATEGORIES = ["ludnosc", "seniorzy", "pomoc", "placowki", "rodzina", "praca", "edukacja", "zdrowie", "kultura",
              "finanse", "otoczenie"]


def ind(key, label, unit, decimals, category, question=None, scale="sequential", area=None, csv=None, zero_is_null=False):
    return dict(key=key, csv=csv, label=label, unit=unit, decimals=decimals, scale=scale, area=area,
                category=category, question=question, zero_is_null=zero_is_null)


GMINA_INDICATORS = [
    ind("ludnosc", "Liczba mieszkańców", "osób", 0, "ludnosc", "Ile osób mieszka w gminie?"),
    ind("zmiana_ludnosci_10l", "Zmiana liczby mieszkańców w 10 lat", "%", 1, "ludnosc",
        "Czy mieszkańców przybywa, czy ubywa? Ujemna liczba to spadek.", scale="diverging"),
    ind("udzial_65plus", "Osoby w wieku 65+", "%", 1, "seniorzy", "Jaka część mieszkańców ma 65 lat lub więcej?", area="seniorzy"),
]


def _reason(csv, key, what, decimals=1, area=None):
    """Powód przyznania pomocy społecznej: odsetek klientów pomocy, którzy dostają ją z tego powodu."""
    return ind(key, f"Pomoc z powodu {what}", "% klientów", decimals, "pomoc",
               f"Jaka część osób korzystających z pomocy społecznej dostaje ją z powodu {what}?", area=area, csv=csv)


def _dps(csv, key, who):
    return ind(key, f"Mieszkańcy DPS {who}", "% mieszkańców DPS", 1, "placowki",
               f"Jaka część mieszkańców domów pomocy społecznej to osoby {who}?", csv=csv)


def _count(csv, key, label, unit, category="placowki", area=None):
    return ind(key, label, unit, 0, category, f"Ile jest w powiecie: {label[0].lower() + label[1:]}? Stan na koniec roku.",
               area=area, csv=csv)


def _unemployed(csv, key, label, who):
    return ind(key, label, "% bezrobotnych", 1, "praca", f"Jaka część zarejestrowanych bezrobotnych to {who}?", csv=csv)


def _sector(csv, key, sector):
    return ind(key, f"Pracujący w: {sector}", "% pracujących", 1, "praca", f"Jaka część pracujących pracuje w: {sector}?", csv=csv)


def _per_place(csv, key, label, place):
    return ind(key, label, "osób", 0, "kultura", f"Na ilu mieszkańców przypada {place}? Mniej = łatwiej o dostęp.",
               csv=csv, zero_is_null=True)


def _spending(csv, key, what):
    return ind(key, f"Wydatki gmin: {what}", "zł na mieszkańca", 0, "finanse",
               f"Ile gminy w powiecie wydają na mieszkańca: {what}?", csv=csv)


POWIAT_INDICATORS = [
    # Ludność
    ind("ludnosc", "Liczba mieszkańców", "osób", 0, "ludnosc", "Ile osób mieszka w powiecie?", csv="Ludność ogółem"),
    ind("gestosc", "Gęstość zaludnienia", "osób na km²", 0, "ludnosc", "Ile osób mieszka na 1 km²?", csv="Wskaźnik gęstości zaludnienia"),
    ind("urbanizacja", "Mieszkańcy miast", "%", 1, "ludnosc", "Jaka część mieszkańców mieszka w miastach?", csv="Wskaźnik urbanizacji"),
    ind("przedprodukcyjny", "Dzieci i młodzież (do 17 lat)", "%", 1, "ludnosc", "Jaka część mieszkańców ma mniej niż 18 lat?",
        csv="Ludność w wieku przedprodukcyjnym"),
    ind("produkcyjny", "Osoby w wieku produkcyjnym", "%", 1, "ludnosc",
        "Jaka część mieszkańców jest w wieku pracy (mężczyźni 18–64, kobiety 18–59 lat)?", csv="Ludność w wieku produkcyjnym"),
    ind("obciazenie", "Obciążenie demograficzne", "na 100 osób w wieku produkcyjnym", 1, "ludnosc",
        "Ile dzieci i seniorów przypada na 100 osób w wieku pracy?", csv="Wskaźnik obciążenia demograficznego"),
    ind("przyrost", "Przyrost naturalny", "na 1000 mieszkańców", 2, "ludnosc",
        "Czy urodzeń jest więcej niż zgonów? Ujemna liczba: więcej zgonów.", scale="diverging", csv="Przyrost naturalny na 1 000 ludności"),
    ind("urodzenia", "Urodzenia", "na 1000 mieszkańców", 2, "ludnosc", "Ile dzieci rodzi się w roku na 1000 mieszkańców?",
        csv="Urodzenia na 1000 mieszkańców"),
    ind("zgony", "Zgony", "na 1000 mieszkańców", 2, "ludnosc", "Ile osób umiera w roku na 1000 mieszkańców?", csv="Zgony na 1000 mieszkańców"),
    ind("malzenstwa", "Małżeństwa", "na 1000 mieszkańców", 1, "ludnosc", "Ile małżeństw zawiera się w roku na 1000 mieszkańców?",
        csv="Małżeństwa na 1000 mieszkańców"),
    ind("saldo_migracji", "Saldo przeprowadzek", "osób", 0, "ludnosc",
        "Ile osób więcej się zameldowało, niż wymeldowało? Ujemna liczba: więcej osób wyjechało.", scale="diverging",
        csv="Saldo migracji stałych"),
    ind("saldo_zagraniczne", "Saldo migracji zagranicznych", "osób", 0, "ludnosc",
        "Ile osób więcej przyjechało z zagranicy, niż wyjechało za granicę? Ujemna liczba: więcej wyjazdów.", scale="diverging",
        area="cudzoziemcy", csv="Saldo migracji zagranicznych"),
    ind("feminizacja", "Kobiety na 100 mężczyzn", "kobiet", 1, "ludnosc", "Ile kobiet przypada na 100 mężczyzn?", csv="Wskaźnik feminizacji"),
    ind("maskulinizacja", "Mężczyźni na 100 kobiet", "mężczyzn", 1, "ludnosc", "Ilu mężczyzn przypada na 100 kobiet?",
        csv="Wskaźnik maskulinizacji"),

    # Seniorzy i opieka
    ind("65plus", "Osoby w wieku 65+", "%", 1, "seniorzy", "Jaka część mieszkańców ma 65 lat lub więcej?", area="seniorzy",
        csv="Ludność w wieku 65+/ Współczynnik starości demograficznej"),
    ind("60plus", "Osoby w wieku 60+", "%", 1, "seniorzy", "Jaka część mieszkańców ma 60 lat lub więcej?", area="seniorzy",
        csv="Ludność w wieku 60+"),
    ind("poprodukcyjny", "Osoby w wieku emerytalnym", "%", 1, "seniorzy",
        "Jaka część mieszkańców jest w wieku emerytalnym (mężczyźni od 65, kobiety od 60 lat)?", area="seniorzy",
        csv="Ludność w wieku poprodukcyjnym"),
    ind("podwojne_starzenie", "Osoby 80+ wśród seniorów", "% osób 60+", 1, "seniorzy",
        "Jaka część osób po sześćdziesiątce ma 80 lat lub więcej?", area="seniorzy", csv="Wskaźnik podwójnego starzenia"),
    ind("indeks_starosci", "Seniorzy na 100 dzieci", "osób 65+", 0, "seniorzy",
        "Ile osób w wieku 65+ przypada na 100 dzieci do 14 lat?", area="seniorzy", csv="Wskaźnik/ indeks starości"),
    ind("potencjalne_wsparcie", "Osoby w wieku pracy na 100 seniorów", "osób 15–64", 0, "seniorzy",
        "Ile osób w wieku 15–64 lat przypada na 100 osób w wieku 65+? Mniej = mniej rąk do pomocy.", area="seniorzy",
        csv="Wskaźnik potencjalnego wsparcia"),
    ind("potencjal_pielegnacyjny", "Potencjalne opiekunki na 100 osób 80+", "kobiet 45–64", 0, "seniorzy",
        "Ile kobiet w wieku 45–64 lat (najczęstszych opiekunek rodzinnych) przypada na 100 osób w wieku 80+?", area="seniorzy",
        csv="Potencjał pielęgnacyjny"),
    ind("wsparcie_najstarszych", "Osoby 85+ na 100 osób w wieku 50–64", "osób 85+", 0, "seniorzy",
        "Ile osób w wieku 85+ przypada na 100 osób w wieku 50–64 lat, czyli ich możliwych opiekunów?", area="seniorzy",
        csv="Wskaźnik wsparcia osób najstarszych"),
    ind("uslugi_opiekuncze", "Osoby korzystające z usług opiekuńczych", "osób", 0, "seniorzy",
        "Ile osób dostaje pomoc w domu w ramach usług opiekuńczych?", area="seniorzy",
        csv="Osoby korzystające z usług opiekuńczych i specjalistycznych usług opiekuńczych"),
    ind("rodziny_emerytow", "Rodziny emerytów i rencistów wśród objętych pomocą", "% rodzin", 1, "seniorzy",
        "Jaka część rodzin korzystających z pomocy społecznej to rodziny emerytów i rencistów?", area="seniorzy",
        csv="Rodziny emerytów i rencistów objęte pomocą społeczną"),

    # Pomoc społeczna
    ind("beneficjenci", "Mieszkańcy korzystający z pomocy społecznej", "%", 2, "pomoc",
        "Jaka część mieszkańców dostaje pomoc społeczną?", area="ubostwo", csv="Beneficjenci pomocy społecznej"),
    _reason("Ubóstwo", "ubostwo", "ubóstwa", area="ubostwo"),
    _reason("Niepełnosprawność", "niepelnosprawnosc", "niepełnosprawności", area="niepelnosprawnosc"),
    _reason("Długotrwała lub ciężka choroba", "choroba", "długotrwałej lub ciężkiej choroby", area="zdrowie"),
    _reason("Bezrobocie", "pomoc_bezrobocie", "bezrobocia"),
    _reason("Bezradność w sprawach opiekuńczo-wychowawczych i prowadzenia gosp. dom.", "bezradnosc",
            "bezradności w sprawach opiekuńczo-wychowawczych", area="rodzina_piecza"),
    _reason("Wielodzietność", "wielodzietnosc", "wielodzietności", area="rodzina_piecza"),
    _reason("Potrzeba ochrony macierzyństwa", "macierzynstwo", "potrzeby ochrony macierzyństwa", area="rodzina_piecza"),
    _reason("Alkoholizm", "alkoholizm", "alkoholizmu", area="zdrowie_psychiczne"),
    _reason("Przemoc domowa", "przemoc", "przemocy domowej"),
    _reason("Bezdomność", "bezdomnosc", "bezdomności", decimals=2, area="bezdomnosc"),
    _reason("Sytuacja kryzysowa", "kryzys", "sytuacji kryzysowej", decimals=2),
    _reason("Zdarzenie losowe", "zdarzenie_losowe", "zdarzenia losowego", decimals=2),
    _reason("Narkomania", "narkomania", "narkomanii", decimals=2, area="zdrowie_psychiczne"),
    _reason("Sieroctwo", "sieroctwo", "sieroctwa", decimals=2, area="rodzina_piecza"),
    ind("swiadczenia_pieniezne", "Pomoc w pieniądzach", "% klientów", 1, "pomoc",
        "Jaka część osób korzystających z pomocy społecznej dostaje świadczenia pieniężne?",
        csv="Świadczenia pieniężne z pomocy społecznej"),
    ind("swiadczenia_niepieniezne", "Pomoc w naturze (posiłki, ubrania, usługi)", "% klientów", 1, "pomoc",
        "Jaka część osób korzystających z pomocy społecznej dostaje świadczenia niepieniężne?",
        csv="Świadczenia niepieniężne z pomocy społecznej"),
    ind("kontrakty", "Osoby z kontraktem socjalnym", "% klientów", 2, "pomoc",
        "Jaka część osób korzystających z pomocy społecznej ma podpisany kontrakt socjalny?", csv="Osoby objęte kontraktami socjalnymi"),
    ind("dozywianie", "Osoby objęte dożywianiem", "na 1000 mieszkańców", 0, "pomoc",
        "Ile osób na 1000 mieszkańców dostaje posiłki w rządowym programie dożywiania?", area="ubostwo",
        csv="Osoby objęte dożywianiem na 1000 mieszkańców"),
    ind("uslugi_psychiczne", "Usługi opiekuńcze dla osób z zaburzeniami psychicznymi", "osób", 0, "pomoc",
        "Ile osób z zaburzeniami psychicznymi korzysta ze specjalistycznych usług opiekuńczych w domu?", area="zdrowie_psychiczne",
        csv="Osoby korzystające ze specjalistycznych usług opiekuńczych dla osób z zaburzeniami psychicznymi"),

    # Placówki i kadra pomocy społecznej
    ind("pracownik_socjalny", "Mieszkańcy na 1 pracownika socjalnego", "osób", 0, "placowki",
        "Na ilu mieszkańców przypada jeden pracownik socjalny?", csv="Liczba mieszkańców na 1 pracownika socjalnego"),
    ind("pracownicy_wyzsze", "Pracownicy socjalni z wyższym wykształceniem", "%", 1, "placowki",
        "Jaka część pracowników socjalnych w ośrodkach pomocy ma wyższe wykształcenie?",
        csv="Pracownicy socjalni OPS posiadający wyższe wykształcenie"),
    ind("pracownicy_spec1", "Pracownicy socjalni z I stopniem specjalizacji", "%", 1, "placowki",
        "Jaka część pracowników socjalnych ma I stopień specjalizacji zawodowej?",
        csv="Pracownicy socjalni OPS posiadający I stopień specjalizacji w zawodzie pracownik socjalny"),
    ind("pracownicy_spec2", "Pracownicy socjalni z II stopniem specjalizacji", "%", 1, "placowki",
        "Jaka część pracowników socjalnych ma II stopień specjalizacji zawodowej?",
        csv="Pracownicy socjalni OPS posiadający II stopień specjalizacji w zawodzie pracownik socjalny"),
    _count("Domy pomocy społecznej", "dps", "Domy pomocy społecznej", "domów", area="seniorzy"),
    _count("Dzienne domy pomocy", "ddp", "Dzienne domy pomocy", "domów", area="seniorzy"),
    _count("Środowiskowe domy samopomocy", "sds", "Środowiskowe domy samopomocy", "domów", area="zdrowie_psychiczne"),
    _count("Placówki zapewniające całodobową opiekę osobom niepełnosprawnym, przewlekle chorym lub osobom w podeszłym wieku",
           "calodobowe", "Placówki całodobowej opieki", "placówek", area="niepelnosprawnosc"),
    _count("Mieszkania treningowe oraz wspomagane", "mieszkania_wspomagane", "Mieszkania treningowe i wspomagane", "mieszkań",
           area="niepelnosprawnosc"),
    _count("Noclegownie, schroniska i domy dla osób bezdomnych", "noclegownie", "Noclegownie, schroniska i domy dla bezdomnych",
           "placówek", area="bezdomnosc"),
    _count("Ośrodki interwencji kryzysowej", "oik", "Ośrodki interwencji kryzysowej", "ośrodków"),
    _count("Placówki specjalistycznego poradnictwa - jednostki  powiatowe", "poradnictwo", "Placówki specjalistycznego poradnictwa",
           "placówek"),
    _count("Centra integracji społecznej", "cis", "Centra integracji społecznej", "centrów"),
    _count("Kluby integracji społecznej", "kis", "Kluby integracji społecznej", "klubów"),
    _count("Zakłady aktywności zawodowej", "zaz", "Zakłady aktywności zawodowej", "zakładów", area="niepelnosprawnosc"),
    _count("Placówki opiekuńczo-wychowawcze", "pow", "Placówki opiekuńczo-wychowawcze", "placówek", area="rodzina_piecza"),
    _count("Placówki wsparcia dziennego", "pwd", "Placówki wsparcia dziennego (świetlice)", "placówek", area="rodzina_piecza"),
    ind("dps_lezacy", "Mieszkańcy DPS nieopuszczający łóżek", "% mieszkańców DPS", 1, "placowki",
        "Jaka część mieszkańców domów pomocy społecznej nie wstaje z łóżka?", csv="Pensjonariusze DPS nieopuszczający łóżek"),
    _dps("Pensjonariusze DPS do 18 roku życia", "dps_do18", "do 18 lat"),
    _dps("Pensjonariusze DPS w wieku 19-40 lat", "dps_19_40", "w wieku 19–40 lat"),
    _dps("Pensjonariusze DPS w wieku 41-60 lat", "dps_41_60", "w wieku 41–60 lat"),
    _dps("Pensjonariusze DPS w wieku 61-74 lat", "dps_61_74", "w wieku 61–74 lat"),
    _dps("Pensjonariusze DPS w wieku powyżej 74 lat", "dps_75plus", "po 74. roku życia"),

    # Rodzina i dzieci
    ind("piecza", "Dzieci w pieczy zastępczej", "na 1000 dzieci", 1, "rodzina",
        "Ile dzieci na 1000 wychowuje się w pieczy zastępczej?", area="rodzina_piecza", csv="Intensywność pieczy zastępczej"),
    ind("deinstytucjonalizacja", "Dzieci w rodzinnej pieczy zastępczej", "% dzieci w pieczy", 1, "rodzina",
        "Jaka część dzieci w pieczy zastępczej wychowuje się w rodzinie (a nie w placówce)?", area="rodzina_piecza",
        csv="Stopień deinstytucjonalizacji pieczy zastępczej"),
    ind("rodziny_zastepcze", "Rodziny zastępcze", "rodzin", 0, "rodzina", "Ile rodzin zastępczych działa w powiecie?",
        area="rodzina_piecza", csv="Liczba rodzin zastępczych"),
    ind("dzieci_rodziny_zastepcze", "Dzieci w rodzinach zastępczych", "dzieci", 0, "rodzina",
        "Ile dzieci wychowuje się w rodzinach zastępczych?", area="rodzina_piecza", csv="Liczba dzieci w rodzinach zastępczych"),
    ind("rodziny_niepelne", "Rodziny niepełne wśród objętych pomocą", "% rodzin z dziećmi", 1, "rodzina",
        "Jaka część rodzin z dziećmi korzystających z pomocy społecznej to samotni rodzice?", area="rodzina_piecza",
        csv="Rodziny niepełne objęte pomocą społeczną"),
    ind("rodziny_wielodzietne", "Rodziny wielodzietne wśród objętych pomocą", "% rodzin z dziećmi", 1, "rodzina",
        "Jaka część rodzin z dziećmi korzystających z pomocy społecznej ma troje dzieci lub więcej?", area="rodzina_piecza",
        csv="Rodziny wielodzietne objęte pomocą społeczną"),
    ind("dozywianie_dzieci", "Małe dzieci wśród dożywianych", "% dożywianych", 0, "rodzina",
        "Jaka część osób objętych dożywianiem to dzieci przed szkołą?", csv="Udział dzieci w ogóle osób objętych dożywianiem"),
    ind("dozywianie_uczniowie", "Uczniowie wśród dożywianych", "% dożywianych", 0, "rodzina",
        "Jaka część osób objętych dożywianiem to uczniowie?", csv="Udział uczniów w ogóle osób objętych dożywianiem"),

    # Praca i gospodarka
    ind("stopa_bezrobocia", "Stopa bezrobocia", "%", 1, "praca", "Jaka część osób aktywnych zawodowo jest bez pracy?",
        csv="Stopa bezrobocia"),
    ind("wynagrodzenie", "Wynagrodzenie wobec średniej krajowej", "% średniej", 1, "praca",
        "Ile wynosi przeciętna pensja brutto w porównaniu ze średnią krajową (Polska = 100%)?",
        csv="Przeciętne wynagrodzenie w relacji do śr. krajowej"),
    ind("dzialalnosc", "Osoby prowadzące firmę", "na 100 osób w wieku produkcyjnym", 1, "praca",
        "Ile osób na 100 w wieku pracy prowadzi własną działalność gospodarczą?", csv="Prowadzący działalność gospodarczą"),
    _unemployed("Bezrobotni dłużej niż 1 rok", "bezrobotni_dlugo", "Bezrobotni dłużej niż rok", "osoby bez pracy dłużej niż rok"),
    _unemployed("Bezrobocie kobiet", "bezrobocie_kobiet", "Kobiety wśród bezrobotnych", "kobiety"),
    _unemployed("Bezrobotni w wieku poniżej 25 lat", "bezrobotni_do25", "Bezrobotni poniżej 25 lat", "osoby poniżej 25 lat"),
    _unemployed("Bezrobotni w wieku 25-34 lata", "bezrobotni_25_34", "Bezrobotni w wieku 25–34 lata", "osoby w wieku 25–34 lata"),
    _unemployed("Bezrobotni w wieku 55 lat i więcej", "bezrobotni_55plus", "Bezrobotni w wieku 55+", "osoby w wieku 55 lat i więcej"),
    _unemployed("Bezrobotni z wykształceniem gimnazjalnym i niższym", "bezrobotni_gimn", "Bezrobotni z wykształceniem gimnazjalnym lub niższym",
                "osoby z wykształceniem gimnazjalnym lub niższym"),
    _unemployed("Bezrobocie rodzinne", "bezrobocie_rodzinne", "Bezrobotni w domach, gdzie bez pracy są co najmniej 2 osoby",
                "osoby z domów, w których bez pracy są co najmniej dwie osoby"),
    _sector("Zatrudnienie w rolnictwie", "praca_rolnictwo", "rolnictwo"),
    _sector("Zatrudnienie w przemyśle i budownictwie", "praca_przemysl", "przemysł i budownictwo"),
    _sector("Zatrudnienie w handlu, transporcie, turystyce, informacji i komunikacji", "praca_handel",
            "handel, transport, turystyka, IT"),
    _sector("Zatrudnienie w branży finansowej i nieruchomościach", "praca_finanse", "finanse i nieruchomości"),
    _sector("Zatrudnienie w pozostałych usługach", "praca_uslugi", "pozostałe usługi (w tym administracja, szkoły, zdrowie)"),

    # Edukacja
    ind("przedszkola", "Dzieci 3–5 lat w przedszkolach", "%", 1, "edukacja",
        "Jaka część dzieci w wieku 3–5 lat chodzi do przedszkola? Ponad 100%: przychodzą też dzieci spoza powiatu.",
        area="rodzina_piecza", csv="Edukacja przedszkolna"),
    ind("e8_polski", "Egzamin ósmoklasisty: polski", "% punktów", 1, "edukacja", "Jaki średni wynik mają ósmoklasiści z polskiego?",
        csv="Wyniki egzaminu ósmoklasisty – język polski"),
    ind("e8_matematyka", "Egzamin ósmoklasisty: matematyka", "% punktów", 1, "edukacja",
        "Jaki średni wynik mają ósmoklasiści z matematyki?", csv="Wyniki egzaminu ósmoklasisty – matematyka"),
    ind("e8_angielski", "Egzamin ósmoklasisty: angielski", "% punktów", 1, "edukacja",
        "Jaki średni wynik mają ósmoklasiści z angielskiego?", csv="Wyniki egzaminu ósmoklasisty – język angielski podstawowy"),
    ind("matura_lo", "Zdana matura w liceach", "%", 0, "edukacja", "Jaka część uczniów liceów zdaje maturę?",
        csv="Zdawalność egzaminu maturalnego w liceach ogólnokształcących"),
    ind("matura_technikum", "Zdana matura w technikach", "%", 0, "edukacja", "Jaka część uczniów techników zdaje maturę?",
        csv="Zdawalność egzaminu maturalnego w technikach"),
    ind("wybor_lo", "Ósmoklasiści wybierający liceum", "% absolwentów", 1, "edukacja",
        "Jaka część absolwentów szkół podstawowych idzie do liceum?", csv="Wybory edukacyjne ósmoklasistów – liceum ogólnokształcące"),
    ind("wybor_technikum", "Ósmoklasiści wybierający technikum", "% absolwentów", 1, "edukacja",
        "Jaka część absolwentów szkół podstawowych idzie do technikum?", csv="Wybory edukacyjne ósmoklasistów – technikum"),
    ind("wybor_branzowa", "Ósmoklasiści wybierający szkołę branżową", "% absolwentów", 1, "edukacja",
        "Jaka część absolwentów szkół podstawowych idzie do szkoły branżowej?",
        csv="Wybory edukacyjne ósmoklasistów – szkoła branżowa I stopnia"),

    # Zdrowie
    ind("apteki", "Mieszkańcy na 1 aptekę", "osób", 0, "zdrowie", "Na ilu mieszkańców przypada jedna apteka? Mniej = łatwiej o dostęp.",
        area="zdrowie", csv="Dostępność aptek"),
    ind("zgony_nowotwory", "Zgony z powodu nowotworów", "% zgonów", 1, "zdrowie", "Jaka część zgonów jest spowodowana nowotworami?",
        area="zdrowie", csv="Zgony z powodu chorób nowotworowych"),
    ind("zgony_krazenie", "Zgony z powodu chorób serca i krążenia", "% zgonów", 1, "zdrowie",
        "Jaka część zgonów jest spowodowana chorobami układu krążenia?", area="zdrowie", csv="Zgony z powodu chorób układu krążenia"),

    # Kultura
    _per_place("Wskaźnik dostępności bibliotek", "biblioteki", "Mieszkańcy na 1 bibliotekę", "jedna biblioteka lub filia"),
    _per_place("Wskaźnik dostępności domów i ośrodków kultury", "domy_kultury", "Mieszkańcy na 1 dom kultury lub świetlicę",
               "jeden dom kultury, klub lub świetlica"),
    _per_place("Wskaźnik dostępności muzeów", "muzea", "Mieszkańcy na 1 muzeum", "jedno muzeum"),
    _per_place("Wskaźnik dostępności kin", "kina", "Mieszkańcy na 1 miejsce w kinie", "jedno miejsce na widowni kina"),
    ind("czytelnictwo", "Wypożyczenia na czytelnika", "książek w roku", 0, "kultura",
        "Ile książek i czasopism wypożycza w roku jeden czytelnik biblioteki?", csv="Wskaźnik czytelnictwa"),

    # Budżety gmin
    _spending("Wydatki budżetów gmin ogółem", "wydatki", "ogółem"),
    _spending("Wydatki budżetów gmin - pomoc społeczna", "wydatki_pomoc", "pomoc społeczna"),
    _spending("Wydatki budżetów gmin - oświata i wychowanie", "wydatki_oswiata", "oświata i wychowanie"),
    _spending("Wydatki budżetów gmin - kultura", "wydatki_kultura", "kultura"),
]

# Wskaźniki z CSV, których świadomie nie pokazujemy.
POWIAT_SKIPPED = {
    "Placówki specjalistycznego poradnictwa": "od 2021 r. nieaktualizowany (zastąpił go wskaźnik dla jednostek powiatowych)",
}


def check(indicators: list[dict]) -> None:
    keys = [i["key"] for i in indicators]
    dupes = {k for k in keys if keys.count(k) > 1}
    assert not dupes, f"Powtórzone klucze wskaźników: {dupes}"
    for i in indicators:
        assert i["category"] in CATEGORIES, f"Nieznana kategoria {i['category']} ({i['key']})"
        assert re.fullmatch(r"[a-z0-9_]+", i["key"]), i["key"]
