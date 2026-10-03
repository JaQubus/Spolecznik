# Alert

Full-width message on a soft ground: info, success or error. No border, no coloured side stripe.

Consumer provides: a short title, one or two sentences, the tone.

- Info and success: `role="status"` (WCAG 4.1.3). Error summary after submit: `role="alert"`, move focus to it, each error a link to its field.
- Tone is carried by icon + title words, not colour alone.
- Grounds: `surface-alt` (info), `brand-soft` (success), `danger-soft` (error). Text `ink`.
- Stack vertically; never several side by side.
