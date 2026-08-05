# shared/

Kit-level template files that are **identical across stacks**. One copy here, read directly
by every stack's `SETUP.md`, instead of the same bytes sitting in five `templates/` folders
drifting apart one PR at a time.

| File | Destination in a generated project | Used by |
| --- | --- | --- |
| `.claude/settings.json` | `.claude/settings.json` | all five stacks |
| `folder-README.md` | each domain folder's `README.md` | `console` · `marketing` · `backend-ts` |

Anything that genuinely varies per stack stays in `stacks/<stack>/templates/`. This folder is
for files where a difference would be a bug, not a choice.

## `.claude/settings.json`

The agent-hook layer — guard-rail layer 2 of the five in [`CORE.md`](../CORE.md). It runs the
structure gate on every file an agent writes, and again before the agent finishes its turn:

- `PostToolUse` on `Edit|Write` → `bash scripts/guardrails/run.sh --hook`
- `Stop` → `bash scripts/guardrails/run.sh --stop`

Both invoke the **destination** path, `scripts/guardrails/run.sh`, because the file describes
a generated project rather than this kit — see
[`guardrails/README.md`](../guardrails/README.md) on source vs. destination.

Identical for all five stacks, `rust` included: the hook wiring does not care what language
the project is in, only that `run.sh` sits at that path. `scripts/validate-templates.sh`
asserts both commands are present, so a fork of this wiring cannot pass CI quietly.

## `folder-README.md`

The per-folder README template. `agent-guardrails`' `folder-readmes` check requires one in
every folder named by `guardrails.config.json`'s `src.requireReadme`, so a domain folder
without it fails the gate.

Three stacks share this copy. Two do not, and that is deliberate:

| Stack | Template | Why |
| --- | --- | --- |
| `console` · `marketing` · `backend-ts` | `shared/folder-README.md` | Same web-app domain vocabulary |
| `expo` | `stacks/expo/templates/folder-README.md` | Its own copy — React Native domain shape |
| `rust` | `stacks/rust/templates/folder-README.md` | Its own copy — crate modules, not `src/` domains |

`scripts/validate-templates.sh` asserts the three do **not** ship their own copy and that
expo and rust **do** — so a future cleanup cannot delete a file that only looks like a
duplicate.

## Adding a file here

Only when it is byte-identical across every stack that uses it, and a difference between
stacks would be a defect. Add the copy step to each stack's `SETUP.md`, and add an assertion
to `scripts/validate-templates.sh` — both that this copy exists, and that no stack has
started shipping its own again. An unenforced rule drifts; that is the whole thesis of this
repo.
