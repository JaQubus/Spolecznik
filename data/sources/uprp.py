"""Urząd Patentowy RP: zgłoszenia patentowe, patenty i wzory instytucji publicznych z regionu. MIGAWKA PRZYKŁADOWA.

e-Wyszukiwarka UPRP (ewyszukiwarka.pue.uprp.gov.pl) nie ma publicznego API, a automatyczne zapytania blokuje ochrona
antybotowa (Incapsula) — sprawdzone 21.11.2026. Nie obchodzimy jej. Docelowo: eksport z bazy UPRP na podstawie umowy
o ponowne wykorzystanie albo dane przez EPO OPS (zgłoszenia PL są w DOCDB, patrz epo_ops.py).
Do tego czasu migawka z kilkoma rekordami przykładowymi, w tym zgłoszenie uczelni z Rzeszowa (przypadek demo 2).

    cd data && uv run sources/uprp.py
"""
from base import save_synthetic

RECORDS = [
    dict(external_id="PRZYKLAD-UPRP-001", kind="zgloszenie_patentowe", institution="Uczelnia techniczna w Rzeszowie", city="Rzeszów", published_on="2026-06-15",
         title="Sposób wytwarzania elementów nośnych z rozdrobnionych odpadów kompozytu zbrojonego włóknem węglowym",
         abstract="Sposób polega na rozdrobnieniu odpadów poprodukcyjnych kompozytu z włóknem węglowym, ukierunkowaniu włókien "
                  "i ponownym spojeniu żywicą termoplastyczną w prasie. Otrzymane elementy, np. wsporniki wyposażenia kabiny "
                  "statku powietrznego, mają wytrzymałość zbliżoną do elementów z nowego kompozytu przy niższym koszcie materiału. "
                  "Zgłoszenie opracował zespół pod kierunkiem dr hab. inż. Jana Przykładowego.",
         inventors=["Jan Przykładowy", "Anna Przykładowa"],
         keywords=["kompozyt", "włókno węglowe", "recykling", "wspornik", "lotnictwo", "odpad produkcyjny"]),
    dict(external_id="PRZYKLAD-UPRP-002", kind="zgloszenie_patentowe", institution="Uczelnia przyrodniczo-medyczna w Rzeszowie", city="Rzeszów", published_on="2026-03-02",
         title="Układ radarowy do bezkontaktowego wykrywania upadku osoby w pomieszczeniu",
         abstract="Układ zawiera moduł radaru fal milimetrowych i procesor rozpoznający upadek na podstawie zmian prędkości "
                  "i wysokości odbić od ciała. Nie rejestruje obrazu, dzięki czemu nadaje się do mieszkań osób starszych.",
         keywords=["radar", "upadek", "senior", "czujnik", "teleopieka"]),
    dict(external_id="PRZYKLAD-UPRP-003", kind="patent", institution="Uczelnia zawodowa w Krośnie", city="Krosno", published_on="2025-11-20",
         title="Biodegradowalna kształtka opakowaniowa z łusek gryki i sposób jej wytwarzania",
         abstract="Kształtka z rozdrobnionych łusek gryki spojonych spoiwem skrobiowym modyfikowanym, przeznaczona do pakowania "
                  "żywności. Rozkłada się w warunkach kompostowania przemysłowego.",
         keywords=["opakowanie", "łuska gryki", "biodegradowalne", "żywność"]),
    dict(external_id="PRZYKLAD-UPRP-004", kind="zgloszenie_patentowe", institution="Uczelnia techniczna w Rzeszowie", city="Rzeszów", published_on="2026-01-12",
         title="Sposób szacowania pojemności baterii trakcyjnej autobusu na podstawie danych z procesu ładowania",
         abstract="Sposób wykorzystuje przebiegi napięcia i prądu zapisywane przez ładowarkę do estymacji stanu zdrowia baterii "
                  "bez dodatkowych czujników. Przeznaczony dla przewoźników komunikacji miejskiej.",
         keywords=["bateria", "autobus elektryczny", "diagnostyka", "ładowanie"]),
    dict(external_id="PRZYKLAD-UPRP-005", kind="zgloszenie_patentowe", institution="Uczelnia zawodowa w Przemyślu", city="Przemyśl",
         published_on="2026-08-30", title="Powłoka hydrofobowa ograniczająca oblodzenie łopat wirnika bezzałogowego statku powietrznego",
         abstract="Powłoka zawiera nanocząstki krzemionki w matrycy fluoropolimerowej i opóźnia narastanie lodu na łopatach wirnika drona.",
         keywords=["dron", "oblodzenie", "powłoka", "wirnik"]),
    dict(external_id="PRZYKLAD-UPRP-006", kind="patent", institution="Uczelnia techniczna w Rzeszowie", city="Rzeszów", published_on="2025-05-07",
         title="Uchwyt do mocowania płaskich próbek w maszynie wytrzymałościowej",
         abstract="Uchwyt z wymiennymi szczękami ułatwia mocowanie próbek o różnej grubości w laboratoryjnej maszynie wytrzymałościowej.",
         keywords=["uchwyt", "próbka", "maszyna wytrzymałościowa", "laboratorium"]),
]

if __name__ == "__main__":
    save_synthetic("uprp", RECORDS, "e-Wyszukiwarka UPRP nie ma publicznego API i blokuje automatyczne zapytania.")
