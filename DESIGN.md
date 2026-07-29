# Design Language — CodaSignal "Signal"

Stack-agnostic UI/UX language every kit under `stacks/` inherits, alongside
[`CORE.md`](./CORE.md). This is the house system for **every app and web surface
we build** — imported from the CodaSignal design system (`v.03`, 2026-07). A
stack's `STRUCTURE.md` may add rules but never relax one.

Token values live in `stacks/<stack>/templates/theme/`
(`colors.ts` · `typography.ts` · `spacing.ts` · `motion.ts` · `icons.ts`) and are
copied into `src/ui/theme/` at scaffold time. **This file is the "why"; those
files are the "what".** Change one, change the other.

---

## Ethos

A page is **one page, alternating dark and light bands, a ruled grid behind
everything, and a single signal colour that only ever lands on the second line of
a heading or on live data.**

Controls stay quiet; data does the talking. Every claim gets a number beside it.
Premium comes from measurement, not decoration.

> The studio is precise, not decorative.

---

## Bands

The page is a stack of **full-bleed bands that alternate dark and light**. A band
owns its own token set, and **no component straddles a seam** — if a panel needs
a light background, it lives in a light band.

| Band  | Surface   | Panel     | Ink       | Rules     |
| ----- | --------- | --------- | --------- | --------- |
| Dark  | `#0e0f0d` | `#1f1f1f` | `#f2f2ef` | `#191b17` |
| Light | `#f2f2ee` | `#ffffff` | `#16170f` | `#e6e6df` |

**Dark is the default; light is a class.** On web, `:root` carries the `colors`
map and `.band-light` overrides it with `colorsLight`; a light band is
`<section class="band band-light">`. The `.band-light` block must also re-apply
`background-color` / `color` from its own variables — redeclaring the custom
properties alone flips descendants' `var()` lookups while the element keeps the
dark surface it inherited. On native, the same seam is a theme provider exposing
one of the two maps.

**The ruled backdrop.** Quarter-width vertical rules run through every band at
about 6% contrast, offset by the gutter (`.band` in `globals.css`). Crosshairs
(`┼`) mark the seams. At `<600` the rules halve to 50% so they still read.

Content is capped at **1360px**; bands are not.

The primary action inverts with the band: **paper fill + near-black label on
dark**, **ink fill + paper label on light**.

---

## The signal

**One neutral ramp per band + exactly one chromatic signal.** No secondary hue,
no gradients, no colour-coded categories.

The signal has **exactly three jobs**:

1. the **second line** of a two-line heading,
2. the **current / live** item in a data panel,
3. the **number** in a numbered list.

It never fills a button and never tints a surface. If you cannot name the *state*
a signal pixel represents, it should be neutral.

### Four temperatures, one grammar

A theme swaps the signal and **nothing else** — bands, ink, lines, radius, type,
spacing and motion are fixed, which is why a theme change reads as a change of
instrument, not a change of brand. Pick one per product and stay there.

| Theme         | Signal    | Lift      | Dim       | Use                                        |
| ------------- | --------- | --------- | --------- | ------------------------------------------ |
| **Jade** (default) | `#43c98b` | `#7be0b0` | `#2e9c6b` | Delivery, health, uptime                   |
| **Blueprint** | `#45b4cc` | `#7ed6e6` | `#2c8aa0` | Data-dense tools, read-only surfaces       |
| **Ion**       | `#9a8cf0` | `#c0b6ff` | `#6c5dd0` | Internal and AI surfaces — never marketing |
| **Chalk**     | `#f2f2ef` | `#ffffff` | `#16170f` | No-signal: print, docs, one-ink output     |

The hue arc stays green → cyan → indigo, clear of amber and red, so the signal
never collides with a status colour. Each theme also carries a **wash** (`#12241c`
for Jade on dark, `#e6f2eb` on light) that backs signal chips, the current step
and the focus ring.

Web: `<html data-signal="blueprint">` **and** `defaultSignal` in
`theme/colors.ts` — the attribute themes the CSS seam, the constant themes every
TS consumer of `colors`, and they have to name the same temperature. Native:
`defaultSignal` alone.

**On a light band the signal drops one step to `dim`** — full signal measures
`3.1:1` on paper, which is headings-only. That swap is already baked into
`colorsLight`.

**Swaps with the theme:** signal / lift / dim / wash, focus border, live dot,
checked box, current-step border, link colour, selection.
**Never swaps:** bands, ink ramp, lines, rules, radius, type, spacing, motion,
and the three status colours below.

### Status — fixed, never themed

A reader learns these once, so they cannot move.

| Status       | Colour              | Means                                                  |
| ------------ | ------------------- | ------------------------------------------------------ |
| **live**     | the signal          | Current, healthy, running. The only status that themes. |
| **degraded** | `#c99a3a`           | Slow, retrying, over budget.                            |
| **incident** | `#c9553a`           | Down, failed, destructive. Also owns the destructive border. |
| **idle**     | faint ink           | Queued, paused, not started. Absence of colour is a state. |

All four are **dot, border or mono label** roles — never a fill, never body text.

---

## Typography

| Role                                          | Family              | Weights       |
| --------------------------------------------- | ------------------- | ------------- |
| Display, titles, numbers, all prose           | **Archivo**         | 400 · 500 · 600 |
| Labels, data, tags, glyphs, code              | **JetBrains Mono**  | 400 · 500     |
| Serif, italic                                 | *none*              | *banned*      |

```
--font-sans: Archivo, Helvetica, -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
```

### The scale

| Variant     | Size          | Leading | Weight | Tracking   |
| ----------- | ------------- | ------- | ------ | ---------- |
| `displayLg` | 68 → 40       | 1.03    | 600    | `-0.038em` |
| `display`   | 50 → 30       | 1.04    | 600    | `-0.035em` |
| `statLg`    | 66 → 44       | 0.9     | 600    | `-0.045em` |
| `stat`      | 40 → 32       | 1       | 600    | `-0.04em`  |
| `quote`     | 26            | 1.4     | 500    | `-0.024em` |
| `subhead`   | 21            | 1.3     | 500    | `-0.022em` |
| `body`      | 15            | 1.7     | 400    | `0`        |
| `bodySm`    | 14            | 1.6     | 400    | `0`        |
| `marker`    | 9.5 mono caps | —       | 400    | `0.24em`   |
| `label`     | 9.5 mono caps | —       | 400    | `0.2em`    |
| `button`    | 9.5 mono caps | —       | 400    | `0.18em`   |
| `tag`       | 9 mono caps   | —       | 400    | `0.16em`   |
| `data`      | 10.5 mono caps| —       | 400    | `0.16em`   |
| `meta`      | 10 mono       | 1.6     | 400    | `0.06em`   |
| `code`      | 12 mono       | 1.75    | 400    | `0`        |

**Rules**

1. **Headings break in two.** Line one states the fact, line two names the
   consequence — and only line two takes the signal. Never colour both lines;
   never colour a single-line heading.
2. **Display weight is 600, title weight is 500. 700 is banned.** Size carries
   the emphasis.
3. **Sentence case throughout.** Tracking is `-0.035em` or tighter at every
   display size.
4. **Emphasis is weight, not colour** — `<strong>` at 600 in full ink.
5. **Mono carries meta, never prose.** The four tracking steps are not
   interchangeable: `marker` for section marks (`— §04 · speed`), `label` for
   panel and field labels, `button` for controls and bracket links, `tag` for
   chips, pagination and status words. `data` is the one mono size that carries
   values a reader parses (`FROM $40K · 6–12 WEEKS`); `meta` carries rail lines
   (`├─ … ─┤`) and is the only mono variant that is *not* uppercase.
6. **Body is never wider than 52 characters** and never a serif.
7. **Tabular numerals on every readout** — `stat`, `statLg`, `data`, `meta` and
   `code` set them; any table column of figures must too. Body copy keeps
   proportional figures.

---

## Space & shape

| Concern           | Value                                                        |
| ----------------- | ------------------------------------------------------------ |
| Container         | `max-width: 1360px`                                          |
| Gutter            | `48px` (≥1400) · `40` (600–1400) · `24` (<600)                |
| Band rhythm       | `84px` top (`56` ≤860) · `100px` bottom · `16px` header rule |
| Radii             | `3` buttons/tags · `4` fields/banners · `6` insets/toasts · `10` cards · `12` panels · `14` feature panels |
| Borders           | `1px` hairline — always                                      |
| Field height      | `42` marketing · `34` in-app                                 |
| Touch target      | `44px` minimum (an app row may be `36` inside a `44` hit area) |
| Focus ring        | `3px` wash outside a `1px` signal border                     |
| Status dot        | `7px`                                                        |
| Icon-only control | a `30px` bordered box                                        |

Radius encodes **what a thing is**, not how big it is. **No pill buttons, no
large radii.**

**Depth is a hairline.** A panel on a *light* band adds exactly one soft shadow —
`0 24px 60px rgba(20,22,15,.09)` (`0 18px 44px …/.07` for cards). A panel on a
*dark* band **drops the shadow and keeps the border**; that is the only
difference between the two treatments. Never a shadow on hover.

Native compresses the page rhythm only (`24px` screen padding, `48`/`64` band
rhythm). Radii, hairline, control geometry, touch target and focus ring are
identical on both.

---

## Motion

Motion measures; it never performs. **Nothing bounces, nothing shimmers, nothing
spins.**

| Purpose                        | Duration | Easing                        |
| ------------------------------ | -------- | ----------------------------- |
| Hover / focus — colour + border | `140ms`  | `cubic-bezier(0.2, 0, 0, 1)`  |
| Disclosure, panel swap, toggle  | `220ms`  | `cubic-bezier(0.2, 0, 0, 1)`  |
| Progress bar to a real value    | `800ms`  | `cubic-bezier(0.2, 0, 0, 1)`  |
| Live dot / cursor blink         | `1.8s`   | `steps(1, end)`, infinite     |
| Toast dwell                     | `4s`     | —                             |

`cubic-bezier(0.2, 0, 0, 1)` is the only curve in the system.

Hover changes **colour or border only** — never size, never shadow. The primary
button dips to `0.86` opacity instead of swapping a fill. Press is a **1px
nudge**. That is the whole tactile vocabulary.

`prefers-reduced-motion: reduce` makes the blink static, jumps the progress bar
to its value, and opens disclosure without a transition.

---

## Glyphs, icons and marks

Two layers, and they do different jobs: **glyphs annotate, icons afford.**

### Glyphs — drawn with the mono font

`→` next · `↗` external · `↑` to top · `┼` seam · `├─ … ─┤` rail · `·` joint ·
`§` section · `✓` done · `+` expand · `–` collapse · `/` crumb

They inherit ink, size and tracking automatically, and there is nothing to keep
in sync. **They render at the ink of their label, never the signal by default.**
One glyph per element; never a glyph pair as decoration.

### Icons — 60 marks, one pen width

Where a control needs a *target* rather than a note, use the set in
`theme/icons.ts`: six groups of ten (direction · find & arrange · code & data ·
ops & time · access & identity · state & action).

Drawn on a **24 box with a 20 live area**, **1.25px stroke**, **square caps**,
**mitred joins**, and **never filled**. Stroke scales with size only —
`16/1.0`, `20/1.25`, `24/1.5` — never with colour. They inherit ink from their
label, which is why the whole set themes for free.

**Do:** pair with a mono caps label · one stroke width per view · let ink carry
state (muted at rest, primary on hover, signal when live).
**Don't:** fill them · round the caps · put two weights side by side · tint a
whole toolbar · use one as decoration beside a heading.

**An icon alone is only legal inside a 30px bordered box.** There is no icon
library and no illustration anywhere in the system — if a concept needs a
picture, use a ruled placeholder and a caption.

### Patterns built from them

| Pattern         | Shape                                                                    |
| --------------- | ------------------------------------------------------------------------ |
| Section marker  | `— §04 · speed` — em-dash, `§NN`, middot, one word. `marker` variant.     |
| Fact rail       | 88px mono caps label column + full-ink value.                            |
| Rail line       | `├─ radius 14 · border … ─┤` — `meta` variant, one constraint per line.   |
| Index row       | number · title + sub · spec · tag · arrow box. Hover tints the row only.  |
| Spec strip      | `label`-variant `dt` + content `dd`, hairline top and bottom.            |
| Stat band       | Four cells, hairline top/bottom, 1px dividers, `stat` figure + label.     |
| Credential strip| Wordmarks in mono caps, one fact each. No logo wall, no greyed-out PNGs.  |
| Quote           | `quote` variant, no quotation marks, no photo, attribution in mono caps.  |
| Closer          | Centred two-line heading. **Once per page**, on the last band.            |

---

## States

A message states **what happened, when, and what the reader does now.** No
apology paragraph, no icon, no coloured fill — a 7px dot, a mono status label,
one line of ink, one action.

- **Banner** — panel fill, 4px radius, `7px | content | action` grid. Border
  takes the status colour; only `incident` gets a bordered action button.
- **Toast** — **always inverted** (dark on both bands: a floating object belongs
  to the app chrome, not the page). Bottom-left, 6px radius, 4s, no progress bar.
- **Empty state** — one sentence of fact, one action, and a **ruled placeholder
  at the size of the thing that will appear**. Never an illustration.
- **Loading** — skeletons hold the exact grid of the loaded row and **sit still**;
  no shimmer. Progress is a real count (`loading · 3 of 12`), never a spinner.

---

## Fields

Every input reads like a spec line: **label above in mono caps, control on the
band with a 1px border and a 4px radius, help text below in mono.** Nothing
floats, nothing animates its label.

- Focus: **signal border + 3px wash ring**, no glow, no offset jump. Identical on
  mouse and keyboard, and never removed.
- Error: **`#c9553a` border + a mono note.** The label is unchanged — the field's
  identity has to stay readable while it is being corrected.
- Disabled: a real quiet fill and a real quiet ink, not a dimmed copy.
- Choice controls: radio ring `16px`, checkbox `16px` at `3px` radius filled with
  the signal, toggle `42×22` with a `16px` knob.

---

## Voice

Write: *"Most launches break in week three."* · *"from $25K · 4–8 weeks"* ·
*"No pitch. Just the next step."*

Never: world-class, cutting-edge, leverage, exclamation marks, emoji, or **a
promise without a number attached**.

---

## Breakpoints

| At       | What moves                                                                 |
| -------- | -------------------------------------------------------------------------- |
| `≥1400`  | Full system: 1360 content, 48 gutter, display 68, three-up card rows.       |
| `1400`   | Gutter drops to 40 (and stays there down to 600).                           |
| `1120`   | Three-up rows become two-up; index rows keep the spec column.               |
| `860`    | Bands go single column. Display 50, rhythm 84 → 56, index rows drop the spec. |
| `600`    | Gutter 24, display 40, buttons full width, band rules halve to 50%.         |

---

## Contrast & accessibility — measured

| Pair                        | Ratio    | Verdict                        |
| --------------------------- | -------- | ------------------------------ |
| ink on dark band            | `17.1:1` | AAA · any size                 |
| muted ink on dark band      | `5.7:1`  | AA · body 15px and up          |
| soft ink on dark band       | `3.8:1`  | **fails AA · sub-copy 19px+**  |
| faint ink on dark band      | `2.5:1`  | **fails AA · metadata only**   |
| signal on dark band         | `9.1:1`  | AAA · safe as text             |
| ink on light band           | `16.1:1` | AAA · any size                 |
| muted ink on light band     | `6.5:1`  | AA · body 15px and up          |
| soft ink on light band      | `3.0:1`  | **fails AA · labels only**     |
| faint ink on light band     | `1.9:1`  | **under the 3:1 floor · decorative only** |
| signal-dim on light band    | `3.1:1`  | **headings only · 24px/600 up**|
| degraded on light band      | `2.3:1`  | **under the 3:1 floor — pair it with a mono label, never the dot alone** |

Faint ink and the signal are the two places this system can hurt a reader.

- **When a label carries an instruction, it moves up one step of ink** — from
  `textFaint` to `textSoft`, and to `textMuted` the moment it carries meaning.
  On a light band `textFaint` is below the 3:1 non-text floor, so nothing a
  reader has to parse may sit on it.
- **Prose never below 13px; a mono label never below 9px.**
- Status colours are **fill / dot / border** roles, not text roles. Always carry
  the meaning in a neutral label beside the colour.
- Interactive elements are real `<button>` / `<a>` (RN: `Pressable` with
  `accessibilityRole`), always labeled.
- Targets: `44px` minimum on marketing; an app row may be `36` tall as long as
  its hit area reaches `44`.

---

## Banned

- ❌ Green (signal-coloured) buttons — the signal never fills a control
- ❌ A second accent hue, or two signals in one view
- ❌ Gradients, glassmorphism, radial glows, grain overlays, animated blobs
- ❌ Serif or italic anywhere; mono paragraphs
- ❌ Shadows on dark bands; shadows on hover; pill buttons
- ❌ Weight-700 headings
- ❌ Icon libraries, illustrations, logo walls, photos beside a quote
- ❌ Spinners, shimmer skeletons, progress bars without a real number
- ❌ Hardcoded hex or magic numbers in components — tokens only

---

## Applying it

1. Fill the theme token files from this language — they ship pre-filled with the
   values above, so a new project starts on-language by default.
2. Pick **one** signal temperature for the product and set it once
   (`data-signal` **and** `defaultSignal` on web, `defaultSignal` on native).
3. If the intake design context asks for a **different** brand, replace the
   values but keep the *structure* (alternating bands, one signal with four
   steps, fixed status colours, mono meta layer, hairline depth, glyphs over
   icons). Record the deviation in the project's `CLAUDE.md` design notes.
4. Build `src/ui/*` primitives from the tokens; screens compose primitives.
   No component reads a hex.
