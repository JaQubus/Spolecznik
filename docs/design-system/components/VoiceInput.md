# VoiceInput

Large microphone toggle ("Opowiedz problem") with a live status line and an editable transcript.

Consumer provides: recording state, recognised text (Web Speech API, `pl-PL`), and the fallback when recognition is unsupported (show only the textarea).

- A `button` with `aria-pressed`; the label states what a press does ("Opowiedz problem" / "Słucham… kliknij, by zakończyć").
- On a screen where the mic is the primary action it takes the brand fill; next to a SearchBar it drops to `hm-btn--secondary` so there is still only one green.
- Status line `aria-live="polite"`; transcript always visible and editable.
- Pulse stops under `prefers-reduced-motion`.
