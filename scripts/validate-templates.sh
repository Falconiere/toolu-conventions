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

# --- JSONC (wrangler configs; comments are the point, so jq can't read them) ---
# Strips // and /* */ comments with a string-aware scanner — a naive regex would
# eat the "//" inside a URL. Trailing commas are legal JSONC but rejected here:
# the templates don't use them, and allowing them hides a real typo.
while IFS= read -r -d '' f; do
  python3 - "$f" <<'PY' >/dev/null 2>&1 || bad "jsonc parse: $f"
import json, sys

text = open(sys.argv[1], encoding="utf-8").read()
out, i, n = [], 0, len(text)
while i < n:
    ch = text[i]
    if ch == '"':
        j = i + 1
        while j < n:
            if text[j] == "\\":
                j += 2
                continue
            if text[j] == '"':
                break
            j += 1
        out.append(text[i : j + 1])
        i = j + 1
    elif text.startswith("//", i):
        while i < n and text[i] != "\n":
            i += 1
    elif text.startswith("/*", i):
        k = text.find("*/", i + 2)
        i = n if k == -1 else k + 2
    else:
        out.append(ch)
        i += 1
json.loads("".join(out))
PY
done < <(find stacks/*/templates -type f -name '*.jsonc' -print0)

# --- YAML (templates, plus this repo's OWN workflows — a kit whose CI file
#     does not parse cannot enforce anything) ---
while IFS= read -r -d '' f; do
  ruby -ryaml -e "YAML.load_file(ARGV[0])" "$f" >/dev/null 2>&1 || bad "yaml parse: $f"
done < <(find stacks/*/templates .github -type f \( -name '*.yml' -o -name '*.yaml' \) -print0 2>/dev/null)

# The kit calls all five guard-rail layers mandatory in CORE.md; it has to run
# them itself. This is the check that keeps it honest.
for wf in .github/workflows/ci.yml .github/workflows/code-review.yml; do
  [ -f "$wf" ] || bad "the kit does not run its own guard rails: missing $wf"
done

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

# --- Lint each stack's templates with THAT STACK'S SHIPPED .oxlintrc.json.
#     The pass above uses a deliberately minimal config, which is exactly how a
#     template that trips a rule the real config enables reached a scaffold and
#     turned `bun run lint` red on the very first run (a side-effect
#     `import './globals.css'` under `suspicious: error`). Templates are copied
#     to a temp dir at their project-relative paths so the config's `overrides`
#     (keyed on `src/main.tsx`, `src/app/**`, …) match the way they will in a
#     real project. `typeAware` is forced off — it needs the node_modules and
#     tsconfig that only exist inside a scaffold. ---
for d in stacks/*/; do
  stack=$(basename "$d")
  [ -f "$d/templates/.oxlintrc.json" ] || continue
  lintdir="$(mktemp -d)"
  cp -R "$d/templates/." "$lintdir/"
  if python3 -c "
import json, sys
cfg = json.load(open(sys.argv[1]))
cfg.setdefault('options', {})['typeAware'] = False
json.dump(cfg, open(sys.argv[1], 'w'), indent=2)
" "$lintdir/.oxlintrc.json" 2>/dev/null; then
    ( cd "$lintdir" && bunx oxlint --deny-warnings . ) \
      || bad "oxlint with the SHIPPED .oxlintrc.json on $stack templates"
  else
    bad "could not read $stack .oxlintrc.json to disable typeAware"
  fi
  rm -rf "$lintdir"
done

# --- The globals.css pair: both exist, and neither has the other's Tailwind
#     wiring. Copying the wrong one silently kills every utility class or every
#     UA default. These two files are shared: the marketing kit copies one of
#     them too, so a break here breaks two stacks. ---
plain=stacks/console/templates/globals.css
twind=stacks/console/templates/globals.tailwind.css
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
    const m = await import("./stacks/console/templates/theme/colors.ts");
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
  stacks/console/templates/theme/colors.ts
  stacks/console/templates/theme/icons.ts
  stacks/console/templates/theme/motion.ts
  stacks/console/templates/theme/spacing.ts
  stacks/console/templates/theme/typography.ts
)
missing=0
for f in "${depfree[@]}"; do [ -f "$f" ] || { bad "dep-free template missing: $f"; missing=1; }; done
if [ "$missing" -eq 0 ]; then
  bunx tsc --strict --noEmit "${depfree[@]}" || bad "tsc --strict on dep-free templates"
fi

# --- The HTTP client: dependency-free, but it needs the browser lib and a modern
#     target, so it gets its own pass under the console tsconfig's real flags.
#     It ships to three stacks (console, marketing, expo) — a break here is a
#     break everywhere, and it is the one template with actual logic in it. ---
http_client=stacks/console/templates/utilities/http.ts
if [ ! -f "$http_client" ]; then
  bad "http client template missing: $http_client"
else
  bunx tsc --noEmit --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes \
    --noImplicitOverride --noImplicitReturns --noUnusedLocals --noUnusedParameters \
    --useUnknownInCatchVariables --verbatimModuleSyntax \
    --target ES2022 --lib ES2022,DOM,DOM.Iterable \
    --module esnext --moduleResolution bundler \
    "$http_client" || bad "tsc --strict on $http_client"
  # Enforced by lint in a scaffold, but the templates lint non-type-aware here,
  # so check the two bans that make this file worth having.
  grep -q "from 'axios'" "$http_client" && bad "http client must not import axios: $http_client"
  grep -qE '\bas [A-Z]' "$http_client" && bad "http client must not use type assertions: $http_client"
fi

# --- Cross-stack template references: the marketing kit copies its tokens,
#     stylesheet, and (via expo) the HTTP client out of the console kit. Those
#     paths are prose in SETUP.md, so nothing else would catch a rename. ---
for f in \
  stacks/console/templates/theme/colors.ts \
  stacks/console/templates/theme/typography.ts \
  stacks/console/templates/globals.css \
  stacks/console/templates/utilities/http.ts
do
  [ -f "$f" ] || bad "cross-stack template referenced by marketing/expo is missing: $f"
done

# --- Guard rails: every stack ships both workflows, and no stack ships a
#     lefthook.yaml (the 2.x installer silently shadows it). ---
for d in stacks/*/; do
  stack=$(basename "$d")
  for wf in ci.yml code-review.yml; do
    [ -f "$d/templates/.github/workflows/$wf" ] \
      || bad "stack '$stack' is missing templates/.github/workflows/$wf"
  done
  [ -f "$d/templates/lefthook.yaml" ] \
    && bad "stack '$stack' ships lefthook.yaml — must be lefthook.yml"
done

# --- The console stack must NOT ship a vitest config: its own
#     guardrails/run.sh fails the gate when one exists (a vitest config
#     replaces vite.config.ts rather than merging, dropping the router plugin
#     and the @/* alias). Shipping one would hand every new project a template
#     that its own gate rejects. ---
[ -e stacks/console/templates/vitest.config.ts ] \
  && bad "console ships a vitest.config.ts — its guardrails/run.sh rejects one; the test block belongs in vite.config.ts"

# --- Gate extras: every TypeScript stack ships knip + jscpd configs, and the
#     jscpd config carries exitCode 1. Measured on 4.0.0, 4.2.5 and 5.0.14:
#     `threshold: 0` is what fails the gate (any clone exceeds it, jscpd throws,
#     exit 1) with or without the key — exitCode is inert at threshold 0. It
#     matters only above threshold 0, where jscpd stops throwing and without the
#     key reports clones and exits 0. Required here so the pair stays correct if
#     a project ever relaxes the threshold. ---
for stack in console marketing backend-ts expo; do
  [ -f "stacks/$stack/templates/knip.json" ] \
    || bad "stack '$stack' is missing templates/knip.json"
  jscpd_cfg="stacks/$stack/templates/.jscpd.json"
  if [ ! -f "$jscpd_cfg" ]; then
    bad "stack '$stack' is missing templates/.jscpd.json"
  else
    [ "$(jq -r '.exitCode' "$jscpd_cfg")" = "1" ] \
      || bad "jscpd config must set exitCode 1 (keeps it correct if threshold is ever raised): $jscpd_cfg"
  fi
done


# --- agent-guardrails: the copies, the declaration, and the old name ---------
# Three assertions, each guarding a distinct failure:
#   (a) a stack's copy drifting from the kit source, which is the exact rot the
#       module was built to end;
#   (b) the ceiling DECLARED in guardrails.config.json disagreeing with the one
#       oxlint actually enforces — two numbers for one rule is how they part
#       company;
#   (c) a lingering reference to the script guardrails replaced, which would
#       leave a generated project invoking a file that no longer exists.
gr_manifest='run.sh lib checks patterns schema.json oxlint-plugin'
for stack_dir in stacks/*/; do
  stack=$(basename "$stack_dir")
  copy="$stack_dir/templates/scripts/guardrails"
  [ -d "$copy" ] || { bad "guardrails: $stack has no scripts/guardrails/ copy"; continue; }
  for item in $gr_manifest; do
    diff -r "guardrails/$item" "$copy/$item" >/dev/null 2>&1 \
      || bad "guardrails: $stack copy of $item differs from guardrails/ — re-copy, don't hand-edit"
  done
  # __tests__ deliberately stays in the kit: it is a deliberately-violating tree,
  # and shipping it would trip the very gate it exists to test.
  [ -e "$copy/__tests__" ] \
    && bad "guardrails: $stack ships __tests__/ — the fixtures belong to the kit only"

  cfg="$stack_dir/templates/guardrails.config.json"
  [ -f "$cfg" ] || { bad "guardrails: $stack has no guardrails.config.json"; continue; }
  jq empty "$cfg" >/dev/null 2>&1 || { bad "guardrails: $stack config is not valid JSON"; continue; }
  for key in version srcRoot src fileSize functionSize testDir testGlob barrelNames bannedDeps shadowConfigs; do
    jq -e --arg k "$key" 'has($k)' "$cfg" >/dev/null 2>&1 \
      || bad "guardrails: $stack config is missing required key $key"
  done

  # (b) declaration vs enforcer.
  oxlintrc="$stack_dir/templates/.oxlintrc.json"
  if [ -f "$oxlintrc" ]; then
    declared_file=$(jq -r '.fileSize.max' "$cfg")
    actual_file=$(jq -r '.rules["max-lines"][1].max // empty' "$oxlintrc")
    if [ -n "$actual_file" ] && [ "$declared_file" != "$actual_file" ]; then
      bad "guardrails: $stack declares fileSize.max=$declared_file but .oxlintrc.json max-lines=$actual_file"
    fi
    declared_fn=$(jq -r '.functionSize.max' "$cfg")
    actual_fn=$(jq -r '.rules["max-lines-per-function"][1].max // empty' "$oxlintrc")
    if [ -n "$actual_fn" ] && [ "$declared_fn" != "$actual_fn" ]; then
      bad "guardrails: $stack declares functionSize.max=$declared_fn but .oxlintrc.json max-lines-per-function=$actual_fn"
    fi
  fi

  clippy_cfg="$stack_dir/templates/clippy.toml"
  if [ -f "$clippy_cfg" ]; then
    declared_fn=$(jq -r '.functionSize.max' "$cfg")
    actual_fn=$(sed -n 's/^too-many-lines-threshold *= *\([0-9]*\).*/\1/p' "$clippy_cfg")
    if [ -n "$actual_fn" ] && [ "$declared_fn" != "$actual_fn" ]; then
      bad "guardrails: $stack declares functionSize.max=$declared_fn but clippy.toml too-many-lines-threshold=$actual_fn"
    fi
  fi

  # Every check declared linter-owned must actually be a rule oxlint runs.
  # Without this, moving a check to ownedByLinter and forgetting the oxlint side
  # silently disables it in BOTH places — the fail-open this whole module exists
  # to prevent, one level up.
  owned=$(jq -r '.ownedByLinter // [] | .[]' "$cfg")
  if [ -n "$owned" ]; then
    [ -f "$oxlintrc" ] || bad "guardrails: $stack declares ownedByLinter but ships no .oxlintrc.json"
    jq -e '.jsPlugins | index("./scripts/guardrails/oxlint-plugin/index.js")' "$oxlintrc" >/dev/null 2>&1 \
      || bad "guardrails: $stack declares ownedByLinter but .oxlintrc.json does not load the house plugin"
    for check in $owned; do
      case "$check" in
        # These are enforced by oxlint built-ins rather than the house plugin.
        filename-case) jq -e '.rules["unicorn/filename-case"]' "$oxlintrc" >/dev/null 2>&1 \
          || bad "guardrails: $stack owns filename-case by linter but unicorn/filename-case is not configured" ;;
        patterns) jq -e '.rules["house/no-bare-fetch"] and .rules["house/no-hardcoded-hex"]' "$oxlintrc" >/dev/null 2>&1 \
          || bad "guardrails: $stack owns patterns by linter but the house pattern rules are not configured" ;;
        *) jq -e --arg r "house/$check" '.rules[$r]' "$oxlintrc" >/dev/null 2>&1 \
          || bad "guardrails: $stack owns $check by linter but rule house/$check is not configured" ;;
      esac
    done
  fi

  hooks="$stack_dir/templates/.claude/settings.json"
  [ -f "$hooks" ] || bad "guardrails: $stack ships no .claude/settings.json — the agent-hook layer is mandatory"
done

# (c) The old name must be gone everywhere the kit ships from. docs/toolu/ is
# excluded on purpose: the spec and decision record name the file they replace,
# and an assertion that failed on its own design docs would be self-inflicted.
# The needle lives in a variable and this file excludes itself: otherwise the
# assertion matches its own source and the gate fails on the check, not the code.
old_gate='check-structure'
gr_stale=$(grep -rl "$old_gate" stacks/ scripts/ CORE.md README.md .github/ \
  --exclude=validate-templates.sh 2>/dev/null | tr '\n' ' ')
[ -n "$gr_stale" ] && bad "guardrails: '$old_gate' still referenced in $gr_stale" 

# The kit runs the guard rails on itself.
bash guardrails/__tests__/run-fixtures.sh >/dev/null 2>&1 \
  || bad "guardrails: the fixture suite is red — run: bash guardrails/__tests__/run-fixtures.sh"
bash guardrails/__tests__/run-plugin.sh >/dev/null 2>&1 \
  || bad "guardrails: the oxlint plugin suite is red — run: bash guardrails/__tests__/run-plugin.sh"

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
