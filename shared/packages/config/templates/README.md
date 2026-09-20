# @{{TOOLU_PROJECT_SLUG}}/config

Shared lint bases, and nothing else. This package has no source tree, no
`vitest.config.ts`, and no tests to run — there is no code here for a test to
exercise.

## What is here

- `base.oxlintrc.json` — the house rules shared by every TypeScript package:
  type-aware correctness rules, no barrels, no deep relative imports, kebab-case
  filenames, the `house/*` plugin rules.
- `base-react.oxlintrc.json` — the React-specific additions (`react/*`,
  `react-hooks/*`) for packages and apps that render JSX.

## Using it

An app or package extends these from its own `.oxlintrc.json`, relative to
where it sits in the workspace:

```json
{
  "extends": ["../../packages/config/base.oxlintrc.json"]
}
```

Add `"../../packages/config/base-react.oxlintrc.json"` to that `extends` array
too when the package renders JSX.

## Why a package instead of one root config

Every workspace package runs `oxlint` from its own directory — never from the
workspace root, because `guardrails.config.json` resolution depends on the
working directory. A shared root config would mean either running from the
root (breaking that resolution) or duplicating the rules into every package
(letting them drift). Extending a package that ships nothing but the rules
keeps one copy and lets each package's `.oxlintrc.json` still declare its own
`env`, `ignorePatterns`, and overrides.

## How the paths in these files resolve

The `jsPlugins` entry in `base.oxlintrc.json` and the `extends` entries in every
consuming package point two levels up, at the workspace root — the initializer
writes them that way when it generates the workspace. A package that does not
extend this one keeps its own copy of the bases instead, with the same paths
rewritten for its own depth, so both shapes resolve from the directory oxlint
actually runs in: the package.

## What does NOT go here

Application code, contracts, or components. Those belong in `packages/ui` and
`packages/types`. The `package.json` here declares the two bases in its
`exports` map and one script, the format check: a package with no code has
nothing else to gate. Consumers still resolve the bases by path, because
oxlint reads `extends` as a path rather than through Node.
