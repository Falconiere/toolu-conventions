# Design Language — "Spec Sheet"

Stack-agnostic UI/UX language every kit under `stacks/` inherits, alongside
[`CORE.md`](./CORE.md). Derived from **codasignal.com** (verified against the
live site, 2026-07). A stack's `STRUCTURE.md` may add rules but never relax one.

Token values live in `stacks/<stack>/templates/theme/`
(`colors.ts` · `typography.ts` · `spacing.ts` · `motion.ts`) and are copied into
`src/ui/theme/` at scaffold time. **This file is the "why"; those files are the
"what".** Change one, change the other.

---

## Ethos

The product reads like a **precision instrument**: discipline, restraint,
technical confidence. Premium comes from refinement, not decoration. A screen
should look like it was measured, not styled.

Anchor references: Linear, Vercel, Anthropic Console, Raycast.

> The studio is precise, not decorative.

---

## Typography

| Role                                                    | Family         | Weights   |
| ------------------------------------------------------- | -------------- | --------- |
| Display + body                                          | **Geist Sans** | 400 · 500 · 600 |
| Labels, indices, metadata, chips, dimensions, code      | **Geist Mono** | 400 · 500 |
| Italic serif                                            | *none*         | *banned*  |

```
--font-sans: "Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--font-mono: "Geist Mono", "JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
```

**Rules**

1. **Display headings are weight 500, never 700.** Size carries the emphasis;
   weight stays calm.
2. **Negative tracking scales with size.** `-0.035em` on display/title,
   `-0.025em` on mid headings, `-0.01em` on small headings, `0` on body.
3. **Display line-height is nearly solid** — `1.02`–`1.05`. Body breathes at
   `1.55`–`1.65`.
4. **Mono carries meta, not prose.** Labels, section indices, chips, status
   lines, and coordinates are mono **uppercase** at `0.6875rem` — `+0.16em`
   tracking, `+0.06em` on chips, `+0.12em` on bracketed links (the `label` and
   `chip` variants). Dimension brackets are mono but **not** uppercase and one
   step larger — `0.875rem` at `+0.02em` (the `dimension` variant) — because they
   carry values a reader parses, not headings they scan. Web adds a `code`
   variant at the same size with normal tracking; native has none.
5. **No italic anywhere.** Emphasis is a mono uppercase token or a spruce
   underline — never a slant.
6. **Tabular numerals on numeric readouts** — the `dimension` variant sets them
   on both stacks (`font-variant-numeric: tabular-nums`, RN:
   `fontVariant: ['tabular-nums']`), as does web's `code`, and any table column
   of figures must too.
   Set a number that a reader compares or scans in one of those variants rather
   than in running prose; body copy keeps proportional figures, where tabular
   spacing reads as a gap.

---

## Color

**One neutral scale + exactly one chromatic accent.** No secondary hue, no
gradients between hues, no color-coded categories.

### Neutrals

Never pure `#000` or `#fff` on a surface — always the brand neutrals.

| Token          | Value     | Role                          |
| -------------- | --------- | ----------------------------- |
| `night`        | `#1a1a1a` | Dark page surface             |
| `nightDeep`    | `#0f0f0f` | Recessed dark                 |
| `ink`          | `#1f1f1f` | Body text on light; dark fills |
| `inkStrong`    | `#0a0a0a` | Strongest ink                 |
| `paper`        | `#fafafa` | Light surface; text on dark   |
| `cream`        | `#f4f4f4` | Quieter light surface         |
| `shell`        | `#e8e8e8` | Quietest light surface (page) |
| `neutral600`   | `#525252` | Secondary text on light (`textMuted`) |
| `neutral500`   | `#737373` | Tertiary text on light (`textSoft`)   |

Token names in this table are the `palette` keys in `theme/colors.ts`; the roles
in parentheses are the `SemanticColors` keys components actually read.

### Signal accent — spruce

```
--color-spruce:      #3a8f6f;                       /* the only chromatic note */
--color-spruce-soft: rgba(58, 143, 111, 0.16);      /* fills, hovers, focus ring */
--color-spruce-line: rgba(58, 143, 111, 0.36);      /* borders, rules */
--color-spruce-glow: rgba(58, 143, 111, 0.08);      /* atmosphere — sparingly */
```

**Spruce is reserved for meaning**, never decoration:

- status dots (live / healthy / active)
- focus rings and active underlines
- single-word emphasis tokens
- dimension marks on stat callouts
- section sigils and locators

If you cannot name the *state* a spruce pixel represents, it should be neutral.

### Feedback

The marketing site only ever renders errors on light, so the kit fills the ramp
from the same source scale for product surfaces (forms, toasts, destructive
actions). `success` **is spruce** — a healthy state is the signal state.
`warning` is the one token outside the marketing palette; use it sparingly and
never decoratively.

### Two tones, one system

Surfaces alternate **night** and **paper** section by section. Every primitive
must read correctly in both — that's what the `colorsLight` map (web/expo
`theme/colors.ts`) exists for. On dark, hairlines are `rgba(255,255,255,0.08)`
and chip borders `0.18`; on light they are `neutral300` and `neutral400`.

**Night is the default, light is the opt-in.** On web, `:root` carries the
`colors` map and an `.on-light` class overrides it with `colorsLight`; a light
section is `<section className="on-light">`. The `.on-light` block must also
re-apply `background-color` / `color` from its own variables — redeclaring the
custom properties alone flips descendants' `var()` lookups while the element
keeps the night surface it inherited. (The source site inverts the whole scheme
— it defaults to light and opts into `.on-dark` — so don't copy its class
names.) On native, the same seam is a theme provider exposing one of the two
maps.

The primary action inverts with the tone: **paper fill + ink label on night**,
**ink fill + paper label on paper**.

---

## Space & shape

| Concern            | Value                                             |
| ------------------ | ------------------------------------------------- |
| Container          | `max-width: 1280px`                               |
| Gutter             | `1.5rem` → `2rem` (≥640) → `4rem` (≥1024)         |
| Section rhythm     | `96px` · `128px` · `141px` vertical               |
| Radii              | `3px` chips · `4px` tokens · `8px` controls & fields · `12px` panels |
| Borders            | `1px` hairline — always                           |
| Touch target       | `44px` minimum on any interactive element         |
| Scroll padding     | `80px` (fixed header offset)                      |

Motif dimensions, also tokens (`layout` in `theme/spacing.ts`, both stacks):
`28px` sigil rule, `6px` status dot, `80px` spec-strip label column, `4px` focus
ring. The `64px` grid-wash cell is web-only, like the atmosphere layer itself.

The table is the **web** scale. Native compresses the page rhythm only: `24px`
screen padding and a `48` / `64` section rhythm (`theme/spacing.ts` `layout` in
the expo kit). Radii, hairline, touch target, and focus ring are identical on
both.

**No pill buttons, no large radii, no shadow-heavy cards.** Depth comes from a
hairline and a 1px lift, not from a blur. The single sanctioned shadow is
`0 1px 2px rgba(0,0,0,.05), 0 12px 32px rgba(0,0,0,.09)` — web only; on native,
depth is always a hairline.

---

## Atmosphere — web only

Two layers, maximum: **hairline grid + soft vignette.** Native ships no
atmosphere layer (no grid tokens in the expo kit) — a mobile screen is already
dense, and the grid reads as noise at phone width.

```css
background-image:
  linear-gradient(to right,  rgba(255, 255, 255, 0.035) 1px, transparent 1px),
  linear-gradient(to bottom, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
background-size: 64px 64px;
mask-image: radial-gradient(ellipse at 50% 35%, black 30%, transparent 85%);
```

On light surfaces the lines are `rgba(0,0,0,0.04)`. The grid is always masked
and always `pointer-events: none`.

---

## Motion

| Purpose                        | Duration | Easing                          |
| ------------------------------ | -------- | ------------------------------- |
| Color / border / opacity       | `200ms`  | `ease`                          |
| Buttons, transforms, surfaces  | `300ms`  | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Viewport reveal (fade-in-up)   | `700–800ms` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| List stagger step              | `120ms`  | —                               |
| Status pulse                   | `2.4s`   | `ease-in-out`, infinite         |
| Cursor blink                   | `1.05s`  | `steps(2, end)`, infinite       |

`cubic-bezier(0.16, 1, 0.3, 1)` is the house curve — fast out, long settle.

**Hover never adds a shadow.** It adds a 1px line, a spruce tint, or a `-1px`
translate. `prefers-reduced-motion: reduce` must flatten every reveal to its
final state (no opacity ramp, no transform, no transition).

---

## Schematic motifs

These are the vocabulary that makes a screen read as an instrument. Use them
where they carry information; don't sprinkle them.

| Motif             | Use                                                              |
| ----------------- | ---------------------------------------------------------------- |
| `§01 — PRECISION` | Section sigil — `label` variant in spruce, leading `layout.sigilRule` hairline |
| `├─ 2–4 weeks ─┤` | Dimension bracket — `dimension` variant, brackets in `textSoft`, value in `text` |
| `┼`               | Pin marker at section corners (decorative anchor, `aria-hidden`) |
| `[ TIMELINE ]`    | KBD chip — `chip` variant in a `borderWidth.hairline` pill, `radii.xs` |
| `●`               | Status dot — `layout.statusDot` spruce, pulsing `accentSoft` halo |
| `▌`               | Cursor block after a live/rotating token, blinking               |
| `2026 · §00`      | Coordinate label — `label` variant, upper-right                  |
| Spec strip        | Labeled `dl`: `label`-variant `dt` (`layout.specStripLabel` column) + content `dd`, hairline top/bottom |

Every dimension above is a token — build the motifs from `spacing.ts` and
`typography.ts`, never from the literals.

---

## Focus & accessibility

- Focus is **visible and spruce**: border → `spruce`, plus a `4px`
  `spruce-soft` ring. Never `outline: none` without a replacement.
- Body text on night is `paper @ 70%`; never drop below `50%` for readable text
  — `soft` tones are for labels only. On the **paper** tone `textSoft`
  (`#737373`) measures `4.54:1` over `surface` but only `3.87:1` over the
  `shell` page background — below the AA small-text bar. Anything a user must
  read on the page surface uses `textMuted` (`6.38:1`).
- `success` is spruce and `warning` is amber: both are **fill / dot / border**
  roles, not text roles. Amber on a light surface is ~`1.8:1`. Always carry the
  meaning in a neutral label beside the color.
- **Spruce is not a text color for essential copy.** Measured contrast:
  `4.42:1` on night, `3.77:1` on paper — both clear WCAG AA for large text
  (≥24px, or ≥18.66px bold) and for UI components/graphics (3:1), both fall
  short of the `4.5:1` small-text bar. So: sigils, status labels, and locators
  in spruce are fine because they are decorative-redundant (a dot, a rule, or an
  adjacent neutral label carries the same information). Never set an error
  message, a form hint, or body copy in spruce.
- Interactive elements are real `<button>` / `<a>` (RN: `Pressable` with
  `accessibilityRole`), always labeled.
- The mono 11px label size is a **label** size. Never set prose in it.

---

## Banned

- ❌ Italic serif for emphasis (or italic at all)
- ❌ A second accent hue, or spruce used decoratively
- ❌ Radial glow halos, grain overlays, animated blobs
- ❌ Glassmorphism, heavy drop-shadow cards, pill buttons
- ❌ Pure `#000` / `#fff` surfaces
- ❌ Weight-700 display headings
- ❌ Hardcoded hex or magic numbers in components — tokens only

---

## Applying it

1. Fill the theme token files from this language — they ship pre-filled with the
   values above, so a new project starts on-language by default.
2. If the intake design context asks for a **different** brand, replace the
   values but keep the *structure* (one neutral scale, one accent, two tones,
   mono meta layer, hairline depth). Record the deviation in the project's
   `CLAUDE.md` design notes.
3. Build `src/ui/*` primitives from the tokens; screens compose primitives.
   No component reads a hex.
