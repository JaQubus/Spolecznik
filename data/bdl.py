"""Profile gmin Małopolski z API BDL GUS (README sekcja 8.3).

Ludność ogółem, ludność wg wieku (udział 65+), zmiana ludności w 10 lat.
Identyfikatory jednostek BDL ≠ TERYT — mapujemy raz, przy pobieraniu.
Nagłówek X-ClientId (zmienna BDL_CLIENT_ID) podnosi limity.
Wynik: out/gminy.json."""
from common import OUT, RAW  # noqa: F401


def main() -> None:
    raise NotImplementedError("TODO: bdl.py")


if __name__ == "__main__":
    main()
