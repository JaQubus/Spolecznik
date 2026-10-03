"""Dane demo — WYRAŹNIE OZNACZONE jako syntetyczne (synthetic = true). README sekcja 8.6.

~200 potrzeb rozłożonych po gminach zgodnie z profilami BDL, 10 ekspertów,
2 nabory (jeden aktywny), kilka pomysłów i testów.

Potrzeby losujemy z szablonów, a wagę gminy liczymy z jej profilu: samotność seniorów częściej
tam, gdzie dużo osób 65+ i ludność ubywa; brak żłobków w szybko rosnących gminach podkrakowskich.
Pomysły bierzemy z fikcyjnych wniosków IWS 2.0 (../dane/mock/wnioski_mock.json) — bez danych
pomysłodawców. Nie wywołuje żadnego API: karty potrzeb mają już słowa kluczowe, embeddingi liczy embed.py.

Wejście: out/gminy.json (bdl.py), out/innovations.json (scrape_library.py).
Wynik: out/synthetic.json. Uruchomienie: uv run seed_synthetic.py"""
import random
from datetime import date, datetime, timedelta, timezone

from common import OUT, ROOT, read_json, write_json

SEED = 42
NEED_COUNT = 200
TODAY = date(2026, 10, 3)
ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"  # jak lib/status-code.ts

# ── Szablony potrzeb ──────────────────────────────────────────────────────────────────
# weight(g) → względna częstość w gminie g (s = udział 65+, c = zmiana ludności w 10 lat, %).
# gap=True: tematy, na które Biblioteka raczej nie ma odpowiedzi — częściej kończą jako „luka”.
NEED_TEMPLATES = [
    dict(
        texts=["Samotni seniorzy w małych wsiach nie mają z kim porozmawiać, rodziny wyjechały.",
               "Starsze osoby mieszkające same całymi dniami nikogo nie widzą, nie ma klubu seniora.",
               "Coraz więcej seniorów zostaje samych po wyjeździe dzieci za granicę."],
        areas=["seniorzy"], groups=["seniorzy"], cross=["samotnosc", "depopulacja_suburbanizacja"],
        keywords=["senior", "samotność", "osoba starsza", "wieś", "kontakt", "klub seniora"],
        weight=lambda g: max(g["s"] - 15, 1) * (2 if g["c"] < 0 else 1)),
    dict(
        texts=["Seniorzy nie umieją korzystać z bankowości internetowej i e-recepty, boją się oszustów.",
               "Starsze osoby nie radzą sobie z telefonem i internetem, wszystko jest teraz online.",
               "Seniorzy dają się nabierać na oszustwa przez telefon i SMS."],
        areas=["seniorzy"], groups=["seniorzy"], cross=["wykluczenie_cyfrowe"],
        keywords=["senior", "kompetencja cyfrowa", "internet", "smartfon", "oszustwo", "e-usługa"],
        weight=lambda g: max(g["s"] - 14, 1)),
    dict(
        texts=["Brak transportu do lekarza i urzędu, autobus jeździ dwa razy dziennie.",
               "Osoby starsze i z niepełnosprawnością nie mają jak dojechać do przychodni w mieście.",
               "Po likwidacji linii autobusowej mieszkańcy przysiółków są odcięci od usług."],
        areas=["seniorzy", "niepelnosprawnosc"], groups=["seniorzy", "ograniczona_mobilnosc"],
        cross=["dostep_do_uslug", "depopulacja_suburbanizacja"],
        keywords=["transport", "dojazd", "lekarz", "wykluczenie komunikacyjne", "wieś", "autobus"],
        weight=lambda g: (3 if g["typ"] == "wiejska" else 1) * (1.5 if g["c"] < 0 else 1)),
    dict(
        texts=["Za mało miejsc w żłobku, młode rodziny czekają ponad rok.",
               "Do gminy wprowadza się dużo rodzin z Krakowa, a nie ma żłobka ani klubu malucha.",
               "Rodzice małych dzieci nie mogą wrócić do pracy, bo nie ma opieki nad dziećmi do lat 3."],
        areas=["rodzina_piecza"], groups=["dzieci_mlodziez_rodzina", "rynek_pracy"], cross=["depopulacja_suburbanizacja", "dostep_do_uslug"],
        keywords=["żłobek", "opieka nad dzieckiem", "rodzina", "rodzic", "powrót do pracy", "suburbanizacja"],
        weight=lambda g: max(g["c"], 0.5) ** 1.3),
    dict(
        texts=["Nastolatki po szkole nie mają gdzie się podziać, siedzą na przystanku albo w telefonie.",
               "Brakuje miejsca dla młodzieży, rośnie problem z alkoholem i e-papierosami.",
               "Młodzież z rodzin w kryzysie nie ma żadnych zajęć ani wsparcia po lekcjach."],
        areas=["rodzina_piecza", "zdrowie_psychiczne"], groups=["dzieci_mlodziez_rodzina"], cross=["dostep_do_uslug"],
        keywords=["młodzież", "czas wolny", "świetlica", "profilaktyka", "uzależnienie", "nastolatek"],
        weight=lambda g: 1.5),
    dict(
        texts=["Dzieci i młodzież czekają miesiącami na psychologa, rośnie liczba prób samobójczych.",
               "W szkołach brakuje psychologa, a najbliższa poradnia jest 40 km dalej.",
               "Uczniowie po pandemii mają stany lękowe i depresję, rodzice nie wiedzą, gdzie szukać pomocy."],
        areas=["zdrowie_psychiczne"], groups=["dzieci_mlodziez_rodzina", "zdrowie_medycyna"], cross=["dostep_do_uslug"],
        keywords=["zdrowie psychiczne", "psycholog", "depresja", "młodzież", "kryzys", "szkoła"],
        weight=lambda g: 1.5 + (1 if g["typ"] != "miejska" else 0)),
    dict(
        texts=["Opiekunowie osób z demencją są wypaleni, nie mają chwili wytchnienia.",
               "Rodzina opiekuje się mamą z Alzheimerem sama, bez żadnej pomocy.",
               "Brakuje opieki wytchnieniowej dla rodzin osób leżących."],
        areas=["seniorzy", "zdrowie"], groups=["seniorzy", "zdrowie_medycyna"], cross=["dostep_do_uslug"],
        keywords=["opiekun", "demencja", "opieka wytchnieniowa", "wypalenie", "choroba Alzheimera", "rodzina"],
        weight=lambda g: max(g["s"] - 15, 1)),
    dict(
        texts=["Dorośli z niepełnosprawnością intelektualną po skończeniu szkoły siedzą w domu.",
               "Nie ma u nas żadnego miejsca pracy ani zajęć dla dorosłych osób z niepełnosprawnością intelektualną.",
               "Rodzice starzeją się i boją, co będzie z ich dorosłym niepełnosprawnym synem."],
        areas=["niepelnosprawnosc"], groups=["niepelnosprawnosc_intelektualna", "rynek_pracy"], cross=["dostep_do_uslug"],
        keywords=["niepełnosprawność intelektualna", "dorosły", "aktywizacja", "praca", "mieszkalnictwo wspomagane", "rodzic"],
        weight=lambda g: 1.0),
    dict(
        texts=["Osoby niewidome i niedowidzące nie mogą samodzielnie załatwić sprawy w urzędzie.",
               "Osoby głuche nie mają tłumacza języka migowego w przychodni i OPS.",
               "Strony internetowe i dokumenty gminy są niedostępne dla osób z niepełnosprawnością wzroku."],
        areas=["niepelnosprawnosc"], groups=["niepelnosprawnosc_sensoryczna"], cross=["dostep_do_uslug", "wykluczenie_cyfrowe"],
        keywords=["niewidomy", "głuchy", "dostępność", "język migowy", "urząd", "bariera"],
        weight=lambda g: 0.7),
    dict(
        texts=["Rodziny z Ukrainy nie znają polskiego, dzieci mają problem w szkole.",
               "Cudzoziemcy pracujący w zakładzie nie wiedzą, jak załatwić sprawy w urzędzie.",
               "Brakuje kursów polskiego i pomocy w integracji dla nowych mieszkańców z zagranicy."],
        areas=["cudzoziemcy"], groups=["cudzoziemcy", "dzieci_mlodziez_rodzina"], cross=["dostep_do_uslug", "wspolpraca_miedzysektorowa"],
        keywords=["cudzoziemiec", "integracja", "język polski", "uchodźca", "Ukraina", "szkoła"],
        weight=lambda g: (3 if g["ludnosc"] > 30000 else 1) * (1.5 if g["c"] > 5 else 1)),
    dict(
        texts=["Zimą osoby w kryzysie bezdomności nocują na dworcu, nie ma noclegowni.",
               "Bezdomni mężczyźni po wyjściu z więzienia nie mają dokąd pójść.",
               "Osoby bezdomne nie mają gdzie się umyć i wyprać ubrań."],
        areas=["bezdomnosc", "ubostwo"], groups=["bezdomnosc"], cross=["dostep_do_uslug"],
        keywords=["bezdomność", "noclegownia", "schronienie", "zima", "łaźnia", "wykluczenie"],
        weight=lambda g: 4 if g["typ"] == "miejska" else 0.3),
    dict(
        texts=["Rodziny z dziećmi nie mają na opał i jedzenie pod koniec miesiąca.",
               "Coraz więcej emerytów przychodzi do OPS, bo nie starcza na leki i rachunki.",
               "Ubóstwo energetyczne — ludzie zimą nie ogrzewają mieszkań."],
        areas=["ubostwo"], groups=["seniorzy", "dzieci_mlodziez_rodzina"], cross=["dostep_do_uslug"],
        keywords=["ubóstwo", "ubóstwo energetyczne", "rachunek", "żywność", "pomoc społeczna", "emeryt"],
        weight=lambda g: 1 + (1 if g["c"] < 0 else 0)),
    dict(
        texts=["Długotrwale bezrobotni nie chcą wracać do pracy, nie mają motywacji.",
               "Kobiety po latach opieki nad dziećmi nie mogą znaleźć pracy.",
               "Osoby 50+ po zwolnieniu z zakładu nie odnajdują się na rynku pracy."],
        areas=["ubostwo"], groups=["rynek_pracy"], cross=[],
        keywords=["bezrobocie", "aktywizacja zawodowa", "praca", "motywacja", "kompetencja", "50+"],
        weight=lambda g: 1.0),
    dict(
        texts=["Osoby po udarze po wyjściu ze szpitala nie mają rehabilitacji w domu.",
               "Na rehabilitację na NFZ czeka się rok, a osoby leżące nie dojadą do poradni.",
               "Brakuje sprzętu rehabilitacyjnego do wypożyczenia dla mieszkańców."],
        areas=["zdrowie", "niepelnosprawnosc"], groups=["zdrowie_medycyna", "ograniczona_mobilnosc"], cross=["dostep_do_uslug"],
        keywords=["rehabilitacja", "udar", "osoba leżąca", "sprzęt rehabilitacyjny", "opieka domowa", "zdrowie"],
        weight=lambda g: max(g["s"] - 16, 1)),
    dict(
        texts=["Dzieci w pieczy zastępczej po 18. roku życia zostają same, bez mieszkania i wsparcia.",
               "Brakuje rodzin zastępczych, dzieci trafiają do placówek daleko od domu.",
               "Rodziny zastępcze są przeciążone i nie dostają wsparcia psychologicznego."],
        areas=["rodzina_piecza"], groups=["dzieci_mlodziez_rodzina"], cross=["wspolpraca_miedzysektorowa"],
        keywords=["piecza zastępcza", "rodzina zastępcza", "usamodzielnienie", "wychowanek", "dziecko", "wsparcie"],
        weight=lambda g: 0.8),
    # Tematy „luki” — świadomie spoza zakresu Biblioteki
    dict(
        texts=["Mieszkańcy osiedla skarżą się na samotność młodych matek na urlopie macierzyńskim w nowych blokach.",
               "Nowi mieszkańcy osiedli deweloperskich nie znają sąsiadów i nie angażują się w życie gminy."],
        areas=["rodzina_piecza"], groups=["dzieci_mlodziez_rodzina"], cross=["samotnosc", "depopulacja_suburbanizacja"],
        keywords=["nowe osiedle", "sąsiedztwo", "integracja mieszkańców", "matka", "samotność", "suburbanizacja"],
        weight=lambda g: max(g["c"], 0.3), gap=True),
    dict(
        texts=["Rolnicy po likwidacji gospodarstw popadają w depresję, nikt się tym nie zajmuje.",
               "Coraz więcej samobójstw wśród starszych mężczyzn na wsi."],
        areas=["zdrowie_psychiczne"], groups=["zdrowie_medycyna"], cross=["samotnosc"],
        keywords=["rolnik", "depresja", "mężczyzna", "wieś", "samobójstwo", "zdrowie psychiczne"],
        weight=lambda g: 2 if g["typ"] == "wiejska" else 0.3, gap=True),
    dict(
        texts=["Gmina nie ma jak skoordynować pracy OPS, szkoły, policji i parafii przy rodzinach w kryzysie.",
               "Instytucje w gminie nie wymieniają się informacjami, rodzina opowiada swoją historię pięć razy."],
        areas=["rodzina_piecza", "ubostwo"], groups=["dzieci_mlodziez_rodzina"], cross=["wspolpraca_miedzysektorowa"],
        keywords=["koordynacja", "współpraca instytucji", "OPS", "rodzina w kryzysie", "zespół interdyscyplinarny", "przepływ informacji"],
        weight=lambda g: 0.8, gap=True),
]

ALREADY_TRIED = [
    None, None, None,
    "Próbowaliśmy spotkań w świetlicy, ale przychodziło kilka osób.",
    "OPS ma za mało pracowników, żeby to robić na bieżąco.",
    "Był projekt unijny, ale skończyło się finansowanie.",
    "Pytaliśmy w powiecie, ale nie mają takiej usługi.",
]

STATUS_WEIGHTS = {"zgloszone": 25, "w_analizie": 20, "ekspert": 15, "odpowiedz": 15, "zamkniete": 10}

# ── Eksperci (fikcyjni, nazwiska celowo „przykładowe”) ───────────────────────────────
EXPERTS = [
    ("dr Ewa Przykładowa", "gerontolożka, 15 lat w dziennych domach pomocy; usługi sąsiedzkie i samotność seniorów",
     ["seniorzy"], ["seniorzy"], ["senior", "samotność", "usługa sąsiedzka", "dzienny dom pomocy", "wolontariat"]),
    ("Marek Demowski", "koordynator transportu door-to-door w gminach wiejskich, finansowanie z PFRON",
     ["niepelnosprawnosc", "seniorzy"], ["ograniczona_mobilnosc", "seniorzy"], ["transport", "dojazd", "door-to-door", "PFRON", "wieś"]),
    ("Anna Testowa", "psycholożka dziecięca, budowanie lokalnych centrów zdrowia psychicznego dla młodzieży",
     ["zdrowie_psychiczne"], ["dzieci_mlodziez_rodzina"], ["zdrowie psychiczne", "młodzież", "psycholog", "kryzys", "szkoła"]),
    ("Piotr Wzorowy", "trener kompetencji cyfrowych seniorów, profilaktyka oszustw",
     ["seniorzy"], ["seniorzy"], ["kompetencja cyfrowa", "senior", "internet", "oszustwo", "smartfon"]),
    ("Katarzyna Fikcyjna", "doradczyni zawodowa, zatrudnienie wspomagane osób z niepełnosprawnością intelektualną",
     ["niepelnosprawnosc"], ["niepelnosprawnosc_intelektualna", "rynek_pracy"], ["zatrudnienie wspomagane", "niepełnosprawność intelektualna", "trener pracy", "aktywizacja"]),
    ("Tomasz Pokazowy", "streetworker, wychodzenie z bezdomności i model Housing First",
     ["bezdomnosc", "ubostwo"], ["bezdomnosc"], ["bezdomność", "streetworking", "housing first", "noclegownia", "mieszkanie"]),
    ("Olena Przykładowa", "mediatorka międzykulturowa, integracja rodzin z Ukrainy w szkołach",
     ["cudzoziemcy"], ["cudzoziemcy", "dzieci_mlodziez_rodzina"], ["cudzoziemiec", "integracja", "asystent międzykulturowy", "szkoła", "język polski"]),
    ("Joanna Makietowa", "specjalistka pieczy zastępczej i usamodzielniania wychowanków",
     ["rodzina_piecza"], ["dzieci_mlodziez_rodzina"], ["piecza zastępcza", "usamodzielnienie", "rodzina zastępcza", "wychowanek"]),
    ("Paweł Szkicowy", "fizjoterapeuta, wypożyczalnie sprzętu i rehabilitacja domowa",
     ["zdrowie", "niepelnosprawnosc"], ["zdrowie_medycyna", "ograniczona_mobilnosc"], ["rehabilitacja", "sprzęt rehabilitacyjny", "opieka domowa", "udar"]),
    ("Magdalena Robocza","ekspertka dostępności (WCAG, tłumaczenia PJM) w urzędach i OPS",
     ["niepelnosprawnosc"], ["niepelnosprawnosc_sensoryczna"], ["dostępność", "język migowy", "niewidomy", "WCAG", "urząd"]),
]

TEST_FEEDBACK = [
    ("Uczestnicy chętnie wracali, frekwencja lepsza niż na zwykłych zajęciach.", "Więcej materiałów w dużej czcionce."),
    ("Proste do wdrożenia, wystarczyło jedno szkolenie kadry.", "Instrukcja mogłaby mieć wersję wideo."),
    ("Działa, ale wymaga stałej osoby do koordynacji.", "Dodać wzór harmonogramu dla małych gmin."),
    ("Dobra współpraca z kołem gospodyń, rozwiązanie się przyjęło.", "Przydałby się budżet na dojazdy."),
    ("Odbiorcy na początku nieufni, po miesiącu zaangażowani.", "Dłuższy okres testu niż 3 miesiące."),
]


def status_code(rng: random.Random, used: set[str]) -> str:
    while True:
        code = "SPL-" + "".join(rng.choice(ALPHABET) for _ in range(4))
        if code not in used:
            used.add(code)
            return code


def profile(g: dict) -> dict:
    return {"s": g["udzial_65plus"] or 18, "c": g["zmiana_ludnosci_10l"] or 0, "typ": g["typ"], "ludnosc": g["ludnosc"] or 0}


def random_datetime(rng: random.Random, days_back: int = 180) -> str:
    # Lekki trend wzrostowy: nowsze zgłoszenia są częstsze (pierwiastek przesuwa masę ku dziś).
    ago = int(days_back * (1 - rng.random() ** 0.7))
    dt = datetime.combine(TODAY - timedelta(days=ago), datetime.min.time(), timezone.utc)
    return (dt + timedelta(minutes=rng.randint(7 * 60, 20 * 60))).isoformat()


def make_needs(rng: random.Random, gminy: list[dict], used: set[str]) -> list[dict]:
    profiles = [(g, profile(g)) for g in gminy]
    needs = []
    for _ in range(NEED_COUNT):
        t = rng.choices(NEED_TEMPLATES, weights=[sum(t["weight"](p) for _, p in profiles) for t in NEED_TEMPLATES])[0]
        g, _p = rng.choices(profiles, weights=[t["weight"](p) for _, p in profiles])[0]
        text = rng.choice(t["texts"])
        status = "luka" if t.get("gap") and rng.random() < 0.8 else rng.choices(
            list(STATUS_WEIGHTS), weights=list(STATUS_WEIGHTS.values()))[0]
        needs.append({
            "status_code": status_code(rng, used),
            "teryt": g["teryt"],
            "status": status,
            "best_fit": rng.randint(20, 45) if status == "luka" else rng.randint(55, 95),
            "created_at": random_datetime(rng),
            "card": {
                "summary": text,
                "areas": t["areas"],
                "groups": t["groups"],
                "cross": t["cross"],
                "gmina": g["nazwa"],
                "keywords": rng.sample(t["keywords"], k=min(len(t["keywords"]), rng.randint(4, 6))),
                "alreadyTried": rng.choice(ALREADY_TRIED),
                "clarity": round(rng.uniform(0.65, 0.95), 2),
                "followUp": None,
            },
            "synthetic": True,
        })
    return needs


def make_calls() -> list[dict]:
    # Pola formularza jak we wniosku IWS 2.0 (dane/mock/wnioski_mock.json)
    form_schema = {"fields": [
        {"key": "1_tytul", "label": "Tytuł innowacji", "type": "text"},
        {"key": "3_opis_innowacji", "label": "Opis innowacji", "type": "textarea"},
        {"key": "4_innowacyjnosc", "label": "Na czym polega innowacyjność?", "type": "textarea"},
        {"key": "5_diagnoza_problemu", "label": "Diagnoza problemu", "type": "textarea"},
        {"key": "6_odbiorcy", "label": "Odbiorcy", "type": "textarea"},
        {"key": "7_zmiana", "label": "Jaką zmianę przyniesie?", "type": "textarea"},
        {"key": "8_wizja_przyszlosci", "label": "Kto i jak może to powielić?", "type": "textarea"},
        {"key": "9_plan_dzialania", "label": "Plan działania i budżet", "type": "table"},
        {"key": "10_wnioskowana_kwota_grantu", "label": "Wnioskowana kwota grantu (zł)", "type": "number"},
        {"key": "11_zespol_projektowy", "label": "Zespół projektowy", "type": "textarea"},
    ]}
    criteria = [
        {"name": "Innowacyjność", "max": 20},
        {"name": "Trafność diagnozy problemu", "max": 20},
        {"name": "Potencjał upowszechnienia", "max": 20},
        {"name": "Wykonalność planu i budżetu", "max": 20},
        {"name": "Zgodność z Mapą Wyzwań Społecznych", "max": 20},
    ]
    return [
        {"title": "Inkubator Włączenia Społecznego — nabór jesienny 2026 (demo)",
         "description": "Granty do 120 tys. zł na przetestowanie innowacji społecznej w Małopolsce. "
                        "Priorytet: samotność, zdrowie psychiczne młodzieży, dostęp do usług w gminach wiejskich.",
         "active": True, "opens_at": "2026-09-15", "closes_at": "2026-11-30",
         "criteria": criteria, "form_schema": form_schema, "synthetic": True,
         "lemmas": ["grant", "inkubator", "innowacja społeczna", "samotność", "zdrowie psychiczne", "młodzież", "gmina wiejska", "dostęp do usług"],
         "areas": ["seniorzy", "zdrowie_psychiczne", "rodzina_piecza"]},
        {"title": "Inkubator Włączenia Społecznego — nabór wiosenny 2026 (demo)",
         "description": "Granty na innowacje dla seniorów i osób z niepełnosprawnościami. Nabór zakończony.",
         "active": False, "opens_at": "2026-03-01", "closes_at": "2026-04-30",
         "criteria": criteria, "form_schema": form_schema, "synthetic": True,
         "lemmas": ["grant", "inkubator", "senior", "niepełnosprawność"],
         "areas": ["seniorzy", "niepelnosprawnosc"]},
    ]


IDEA_STAGE = {
    "złożony": ("pomysl", "zgloszone"), "weryfikacja formalna": ("pomysl", "w_analizie"),
    "ocena merytoryczna": ("koncepcja", "w_analizie"), "zaakceptowany": ("koncepcja", "zaakceptowane"),
    "skierowany do inkubacji": ("test", "inkubacja"), "odrzucony": ("pomysl", "odrzucone"),
}


def make_ideas(rng: random.Random, used: set[str], count: int = 8) -> list[dict]:
    wnioski = read_json(ROOT.parent / "dane" / "mock" / "wnioski_mock.json")
    ideas = []
    for w in rng.sample(wnioski, k=count):
        stage, status = IDEA_STAGE.get(w["status"], ("pomysl", "zgloszone"))
        ideas.append({
            "status_code": status_code(rng, used),
            # Tylko treść merytoryczna — bez pola 2_pomyslodawca (dane kontaktowe, nawet fikcyjne).
            "fiszka": {
                "krotki_opis": w["1_tytul"],
                "istota": w["3_opis_innowacji"],
                "dla_kogo": w["6_odbiorcy"],
                "problem": w["5_diagnoza_problemu"],
                "kategoria": w["kategoria"],
                "zrodlo": w["id"],
            },
            "stage": stage,
            "status": status,
            "created_at": f"{w['data_zlozenia']}T10:00:00+00:00",
            "synthetic": True,
        })
    return ideas


def make_tests(rng: random.Random, innovations: list[dict], gminy: list[dict], count: int = 30) -> list[dict]:
    picked = rng.sample(innovations, k=min(12, len(innovations)))  # część innowacji testowana w kilku gminach
    tests = []
    for _ in range(count):
        inn = rng.choice(picked)
        done = rng.random() < 0.7
        fb, sug = rng.choice(TEST_FEEDBACK)
        tests.append({
            "innovation_slug": inn["slug"],
            "teryt": rng.choice(gminy)["teryt"],
            "status": "zakonczony" if done else rng.choice(["planowany", "w_trakcie"]),
            "rating": rng.choices([2, 3, 4, 5], weights=[1, 3, 6, 5])[0] if done else None,
            "feedback": fb if done else None,
            "suggestions": sug if done else None,
            "created_at": random_datetime(rng, 240),
            "synthetic": True,
        })
    return tests


def main() -> None:
    rng = random.Random(SEED)
    gminy = read_json(OUT / "gminy.json")
    innovations = read_json(OUT / "innovations.json")
    used: set[str] = set()

    data = {
        "_note": "DANE SYNTETYCZNE — wygenerowane przez data/seed_synthetic.py, nie dotyczą prawdziwych osób ani zgłoszeń.",
        "needs": make_needs(rng, gminy, used),
        "experts": [
            {"name": f"{n} (ekspert demo)", "description": d, "areas": a, "groups": gr, "lemmas": lm}
            for n, d, a, gr, lm in EXPERTS
        ],
        "calls": make_calls(),
        "ideas": make_ideas(rng, used),
        "tests": make_tests(rng, innovations, gminy),
    }
    write_json(OUT / "synthetic.json", data)

    from collections import Counter
    print(f"Zapisano out/synthetic.json: {len(data['needs'])} potrzeb, {len(data['experts'])} ekspertów, "
          f"{len(data['calls'])} nabory, {len(data['ideas'])} pomysłów, {len(data['tests'])} testów")
    print("Statusy:", dict(Counter(n["status"] for n in data["needs"])))
    by_gmina = Counter(next(g["nazwa"] for g in gminy if g["teryt"] == n["teryt"]) for n in data["needs"])
    print("Najwięcej zgłoszeń:", by_gmina.most_common(5))


if __name__ == "__main__":
    main()
