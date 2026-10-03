"""Persony z Mapy Wyzwań Społecznych (ROPS) + innowacje z Biblioteki, które na nie odpowiadają.

Persony są fikcyjne (wymyślił je ROPS do Mapy Wyzwań) — nie są danymi osobowymi. Opis to skrót z Mapy,
napisany prostym językiem. Pole `query` to przykładowy opis problemu słowami tej osoby: do demo
matchmakingu i do zbioru testowego (golden_set). Dopasowania pochodzą z analizy materiałów ROPS
(synteza zespołu) i wymagają potwierdzenia przez eksperta — w UI oznaczamy je jako „propozycja”.
Pusta lista `innovations` + `gap` = prawdziwa luka w Bibliotece (warto pokazać w demo mapy luk).

Innowacje podajemy tytułami; skrypt zamienia je na slugi z out/knowledge/innovations.json
i przerywa, jeśli tytułu nie ma w Bibliotece.

    cd data && uv run knowledge_personas.py   →  out/knowledge/personas.json"""
import json
import sys

from common import OUT, write_json

SOURCE = {
    "source_title": "Mapa Wyzwań Społecznych",
    "source_publisher": "Regionalny Ośrodek Polityki Społecznej w Krakowie",
    "source_url": "https://rops.krakow.pl/mpliki/IS/IWS_20/za._nr_2._Mapa_Wyzwa_Spoecznych.pdf",
}

PERSONAS = [
    dict(key="janina", name="Janina", age=73, area="seniorzy",
         about=["Mieszka sama w małym mieście.", "Niedawno zmarł jej mąż. Czuje się samotna i rzadko wychodzi z domu.",
                "Choruje na kilka chorób i bierze dużo leków."],
         needs=["Mniej samotności i więcej kontaktu z ludźmi.", "Pilnowanie, jakie leki bierze i kiedy."],
         query="Sąsiadka po śmierci męża siedzi sama w domu, prawie nie wychodzi i gubi się w tym, jakie leki ma brać.",
         innovations=["Senior Cuder", "Inteligentny organizer do leków", "Kody QR na pomoc seniorom", "Merkury"]),
    dict(key="stanislaw", name="Stanisław", age=56, area="zdrowie",
         about=["Pracuje na etat i opiekuje się chorą mamą.", "Przez to zaniedbuje własne zdrowie: ma otyłość i chore serce.",
                "Rzadko spotyka się z ludźmi."],
         needs=["Pogodzić pracę z opieką nad mamą.", "Znaleźć chwilę dla siebie i zadbać o zdrowie."],
         query="Pracuję i sam opiekuję się chorą mamą. Nie mam już siły, a nikt mi nie pomaga.",
         innovations=["Organizator kompleksowej opieki w miejscu zamieszkania"]),
    dict(key="karina", name="Karina", age=41, area="zdrowie_psychiczne",
         about=["Mieszka w dużym mieście.", "Ma chorobę afektywną dwubiegunową i jest pod opieką psychiatry.",
                "Po pobycie w szpitalu chce wrócić do pracy."],
         needs=["Stała praca dopasowana do jej możliwości.", "Wsparcie w powrocie do pracy bez wstydu i lęku."],
         query="Po leczeniu psychiatrycznym boję się wrócić do pracy. Nie wiem, jak sobie poradzę.",
         innovations=["Gra o zdrowie"]),
    dict(key="mateusz", name="Mateusz", age=17, area="zdrowie_psychiczne",
         about=["Chodzi do liceum w dużym mieście.", "Dużo czasu spędza w internecie.",
                "Po rozstaniu czuje pustkę i miewa stany depresyjne."],
         needs=["Wsparcie w trudnych emocjach.", "Kontakt z rówieśnikami poza internetem."],
         query="Syn ma 17 lat, zamknął się w pokoju przy komputerze i od rozstania z dziewczyną jest przygnębiony.",
         innovations=["Bez presji z depresji"]),
    dict(key="tomek", name="Tomek", age=60, area="ubostwo",
         about=["Jest na rencie rolniczej i nie pracuje.", "Mieszka sam i nie ma wokół siebie wsparcia.",
                "Grozi mu nadużywanie alkoholu."],
         needs=["Praca dorywcza i pewność, że wystarczy na jedzenie i opał na zimę.", "Ludzie, z którymi można się spotkać."],
         query="Starszy sąsiad żyje z małej renty, nie ma za co kupić opału na zimę i coraz częściej pije.",
         innovations=["Mobilna Giełda Pracy"]),
    dict(key="kuba", name="Kuba", age=22, area="bezdomnosc",
         about=["Wychował się w placówce opiekuńczo-wychowawczej.", "Stracił mieszkanie wspierane i nocuje u znajomych.",
                "Ma problem z narkotykami."],
         needs=["Bezpieczny nocleg na najbliższe dni.", "Ktoś, kto pomoże mu wejść w dorosłe życie."],
         query="Chłopak po domu dziecka nie ma gdzie mieszkać, śpi u znajomych i nie chce, żeby ktoś się dowiedział.",
         innovations=["Szlakiem ludzi bezdomnych"]),
    dict(key="swietlana", name="Swietłana", age=37, area="cudzoziemcy",
         about=["Przyjechała z Ukrainy z dwójką dzieci: 4 i 9 lat.", "W Ukrainie uczyła historii w liceum.",
                "Dzieci nie mówią po polsku."],
         needs=["Mieszkanie i praca.", "Przedszkole i szkoła, w których dzieci się odnajdą."],
         query="Mama z Ukrainy z dwójką małych dzieci nie może wynająć mieszkania, a dzieci nie mówią po polsku.",
         innovations=["Zrozum moją kulturę, zrozum mnie", "Mój pomocny Virtual World"]),
    dict(key="ania_stas", name="Ania i Staś", age=None, area="rodzina_piecza",
         about=["Rodzeństwo: Ania ma 7 lat i zespół Downa, Staś ma 12 lat i słabo słyszy.",
                "Byli już w wielu rodzinach zastępczych i placówkach."],
         needs=["Rodzina zastępcza, która przyjmie ich razem.", "Wsparcie specjalistów."],
         query="Rodzeństwo z niepełnosprawnościami ciągle trafia do różnych placówek. Szukamy sposobu, żeby się nimi zająć.",
         innovations=["koMIX życiowy"]),
    dict(key="krystian", name="Krystian", age=38, area="niepelnosprawnosc",
         about=["Ma porażenie czterokończynowe i nie mówi.", "Pracuje zdalnie, komputer obsługuje wzrokiem.",
                "Mieszka sam w małej miejscowości i jest samotny."],
         needs=["Znajomi i życie towarzyskie.", "Wychodzić z domu, kiedy chce."],
         query="Mój brat jest sparaliżowany i nie mówi. Pracuje przez komputer, ale jest bardzo samotny i nie wychodzi z domu.",
         innovations=[], gap="W Bibliotece nie ma innowacji, która dobrze odpowiada na tę potrzebę."),
]


def main() -> None:
    lib = json.loads((OUT / "knowledge" / "innovations.json").read_text(encoding="utf-8"))
    by_title = {i["title"].strip().lower(): i["slug"] for i in lib}
    errors, out = [], []
    for p in PERSONAS:
        slugs = []
        for title in p["innovations"]:
            slug = by_title.get(title.strip().lower())
            if slug:
                slugs.append(slug)
            else:
                errors.append(f"{p['name']}: brak w Bibliotece „{title}”")
        out.append({**{k: v for k, v in p.items() if k != "innovations"}, "innovation_slugs": slugs,
                    "gap": p.get("gap"), "match_note": "Propozycja dopasowania z analizy materiałów ROPS, do potwierdzenia.",
                    "fictional": True, **SOURCE})
    if errors:
        sys.exit("\n".join(errors))
    write_json(OUT / "knowledge" / "personas.json", out)
    print(f"{len(out)} person, {sum(len(p['innovation_slugs']) for p in out)} dopasowań", file=sys.stderr)


if __name__ == "__main__":
    main()
