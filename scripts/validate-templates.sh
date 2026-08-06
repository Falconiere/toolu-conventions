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

# What a scaffold copies out of the kit's guardrails/ into a project's
# scripts/guardrails/. Declared once: three checks below need the same list, and
# a manifest that disagrees with itself between checks is how a file silently
# stops being validated. `__tests__/` is deliberately absent — it is a
# violating-by-design fixture tree, and shipping it would trip the gate it tests.
GR_MANIFEST='run.sh lib checks patterns schema.json oxlint-plugin'

# --- JSON (comment-free by rule; jq is the validator). shared/ is in the search
#     path alongside stacks/*/templates: shared/.claude/settings.json ships to
#     every stack the same way a per-stack template would, so it must be
#     parse-checked the same way. ---
while IFS= read -r -d '' f; do
  jq empty "$f" >/dev/null 2>&1 || bad "json parse: $f"
done < <(find stacks/*/templates shared -type f -name '*.json' -print0)

# The kit's guardrails/ ships to every project too (schema.json, the ast-grep
# pattern rules), and until the per-stack copies were consolidated away it was
# parse-checked only THROUGH them. __tests__/ is excluded: its fixtures are
# violating trees whose whole job is to fail checks, not to be valid templates.
gr_parse_files=()
while IFS= read -r -d '' f; do gr_parse_files+=("$f"); done \
  < <(find guardrails -path 'guardrails/__tests__' -prune -o -type f \
        \( -name '*.json' -o -name '*.yml' -o -name '*.yaml' \) -print0)
for f in "${gr_parse_files[@]}"; do
  case "$f" in
    *.json) jq empty "$f" >/dev/null 2>&1 || bad "json parse: $f" ;;
    *) ruby -ryaml -e "YAML.load_file(ARGV[0])" "$f" >/dev/null 2>&1 || bad "yaml parse: $f" ;;
  esac
done

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
done < <(find stacks/*/templates shared -type f -name '*.jsonc' -print0)

# --- YAML (templates, plus this repo's OWN workflows — a kit whose CI file
#     does not parse cannot enforce anything) ---
while IFS= read -r -d '' f; do
  ruby -ryaml -e "YAML.load_file(ARGV[0])" "$f" >/dev/null 2>&1 || bad "yaml parse: $f"
done < <(find stacks/*/templates .github shared -type f \( -name '*.yml' -o -name '*.yaml' \) -print0 2>/dev/null)

# The kit calls all five guard-rail layers mandatory in CORE.md; it has to run
# them itself. This is the check that keeps it honest.
for wf in .github/workflows/ci.yml .github/workflows/code-review.yml; do
  [ -f "$wf" ] || bad "the kit does not run its own guard rails: missing $wf"
done

# --- TOML ---
while IFS= read -r -d '' f; do
  python3 -c "import tomllib,sys; tomllib.load(open(sys.argv[1],'rb'))" "$f" >/dev/null 2>&1 || bad "toml parse: $f"
done < <(find stacks/*/templates shared -type f -name '*.toml' -print0)

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
  # Materialize the guard-rail module the way a scaffold does. The stack's
  # .oxlintrc.json loads ./scripts/guardrails/oxlint-plugin/index.js, and the
  # module is no longer duplicated under templates/ — so without this copy oxlint
  # fails to load the house plugin and this whole check reports a false RED.
  mkdir -p "$lintdir/scripts/guardrails"
  for item in $GR_MANIFEST; do
    cp -R "guardrails/$item" "$lintdir/scripts/guardrails/"
  done
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

# --- Same reasoning, the scaffold side: the scaffold names
#     shared/.claude/settings.json and shared/folder-README.md in its own prose
#     (it copies both straight into a new project). Nothing type-checks that
#     prose, so a rename here would only surface as a broken scaffold, not a
#     failed build. The manifest items are asserted once, further down with the
#     rest of the agent-guardrails checks — two loops over $GR_MANIFEST meant
#     one missing item reported itself twice, in two messages free to drift. ---
for f in shared/.claude/settings.json shared/folder-README.md; do
  [ -f "$f" ] || bad "scaffold-referenced path renamed or removed: $f"
done

# --- Copy SOURCES must be anchored to $KIT, never written relative to the
#     SETUP.md's own location. A scaffolding agent runs these files with its
#     CWD set to the NEW PROJECT directory, not the kit, so `../../guardrails/`
#     resolves to somewhere outside the project and the step fails if followed
#     literally. Markdown reading links ([`../../CORE.md`](../../CORE.md)) are
#     fine — they are for a human browsing the repo, not a copy instruction —
#     so strip link constructs before looking for a bare relative path. sed,
#     not perl: this script already leans on sed throughout (the globals.css
#     and clippy.toml checks above), and nothing here uses perl, so sed keeps
#     the strip without adding a dependency the rest of the file doesn't have.
#
#     Two strips, both per LINE. The first removes whole inline links. The
#     second removes a bare `](url)` tail, which is what a link wrapped across
#     two lines leaves behind — the label may wrap, the URL never does, so the
#     tail is always self-contained on its own line and needs no lookback.
#     Deliberately NOT a whole-file slurp: `[^]]*` spans newlines happily, so
#     one unclosed `[` anywhere above would swallow every `../` down to the
#     next `](`, hiding a real violation instead of reporting it. A check that
#     can be silenced by a stray bracket is worse than one that over-fires,
#     and per-line keeps `grep -n`'s numbers pointing at the real line. ---
for setup in stacks/*/SETUP.md; do
  stray=$(sed -E 's/\[[^]]*\]\([^)]*\)//g; s/\]\([^)]*\)//g' "$setup" | grep -n '\.\./' | head -5)
  [ -n "$stray" ] \
    && bad "guardrails: $setup has a copy source written relative to the file ($(printf '%s' "$stray" | head -1 | cut -c1-60)…) — anchor it to \$KIT/ instead; the agent's CWD is the new project, not the kit"
done

# --- Every stack SETUP.md must define the $KIT anchor itself. A stack that
#     forgets this block leaves every $KIT/... path in it undefined — a
#     scaffolding agent would fail on the very first `cp "$KIT/..."` line with
#     an empty variable, silently, since `cp "/guardrails/x" ...` still parses
#     as a command. ---
for setup in stacks/*/SETUP.md; do
  grep -q 'KIT=/path/to/toolu-conventions' "$setup" \
    || bad "guardrails: $setup does not define KIT=/path/to/toolu-conventions — every \$KIT/ path in it is undefined without the anchor"
done

# --- Guard rails: every stack ships both workflows, and no stack ships a
#     lefthook.yaml (the 2.x installer silently shadows it).
#
#     database-ts is exempt from the workflow rule and from nothing else. It
#     scaffolds a PACKAGE inside a workspace, not a repository, and a package
#     has no .github/ of its own — the workspace root owns CI, from
#     shared/workspace/. Shipping per-package workflows would give one repo two
#     CI definitions racing over the same gate. The root pair is asserted just
#     below instead, so the coverage moves rather than disappearing. ---
for d in stacks/*/; do
  stack=$(basename "$d")
  if [ "$stack" != 'database-ts' ]; then
    for wf in ci.yml code-review.yml; do
      [ -f "$d/templates/.github/workflows/$wf" ] \
        || bad "stack '$stack' is missing templates/.github/workflows/$wf"
    done
  fi
  [ -f "$d/templates/lefthook.yaml" ] \
    && bad "stack '$stack' ships lefthook.yaml — must be lefthook.yml"
done

# --- The workspace root template set. These are what a monorepo scaffolds
#     instead of the per-stack equivalents. ---
for f in package.json guardrails.workspace.json knip.json lefthook.yml ci.yml code-review.yml; do
  [ -f "shared/workspace/$f" ] \
    || bad "shared/workspace/ is missing $f — a scaffolded workspace root would have no $f"
done

# A guardrails.config.json at a workspace root is the one thing that must never
# ship: the oxlint plugin resolves that filename from the working directory, so
# one here lets a root-level lint run check every package against it and
# silently disable whatever each package declares ownedByLinter. Its ABSENCE is
# what makes a root-level run fail closed.
[ -e shared/workspace/guardrails.config.json ] \
  && bad "shared/workspace/ ships a guardrails.config.json — a workspace root must carry only guardrails.workspace.json, or oxlint lints every package against the root config"

# The manifest has its own contract, and it is not schema.json's.
[ -f guardrails/workspace.schema.json ] \
  || bad "guardrails: workspace.schema.json is missing — guardrails.workspace.json would have no contract"
jq -e '.required | index("packages")' guardrails/workspace.schema.json >/dev/null 2>&1 \
  || bad "guardrails: workspace.schema.json does not require 'packages' — a manifest naming nothing would validate"
jq -e --slurpfile s guardrails/workspace.schema.json \
  'has("packages") and (has("srcRoot") | not)' shared/workspace/guardrails.workspace.json >/dev/null 2>&1 \
  || bad "shared/workspace/guardrails.workspace.json must name packages and must NOT carry srcRoot — it governs no source tree of its own"

# The kit's OWN ci.yml must run every guardrails suite. run-plugin.sh went a
# long time unrun, which meant the house rules — the ones that fire while an
# agent is still typing — were untested by the gate.
for suite in run-fixtures.sh run-plugin.sh run-latency.sh; do
  grep -q "$suite" .github/workflows/ci.yml \
    || bad "the kit's ci.yml does not run guardrails/__tests__/$suite — that suite is unverified by CI"
done

# --- Every house/* rule the shared lint base references must be EXPORTED by the
#     plugin, and vice versa.
#
#     Referencing a rule the plugin does not export makes oxlint fail at plugin
#     load — the whole lint step, not one rule. That is a real failure mode with
#     a real trigger: adding a rule to lint/base.oxlintrc.json couples the base
#     to a plugin newer than the copy any already-scaffolded project has under
#     scripts/guardrails/. The reverse gap is quieter and worse: a rule the
#     plugin exports but nothing configures never runs, and looks enforced.
#
#     Asserted mechanically because it has been claimed to be broken more than
#     once by reading the plugin's export list out of date. This settles it in
#     CI instead of by inspection. ---
referenced=$(jq -r '.rules | keys[] | select(startswith("house/"))' lint/base.oxlintrc.json | sort)
exported=$(GR_CONFIG=stacks/backend-ts/templates/guardrails.config.json node -e \
  "import('./guardrails/oxlint-plugin/index.js').then(m=>console.log(Object.keys(m.default.rules).map(r=>'house/'+r).join('\n')))" \
  2>/dev/null | sort)
if [ -z "$exported" ]; then
  bad "lint-base: could not load guardrails/oxlint-plugin/index.js to read its exported rules"
else
  while IFS= read -r rule; do
    [ -n "$rule" ] || continue
    printf '%s\n' "$exported" | grep -qx "$rule" \
      || bad "lint-base: lint/base.oxlintrc.json configures $rule but the plugin does not export it — oxlint fails at PLUGIN LOAD, killing the whole lint step"
  done <<< "$referenced"
  while IFS= read -r rule; do
    [ -n "$rule" ] || continue
    printf '%s\n' "$referenced" | grep -qx "$rule" \
      || bad "lint-base: the plugin exports $rule but lint/base.oxlintrc.json never configures it — it looks enforced and never runs"
  done <<< "$exported"
fi

# --- The documented stack count must match the stacks that exist.
#
#     Adding a stack touches six prose surfaces, and the failure mode is that
#     five get updated and one keeps saying "five stacks" for a year. Assert the
#     number rather than trusting the person who adds the seventh. Each stack
#     must also be NAMED wherever stacks are enumerated, so a count that happens
#     to match cannot hide a missing row. ---
stack_count=$(find stacks -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')
case "$stack_count" in
  5) stack_word='five' ;;
  6) stack_word='six' ;;
  7) stack_word='seven' ;;
  *) stack_word='' ;;
esac
if [ -z "$stack_word" ]; then
  bad "stacks/ holds $stack_count stacks and validate-templates.sh has no word for that — add it to the case above"
else
  for doc in README.md docs/index.html docs/conventions.html docs/how-it-works.html; do
    grep -qi "$stack_word stacks" "$doc" \
      || bad "$doc does not say \"$stack_word stacks\" — stacks/ holds $stack_count and the prose has drifted"
    # Presence is not enough. A doc that mentions the count in four places and
    # gets three of them updated still reads "five stacks" somewhere, and an
    # -q match on the ONE corrected line would call that clean. Assert that no
    # OTHER count word appears next to "stacks" anywhere in the file.
    for wrong in five six seven; do
      [ "$wrong" = "$stack_word" ] && continue
      stale=$(grep -in "$wrong stacks" "$doc" | head -1)
      [ -n "$stale" ] \
        && bad "$doc still says \"$wrong stacks\" — stacks/ holds $stack_count ($stack_word): $stale"
    done
  done
fi
for d in stacks/*/; do
  stack=$(basename "$d")
  for doc in README.md SETUP.md docs/conventions.html; do
    grep -q "$stack" "$doc" \
      || bad "$doc never mentions the '$stack' stack — it is enumerated there and this one is missing"
  done
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


# --- agent-guardrails: the manifest, the declaration, and the old name -------
# Three assertions, each guarding a distinct failure:
#   (a) a manifest item missing from guardrails/ — the one copy a scaffold now
#       reads — or a stack shipping its own scripts/guardrails/ again, which is
#       the per-stack duplication this consolidation ended. This pair replaces
#       the old item-by-item diff of five copies against the kit; with no copies
#       left there is nothing to diff. It also subsumes the old "no stack ships
#       __tests__/" check: any such tree reappearing fails on the absence
#       assertion, fixtures included.
#   (b) the ceiling DECLARED in guardrails.config.json disagreeing with the one
#       oxlint actually enforces — two numbers for one rule is how they part
#       company;
#   (c) a lingering reference to the script guardrails replaced, which would
#       leave a generated project invoking a file that no longer exists.
for item in $GR_MANIFEST; do
  [ -e "guardrails/$item" ] \
    || bad "guardrails: manifest item '$item' is missing from guardrails/ — the scaffold copies it from there"
done

# --- The documented check count must match the checks that exist. Adding a
#     check is a two-file edit nobody remembers, so the number went stale the
#     first time it happened: secret-content.sh landed as the 13th while both
#     READMEs still advertised 12. Only the "# N checks" tree comments are
#     asserted here — the prose that spells the number in words ("all
#     thirteen") is not, so keep those in step by hand when this fires.
#
#     Anchored to the tree-diagram line, not a bare substring: an unrelated
#     sentence elsewhere in the doc that happens to contain the right number
#     would otherwise satisfy the grep while the diagram itself stayed stale —
#     a check answering a question nobody asked. ---
check_count=$(find guardrails/checks -maxdepth 1 -name '*.sh' -type f | wc -l | tr -d ' ')
for doc in README.md guardrails/README.md; do
  grep -qE "^.*── checks/ *# $check_count checks" "$doc" \
    || bad "guardrails: $doc's checks/ tree line does not say '# $check_count checks' — guardrails/checks/ holds $check_count, and the diagram has drifted"
done
[ -d guardrails/__tests__ ] \
  || bad "guardrails: guardrails/__tests__/ is missing from the kit — it is the module's own test suite"

for stack_dir in stacks/*/; do
  stack=$(basename "$stack_dir")
  # If templates/scripts/guardrails/ reappears under any stack, the per-stack
  # duplication this consolidation removed is coming back. A scaffold copies
  # the manifest straight out of the kit's guardrails/ now, so no stack should
  # ever carry its own tree again — __tests__/ included.
  [ -e "$stack_dir/templates/scripts/guardrails" ] \
    && bad "guardrails: $stack ships templates/scripts/guardrails/ — copy the manifest from the kit's guardrails/ instead of duplicating it per-stack"

  cfg="$stack_dir/templates/guardrails.config.json"
  [ -f "$cfg" ] || { bad "guardrails: $stack has no guardrails.config.json"; continue; }
  jq empty "$cfg" >/dev/null 2>&1 || { bad "guardrails: $stack config is not valid JSON"; continue; }
  for key in version srcRoot src fileSize functionSize testDir testGlob barrelNames bannedDeps shadowConfigs; do
    jq -e --arg k "$key" 'has($k)' "$cfg" >/dev/null 2>&1 \
      || bad "guardrails: $stack config is missing required key $key"
  done

  # (b) declaration vs enforcer.
  oxlintrc="$stack_dir/templates/.oxlintrc.json"
  # The shared core lives in base.oxlintrc.json (synced from lint/); the stack
  # file only carries what genuinely differs plus the ceilings guardrails.config
  # declares. Assertions read whichever file actually owns the key.
  oxbase="$stack_dir/templates/base.oxlintrc.json"
  if [ -f "$oxlintrc" ]; then
    jq -e --arg b "./base.oxlintrc.json" '(.extends // []) | index($b)' "$oxlintrc" >/dev/null 2>&1 \
      || bad "lint-base: $stack .oxlintrc.json does not extend ./base.oxlintrc.json — the shared core would be silently absent"
    [ -f "$oxbase" ] || bad "lint-base: $stack has no base.oxlintrc.json copy"
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

    # The per-glob ceilings need the same assertion as the base one. console and
    # expo declare functionSize.overrides {"**/*.tsx": 80} and carry a matching
    # .oxlintrc.json override; without this, one can be edited and the other left
    # behind — two numbers for one rule, which is the whole failure mode.
    while IFS=$'\t' read -r glob want; do
      [ -n "$glob" ] || continue
      got=$(jq -r --arg g "$glob" \
        '[.overrides[]? | select((.files // []) | index($g)) | .rules["max-lines-per-function"][1].max] | first // empty' \
        "$oxlintrc")
      if [ -z "$got" ]; then
        bad "guardrails: $stack declares functionSize.overrides[\"$glob\"]=$want but .oxlintrc.json has no max-lines-per-function override for $glob"
      elif [ "$got" != "$want" ]; then
        bad "guardrails: $stack declares functionSize.overrides[\"$glob\"]=$want but .oxlintrc.json enforces $got"
      fi
    done < <(jq -r '.functionSize.overrides // {} | to_entries[] | "\(.key)\t\(.value)"' "$cfg")
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
    [ -f "$oxbase" ] || bad "guardrails: $stack declares ownedByLinter but ships no base.oxlintrc.json"
    jq -e '.jsPlugins | index("./scripts/guardrails/oxlint-plugin/index.js")' "$oxbase" >/dev/null 2>&1 \
      || bad "guardrails: $stack declares ownedByLinter but base.oxlintrc.json does not load the house plugin"
    for check in $owned; do
      case "$check" in
        # These are enforced by oxlint built-ins rather than the house plugin.
        filename-case) jq -e '.rules["unicorn/filename-case"]' "$oxbase" >/dev/null 2>&1 \
          || bad "guardrails: $stack owns filename-case by linter but unicorn/filename-case is not configured in base.oxlintrc.json" ;;
        patterns) jq -e '.rules["house/no-bare-fetch"] and .rules["house/no-hardcoded-hex"]' "$oxbase" >/dev/null 2>&1 \
          || bad "guardrails: $stack owns patterns by linter but the house pattern rules are not configured in base.oxlintrc.json" ;;
        *) jq -e --arg r "house/$check" '.rules[$r]' "$oxbase" >/dev/null 2>&1 \
          || bad "guardrails: $stack owns $check by linter but rule house/$check is not configured in base.oxlintrc.json" ;;
      esac
    done
  fi

  # No stack may ship its own .claude/settings.json any more: every project
  # now scaffolds the agent-hook wiring from shared/.claude/settings.json
  # (checked below). A per-stack copy reappearing means the canonical wiring
  # has been forked, which is exactly the duplication this consolidation
  # removed — and a fork can drift from run.sh silently, the same fail-open
  # this whole module exists to prevent.
  [ -e "$stack_dir/templates/.claude/settings.json" ] \
    && bad "guardrails: $stack ships its own templates/.claude/settings.json — fork of the canonical shared/.claude/settings.json wiring"
done

# --- The agent-hook layer: one canonical wiring in shared/.claude/settings.json,
#     not five per-stack copies. JSON validity is already caught by the generic
#     JSON parse loop above (shared/ is in its search path); this checks the
#     wiring ITSELF. The agent-hook layer is mandatory, so if this file stops
#     invoking scripts/guardrails/run.sh — the gate every stack calls
#     mandatory — every new project silently loses the layer at scaffold time,
#     not just one stack's copy of it. ---
hooks=shared/.claude/settings.json
if [ ! -f "$hooks" ]; then
  bad "guardrails: $hooks is missing — the agent-hook layer is mandatory"
else
  hook_cmd=$(jq -r '.hooks.PostToolUse[0].hooks[0].command // empty' "$hooks" 2>/dev/null)
  stop_cmd=$(jq -r '.hooks.Stop[0].hooks[0].command // empty' "$hooks" 2>/dev/null)
  case "$hook_cmd" in
    *scripts/guardrails/run.sh*--hook*) : ;;
    *) bad "guardrails: $hooks PostToolUse hook does not invoke scripts/guardrails/run.sh --hook" ;;
  esac
  case "$stop_cmd" in
    *scripts/guardrails/run.sh*--stop*) : ;;
    *) bad "guardrails: $hooks Stop hook does not invoke scripts/guardrails/run.sh --stop" ;;
  esac
fi

# --- folder-README: one canonical file, plus the two stacks that genuinely
#     differ. console/marketing/backend-ts used to each ship a byte-identical
#     copy; if one of them ships its own again, that duplication is back and
#     the two copies WILL drift, since nothing keeps hand-edited duplicates in
#     sync. expo and rust ship a DIFFERENT folder-README.md on purpose, so this
#     asserts their file still exists rather than asserting they DON'T have
#     one — a future cleanup pass must not delete it thinking it is a
#     duplicate of shared/folder-README.md. ---
[ -f shared/folder-README.md ] \
  || bad "shared: shared/folder-README.md is missing — console/marketing/backend-ts scaffold from it"
for stack in console marketing backend-ts; do
  [ -e "stacks/$stack/templates/folder-README.md" ] \
    && bad "guardrails: stack '$stack' ships its own templates/folder-README.md — it is byte-identical to shared/folder-README.md and must scaffold from there instead"
done
for stack in expo rust; do
  [ -f "stacks/$stack/templates/folder-README.md" ] \
    || bad "stack '$stack' is missing templates/folder-README.md — it differs from shared/folder-README.md on purpose and must keep shipping its own"
done

# --- lint-base sync: lint/ is the single source; every TS stack ships a
#     byte-identical copy. Same contract as guardrails/, same failure it ends.
for stack in console marketing backend-ts expo; do
  for item in base.oxlintrc.json .oxfmtrc.json; do
    diff "lint/$item" "stacks/$stack/templates/$item" >/dev/null 2>&1 \
      || bad "lint-base: $stack copy of $item differs from lint/ — re-copy, don't hand-edit"
  done
done
for stack in console expo; do
  diff "lint/base-react.oxlintrc.json" "stacks/$stack/templates/base-react.oxlintrc.json" >/dev/null 2>&1 \
    || bad "lint-base: $stack copy of base-react.oxlintrc.json differs from lint/"
  jq -e '(.extends // []) | index("./base-react.oxlintrc.json")' "stacks/$stack/templates/.oxlintrc.json" >/dev/null 2>&1 \
    || bad "lint-base: $stack .oxlintrc.json does not extend ./base-react.oxlintrc.json"
done
# No non-react stack may ship or extend the react layer.
for stack in marketing backend-ts; do
  [ -e "stacks/$stack/templates/base-react.oxlintrc.json" ] \
    && bad "lint-base: $stack ships base-react.oxlintrc.json but declares no react plugin"
done
# The kit source must parse too (the copies are covered by the JSON sweep above).
for f in lint/*.json lint/.oxfmtrc.json; do
  jq empty "$f" >/dev/null 2>&1 || bad "json parse: $f"
done

# (c) The old name must be gone everywhere the kit ships from. docs/toolu/ is
# excluded on purpose: the spec and decision record name the file they replace,
# and an assertion that failed on its own design docs would be self-inflicted.
# The needle lives in a variable and this file excludes itself: otherwise the
# assertion matches its own source and the gate fails on the check, not the code.
old_gate='check-structure'
gr_stale=$(grep -rl "$old_gate" stacks/ scripts/ shared/ CORE.md README.md .github/ \
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
