"""Testy wspólnego formatu źródeł (bez sieci i LLM).

    cd data && uv run python -m unittest discover -s sources -p 'test_*.py'
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from base import (institution_type, is_regional_public, known_university, normalize, rural_by_name,  # noqa: E402
                  scrub_persons, teryt_for)
from sources_seed import pick_duplicate, similarity  # noqa: E402


class ScrubPersons(unittest.TestCase):
    def test_title_and_name(self):
        self.assertEqual(scrub_persons("Zespół pod kierunkiem dr hab. inż. Jana Kowalskiego opracował metodę."),
                         "Zespół pod kierunkiem [osoba] opracował metodę.")
        self.assertEqual(scrub_persons("Autor: prof. Anna Nowak-Wiśniewska"), "Autor: [osoba]")

    def test_contact(self):
        self.assertEqual(scrub_persons("Kontakt: jan.kowalski@prz.edu.pl, tel. 600 100 200"), "Kontakt: [e-mail], tel. [telefon]")

    def test_keeps_institutions(self):
        text = "Politechnika Rzeszowska i Uniwersytet Rzeszowski"
        self.assertEqual(scrub_persons(text), text)


class RegionalPublic(unittest.TestCase):
    def test_universities(self):
        self.assertEqual(known_university("RZESZOW UNIVERSITY OF TECHNOLOGY"), "Politechnika Rzeszowska")
        self.assertEqual(known_university("Karpacka Państwowa Uczelnia w Krośnie"), "Państwowa Akademia Nauk Stosowanych w Krośnie")
        self.assertTrue(is_regional_public("Politechnika Rzeszowska", None, "18"))

    def test_public_bodies_need_region_teryt(self):
        self.assertTrue(is_regional_public("Gmina Komańcza", "1817042", "18"))
        self.assertFalse(is_regional_public("Gmina Kęty", "1213022", "18"))
        self.assertFalse(is_regional_public("Gmina Komańcza", None, "18"))

    def test_private_and_ngo_excluded(self):
        for name in ("Stowarzyszenie Euroregion Karpaty", "Association of the Carpathian Euroregion", "Fundacja Rozwoju",
                     "Przykład Sp. z o.o.", "ABC S.A."):
            self.assertFalse(is_regional_public(name, "1863011", "18"), name)

    def test_institution_types(self):
        self.assertEqual(institution_type("Fryderyk Chopin University Clinical Hospital in Rzeszow"), "pomoc_zdrowie")
        self.assertEqual(institution_type("Muzeum Rzemiosła w Krośnie"), "kultura")
        self.assertEqual(institution_type("Powiat Jasielski"), "powiat")
        self.assertEqual(institution_type("Solina Commune"), "gmina")

    def test_rural_vs_town(self):
        self.assertEqual(teryt_for("Sanok", "sanocki", rural=rural_by_name("Gmina Sanok")), "1817052")
        self.assertEqual(teryt_for("Sanok", "sanocki", rural=rural_by_name("Miasto Sanok")), "1817011")


class Normalize(unittest.TestCase):
    def test_drops_person_fields_and_marks_synthetic(self):
        r = normalize({"source": "uprp", "external_id": "PRZYKLAD-1", "kind": "patent", "title": "Sposób",
                       "abstract": "Opracował dr Jan Kowalski.", "institution": "Uczelnia techniczna w Rzeszowie", "city": "Rzeszów", "inventors": ["Jan Kowalski"],
                       "license": "x", "synthetic": True, "keywords": [" Kompozyt "]})
        self.assertNotIn("inventors", r)
        self.assertEqual(r["abstract"], "Opracował [osoba].")
        self.assertEqual(r["institution"], "Uczelnia techniczna w Rzeszowie (przykład)")
        self.assertEqual(r["institution_type"], "uczelnia")
        self.assertEqual(r["teryt"], "1863011")
        self.assertEqual(r["keywords"], ["kompozyt"])

    def test_rejects_unknown_source(self):
        with self.assertRaises(ValueError):
            normalize({"source": "x", "external_id": "1", "kind": "patent", "title": "t", "license": "l"})


class Duplicates(unittest.TestCase):
    def test_same_rules_as_typescript(self):
        self.assertEqual(similarity(["włókno węglowy", "kompozyt"], ["kompozytu", "włókna węglowego"]), 1)
        self.assertEqual(similarity(["monitoring"], ["monitorowanie"]), 1)
        self.assertEqual(similarity(["metoda", "system"], ["metoda"]), 0)
        pl = ["kompozyt", "włókno węglowe", "recykling", "wspornik", "lotnictwo", "odpad produkcyjny"]
        self.assertEqual(pick_duplicate(["kompozyt", "włókna węglowego", "recyklingu", "wsporniki", "przemysł lotniczy"], [("pl", pl)]), "pl")
        self.assertIsNone(pick_duplicate(["radar", "upadek", "senior", "czujnik"], [("pl", pl)]))
        self.assertIsNone(pick_duplicate(["kompozyt"], [("pl", pl)]))


if __name__ == "__main__":
    unittest.main()
