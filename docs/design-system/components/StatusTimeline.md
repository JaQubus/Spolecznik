# StatusTimeline

Vertical parcel-tracking timeline for a submission's status (Zgłoszone → W analizie → Przypisano eksperta → Odpowiedź).

Consumer provides: ordered steps, each with title, optional timestamp or note, and state: done, current, todo.

- Done: `brand` dot with check (a success mark) and `brand` line; current: `info` ring on `info-soft` with an `info` dot, "Teraz" in its note, `aria-current="step"`; todo: hollow, muted.
- Readable without colour (icon, weight, words).
- Show the status code above it in the `code` style; no login needed to view it.
