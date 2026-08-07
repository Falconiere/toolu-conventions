# No Dead Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make every generated Rust and TypeScript project reject dead code and the escape hatches that currently hide it.

**Architecture:** Rust uses Cargo's non-lowerable forbid level. TypeScript keeps compiler, Oxlint, and Knip coverage, removes the leading-underscore exemption, and gains an independent file-addressable check for dead-code suppression directives. Template validation exercises behavior across all five current TypeScript stacks, including database-ts.

**Tech Stack:** Bash, Cargo/rustc/clippy, TypeScript, Oxlint 1.77.0, Knip, jq, GitHub Actions.

## Global Constraints

- Delete dead code or wire it into a real entry point; do not rename or suppress it.
- Rust must reject #![allow(dead_code)]; deny is insufficient because source can lower it.
- TypeScript retains noUnusedLocals, noUnusedParameters, typescript/no-unused-vars, and Knip.
- Legitimate framework entry points remain documented Knip configuration.
- Reject active blanket Oxlint disables and disables naming no-unused-vars, but not unrelated named suppressions.
- lint/base.oxlintrc.json remains canonical and every TS stack copy stays byte-identical.
- Keep guardrails dependency-free and within its latency budget.
- Follow red-green-refactor for each behavior.

---

### Task 1: Make Rust dead code non-suppressible

**Files:**
- Modify: scripts/validate-templates.sh
- Modify: stacks/rust/templates/Cargo.toml
- Modify: stacks/rust/STRUCTURE.md
- Modify: stacks/rust/SETUP.md
- Modify: stacks/rust/LIBRARIES.md
- Modify: stacks/rust/templates/CLAUDE.md.template

**Interfaces:**
- Consumes: the validator's materialized tmpcrate.
- Produces: dead_code = "forbid" on every Cargo target and a behavioral probe for #![allow(dead_code)].

- [ ] **Step 1: Add the failing test**

After the normal Rust skeleton check in scripts/validate-templates.sh, add:

~~~bash
mkdir -p "$tmpcrate/src/bin"
printf '#![allow(dead_code)]\nfn unused() {}\nfn main() {}\n' \
  > "$tmpcrate/src/bin/dead-code-probe.rs"
probe_output=$(cd "$tmpcrate" \
  && CARGO_NET_OFFLINE=true cargo check --bin dead-code-probe 2>&1)
probe_status=$?
if [ "$probe_status" -eq 0 ]; then
  bad 'rust dead-code policy: #![allow(dead_code)] compiled successfully'
elif ! printf '%s\n' "$probe_output" | grep -q 'overruled by previous forbid'; then
  bad "rust dead-code policy failed for an unexpected reason: $probe_output"
fi
rm -rf "$tmpcrate/src/bin"
~~~

- [ ] **Step 2: Verify RED**

Run: bash scripts/validate-templates.sh

Expected: exit 1 with “#![allow(dead_code)] compiled successfully.”

- [ ] **Step 3: Implement the minimum**

Add this under lints.rust in stacks/rust/templates/Cargo.toml:

~~~toml
dead_code = "forbid"
~~~

Keep cargo clippy --all-targets -- -D warnings for the remaining warnings.

- [ ] **Step 4: Update Rust documentation**

- STRUCTURE: add a No dead code hard convention and name forbid.
- SETUP: distinguish manifest-level forbid from -D warnings and correct the current claim that Clippy merely flags dead code.
- LIBRARIES: distinguish Cargo rust lints from Clippy lints.
- CLAUDE template: say delete/connect unused items and never add allow(dead_code).

- [ ] **Step 5: Verify GREEN**

Run: bash scripts/validate-templates.sh

Expected: GREEN and the probe fails specifically because a previous forbid overrules allow.

- [ ] **Step 6: Commit**

~~~bash
git add scripts/validate-templates.sh stacks/rust/templates/Cargo.toml \
  stacks/rust/STRUCTURE.md stacks/rust/SETUP.md stacks/rust/LIBRARIES.md \
  stacks/rust/templates/CLAUDE.md.template
git commit -m "feat(rust): forbid dead code"
~~~

---

### Task 2: Close TypeScript's underscore exemption

**Files:**
- Modify: guardrails/__tests__/run-plugin.sh
- Modify: lint/base.oxlintrc.json
- Modify: stacks/{backend-ts,console,database-ts,expo,marketing}/templates/base.oxlintrc.json
- Modify: scripts/validate-templates.sh
- Modify: CORE.md
- Modify: stacks/{backend-ts,console,database-ts,expo,marketing}/{STRUCTURE.md,SETUP.md,LIBRARIES.md}
- Modify: stacks/{backend-ts,console,database-ts,expo,marketing}/templates/CLAUDE.md.template

**Interfaces:**
- Consumes: canonical lint base, TS configs/package scripts, real Oxlint suite.
- Produces: typescript/no-unused-vars = error without ignore patterns and validation of all five TS stacks.

- [ ] **Step 1: Add the failing behavior test**

In run-plugin.sh, after removing the seeded house-rule violations and before corrupting the plugin, temporarily lint one file with the canonical base:

~~~bash
cp "$TREE/.oxlintrc.json" "$TREE/.oxlintrc.minimal.json"
jq '.options.typeAware = false | .jsPlugins = ["./oxlint-plugin/index.js"]' \
  "$ROOT/lint/base.oxlintrc.json" > "$TREE/.oxlintrc.json"
printf 'const _unused = 1;\nexport const live = (_dead: string) => 1;\n' \
  > "$TREE/src/utilities/unused.ts"
unused_out=$(cd "$TREE" && $OXLINT src/utilities/unused.ts 2>&1)
unused_status=$?
unused_count=$(printf '%s\n' "$unused_out" | grep -c 'typescript(no-unused-vars)' || true)
if [ "$unused_status" -ne 0 ] && [ "$unused_count" -eq 2 ]; then
  ok 'canonical lint rejects underscore-prefixed unused locals and parameters'
else
  bad "canonical lint expected 2 unused diagnostics, got $unused_count" "$unused_out"
fi
rm -f "$TREE/src/utilities/unused.ts"
mv "$TREE/.oxlintrc.minimal.json" "$TREE/.oxlintrc.json"
~~~

- [ ] **Step 2: Verify RED**

Run: bash guardrails/__tests__/run-plugin.sh

Expected: the new assertion gets zero rather than two diagnostics.

- [ ] **Step 3: Implement and synchronize**

Replace the option array in lint/base.oxlintrc.json with:

~~~json
"typescript/no-unused-vars": "error"
~~~

Synchronize:

~~~bash
for stack in backend-ts console database-ts expo marketing; do
  cp lint/base.oxlintrc.json "stacks/$stack/templates/base.oxlintrc.json"
done
~~~

- [ ] **Step 4: Prove every current TS stack is wired**

Define near GR_MANIFEST in scripts/validate-templates.sh:

~~~bash
TS_STACKS='console marketing backend-ts database-ts expo'
~~~

Use TS_STACKS in Knip/jscpd and lint-base sync loops. Add:

~~~bash
for stack in $TS_STACKS; do
  jq -e '.compilerOptions.noUnusedLocals == true and .compilerOptions.noUnusedParameters == true' \
    "stacks/$stack/templates/tsconfig.json" >/dev/null \
    || bad "dead-code: $stack must enable noUnusedLocals and noUnusedParameters"
  jq -e '.scripts["check:unused"] == "knip" and (.scripts.check | contains("check:unused"))' \
    "stacks/$stack/templates/package.json" >/dev/null \
    || bad "dead-code: $stack must run knip in its full gate"
  jq -e '.rules["typescript/no-unused-vars"] == "error"' \
    "stacks/$stack/templates/base.oxlintrc.json" >/dev/null \
    || bad "dead-code: $stack must reject unused variables without name exemptions"
done
~~~

Add database-ts to the non-React lint assertion, but not per-stack workflow assertions because the workspace root owns its CI.

- [ ] **Step 5: Update TS documentation**

- CORE: compiler/Oxlint own locals and parameters; Knip owns files, exports, dependencies; underscore is not an escape.
- Every TS STRUCTURE: Nothing unused includes locals/parameters and graph-level code; add the rule where absent.
- Every TS LIBRARIES: replace Knip-only ownership with TypeScript + Oxlint + Knip, preserving legitimate Knip boundaries.
- Every TS SETUP: after the gate description, state that all layers are mandatory; delete/wire rather than prefix underscore or ignore.
- Every TS CLAUDE template: include locals/parameters and reject underscore names; add the rule where absent.

- [ ] **Step 6: Verify GREEN**

~~~bash
bash guardrails/__tests__/run-plugin.sh
bash scripts/validate-templates.sh
~~~

Expected: both pass and database-ts participates in the shared checks.

- [ ] **Step 7: Commit**

~~~bash
git add guardrails/__tests__/run-plugin.sh lint/base.oxlintrc.json \
  stacks/*/templates/base.oxlintrc.json scripts/validate-templates.sh CORE.md \
  stacks/{backend-ts,console,database-ts,expo,marketing}/{STRUCTURE.md,SETUP.md,LIBRARIES.md} \
  stacks/{backend-ts,console,database-ts,expo,marketing}/templates/CLAUDE.md.template
git commit -m "feat(typescript): reject all unused code"
~~~

---

### Task 3: Reject dead-code suppression directives independently

**Files:**
- Create: guardrails/checks/lint-suppressions.sh
- Create: guardrails/__tests__/fixtures/violating/src/utilities/suppressed-unused.ts
- Modify: guardrails/run.sh
- Modify: guardrails/__tests__/run-fixtures.sh
- Modify: README.md
- Modify: guardrails/README.md
- Modify: CORE.md
- Modify: docs/how-it-works.html
- Modify: docs/conventions.html

**Interfaces:**
- Consumes: gr_violation plus repo/file/hook/stop dispatch.
- Produces: check id lint-suppressions and gr_check_lint_suppressions with one violation per file.

- [ ] **Step 1: Add failing fixtures**

Create:

~~~ts
// oxlint-disable-next-line typescript/no-unused-vars
const unused = 1;
~~~

In run-fixtures.sh add lint-suppressions to ALL_CHECKS and assert:

- the committed fixture reports one violation in repo and --file modes;
- a scratch active blanket // oxlint-disable reports;
- // Explain oxlint-disable typescript/no-unused-vars here. stays silent;
- --list now returns 14.

Expected message: unused-code lint suppression — delete the dead code or wire it into a real entry point; do not disable the unused-code lint.

- [ ] **Step 2: Verify RED**

Run: bash guardrails/__tests__/run-fixtures.sh --only lint-suppressions

Expected: zero findings where findings are required.

- [ ] **Step 3: Implement the scanner**

Create lint-suppressions.sh with these boundaries:

~~~bash
GR_LS_BLANKET='^[[:space:]]*(//|/\*)[[:space:]]*oxlint-disable(-next-line|-line)?([[:space:]]*(\*/)?[[:space:]]*|[[:space:]]+--.*)$'
GR_LS_UNUSED='^[[:space:]]*(//|/\*)[[:space:]]*oxlint-disable(-next-line|-line)?.*[[:space:],]((typescript|@typescript-eslint)/)?no-unused-vars([[:space:],*]|$)'

gr_ls_source() {
  case "$1" in
    *.ts|*.tsx|*.mts|*.cts|*.js|*.jsx|*.mjs|*.cjs) return 0 ;;
    *) return 1 ;;
  esac
}

gr_ls_scan() {
  local path match status
  path=$1
  gr_ls_source "$path" || return 0
  [ -f "$path" ] || return 0
  match=$(grep -E -I -n -m1 -e "$GR_LS_BLANKET" -e "$GR_LS_UNUSED" -- "$path")
  status=$?
  [ "$status" -le 1 ] || gr_fatal "lint-suppressions scan failed on $path: grep exited $status"
  [ -n "$match" ] || return 0
  gr_violation lint-suppressions "$path" \
    'unused-code lint suppression' \
    'delete the dead code or wire it into a real entry point; do not disable the unused-code lint'
}
~~~

Implement repo mode as one NUL-safe batch, including untracked source files so
the Stop hook sees a newly written suppression before it is staged:

~~~bash
gr_ls_scan_repo() {
  local list hits err status errtext path
  list=$(mktemp)
  hits=$(mktemp)
  err=$(mktemp)
  find . \( -name .git -o -name node_modules -o -name dist -o -name build \
              -o -name out -o -name coverage -o -name .wrangler -o -name .next \) -prune \
    -o -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mts' -o -name '*.cts' \
                   -o -name '*.js' -o -name '*.jsx' -o -name '*.mjs' -o -name '*.cjs' \) \
    -print0 > "$list"
  if [ -s "$list" ]; then
    xargs -0 sh -c '
      p1=$1; p2=$2; shift 2
      grep -E -I -l -Z -e "$p1" -e "$p2" -- "$@" || [ $? -eq 1 ]
    ' sh "$GR_LS_BLANKET" "$GR_LS_UNUSED" < "$list" > "$hits" 2> "$err"
    status=$?
    errtext=$(cat "$err")
    [ -z "$errtext" ] && [ "$status" -eq 0 ] || {
      rm -f "$list" "$hits" "$err"
      gr_fatal "lint-suppressions repo scan failed: ${errtext:-xargs exited $status}"
    }
    while IFS= read -r -d '' path; do
      gr_ls_scan "${path#./}"
    done < "$hits"
  fi
  rm -f "$list" "$hits" "$err"
}
~~~

This copies secret-content.sh's fail-closed xargs contract: grep 1 is clean,
stderr or another status is fatal. Re-running gr_ls_scan only for hit files
keeps output to one violation per file. File mode calls gr_ls_scan directly.

Expose:

~~~bash
gr_check_lint_suppressions() {
  local mode path
  mode=$1
  path=$2
  if [ "$mode" = 'file' ]; then
    gr_ls_scan "$path"
    return 0
  fi
  [ "$mode" = 'repo' ] || return 0
  gr_ls_scan_repo
}
~~~

- [ ] **Step 4: Register it**

Add lint-suppressions to GR_CHECKS_FILE after secret-content. Explain in run.sh that the check lives outside Oxlint because the same directive can silence an Oxlint rule. Do not add it to ownedByLinter. It stays silent on Rust files.

- [ ] **Step 5: Verify GREEN and latency**

~~~bash
bash guardrails/__tests__/run-fixtures.sh --only lint-suppressions
bash guardrails/__tests__/run-fixtures.sh
bash guardrails/__tests__/run-latency.sh
~~~

Expected: all pass; 14 ids; latency within budget.

- [ ] **Step 6: Update public/guardrail docs**

- README: check count 14; correct existing house-plugin count five→six; name lint-suppressions.
- guardrails README: 13→14, remaining eight→nine, all thirteen→all fourteen; add database-ts to TS lists; explain independent ownership.
- CORE: explain this owns the escape hatch, not duplicate unused detection.
- how-it-works.html: Fourteen checks, a passing lint-suppressions row, updated ownership prose.
- conventions.html: name TS local/parameter checks, Knip graph checks, Rust forbid, and no suppression.
- Do not rewrite dated specs/decisions.

- [ ] **Step 7: Commit**

~~~bash
git add guardrails/checks/lint-suppressions.sh guardrails/run.sh \
  guardrails/__tests__/run-fixtures.sh \
  guardrails/__tests__/fixtures/violating/src/utilities/suppressed-unused.ts \
  README.md guardrails/README.md CORE.md docs/how-it-works.html docs/conventions.html
git commit -m "feat(guardrails): reject dead-code suppressions"
~~~

---

### Task 4: Audit documentation and run the complete gate

**Files:**
- Review/possibly modify: CORE.md, README.md, guardrails/README.md, docs/how-it-works.html, docs/conventions.html
- Review/possibly modify: every stack STRUCTURE.md, SETUP.md, LIBRARIES.md, and CLAUDE template

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: evidence that prose, config, focused suites, latency, and CI-equivalent validation agree.

- [ ] **Step 1: Search all current docs**

~~~bash
rg -n -i \
  'dead code|unused|noUnused|underscore|allow\(dead_code\)|dead_code|lint-suppressions|thirteen|13 checks|remaining eight|all thirteen|oxlint-plugin.*5' \
  CORE.md README.md guardrails/README.md docs/*.html \
  stacks/*/{STRUCTURE.md,SETUP.md,LIBRARIES.md} stacks/*/templates/CLAUDE.md.template
~~~

Inspect every hit. Current docs must agree on Rust forbid, TS ownership, no underscore/suppression escape, 14 shell checks, six plugin rules, and database-ts membership. Fix current docs; leave dated history alone.

- [ ] **Step 2: Verify config directly**

~~~bash
for stack in backend-ts console database-ts expo marketing; do
  jq -e '.compilerOptions.noUnusedLocals == true and .compilerOptions.noUnusedParameters == true' \
    "stacks/$stack/templates/tsconfig.json" >/dev/null
  jq -e '.rules["typescript/no-unused-vars"] == "error"' \
    "stacks/$stack/templates/base.oxlintrc.json" >/dev/null
  diff lint/base.oxlintrc.json "stacks/$stack/templates/base.oxlintrc.json"
done
grep -F 'dead_code = "forbid"' stacks/rust/templates/Cargo.toml
bash guardrails/run.sh --list
~~~

Expected: exit 0 and 14 ids including lint-suppressions.

- [ ] **Step 3: Run complete verification**

~~~bash
bash guardrails/__tests__/run-fixtures.sh
bash guardrails/__tests__/run-plugin.sh
bash guardrails/__tests__/run-latency.sh
bash conventions/__tests__/run.sh
bash scripts/validate-templates.sh
git diff --check
~~~

Expected: every suite passes; validator is GREEN; diff-check is silent.

- [ ] **Step 4: Review and commit final doc corrections if any**

~~~bash
git diff origin/main...HEAD --stat
git diff origin/main...HEAD --check
git status --short
~~~

If audit corrections remain, stage only current docs and commit with:

~~~bash
git add CORE.md README.md guardrails/README.md docs/*.html \
  stacks/*/{STRUCTURE.md,SETUP.md,LIBRARIES.md} \
  stacks/*/templates/CLAUDE.md.template
git commit -m "docs: align dead-code enforcement guidance"
~~~

Expected: clean worktree with only approved spec, plan, enforcement, tests, and current docs differing from origin/main.

---

### Task 5: Open and babysit the pull request

**Files:** None unless CI/review requires an in-scope fix.

**Interfaces:**
- Consumes: clean verified feat/no-dead-code.
- Produces: draft PR with green required checks and no actionable unresolved feedback.

- [ ] **Step 1: Pre-PR review**

Invoke superpowers:requesting-code-review. Resolve findings and rerun focused plus full validation after fixes.

- [ ] **Step 2: Open PR**

Invoke github:yeet to confirm commits, push feat/no-dead-code, and open a draft PR against main. Summarize Rust forbid, TS three-layer enforcement, independent suppression check, docs drift fixes, and exact test results.

- [ ] **Step 3: Babysit**

No pr-babysit skill is installed. Use github:gh-fix-ci for checks/logs, github:gh-address-comments for unresolved review threads, and PR metadata polling. Pending is not success. For each in-scope finding: diagnose, test first if behavior changes, fix minimally, run focused/full verification, commit, push, and resume monitoring.

- [ ] **Step 4: Terminal condition**

Stop only when required checks succeed and no actionable unresolved feedback remains. If approval, a secret, or service outage blocks progress, report the exact evidence instead of claiming green.
