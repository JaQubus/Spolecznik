# Header

Site header: thin flag band, accessibility strip, wordmark, primary nav, skip link.

Consumer provides: nav items with the current page (the repo's five: Opisz problem, Biblioteka i wiedza, Zgłoś pomysł, Jak to wdrożyć u nas?, Sprawdź status), toggle states, the mobile menu sheet.

- First focusable element: "Przejdź do treści".
- Accessibility toggles are classes on `<html>`, as `components/a11y/a11y-toolbar.tsx` sets them: Większy tekst → `a11y-large` (root 125%), Wysoki kontrast → `a11y-contrast` (the contrast theme), Tryb prosty → `a11y-simple` + easy-to-read copy. Each a `button` with `aria-pressed`, pressed = `ink` fill, stored in `localStorage` and restored before hydration by `A11Y_INIT_SCRIPT`. Czytaj na głos (`speechSynthesis`) is planned, not in the code yet.
- The strip is always the top band, at every width. Under `bp-md` its toggles fold behind a "Dostępność" button inside the strip; under `bp-lg` the nav folds behind "Menu" in the wordmark row. Both are disclosure buttons (`aria-expanded`, `aria-controls`, Esc closes and returns focus) and each panel opens directly BELOW its own button, so the button you pressed stays put and DOM order = visual order = Tab order at every width. (An earlier draft put both buttons in the wordmark row with the strip moved under it by flex `order`: it doesn't fit at 320px and the strip came before its button in Tab order.)
- Phone menu: an in-flow panel under the wordmark row, not an overlay sheet (no focus trap, no scroll lock). Full-width 56px rows split by `divider` rules, 18px text, a chevron after each label; current page bold + underlined with `aria-current="page"`. Choosing a link closes it.
- Toggles and disclosure buttons are outlined pills (`border-strong`); pressed / expanded = `ink` fill. Without the outline an unpressed toggle reads as plain text on touch screens, where there is no hover.
- The 4px flag band (`flag-white` over `flag-red`) is the only national-colour element in the UI.
- No green in the header. Current page = bold + underline.
- Never the state emblem (godło) or the gov.pl logotype: this is not an official gov.pl service. Partner logos go in the footer, from their owners' files.
