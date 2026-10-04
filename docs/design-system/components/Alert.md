# Alert

Full-width message on a soft ground: info, warning, success or error. No border, no coloured side stripe.

Consumer provides: a short title, one or two sentences, the tone.

- Info and success: `role="status"` (WCAG 4.1.3). Error summary after submit: `role="alert"`, move focus to it, each error a link to its field.
- Tone is carried by icon + title words, not colour alone.
- Grounds: `info-soft` (info, `info` icon), `warning-soft` (warning, `warning` icon, ExclamationTriangleIcon), `brand-soft` (success), `danger-soft` (error). Text `ink`. In Wysoki kontrast all grounds are white and icons black.
- Stack vertically; never several side by side.
