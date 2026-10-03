# Chip

Pill chips: static labels for areas and target groups, or `button` filter toggles with `aria-pressed`.

Consumer provides: the text; for filters, the pressed state and a group label.

- Static chip: `surface-alt` ground, `ink` text. Not interactive.
- Filter chip: 48px, `border-strong` outline; pressed = `ink` fill + `on-ink` text + check icon (state not by colour alone). Airbnb-style category filters sit in one wrapping row above results.
- At most 3 static chips per item.
