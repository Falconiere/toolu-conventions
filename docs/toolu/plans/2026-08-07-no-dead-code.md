# No Dead Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make every generated Rust and TypeScript project reject dead code and the escape hatches that currently hide it.

**Architecture:** Rust uses Cargo's deny level plus an independent ban on source-authored lint attributes that lower or consume dead_code; forbid cannot be used because rustc's generated test harness injects its own allow(dead_code). TypeScript keeps compiler, Oxlint, and Knip coverage, removes the leading-underscore exemption, and gains the same independent file-addressable suppression check. Template validation exercises behavior across all five current TypeScript stacks, including database-ts.

**Tech Stack:** Bash, Cargo/rustc/clippy, TypeScript, Oxlint 1.77.0, Knip, jq, GitHub Actions.

## Global Constraints

- Delete dead code or wire it into a real entry point; do not rename or suppress it.
- Rust uses dead_code = "deny" and the independent guardrail rejects source-authored attributes that lower or consume dead_code directly or through the unused group, including direct, cfg_attr, crate-level, comment-formatted, raw-identifier, and multiline forms.
- TypeScript retains noUnusedLocals, noUnusedParameters, eslint/no-unused-vars, and Knip.
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
- Produces: dead_code = "deny" on every Cargo target, a behavioral unused-item probe, and a normal all-targets test harness that stays green.

- [ ] **Step 1: Add the failing test**

After the normal Rust skeleton check in scripts/validate-templates.sh, add:

~~~bash
mkdir -p "$tmpcrate/src/bin"
printf 'fn unused() {}\nfn main() {}\n' \
  > "$tmpcrate/src/bin/dead-code-probe.rs"
probe_output=$(cd "$tmpcrate" \
  && CARGO_NET_OFFLINE=true cargo check --bin dead-code-probe 2>&1)
probe_status=$?
if [ "$probe_status" -eq 0 ]; then
  bad 'rust dead-code policy: an unused function compiled successfully'
elif ! printf '%s\n' "$probe_output" | grep -q 'function .* is never used'; then
  bad "rust dead-code policy failed for an unexpected reason: $probe_output"
fi
rm -rf "$tmpcrate/src/bin"
~~~

- [ ] **Step 2: Verify RED**

Run: bash scripts/validate-templates.sh

Expected: exit 1 with “an unused function compiled successfully.”

- [ ] **Step 3: Implement the minimum**

Add this under lints.rust in stacks/rust/templates/Cargo.toml:

~~~toml
dead_code = "deny"
~~~

Keep cargo clippy --all-targets -- -D warnings for the remaining warnings.

- [ ] **Step 4: Update Rust documentation**

- STRUCTURE: add a No dead code hard convention and name Cargo deny plus the independent attribute check.
- SETUP: distinguish manifest-level deny from -D warnings, explain why forbid breaks the generated test harness, and correct the current claim that Clippy merely flags dead code.
- LIBRARIES: distinguish Cargo rust lints from Clippy lints.
- CLAUDE template: say delete/connect unused items and never add allow(dead_code); name the guardrail that enforces the attribute ban.

- [ ] **Step 5: Verify GREEN**

Run: bash scripts/validate-templates.sh

Expected: GREEN; the deliberate unused-item probe fails under Cargo deny and the ordinary all-targets skeleton passes.

- [ ] **Step 6: Commit**

~~~bash
git add scripts/validate-templates.sh stacks/rust/templates/Cargo.toml \
  stacks/rust/STRUCTURE.md stacks/rust/SETUP.md stacks/rust/LIBRARIES.md \
  stacks/rust/templates/CLAUDE.md.template
git commit -m "feat(rust): deny dead code"
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
- Produces: eslint/no-unused-vars = ["error", {"args":"all"}], whose explicit options disable Oxlint's intrinsic underscore-name default and its positional after-used exemption, plus validation of all five TS stacks.

- [ ] **Step 1: Add the failing behavior test**

In run-plugin.sh, after removing the seeded house-rule violations and before corrupting the plugin, temporarily lint one file with the canonical base:

~~~bash
cp "$TREE/.oxlintrc.json" "$TREE/.oxlintrc.minimal.json"
jq '.options.typeAware = false | .jsPlugins = ["./oxlint-plugin/index.js"]' \
  "$ROOT/lint/base.oxlintrc.json" > "$TREE/.oxlintrc.json"
printf 'const _unused = 1;\nexport const live = (_dead: string, used: string) => used;\n' \
  > "$TREE/src/utilities/unused.ts"
unused_out=$(cd "$TREE" && $OXLINT src/utilities/unused.ts 2>&1)
unused_status=$?
unused_count=$(printf '%s\n' "$unused_out" | grep -c 'eslint(no-unused-vars)' || true)
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

Oxlint's bare rule form defaults `varsIgnorePattern` to `^_`, and its default
`args: "after-used"` ignores an unused parameter before a later used one. Remove
both explicit ignore patterns and set `args: "all"`:

~~~json
"eslint/no-unused-vars": ["error", {"args": "all"}]
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
  jq -e '.rules["eslint/no-unused-vars"] == ["error", {"args": "all"}]' \
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
- Create: guardrails/lib/lint-syntax.sh
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
- Produces: check id lint-suppressions and gr_check_lint_suppressions with one violation per file across TS/JS line/block directives and direct, cfg_attr, comment-formatted, raw-identifier, or multiline Rust lint-level attributes that neutralize dead_code.

- [ ] **Step 1: Add failing fixtures**

Create:

~~~ts
// oxlint-disable-next-line eslint/no-unused-vars
const unused = 1;
~~~

In run-fixtures.sh add lint-suppressions to ALL_CHECKS and assert:

- the committed fixture reports one violation in repo and --file modes;
- scratch active blanket line and inline block disables report;
- scratch Rust item/crate direct, cfg_attr, multiline, comment-formatted, and raw-identifier allow(dead_code) each report;
- Rust allow(unused), warn(dead_code), expect(dead_code), and conditional expect(unused) each report because they also neutralize dead_code;
- directive/attribute text inside TypeScript strings, rendered JSX text, and Rust comments/strings/character literals stays silent, while real JSX/template expression comments report even after brace-bearing regex literals;
- standard, const, and defaulted TSX generic arrows remain code context, division is not mistaken for a regex, and later directives report;
- multiline generic parameters containing regex classes or comments, including trivia around parameter boundaries, remain code context; postfix increment/decrement, non-null, and completed-regex division keep later directives visible even when block-comment trivia intervenes;
- regex consequents after control-header parentheses or `do`/`else` remain regex context in ordinary TSX and generic-arrow defaults, while public or private keyword-named property calls keep following division in code context;
- multiline Rust attributes balance nested macro brackets before deciding the outer attribute has ended;
- a missing or incomplete lexical helper exits through the controlled fatal path instead of running without enforcement;
- // Explain oxlint-disable eslint/no-unused-vars here. stays silent;
- --list now returns 14.

Expected message: unused-code lint suppression — delete the dead code or wire it into a real entry point; do not disable the unused-code lint.

- [ ] **Step 2: Verify RED**

Run: bash guardrails/__tests__/run-fixtures.sh --only lint-suppressions

Expected: zero findings where findings are required.

- [ ] **Step 3: Implement the scanner**

Create lint-suppressions.sh with these boundaries:

- Lex TypeScript/JavaScript strings, template literals, and rendered JSX text
  before parsing real line comments and single- or multiline block comments.
  Keep JSX/template expression comments visible by lexing regex escapes and
  character classes without confusing ordinary or postfix-expression division,
  including division separated from its left operand by block-comment trivia;
  track token-bounded control headers and statement keywords so consequent
  regex statements remain regex context without treating `object.if()` as a
  control statement.
  Disambiguate TSX generic arrows across the full remaining source through the
  closing type parameters, regex/comment-aware value parameters, and `=>`. Reject blanket
  eslint/oxlint disables and rule lists containing any supported
  `no-unused-vars` alias, including an inline block followed by code.
- Lex Rust comments, normal/raw strings, character/byte literals, and lifetimes
  before parsing attributes as complete blocks. Reject
  direct item/crate and conditional `cfg_attr` forms of `allow`, `warn`, or
  `expect` when they target `dead_code` or its `unused` lint group, including
  multiline forms, nested bracket-delimited macros, embedded comments, and
  equivalent raw-identifier spellings.
- Keep unrelated scoped lint disables and prose that merely names a directive
  silent.
- File mode scans in Bash without child processes. Repo mode uses one NUL-safe
  candidate grep per language family and reuses the syntax-aware file scanner
  only for hits, preserving one violation per file.
- Inventory each language family with a foreground, extension-filtered `find`
  instead of a per-source Bash loop; capture stderr/status and exit 3 if the
  tree cannot be traversed, because a skipped subtree must never read as clean.
- Include untracked source files so the Stop hook sees newly written
  suppressions before they are staged.

- [ ] **Step 4: Register it**

Add lint-suppressions to GR_CHECKS_FILE after secret-content. Explain in run.sh
that the check lives outside Oxlint because the same directive can silence an
Oxlint rule. Do not add it to ownedByLinter: the independent check runs on both
TypeScript/JavaScript and Rust source.

- [ ] **Step 5: Verify GREEN and latency**

~~~bash
bash guardrails/__tests__/run-fixtures.sh --only lint-suppressions
bash guardrails/__tests__/run-fixtures.sh
bash guardrails/__tests__/run-latency.sh
~~~

Expected: all pass; 14 ids; latency within budget.
An over-budget latency sample is retried twice and the median of the three
samples decides the gate, preserving the budget without failing on one shared-host pause.
Workspace repo dispatch runs its isolated package checks concurrently so a
workspace pays the slowest package's cost rather than summing independent work;
every unexpected child status normalizes to fatal exit 3. A measured guardrail
command must itself exit cleanly before its elapsed time can pass.

- [ ] **Step 6: Update public/guardrail docs**

- README: check count 14; correct existing house-plugin count five→six; name lint-suppressions.
- guardrails README: 13→14, remaining eight→nine, all thirteen→all fourteen; add database-ts to TS lists; explain independent ownership.
- CORE: explain this owns the escape hatch, not duplicate unused detection.
- how-it-works.html: Fourteen checks, a passing lint-suppressions row, updated ownership prose.
- conventions.html: name TS local/parameter checks, Knip graph checks, Rust deny plus the attribute guardrail, and no suppression.
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

Inspect every hit. Current docs must agree on Rust deny plus the attribute guardrail (and the rustc test-harness reason forbid is not used), TS ownership, no underscore/suppression escape, 14 shell checks, six plugin rules, and database-ts membership. Fix current docs; leave dated history alone.

- [ ] **Step 2: Verify config directly**

~~~bash
for stack in backend-ts console database-ts expo marketing; do
  jq -e '.compilerOptions.noUnusedLocals == true and .compilerOptions.noUnusedParameters == true' \
    "stacks/$stack/templates/tsconfig.json" >/dev/null
  jq -e '.rules["eslint/no-unused-vars"] == ["error", {"args": "all"}]' \
    "stacks/$stack/templates/base.oxlintrc.json" >/dev/null
  diff lint/base.oxlintrc.json "stacks/$stack/templates/base.oxlintrc.json"
done
grep -F 'dead_code = "deny"' stacks/rust/templates/Cargo.toml
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

Invoke github:yeet to confirm commits, push feat/no-dead-code, and open a draft PR against main. Summarize Rust deny plus the attribute ban, TS three-layer enforcement, independent suppression check, docs drift fixes, and exact test results.

- [ ] **Step 3: Babysit**

No pr-babysit skill is installed. Use github:gh-fix-ci for checks/logs, github:gh-address-comments for unresolved review threads, and PR metadata polling. Pending is not success. For each in-scope finding: diagnose, test first if behavior changes, fix minimally, run focused/full verification, commit, push, and resume monitoring.

- [ ] **Step 4: Terminal condition**

Stop only when required checks succeed and no actionable unresolved feedback remains. If approval, a secret, or service outage blocks progress, report the exact evidence instead of claiming green.
