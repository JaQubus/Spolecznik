# ResultList

Ordered list of matched solutions separated by hairline rules: how results are shown instead of a grid of cards.

Consumer provides: title + link, fit score 0–100, "Dlaczego pasuje" and "Co dostosować u Ciebie" text, up to two actions.

- One column, max 48rem, rows split by a 1px `divider`; no boxes around items.
- Fit score always written as text ("Dopasowanie 86 na 100"); the ink bar is decorative (`aria-hidden`).
- Reasoning in a `dl`. Actions per row are secondary + quiet: a list of ten results must not become ten green buttons.
- Wrap the region in `aria-live="polite"` and announce the count when results arrive.
- No match (luka): an Alert plus the page's one primary "Zgłoś pomysł".
