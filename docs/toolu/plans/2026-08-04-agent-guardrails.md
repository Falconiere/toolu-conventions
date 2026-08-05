# agent-guardrails — Implementation Plan

**Date:** 2026-08-04   **Status:** Approved   **Spec:** [`../specs/2026-08-04-agent-guardrails-design.md`](../specs/2026-08-04-agent-guardrails-design.md)   **Topic:** Build the shared guardrails module, migrate all five stacks off `check-structure.sh`, wire the hook layer

## Context

Five hand-written `check-structure.sh` scripts (45–80 lines each) carry the
kit's structural rules with overlapping logic, no shared config, and no tests —
and they have already drifted. Three stated conventions have no enforcer at all
(function length, intra-domain folder shape, contextual code patterns), and
nothing fires before commit time. This replaces all five with one config-driven,
fixture-tested module that also runs at edit time through Claude Code hooks.

## Approach

`guardrails/` at the kit root is the single source of truth, copied verbatim
into each stack's `templates/scripts/guardrails/`. Stack differences live in
`guardrails.config.json`. Nine checks; each one file-addressable where that is
meaningful, because the `PostToolUse` hook cannot afford a repo scan.

Reuse rather than reinvent: the nine checks are ports of logic that already
exists in `stacks/*/templates/scripts/check-structure.sh` — read all five before
writing any check, and carry over their **error message wording**, which is
already well-tuned (`"lefthook.yaml present — rename to lefthook.yml (lefthook
2.x installer shadows .yaml)"` is the model: problem — remedy — why).

The existing `scripts/validate-templates.sh` (284 lines) gains the drift,
agreement, and no-lingering-reference assertions; it already greps template JSON,
so the pattern is established there.

**Note for the implementer:** `fileSize.skipExtensions` makes `file-size.sh` a
deliberate no-op on console, expo and backend-ts — oxlint's `max-lines` owns
`.ts`/`.tsx` there. It does real work only on marketing (`.astro`, which oxlint
cannot see past the frontmatter) and rust (`.rs`). That is correct, not broken.

## Steps / workstreams

**A — the module.** Skeleton and config loader first (everything else depends on
`lib/config.sh`), then the fixtures, then the checks in two batches
(file-addressable, then repo-only), then patterns, then the test runner. Each
check is its own file under the 300-line ceiling; `run.sh` is dispatch only.

**B — per-stack templates.** One step per stack, same shape each time: write
`guardrails.config.json` from the spec's per-stack table, copy the module, add
`sgconfig.yml` and `.claude/settings.json`, delete `check-structure.sh`.

**C — wiring and docs.** Per-stack doc/CI updates, then the kit-level docs
(`CORE.md` four→five layers, `README.md`, `docs/conventions.html`), then the
`validate-templates.sh` assertions last — they are the gate that proves B and C
actually landed.

## Steps (machine-readable)

```json
[
  {
    "id": "A1",
    "title": "Scaffold guardrails/ — run.sh dispatch, lib/config.sh (jq reads + required-key assertions + version warn), lib/report.sh, schema.json",
    "check": "bash -n guardrails/run.sh guardrails/lib/*.sh && for c in folder-tree file-size colocated-tests no-barrels banned-deps shadow-configs required-files secrets patterns; do bash guardrails/run.sh --list | grep -qx \"$c\" || exit 1; done",
    "ac_refs": ["AC-7", "AC-8", "AC-18"],
    "model": "sonnet",
    "input": "Spec: run.sh contract, exit-code table, guardrails.config.json schema"
  },
  {
    "id": "A2",
    "title": "Build clean + violating fixture trees as PLAIN directories (no nested .git), exactly one violation per check; add lib/mkrepo.sh which copies a fixture to a temp dir and runs git init && git add for the secrets check",
    "check": "test -d guardrails/__tests__/fixtures/clean && test ! -e guardrails/__tests__/fixtures/violating/.git && d=$(bash guardrails/__tests__/lib/mkrepo.sh violating) && git -C \"$d\" ls-files --error-unmatch .dev.vars && rm -rf \"$d\"",
    "ac_refs": ["AC-3", "AC-17"],
    "depends_on": ["A1"],
    "model": "sonnet",
    "input": "git CANNOT track a nested .git — it warns 'adding embedded git repository' and leaves it untracked, so a committed fixture repo would never survive a clone. Build the repo at test time instead; it is still a real repo, not a mock."
  },
  {
    "id": "A3",
    "title": "File-addressable checks: folder-tree.sh, file-size.sh, colocated-tests.sh, no-barrels.sh — each supporting repo and --file mode",
    "check": "bash guardrails/__tests__/run-fixtures.sh --only folder-tree,file-size,colocated-tests,no-barrels",
    "ac_refs": ["AC-4", "AC-9", "AC-10"],
    "depends_on": ["A2"],
    "model": "sonnet",
    "input": "Port from the five existing check-structure.sh scripts; keep their message wording"
  },
  {
    "id": "A4",
    "title": "Repo-only checks: banned-deps.sh, shadow-configs.sh, required-files.sh, secrets.sh",
    "check": "bash guardrails/__tests__/run-fixtures.sh --only banned-deps,shadow-configs,required-files,secrets",
    "ac_refs": ["AC-16", "AC-17"],
    "depends_on": ["A2"],
    "model": "sonnet",
    "input": "required-files + secrets are recovered from backend-ts/marketing; dropping them would be a regression"
  },
  {
    "id": "A5",
    "title": "patterns.sh wrapping ast-grep, plus the four v1 rules (no-bare-fetch, no-hardcoded-hex, no-manual-orpc-key, no-direct-env-var)",
    "check": "bash guardrails/__tests__/run-fixtures.sh --only patterns",
    "ac_refs": ["AC-11"],
    "depends_on": ["A2"],
    "model": "sonnet",
    "input": "ast-grep 0.45.0 via bunx @ast-grep/cli; no-bare-fetch must stay silent inside src/utilities/http.ts"
  },
  {
    "id": "A6",
    "title": "Test runner run-fixtures.sh asserting every AC, including hook modes (--hook exit 2, --stop early-outs and exit 2) and misconfiguration exit 3",
    "check": "bash guardrails/__tests__/run-fixtures.sh",
    "ac_refs": ["AC-1", "AC-2", "AC-5", "AC-6", "AC-7", "AC-8"],
    "depends_on": ["A3", "A4", "A5"],
    "model": "sonnet",
    "input": "Feed --hook a real PostToolUse JSON payload on stdin, not a hand-waved one"
  },
  {
    "id": "A7",
    "title": "Latency harness: generate a 500-file / 20-feature tree, assert repo mode <2s and --file <250ms",
    "check": "bash guardrails/__tests__/run-latency.sh",
    "ac_refs": ["AC-14"],
    "depends_on": ["A6"],
    "model": "sonnet"
  },
  {
    "id": "B1",
    "title": "console: guardrails.config.json + module copy + sgconfig.yml + .claude/settings.json; delete check-structure.sh",
    "check": "for p in run.sh lib checks patterns schema.json; do diff -r guardrails/$p stacks/console/templates/scripts/guardrails/$p || exit 1; done && test ! -e stacks/console/templates/scripts/check-structure.sh && test ! -e stacks/console/templates/scripts/guardrails/__tests__",
    "ac_refs": ["AC-13"],
    "depends_on": ["A6"],
    "model": "sonnet",
    "input": "Values from the spec's per-stack table; console is the only stack with barrelExempt src/app/**"
  },
  {
    "id": "B2",
    "title": "expo: same shape (no barrelExempt — app/ is at repo root, so every src/ index.ts(x) is a real barrel)",
    "check": "for p in run.sh lib checks patterns schema.json; do diff -r guardrails/$p stacks/expo/templates/scripts/guardrails/$p || exit 1; done && test ! -e stacks/expo/templates/scripts/check-structure.sh && test ! -e stacks/expo/templates/scripts/guardrails/__tests__",
    "depends_on": ["B1"],
    "model": "haiku"
  },
  {
    "id": "B3",
    "title": "backend-ts: same shape; requiredFiles wrangler.jsonc, secrets .dev.vars, no domain root",
    "check": "for p in run.sh lib checks patterns schema.json; do diff -r guardrails/$p stacks/backend-ts/templates/scripts/guardrails/$p || exit 1; done && test ! -e stacks/backend-ts/templates/scripts/check-structure.sh && test ! -e stacks/backend-ts/templates/scripts/guardrails/__tests__",
    "depends_on": ["B1"],
    "model": "haiku"
  },
  {
    "id": "B4",
    "title": "marketing: same shape; requiredFiles src/pages/404.astro, and .astro deliberately absent from skipExtensions",
    "check": "for p in run.sh lib checks patterns schema.json; do diff -r guardrails/$p stacks/marketing/templates/scripts/guardrails/$p || exit 1; done && test ! -e stacks/marketing/templates/scripts/check-structure.sh && test ! -e stacks/marketing/templates/scripts/guardrails/__tests__",
    "depends_on": ["B1"],
    "model": "sonnet",
    "input": "Raised from haiku: marketing carries the one real subtlety in this batch — .astro is deliberately ABSENT from skipExtensions, because oxlint cannot see past an .astro file's frontmatter, making guardrails its only size enforcer"
  },
  {
    "id": "B5",
    "title": "rust: omit src.topLevel entirely (arbitrary module names), testDir tests, fileSize 500, functionSize 100",
    "check": "for p in run.sh lib checks patterns schema.json; do diff -r guardrails/$p stacks/rust/templates/scripts/guardrails/$p || exit 1; done && test ! -e stacks/rust/templates/scripts/check-structure.sh && test ! -e stacks/rust/templates/scripts/guardrails/__tests__",
    "depends_on": ["B1"],
    "model": "sonnet",
    "input": "Omitted topLevel means unconstrained; an empty array would reject every module"
  },
  {
    "id": "C1",
    "title": "Per-stack wiring: SETUP.md prereqs (jq, ast-grep) + scaffold steps, STRUCTURE.md trees and 'Enforced by:' lines, CLAUDE.md.template gate commands, lefthook.yml, ci.yml",
    "check": "! grep -rl 'check-structure' stacks/ && grep -rl 'guardrails' stacks/*/SETUP.md stacks/*/STRUCTURE.md stacks/*/templates/CLAUDE.md.template | wc -l | xargs -I{} test {} -ge 15",
    "ac_refs": ["AC-15"],
    "depends_on": ["B2", "B3", "B4", "B5"],
    "model": "sonnet"
  },
  {
    "id": "C2",
    "title": "Kit docs: CORE.md four→five guard-rail layers with the hook layer specified, README.md guard-rails paragraph, docs/conventions.html",
    "check": "! grep -lq 'check-structure' CORE.md README.md docs/conventions.html && ! grep -q 'Four layers' CORE.md && grep -q 'Five layers' CORE.md && for n in 1 2 3 4 5; do grep -q \"^\\*\\*$n\\.\" CORE.md || exit 1; done",
    "ac_refs": ["AC-15"],
    "depends_on": ["C1"],
    "model": "sonnet",
    "input": "Hooks slot in after CLAUDE.md as the earliest feedback point, becoming layer 2"
  },
  {
    "id": "C3",
    "title": "validate-templates.sh: copy-manifest drift, oxlint↔config ceiling agreement, schema validation, and no check-structure.sh reference outside docs/toolu/ — including updating its OWN line-250 error message, which names the file",
    "check": "bash scripts/validate-templates.sh && ! grep -rl 'check-structure' stacks/ scripts/ CORE.md README.md .github/",
    "ac_refs": ["AC-12", "AC-13"],
    "depends_on": ["C2"],
    "model": "sonnet",
    "input": "The no-reference search MUST exclude docs/toolu/ (the spec and decision record name the file they replace) and MUST include scripts/ (validate-templates.sh line 250 currently names it in an error string)"
  },
  {
    "id": "C4",
    "title": "Kit CI: .github/workflows/ci.yml runs the guardrails fixture suite and the latency harness as named steps",
    "check": "bash guardrails/__tests__/run-fixtures.sh && bash scripts/validate-templates.sh",
    "depends_on": ["C3"],
    "model": "haiku"
  }
]
```

## Critical files

**Create** — `guardrails/run.sh`, `guardrails/lib/{config,report}.sh`,
`guardrails/checks/{folder-tree,file-size,colocated-tests,no-barrels,banned-deps,shadow-configs,required-files,secrets,patterns}.sh`,
`guardrails/patterns/{ts/no-bare-fetch.yml,ts/no-hardcoded-hex.yml,ts/no-manual-orpc-key.yml,rust/no-direct-env-var.yml}`,
`guardrails/schema.json`, `guardrails/__tests__/{run-fixtures.sh,run-latency.sh}`,
`guardrails/__tests__/fixtures/{clean,violating}/**`, and per stack
`stacks/<s>/templates/{guardrails.config.json,sgconfig.yml,.claude/settings.json,scripts/guardrails/**}`.

**Modify** — `CORE.md`, `README.md`, `docs/conventions.html`,
`scripts/validate-templates.sh`, `.github/workflows/ci.yml`, and per stack
`SETUP.md`, `STRUCTURE.md`, `templates/CLAUDE.md.template`,
`templates/lefthook.yml`, `templates/.github/workflows/ci.yml`.

**Delete** — `stacks/*/templates/scripts/check-structure.sh` (all five).

## Verification

Real-data only, no mocks: every assertion runs the actual `run.sh` against real
directory trees on disk. The violating fixture is a real git repository because
`secrets.sh` shells out to `git ls-files` and cannot be exercised otherwise.

```bash
bash guardrails/__tests__/run-fixtures.sh    # AC-1..AC-11, AC-16..AC-18
bash guardrails/__tests__/run-latency.sh     # AC-14, on a generated 500-file tree
bash scripts/validate-templates.sh           # AC-12, AC-13, AC-15
```

End-to-end path worth exercising by hand once: scaffold a throwaway console
project from the kit, introduce a `src/features/x/utils/` folder, and confirm
the `PostToolUse` hook reports it with a remedy clause and exit 2.

**Docs in sync** is step C2, not a follow-up: `CORE.md` is the file that
currently promises four mandatory layers, and shipping a fifth without updating
it would leave the kit's central rules document wrong.

## Review

Reviewed 2026-08-04 against the `plan-review` checklist. Two blockers found and
closed. **A2** planned to commit a fixture git repository — verified impossible:
git refuses to track a nested `.git` ("adding embedded git repository") and
leaves it untracked, so the fixture would not survive a clone; the repo is now
built at test time by `__tests__/lib/mkrepo.sh`. **B1–B5** diffed with
`--exclude=__tests__` while the spec called the copy "verbatim" and AC-12
asserted byte-for-byte; the spec now carries an explicit copy manifest and every
B check diffs against it. Four should-fixes closed: AC-12's search scope missed
`scripts/`, where `validate-templates.sh` names `check-structure.sh` in its own
error message; C2's `grep -q 'five'` was a coincidence detector and now asserts
the layer headings; B4 rose from haiku to sonnet for the `.astro` subtlety; A1's
line-count check now asserts the nine check ids by name.

Gate sequencing verified clean: `validate-templates.sh` only *mentions*
`check-structure.sh` in a comment and an error string — it never asserts the
file exists — so deleting it in B1–B5 does not red the gate before C3 lands.
**Status: Approved.**
