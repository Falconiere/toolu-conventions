# components/

Shared React primitives, rendered by any app in the workspace.

## What is here

- `surface.tsx` — the smallest layout primitive: a div that forwards
  `className` and `children`. It carries no styling of its own.

## What does NOT go here

- Colour, spacing, or any other styling decision. Those are the consuming
  app's utility classes, passed in through `className`. `house/no-hardcoded-hex`
  fails the lint on a literal hex value in this folder.
