# Button

Pill-shaped action trigger: primary (brand green), secondary (ink outline), quiet (underlined text).

Consumer provides: a verb label ("Wyślij zgłoszenie", "Znajdź rozwiązania"), `type`, an optional icon beside the text.

- **One primary per view.** It is the only green on most screens; everything else is secondary or quiet. Two green buttons side by side is a bug.
- Height `control-height` (56px); `--sm` is `target-min` (48px); `--lg` 64px for the home hero only. These are minimums: a long label wraps onto a second line instead of pushing past the screen at 320px or with "Większy tekst" (SC 1.4.10).
- `<button>` for actions, `<a class="hm-btn">` for navigation.
- Prefer `aria-disabled="true"` to `disabled` so the button stays focusable and can explain itself; better, keep it enabled and show errors on submit.
- Under `bp-sm` add `hm-btn--stack` for full width.
- No icon-only buttons. Text on brand is `on-brand`, never literal white.
- Links are `hm-link`: `link` blue, bold, underlined. Never green.
