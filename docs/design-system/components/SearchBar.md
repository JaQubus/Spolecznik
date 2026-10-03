# SearchBar

The home page's main entry point: two ordinary text fields ("Jaki masz problem?", "Gmina") and the page's one green "Szukaj" button.

Consumer provides: each field's id, label and optional hint, the submit handler, and optionally the VoiceInput as an alternative under it.

- **The fields are TextField inputs**, not a custom pill: white box, 2px `border-strong` edge (3.7:1 on `surface`, 3.4:1 on `surface-alt`), `radius-sm` corners, 56px tall, label above, hint between label and box. People recognise a field by an empty, outlined box; reuse that instead of inventing a new look.
- **Never pill-shaped.** In this system the pill means "button"; a pill field reads as something to press, not type in.
- **No fill-only wells.** A cream or grey fill with no edge looks like a disabled field or a tag, and its edge is far below the 3:1 that WCAG 1.4.11 asks of a fill-only boundary.
- **Examples go in the hint, not the placeholder.** A placeholder disappears as soon as you type, isn't read by every screen reader, and in a dark grey looks like a pre-filled value.
- The first field carries a muted search icon inside the box (decorative, `aria-hidden`).
- Put it on a `surface-alt` band (the hero): white boxes on cream is the clearest field-versus-page contrast. No shadow.
- Stacks under `bp-md` (full-width button); one row from `bp-md`, with inputs and button aligned on their bottom edge.
- It is a `form role="search"`; the submit is the page's single primary button.
