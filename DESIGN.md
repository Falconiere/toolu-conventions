# Design Language — CodaSignal "Signal"

House UI/UX language for **every app and web surface we build**. Imported from the
CodaSignal design system (`v.03`, 2026-07). Rules here bind; a project or stack
may add rules, never relax one.

**Values are not in this file.** They live in the token files. This file is the
rules; those files are the numbers. Read both.

*Which* token files depends on the platform, because the two have opposite
mechanics:

| Platform | Styled with | Values live in |
| --- | --- | --- |
| **Web** — console, marketing | **TailwindCSS utilities, always** | `ui/theme/palette.css` (what swaps: the two bands, the four signals) · `ui/theme/scale.css` (what never swaps: space, shape, type, motion) · `ui/theme/icons.ts` |
| **Native** — expo | `StyleSheet.create` + TS tokens | `ui/theme/{colors,spacing,typography,motion,icons}.ts` |

Web has a cascade, so a value can follow the band it lands in and the tokens
belong in CSS. React Native has none, so native carries the same numbers in
TypeScript. **Do not port either pattern across:** a TS colour on web cannot
follow `.band-light`, and a utility class means nothing to a `<View>`.

| Need | Read |
| --- | --- |
| Whether a thing is allowed, and which token it takes | this file |
| The band seam, and the two ways to break it silently | the `palette.css` header comment (web) |

This file lives twice, verbatim: `DESIGN.md` in the conventions kit, and
`docs/design-language.md` inside every project scaffolded from it (the kit is not
on disk there, so that copy is the only one a project's agents can read). It is
therefore written to be path-neutral — **edit it in the kit**, and projects pick
the change up at their next scaffold or by re-copying. In the kit it sits
alongside `CORE.md` and each stack's `STRUCTURE.md`.

---

## 1. Bands

The page is a stack of **full-bleed bands alternating dark and light**. A band
owns its token set.

- **No component straddles a seam.** A panel that needs a light background lives
  in a light band.
- **Dark is the default; light is a class.** Web: `:root` carries the dark band
  and `.band-light` overrides it, so a light band is
  `<section class="band band-light">` and every utility on it flips. Native: a
  provider exposing one map.
- `.band-light` **must re-apply `background-color` and `color`** from its own
  variables. Redeclaring the custom properties alone flips descendants' `var()`
  lookups while the element keeps the dark surface it inherited.
- **Ruled backdrop** (`.band`): quarter-width vertical rules, offset by the
  gutter, halving to 50% at the `sm` breakpoint. Crosshairs (`┼`) mark seams.
- Content is capped at `layout.containerMaxWidth`; **bands are not**.
- The primary action **inverts with the band** — paper fill on dark, ink fill on
  light. `colors.primary` / `onPrimary` already encode this.

---

## 2. Signal

One neutral ramp per band **+ exactly one chromatic signal**. No secondary hue,
no gradients, no colour-coded categories.

**The signal has exactly three jobs:**

1. the **second line** of a two-line heading,
2. the **current / live** item in a data panel,
3. the **number** in a numbered list.

It **never fills a button** and **never tints a surface**. If you cannot name the
*state* a signal pixel represents, make it neutral.

### Four temperatures

A theme swaps the signal and **nothing else** — so it reads as a change of
instrument, not of brand. One per product. Values: the `[data-signal]` blocks in
`palette.css` (web) · `signalThemes` in `colors.ts` (native).

| Theme | Use |
| --- | --- |
| **jade** (default) | Delivery, health, uptime |
| **blueprint** | Data-dense tools, read-only surfaces |
| **ion** | Internal and AI surfaces — never marketing |
| **chalk** | No-signal: print, docs, one-ink output |

The hue arc stays green → cyan → indigo, clear of amber and red, so the signal
never collides with a status colour.

**Setting it — one place per platform.** Web: `<html data-signal="…">`, and
nothing else (`index.html` for the console, the base layout for the marketing
site) — colour lives only in CSS there, so it cannot disagree with itself.
Native (Expo): `defaultSignal` in `colors.ts`, and nothing else.

**On a light band the signal drops one step** (`dim`) — the full signal is
headings-only on paper (§11). Already baked into `.band-light` / `colorsLight`.

| | |
| --- | --- |
| **Swaps with the theme** | the four signal steps, focus border, live dot, checked box, current-step border, link colour, selection |
| **Never swaps** | bands, ink ramp, lines, rules, radius, type, spacing, motion, status |

---

## 3. Status — fixed, never themed

A reader learns these once, so they cannot move.

| Status | Token | Means |
| --- | --- | --- |
| **live** | `success` (= the signal) | Current, healthy, running. The only status that themes. |
| **degraded** | `warning` | Slow, retrying, over budget. |
| **incident** | `danger` | Down, failed, destructive. Also owns the destructive border. |
| **idle** | `idle` | Queued, paused, not started. Absence of colour is a state. |

All four are **dot / border / mono-label** roles — never a fill, never body text.
Always carry the meaning in a neutral label beside the colour.

---

## 4. Type

**Archivo** for everything readable — display, titles, numbers, all prose.
**JetBrains Mono** for the meta layer — labels, data, tags, glyphs, code.
No serif, no italic, anywhere. Scale: the `type-*` roles in `scale.css` (web) ·
`typography` in `typography.ts` (native).

1. **Headings break in two.** Line one states the fact, line two names the
   consequence — and **only line two takes the signal**. Never colour both lines;
   never colour a single-line heading.
2. **Display is 600, titles are 500. 700 is banned.** Size carries emphasis.
3. **Sentence case throughout.**
4. **Emphasis is weight, not colour.**
5. **Mono carries meta, never prose.** The tracking steps are not
   interchangeable — pick by role, not by size:

   | Variant | Carries |
   | --- | --- |
   | `marker` | section marks — `— §04 · speed` |
   | `label` | panel and field labels |
   | `button` | controls and bracket links |
   | `tag` | chips, pagination, status words |
   | `data` | values a reader parses — `FROM $40K · 6–12 WEEKS` |
   | `meta` | rail lines `├─ … ─┤`. The only mono variant not uppercase. |

   On web each variant is one class (`type-label`, `type-meta`, …) carrying
   family, size, leading, weight, tracking, case and numerals together — a role
   is applied whole or not at all, never assembled from size utilities.

6. **Body never wider than 52 characters.**
7. **Tabular numerals on every readout.** `stat`, `statLg`, `data`, `meta` and
   `code` set them; any table column of figures must too. Prose keeps
   proportional figures.

---

## 5. Space, shape, depth

Values: `scale.css` (web) · `spacing.ts` (native — `spacing` · `radii` · `layout`
· `breakpoints`).

- **Radius encodes what a thing is**, not how big it is. No pill buttons, no
  large radii.
- **Depth is a hairline.** A panel on a **light** band adds exactly one shadow
  (`shadow-card` / `shadow-panel` / `shadow-panel-lg` on web; `shadow` in
  `colors.ts` on native). A panel on a **dark** band drops it and keeps the
  border — the only difference between the two treatments.
- **Never a shadow on hover.**
- Native compresses the **page rhythm only**. Radii, hairline, control geometry,
  touch target and focus ring are identical on both stacks.

**Breakpoints** (`--breakpoint-*` in `scale.css`, `breakpoints` in `spacing.ts` —
`xl` · `lg` · `md` · `sm`). The table reads downward; the web utilities are
min-width, so write mobile-first and let each step add back:

| At | What moves |
| --- | --- |
| `xl` 1400 | Full system: max content, widest gutter, three-up card rows. |
| `lg` 1120 | Three-up rows become two-up; index rows keep the spec column. |
| `md` 860 | Bands go single column; index rows drop the spec; rhythm compresses. |
| `sm` 600 | Narrowest gutter, buttons full width, band rules halve to 50%. |

The gutter has three steps and changes at `xl` and `sm` only — `lg` is a
column-count step, not a gutter step.

---

## 6. Motion

Motion measures; it never performs. **Nothing bounces, shimmers or spins.**
Durations and the single house curve: `--duration-*` / `--ease-signal` in
`scale.css` (web) · `motion.ts` (native).

- **Hover changes colour or border only** — never size, never shadow.
- The primary button **dips opacity** instead of swapping a fill.
- **Press is a 1px nudge.** That is the whole tactile vocabulary.
- There is **one easing curve** in the system. Do not introduce a second.
- `prefers-reduced-motion: reduce` → blink static, progress bar jumps to its
  value, disclosure opens without a transition.

---

## 7. Glyphs & icons

**Glyphs annotate; icons afford.** Both sets in `icons.ts` — the one token file
that stays TypeScript on every platform, because its values are markup, not
style. Their geometry lives with the rest of the scale.

**Glyphs** are drawn with the mono font (`glyphs`): `→ ↗ ↑ ┼ ├─ ─┤ · § ✓ + – /`.
They render **at the ink of their label, never the signal by default**. One glyph
per element; never a glyph pair as decoration.

**Icons** — 60 marks, six groups of ten (`icons`, `iconGroups`). Drawn on a
**24 box with a 20 live area**, **square caps**, **mitred joins**, and **never
filled**. Stroke scales with **size only, never with colour** (`iconStroke` —
in `icons.ts` on web, `spacing.ts` on native; it is an SVG attribute, so it is a
number on both).
They inherit ink from their label, which is why the set themes for free.

- **Do:** pair with a mono caps label · one stroke width per view · let ink carry
  state (muted at rest, primary on hover, signal when live).
- **Don't:** fill them · round the caps · put two weights side by side · tint a
  whole toolbar · use one as decoration beside a heading.
- **An icon alone is only legal inside a bordered box** (`layout.controlBox`).
- **No icon library, no illustration.** If a concept needs a picture, use a ruled
  placeholder and a caption.

---

## 8. Patterns

| Pattern | Shape |
| --- | --- |
| Section marker | `— §04 · speed` — em-dash, `§NN`, middot, one word. `marker`. |
| Fact rail | Mono caps label column + full-ink value. |
| Rail line | `├─ radius 14 · border … ─┤` — `meta`, one constraint per line. |
| Index row | number · title + sub · spec · tag · arrow box. Hover tints the row only. |
| Spec strip | `label` `dt` + content `dd`, hairline top and bottom. |
| Stat band | Four cells, hairline top/bottom, 1px dividers, `stat` figure + label. |
| Credential strip | Wordmarks in mono caps, one fact each. No logo wall, no greyed PNGs. |
| Quote | `quote`, no quotation marks, no photo, attribution in mono caps. |
| Closer | Centred two-line heading. **Once per page**, on the last band. |

---

## 9. States & fields

A message states **what happened, when, and what the reader does now.** No
apology paragraph, no icon, no coloured fill — a dot, a mono status label, one
line of ink, one action.

- **Banner** — panel fill, `dot | content | action` grid. Border takes the status
  colour; only `incident` gets a bordered action button.
- **Toast** — **always inverted** (dark on both bands: a floating object belongs
  to the app chrome, not the page). Bottom-left, no progress bar.
- **Empty state** — one sentence of fact, one action, and a **ruled placeholder
  at the size of the thing that will appear**. Never an illustration.
- **Loading** — skeletons hold the exact grid of the loaded row and **sit still**.
  Progress is a real count (`loading · 3 of 12`), never a spinner.

Every input reads like a **spec line**: label above in mono caps, control on the
band with a hairline border, help text below in mono. Nothing floats, nothing
animates its label.

- **Focus:** signal border + wash ring. No glow, no offset jump, identical on
  mouse and keyboard, **never removed**.
- **Error:** `danger` border + a mono note. **The label is unchanged** — the
  field's identity must stay readable while it is being corrected.
- **Disabled:** a real quiet fill and a real quiet ink, not a dimmed copy.

---

## 10. Voice

Write: *"Most launches break in week three."* · *"from $25K · 4–8 weeks"* ·
*"No pitch. Just the next step."*

Never: world-class, cutting-edge, leverage, exclamation marks, emoji, or **a
promise without a number attached**.

---

## 11. Contrast gate — measured

Faint ink and the signal are the two places this system can hurt a reader.

| Pair | Ratio | Verdict |
| --- | --- | --- |
| ink on dark | `17.1:1` | AAA, any size |
| muted ink on dark | `5.7:1` | AA, body and up |
| soft ink on dark | `3.8:1` | fails AA — sub-copy 19px+ |
| faint ink on dark | `2.5:1` | fails AA — metadata only |
| signal on dark | `9.1:1` | AAA, safe as text |
| ink on light | `16.1:1` | AAA, any size |
| muted ink on light | `6.5:1` | AA, body and up |
| soft ink on light | `3.0:1` | fails AA — labels only |
| faint ink on light | `1.9:1` | **under the 3:1 floor — decorative only** |
| signal-dim on light | `3.1:1` | headings only, 24px/600 up |
| degraded on light | `2.3:1` | **under the 3:1 floor — never the dot alone** |

- **A label that carries an instruction moves up one step of ink** — `textFaint`
  → `textSoft`, and → `textMuted` the moment it carries meaning.
- **Prose never below the `body`/`bodySm` floor; a mono label never below the
  `tag` floor.** The roles *are* the floor — reaching past them is how you break
  it, which is why web resets the raw font-size utilities out of existence.
- Interactive elements are real `<button>` / `<a>` (RN: `Pressable` with
  `accessibilityRole`), always labeled.
- Targets: `touch` minimum; an app row may be `row` tall as long as its hit area
  reaches the minimum.

---

## 12. Banned

- ❌ Signal-coloured buttons — the signal never fills a control
- ❌ A second accent hue, or two signals in one view
- ❌ Gradients, glassmorphism, radial glows, grain overlays, animated blobs
- ❌ Serif or italic anywhere; mono paragraphs
- ❌ Shadows on dark bands; shadows on hover; pill buttons
- ❌ Weight-700 headings
- ❌ Icon libraries, illustrations, logo walls, photos beside a quote
- ❌ Spinners, shimmer skeletons, progress bars without a real number
- ❌ Hardcoded hex or magic numbers in components — tokens only
- ❌ A second styling system on a web surface — CSS Modules, CSS-in-JS, an Astro
  scoped `<style>`, a `style` object. Utilities, and one `globals.css`.

---

## 13. Applying it

1. Tokens ship pre-filled — a new project starts on-language by default.
2. Pick **one** temperature and set it, in the one place your platform has
   (console/marketing: `data-signal` on `<html>`; expo: `defaultSignal`).
3. A **different brand** replaces values but keeps the *structure*: alternating
   bands, one signal with four steps, fixed status, mono meta layer, hairline
   depth, glyphs over icons. Record the deviation in the project's `CLAUDE.md`.
4. Build `src/ui/*` from tokens — utilities on web, `StyleSheet.create` on
   native; screens compose primitives.

**Self-check before you call a screen done:**

- [ ] Every colour, size, radius and duration came from a token — **no literal**.
- [ ] The signal appears in **at most one** of its three jobs per viewport, and
      fills nothing.
- [ ] Every heading that takes the signal is **two lines**, coloured on line two.
- [ ] Each band's components read the band's own map — nothing straddles a seam.
- [ ] Shadows: light bands only. Hover: colour or border only.
- [ ] Every ink/background pair clears §11 for its size.
- [ ] Focus is visible on every interactive element and never removed.
- [ ] Nothing from §12 is present.
