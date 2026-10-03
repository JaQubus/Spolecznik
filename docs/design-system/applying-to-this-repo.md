# Applying it to VibeCorner

How this system maps onto the repository's Next.js + Tailwind v4 + shadcn/ui ("new-york", neutral) setup. Paths are relative to the repo root. The repo's own conventions win where they exist: themes are classes on `<html>` (`.dark`, `.a11y-contrast`), settings are `a11y-large` / `a11y-simple`, and components stay in `components/ui/`.

## 1. `app/globals.css`: tokens

Keep the three `@import`s, `@custom-variant dark` and the `@theme inline` block, but change two lines in `@theme inline`: `--font-sans: var(--font-atkinson);` and `--font-mono: var(--font-atkinson-mono);`. Then replace the whole `:root {…}`, `.dark {…}` and `html.a11y-contrast {…}` blocks with:

```css
:root {
  --surface: #ffffff;
  --surface-alt: #f7f4ef;
  --surface-sunken: #ece7df;
  --ink: #222222;
  --ink-muted: #625d57;
  --on-ink: #ffffff;
  --border-strong: #8a847c;
  --divider: #e6e1d9;
  --brand: #1b7343;
  --brand-hover: #145a33;
  --brand-soft: #e8f3ec;
  --on-brand: #ffffff;
  --danger: #c2102c;
  --danger-soft: #fcecee;
  --focus: #222222;
  --flag-white: #ffffff;
  --flag-red: #dc143c;

  --background: var(--surface);      --foreground: var(--ink);
  --card: var(--surface);            --card-foreground: var(--ink);
  --popover: var(--surface);         --popover-foreground: var(--ink);
  --primary: var(--brand);           --primary-foreground: var(--on-brand);
  --secondary: var(--surface-alt);   --secondary-foreground: var(--ink);
  --muted: var(--surface-sunken);    --muted-foreground: var(--ink-muted);
  --accent: var(--surface-sunken);   --accent-foreground: var(--ink);
  --destructive: var(--danger);
  --border: var(--divider);          --input: var(--border-strong);
  --ring: var(--focus);
  --radius: 0.5rem; /* rounded-lg = 8px = radius-sm (text inputs) */
}

.dark {
  --surface: #161514;
  --surface-alt: #1f1e1c;
  --surface-sunken: #2a2826;
  --ink: #f2efea;
  --ink-muted: #b3ada5;
  --on-ink: #161514;
  --border-strong: #8a847c;
  --divider: #34312e;
  --brand: #6fcf97;
  --brand-hover: #8fdcaf;
  --brand-soft: #1f3a2a;
  --on-brand: #0d1f14;
  --danger: #ff8a9a;
  --danger-soft: #3b1d22;
  --focus: #f2efea;
  --flag-white: #ffffff;
  --flag-red: #dc143c;
}

/* after .dark, so high contrast wins when both are on */
html.a11y-contrast {
  --surface: #ffffff;
  --surface-alt: #ffffff;
  --surface-sunken: #f0f0f0;
  --ink: #000000;
  --ink-muted: #1f1f1f;
  --on-ink: #ffffff;
  --border-strong: #000000;
  --divider: #000000;
  --brand: #0b4f2b;
  --brand-hover: #06371d;
  --brand-soft: #ffffff;
  --on-brand: #ffffff;
  --danger: #8f0018;
  --danger-soft: #ffffff;
  --focus: #000000;
  --flag-white: #ffffff;
  --flag-red: #dc143c;
}
```

Replace the base layer's `@apply border-border outline-ring/50;` with `@apply border-border;` (the half-opacity ring fails 1.4.11), keep the repo's `:focus-visible` rule but set `outline-offset: 3px`, and add `body { font-size: 1.125rem; line-height: 1.75rem; }` and `html.a11y-simple body { font-size: 1.25rem; line-height: 2rem; }`. Keep `html.a11y-large { font-size: 125%; }`.

## 2. `app/layout.tsx`: the font

Swap `Geist` / `Geist_Mono` for `Atkinson_Hyperlegible_Next` and `Atkinson_Hyperlegible_Mono` from `next/font/google`, both with `subsets: ["latin", "latin-ext"]`, variables `--font-atkinson` and `--font-atkinson-mono`, weights `["400", "700"]` (mono `["500"]`). If the installed Next version doesn't export those names yet, put `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Mono:wght@500&family=Atkinson+Hyperlegible+Next:ital,wght@0,400;0,700;1,400&display=swap">` in `<head>` instead and point `--font-sans` / `--font-mono` at those family names.

Also in the layout: give the skip link `rounded-full bg-[var(--ink)] text-[var(--on-ink)]` (not `bg-primary`: it's not a primary action), add the flag band as the first child of `<body>` (`<span aria-hidden className="block h-1 border-t-2 border-[var(--flag-white)] bg-[var(--flag-red)]" />`), and give the footer `bg-[var(--surface-alt)] border-0 text-base` (16px floor).

## 3. `components/ui/*`: class edits

| File | Change |
|---|---|
| `button.tsx` | base `rounded-md text-sm font-medium` → `rounded-full text-lg font-bold`; remove `focus-visible:ring-[3px] focus-visible:ring-ring/50` (the global outline handles focus); sizes: `default` `h-14 px-6`, `sm` `h-12 px-4 text-base`, `lg` `h-16 px-8 text-xl`, `icon*` `size-12`; `outline` → `border border-[var(--ink)] bg-background hover:bg-secondary`, no `shadow-xs`; `link` → `text-foreground font-bold underline underline-offset-4`; `disabled:opacity-50` → `disabled:bg-muted disabled:text-muted-foreground` (50% opacity drops text below 4.5:1). |
| `input.tsx`, `textarea.tsx` | `h-14 rounded-lg border-2 border-input bg-background px-4 text-lg` (white box + 2px edge: what reads as a field); drop focus ring classes; `aria-invalid:border-[3px] aria-invalid:border-destructive`. |
| `select.tsx` | trigger `h-14 rounded-lg text-lg`; content `shadow-[var(--shadow-overlay)]`. |
| `radio-group.tsx` | item `size-[26px] border-[var(--border-strong)]`, checked `border-[8px] border-foreground`; wrap each item and its `Label` in a 48px-tall row. |
| `badge.tsx` | `default` variant → `bg-secondary text-foreground` (chips are not green); text `text-base`, `px-3 py-0.5`. |
| `label.tsx` | `text-lg font-bold`. |
| `card.tsx` | keep for dialogs and panels only; don't use it for lists (see below). |
| `sonner.tsx` | toasts on `--popover`, `shadow-[var(--shadow-overlay)]`, `role="status"`. |

## 4. App code

- `app/(public)/opisz/match-results.tsx` builds results from `Card`. Rebuild it as the **ResultList** pattern: an `<ol>` with rows split by `border-b border-border py-8`, no Card. Per row, "Jak to wdrożyć u nas?" is `variant="outline"` and "Chcę przetestować" is `variant="link"`, so ten results don't produce ten green buttons.
- The amber notice (`bg-amber-50 border-amber-500 text-amber-950`) and `border-dashed` boxes in `match-results.tsx` / `describe-flow.tsx` → **Alert** (info: `bg-secondary rounded-[16px] p-5`, an icon, no border). There's no yellow in the system.
- `components/a11y/a11y-toolbar.tsx`: buttons → `rounded-full min-h-12 px-3 text-base border-0 hover:bg-muted aria-pressed:bg-foreground aria-pressed:text-background aria-pressed:font-bold`, plus a Lucide icon each (`Type`, `Contrast`, `AlignLeft`); put the group in a `bg-secondary` strip above the header row. Add "Czytaj na głos" (`Volume2`, `speechSynthesis`) when it's built.
- `components/layout/site-header.tsx`: links → `rounded-full px-4 min-h-12 inline-flex items-center hover:bg-secondary no-underline`, current page `aria-current="page"` + `font-bold underline underline-offset-8`; wordmark `hubmi<span className="font-normal text-muted-foreground">.pl</span>`. Five nav items don't fit under 1024px: fold them behind a "Menu" button there. Under 768px the toolbar folds behind a "Dostępność" button and must open below the header row (render it after the row, or `flex-col` + `order-2` / `md:order-none`), so the pressed button doesn't jump.
- The home search: two normal shadcn `Input`s (label above, hint below the label, no placeholder) and one `Button` in a `flex flex-col md:flex-row md:items-end gap-4` form, sitting on a `bg-secondary` hero band so the white inputs stand out. No pill-shaped or fill-only fields.
- `text-sm` appears in a few places; the floor is `text-base` (16px).
- `text-muted-foreground` is safe on every surface (5.3:1+).

## 5. Check

`pnpm dlx @axe-core/cli` or Playwright + `@axe-core/playwright` on `/`, `/opisz`, `/biblioteka`, `/status/HUB-XXXX`, `/panel`, with `.dark` and `.a11y-contrast` toggled.
