hubmi.pl (placeholder name) is a public-service site for everyone in Małopolska: a sołtyska on her phone, a wójt at a desk, a senior with a screen reader. It should feel like a modern Polish public website crossed with a good travel site: mostly white and warm cream, near-black type, big rounded photos, pill buttons, and one green used so rarely that it always means "this is the next step".

Every rule below serves **WCAG 2.1 level AA**. Where a rule cites a success criterion (SC), breaking it breaks conformance.

## Content fundamentals

- **Write like a helpful neighbour, not an office.** Second person ("Twoja gmina", "Opisz problem"), short sentences, one idea each.
- **Verbs on actions:** "Opisz problem", "Zgłoś pomysł", "Zapytaj eksperta", "Jak to wdrożyć u nas?". No internal module names in the UI.
- **Sentence case** everywhere. No ALL CAPS.
- **Numbers as people say them:** "co czwarta osoba ma 65+ lat", "Dopasowanie 86 na 100", not "0.86".
- **Errors say what to do:** "Wpisz adres e-mail w formacie nazwa@domena.pl", never "Nieprawidłowe dane".
- **No emoji** in the interface.
- **Tryb prosty** (`html.a11y-simple`) swaps body copy for the easy-to-read summary, sets it in `lead`, hides secondary metadata.
- `lang="pl"` on `<html>`; mark English terms with `lang="en"`.

## Colour

Neutral first. A screen is roughly 90% `surface` and `surface-alt`, 9% `ink`, 1% `brand`.

- `surface` (white) is the page; `surface-alt` (warm cream) makes bands: hero, accessibility strip, footer. Separate areas by shifting the ground, never by outlined boxes.
- `ink` (#222) is text **and** the secondary emphasis colour: secondary button outline, selected chips, checked radios and checkboxes, done timeline steps, links (bold + underlined).
- `brand` green is spent only on: the **one** primary button per view, the SearchBar submit, the VoiceInput mic when it is the primary action, and success icons. If you see two green things on one screen, one of them is wrong.
- `danger` is for errors and nothing else. No warning yellow, no info blue: info is `surface-alt` + an icon.
- `flag-white` / `flag-red` appear once, as the 4px band at the top of Header.
- **No gradients.** Flat fills only. One shadow, `shadow-overlay`, for menus, sheets and toasts; nothing in the page flow.

### Contrast (SC 1.4.3, 1.4.11)

Measured pairs; each token's usage note lists the grounds it is safe on.

| Pair | Light | Dark | Wysoki kontrast |
|---|---|---|---|
| `ink` on any surface (worst case) | 12.9:1 | 10.8:1 | 18.4:1 |
| `ink-muted` on any surface (worst case) | 5.3:1 | 5.6:1 | 14.5:1 |
| `on-brand` on `brand` (primary button) | 5.9:1 | 9.0:1 | 9.7:1 |
| `on-ink` on `ink` (selected chip) | 15.9:1 | 15.9:1 | 21:1 |
| `danger` on any surface (worst case) | 5.0:1 | 5.5:1 | 8.5:1 |
| `border-strong` on `surface` / `surface-alt` / `surface-sunken` | 3.7 / 3.4 / 3.0:1 | 4.9 / 4.5 / 4.0:1 | 21:1 |
| `focus` ring on any surface | ≥12.9:1 | ≥10.8:1 | ≥18.4:1 |

### Themes

- **Jasny** (default) and **Ciemny**, applied by the `.dark` class on `<html>` (shadcn's `@custom-variant dark`).
- **Wysoki kontrast** is an added theme: black on white, black borders, darker green, every text pair ≥7:1 (AAA). The Header toggle sets `.a11y-contrast` on `<html>`; its block comes after `.dark` so it wins when both are on. It replaces the code's earlier blue (#0000c8) contrast primary: there is still one accent, the dark green.
- Colour never carries meaning alone (SC 1.4.1): errors have icon + words, pressed chips have a check, the fit score is written as text, links are underlined.

## Typography

- One family: **Atkinson Hyperlegible Next** (Google Fonts, full Polish diacritics), designed by the Braille Institute so look-alike letters (I l 1, O 0, rn m) stay distinct. **Atkinson Hyperlegible Mono** for codes people retype, like `HUB-4K7Q`.
- Base **18px** (`body`); smallest **16px** (`body-sm`). Nothing smaller.
- Sizes in `rem`, so "Większy tekst" (`html.a11y-large`, root 125%) and 200% browser zoom scale everything (SC 1.4.4).
- Body line height ≥1.5. Layouts survive user text-spacing overrides (line height 1.5, paragraphs 2em, letters 0.12em, words 0.16em; SC 1.4.12): no fixed heights on text containers.
- Reading width max `measure` (68ch). Left-aligned, never justified.
- One `h1` per page; headings in order (SC 1.3.1, 2.4.6). Headings are bold `ink`, never green.

## Spacing, shape and layout

- Spacing `space-1`…`space-8` (4 → 72px). Mobile gutter `space-4`, from `bp-md` `space-5`. Generous section gaps: `space-7` / `space-8`. When in doubt, add white space, not a line.
- Radii: `radius-sm` text inputs (an outlined box, so it reads as a field), `radius-md` photos and alerts, `radius-lg` hero media, **`radius-pill` every button and chip**. Text inputs are never pills: in this system the pill means "press me".
- **Mobile first.** Design at 320px wide: no horizontal scroll (SC 1.4.10), both orientations (SC 1.3.4). One column by default.
- **Tap targets ≥ `target-min` (48px)** everywhere. Beyond AA (2.5.5 is AAA), on purpose.
- **No bordered boxes with text in a row.** No feature-card grids, no stat-card rows. Browsing uses StoryTile (a rounded photo with plain text under it, no frame). Results use ResultList (rows split by rules). A section is a heading and prose.
- **Photography carries the warmth.** Real places and projects from Małopolska, 4:3, `radius-md`. No stock photos of people, no illustrations in the core flow.

## Interaction and states

- **Focus:** 3px solid `focus` outline, 3px offset, on every interactive element (SC 2.4.7). Never removed.
- **Keyboard:** the main path (search → results → wdrożenie) works with Tab, Shift+Tab, Enter, Space, in reading order (SC 2.4.3). No traps.
- **Hover:** links thicken the underline; buttons and chips shift ground (`brand-hover`, `surface-alt`, `surface-sunken`) or darken the outline to `ink`. Hover never hides content; popovers close with Esc and stay open while hovered (SC 1.4.13).
- **Async results and status changes** announce via `aria-live="polite"` / `role="status"` (SC 4.1.3). Submit errors focus an error summary.
- **Pointer:** actions fire on click (SC 2.5.2); no gesture-only interactions (SC 2.5.1).
- **Motion:** 150ms colour transitions and the mic pulse only, removed under `prefers-reduced-motion`.
- **No time limits.**
- **Accessible names start with the visible label** (SC 2.5.3).

## Iconography

- Line icons, 24px, 2px stroke, round caps: the **Lucide** set (ships with shadcn/ui), in `currentColor`, normally `ink`.
- An icon always sits next to a visible word. No icon-only buttons; decorative icons get `aria-hidden="true"`.
- Meaningful icons (error, success) meet 3:1 on their ground.

## Name and logo

"hubmi.pl" is a placeholder. Set it as a wordmark in bold Atkinson Hyperlegible Next at `h2` size, with ".pl" in `ink-muted` regular; there is no symbol. Never use the Polish state emblem (godło) or the gov.pl logotype: this is not an official government service. Partner logos (ROPS Kraków, Województwo Małopolskie, EU funds) go in the footer from their owners' official files.

## Using it with Tailwind + shadcn/ui

The exact edits for this codebase are in `applying-to-this-repo.md` (all applied on the `design-system` branch; its section 5 lists where each component lives in the code). `reference.css` is the reference implementation of every component in plain CSS.

The green is named `brand`, not `accent`, on purpose: shadcn already owns `--accent` (its hover ground). Load the font, paste this system's `tokens.css`, then point shadcn's variables at the tokens in `globals.css` (Tailwind v4):

```css
@import url("https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:wght@500&family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,700;1,400&display=swap");

:root {
  --background: var(--surface);      --foreground: var(--ink);
  --primary: var(--brand);           --primary-foreground: var(--on-brand);
  --secondary: var(--surface-alt);   --secondary-foreground: var(--ink);
  --muted: var(--surface-sunken);    --muted-foreground: var(--ink-muted);
  --accent: var(--surface-sunken);   --accent-foreground: var(--ink); /* shadcn hover ground */
  --destructive: var(--danger);
  --border: var(--divider);          --input: var(--border-strong);
  --ring: var(--focus);
  --radius: 0.5rem; /* rounded-lg = 8px = radius-sm; radius-md / radius-lg as rounded-[16px] / rounded-[24px] */
}
body { font: 400 1.125rem/1.75rem var(--font-sans); }
```

Then: shadcn `Button` → `rounded-full h-14 px-6 text-lg font-bold`; its `outline` variant → `border-[var(--ink)]`; `Input` → `h-14 text-lg`; replace the default ring with `focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[var(--focus)]`. Don't use shadcn `Card` for lists or tiles.

## Verification

Before shipping a screen: axe (`@axe-core/playwright`) zero violations; Lighthouse accessibility ≥95; check at 320px and at 200% zoom; run the main path keyboard-only and once with NVDA or VoiceOver; switch on all three accessibility toggles; count the green elements (should be one or two).

## Not synced

From JaQubus/VibeCorner at `main@68fab36`, read only (nothing was installed, built or run).

- **Colour values not taken:** the repo's `app/globals.css` is shadcn's stock neutral palette, not a brand. Two of its pairs fail AA: `--input` `oklch(0.922 0 0)` on white is about 1.3:1 for input edges (SC 1.4.11 needs 3:1), and `outline-ring/50` makes a half-transparent focus ring. This system's values replace them; the `--chart-*` and `--sidebar-*` variables have no counterpart here and stay as they are in the repo.
- **Font not taken:** the code loads Geist; this system uses Atkinson Hyperlegible Next. There are no font files in the repo.
- **Taken from the code:** the `html` class hooks (`dark`, `a11y-large`, `a11y-contrast`, `a11y-simple`), the three toggles and their labels, the five nav labels, the "hubmi.pl" wordmark, the `#tresc` skip-link target, the footer line.
- **Components not built:** the shadcn primitives in `components/ui/` (button, input, textarea, select, radio-group, badge, label, card, dialog, tabs, form, separator, skeleton, sonner) and the app components (`app/(public)/opisz/voice-input.tsx`, `match-results.tsx`, `describe-flow.tsx`). The design system's own previews ran on a small hand-written React bundle (`bundle.js` / `bundle.css`), which was not copied into this repo; `reference.css` here is the matching stylesheet, a reference implementation rather than the repo's code; "Applying it to VibeCorner" lists the class changes per file.
- No logos or icons in the repo; it uses Lucide via shadcn.
