"""Ewaluacja dopasowań (README sekcja 5.5).

Wejście: golden_set.jsonl, linia = {"query": "...", "relevant": ["slug", ...]}
(pusta lista relevant = oczekiwana luka).
Metryki: hit@3, MRR@5, trafność wykrywania luk.
Konfiguracje: BM25 na lematach, same embeddingi, hybryda, hybryda + rerank."""
from common import OUT, RAW  # noqa: F401


def main() -> None:
    raise NotImplementedError("TODO: eval.py")


if __name__ == "__main__":
    main()
