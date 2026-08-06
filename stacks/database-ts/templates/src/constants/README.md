# constants/

Config, parsed at the boundary.

## What is here

- env.ts — the Zod schema for caller-supplied credentials.

## What does NOT go here

- Anything read from process.env; there is none on workerd.
