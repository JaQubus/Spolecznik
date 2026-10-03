# TextField

Labelled text input or textarea with optional hint and error.

Consumer provides: `id`, visible label, optional hint, `autocomplete` where it applies (WCAG 1.3.5: `email`, `name`, `address-level2` for gmina), error text.

- Label always visible above. Placeholders are examples, never labels.
- Order: label, hint, error, input; hint and error wired with `aria-describedby`.
- Box: white `surface`, 2px `border-strong` edge, `radius-sm`, 56px tall. Error: `aria-invalid="true"`, 3px `danger` border, bold `danger` text with icon and a hidden "Błąd:" prefix. Say what to do ("Wpisz adres e-mail w formacie nazwa@domena.pl").
- Validate on submit; then focus the error summary (Alert, error tone).
- Width follows the expected answer. Max 36rem. No time limits.
