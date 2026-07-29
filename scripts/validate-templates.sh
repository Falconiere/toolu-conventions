#!/usr/bin/env bash
# Template-level validation for all stack kits (spec AC-3). Dev-only tooling.
# Parses every JSON/YAML/TOML template, lints TS/TSX with a non-type-aware
# config, strict-type-checks dependency-free templates, and materializes the
# rust skeleton into a temp crate for fmt+clippy. Exit 0 = green.
set -u
cd "$(dirname "$0")/.."

fail=0
note() { printf '%s\n' "$*"; }
bad() { printf 'FAIL %s\n' "$*"; fail=1; }

# --- JSON (comment-free by rule; jq is the validator) ---
while IFS= read -r -d '' f; do
  jq empty "$f" >/dev/null 2>&1 || bad "json parse: $f"
done < <(find stacks/*/templates -type f -name '*.json' -print0)

# --- YAML ---
while IFS= read -r -d '' f; do
  ruby -ryaml -e "YAML.load_file(ARGV[0])" "$f" >/dev/null 2>&1 || bad "yaml parse: $f"
done < <(find stacks/*/templates -type f \( -name '*.yml' -o -name '*.yaml' \) -print0)

# --- TOML ---
while IFS= read -r -d '' f; do
  python3 -c "import tomllib,sys; tomllib.load(open(sys.argv[1],'rb'))" "$f" >/dev/null 2>&1 || bad "toml parse: $f"
done < <(find stacks/*/templates -type f -name '*.toml' -print0)

# --- TS/TSX lint: non-type-aware pass (type-aware .oxlintrc runs only inside a scaffold) ---
ts_files=()
while IFS= read -r -d '' f; do ts_files+=("$f"); done \
  < <(find stacks/*/templates -type f \( -name '*.ts' -o -name '*.tsx' \) -print0)
if [ "${#ts_files[@]}" -gt 0 ]; then
  bunx oxlint --deny-warnings -c scripts/oxlintrc.templates.json "${ts_files[@]}" \
    || bad "oxlint (non-type-aware) on templates"
  # House format. Each stack's templates/.oxfmtrc.json (singleQuote) is picked up
  # by oxfmt's nested-config search. Templates that fail here ship a project that
  # is RED on its very first `bun run check`.
  bunx oxfmt --check "${ts_files[@]}" \
    || bad "oxfmt --check on TS/TSX templates"
fi

# --- Web globals.css pair: both exist, and neither has the other's Tailwind wiring.
#     Copying the wrong one silently kills every utility class or every UA default. ---
plain=stacks/web/templates/globals.css
twind=stacks/web/templates/globals.tailwind.css
for f in "$plain" "$twind"; do
  [ -f "$f" ] || bad "globals template missing: $f"
done
if [ -f "$plain" ] && [ -f "$twind" ]; then
  grep -q '@import "tailwindcss";' "$twind" || bad "missing @import tailwindcss: $twind"
  grep -q '@theme inline' "$twind" || bad "missing @theme inline alias block: $twind"
  grep -q '@import "tailwindcss";' "$plain" && bad "non-Tailwind globals must not @import tailwindcss: $plain"
  grep -q 'box-sizing: border-box' "$plain" || bad "non-Tailwind globals must carry its own reset: $plain"
  # A complete --color-<name> anywhere in the Tailwind file — comments included —
  # makes Tailwind re-emit it frozen at :root, defeating @theme inline. Only the
  # alias block may spell them, so check the header comment specifically.
  if sed -n '1,/^@import/p' "$twind" | grep -q -- '--color-[a-z]'; then
    bad "header comment spells a complete --color-* name (emits a frozen var): $twind"
  fi

  # Extract DECLARATIONS only (`--tone-x:`), never `var(--tone-x)` references —
  # otherwise deleting a declaration that is also read in the same block passes.
  tone_decls() { # file, selector-regex
    sed -n "/^ *$2 {/,/^ *}\$/p" "$1" | grep -o '^ *--tone-[a-z-]*:' | tr -d ' :' | sort -u
  }
  for f in "$plain" "$twind"; do
    root_keys=$(tone_decls "$f" ':root')
    light_keys=$(tone_decls "$f" '\.band-light')
    # Guard against the selector regex silently matching nothing — "" = "" passes.
    [ -n "$root_keys" ] || bad "no --tone-* declarations found in :root: $f"
    [ -n "$light_keys" ] || bad "no --tone-* declarations found in .band-light: $f"
    [ "$root_keys" = "$light_keys" ] \
      || bad "--tone-* keys differ between :root and .band-light: $f"
  done
  # The two stylesheets must ship identical tone blocks — they are one projection
  # rendered for two scaffold paths, not two independent palettes.
  for sel in ':root' '\.band-light'; do
    diff <(sed -n "/^ *$sel {/,/^ *}\$/p" "$plain" | grep -o '^ *--tone-.*;' | tr -d ' ') \
         <(sed -n "/^ *$sel {/,/^ *}\$/p" "$twind" | grep -o '^ *--tone-.*;' | tr -d ' ') \
      >/dev/null || bad "globals.css and globals.tailwind.css disagree on $sel tone values"
  done
  # And both must match theme/colors.ts, the declared source of truth. camelCase
  # SemanticColors keys map to kebab-case --tone-* names.
  tonetmp="$(mktemp -d)"
  bun -e '
    const m = await import("./stacks/web/templates/theme/colors.ts");
    const kebab = (k) => k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
    const emit = (o) =>
      Object.entries(o)
        .map(([k, v]) => `--tone-${kebab(k)}:${v};`.replace(/ /g, ""))
        .sort()
        .join("\n");
    console.log(emit(m.colors) + "\n@@\n" + emit(m.colorsLight));
  ' > "$tonetmp/expected.txt" 2>/dev/null || bad "could not evaluate theme/colors.ts"
  if [ -s "$tonetmp/expected.txt" ]; then
    for f in "$plain" "$twind"; do
      for sel in ':root@1' '\.band-light@2'; do
        selector=${sel%@*}; part=${sel#*@}
        got=$(sed -n "/^ *$selector {/,/^ *}\$/p" "$f" | grep -o '^ *--tone-.*;' | tr -d ' ' | sort -u)
        want=$(awk -v p="$part" 'BEGIN{n=1} /^@@$/{n=2;next} n==p' "$tonetmp/expected.txt")
        [ "$got" = "$want" ] || bad "tone values drift from theme/colors.ts ($selector): $f"
      done
    done
  fi
  rm -rf "$tonetmp"
fi

# --- Strict type-check: dependency-free templates only (enumerated) ---
depfree=(
  stacks/expo/templates/theme/colors.ts
  stacks/expo/templates/theme/icons.ts
  stacks/expo/templates/theme/motion.ts
  stacks/expo/templates/theme/spacing.ts
  stacks/expo/templates/theme/typography.ts
  stacks/web/templates/theme/colors.ts
  stacks/web/templates/theme/icons.ts
  stacks/web/templates/theme/motion.ts
  stacks/web/templates/theme/spacing.ts
  stacks/web/templates/theme/typography.ts
)
missing=0
for f in "${depfree[@]}"; do [ -f "$f" ] || { bad "dep-free template missing: $f"; missing=1; }; done
if [ "$missing" -eq 0 ]; then
  bunx tsc --strict --noEmit "${depfree[@]}" || bad "tsc --strict on dep-free templates"
fi

# --- Rust skeleton: materialize into temp crate, fmt + clippy offline ---
tmpcrate="$(mktemp -d)/skel"
mkdir -p "$tmpcrate"
cp -R stacks/rust/templates/src "$tmpcrate/src"
sed 's/name = "project-name"/name = "skel-check"/' stacks/rust/templates/Cargo.toml > "$tmpcrate/Cargo.toml"
cp stacks/rust/templates/rustfmt.toml "$tmpcrate/rustfmt.toml"
( cd "$tmpcrate" \
  && CARGO_NET_OFFLINE=true cargo fmt --check \
  && CARGO_NET_OFFLINE=true cargo clippy --all-targets -- -D warnings \
) || bad "rust skeleton fmt/clippy"
rm -rf "$(dirname "$tmpcrate")"

[ "$fail" -eq 0 ] && note "validate-templates: GREEN" || note "validate-templates: RED"
exit "$fail"
