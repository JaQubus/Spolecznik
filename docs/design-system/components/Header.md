# Header

Site header: thin flag band, accessibility strip, wordmark, primary nav, skip link.

Consumer provides: nav items with the current page (the repo's five: Opisz problem, Biblioteka i wiedza, Zgłoś pomysł, Jak to wdrożyć u nas?, Sprawdź status), toggle states, the mobile menu sheet.

- First focusable element: "Przejdź do treści".
- Accessibility toggles are classes on `<html>`, as `components/a11y/a11y-toolbar.tsx` sets them: Większy tekst → `a11y-large` (root 125%), Wysoki kontrast → `a11y-contrast` (the contrast theme), Tryb prosty → `a11y-simple` + easy-to-read copy. Each a `button` with `aria-pressed`, pressed = `ink` fill, stored in `localStorage` and restored before hydration by `A11Y_INIT_SCRIPT`. Czytaj na głos (`speechSynthesis`) is planned, not in the code yet.
- Under `bp-md` the strip folds behind "Dostępność" and opens BELOW the header row (flex `order`), so the button you pressed stays put; (`aria-expanded`, `aria-controls`; set `data-open` on `.hm-a11ybar`). Under `bp-lg` the nav folds behind "Menu".
- The 4px flag band (`flag-white` over `flag-red`) is the only national-colour element in the UI.
- No green in the header. Current page = bold + underline.
- Never the state emblem (godło) or the gov.pl logotype: this is not an official gov.pl service. Partner logos go in the footer, from their owners' files.
