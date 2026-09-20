# @{{TOOLU_PROJECT_SLUG}}/ui

Shared React components, as their own package. Bundler-free: there is no build
step here, and consumers import the TS/TSX source directly through the
workspace `exports` map, the same way `@{{TOOLU_PROJECT_SLUG}}/database`
exports its client.

## Using it

```tsx
import { Surface } from '@{{TOOLU_PROJECT_SLUG}}/ui/surface';
import { classNames } from '@{{TOOLU_PROJECT_SLUG}}/ui/class-names';

export function Card({ active }: { active: boolean }) {
  return <Surface className={classNames('rounded-lg border p-4', active && 'border-accent')} />;
}
```

## What isolation this does and does not buy

It gives you one implementation of a shared primitive, imported by every app
in the workspace instead of copy-pasted into each. It is **not** a design
system with its own styling: the components carry no colour, spacing, or
typography of their own — those are Tailwind utility classes the consuming
app passes in through `className`. A component in this package that hardcodes
a colour is a component that cannot be reused across two apps with two
different themes, which is what `house/no-hardcoded-hex` blocks.

## The public surface is the `exports` map

`package.json` maps each component and utility straight at its concrete file.
That is the whole API; there is no `index.ts`, because a re-export barrel is
banned and this needs no exemption to avoid one.

## Tests

`bun run test` runs jsdom vitest with React Testing Library — render the
component, assert on what a user would see, no mocks.
