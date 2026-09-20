# @{{TOOLU_PROJECT_SLUG}}/types

The shared contracts, as their own package. Every zod schema that crosses a
boundary between two workspace packages or apps lives here, so both sides
import the same runtime validator and the same inferred type — never a
hand-written mirror on either end.

## Using it

```ts
import { HealthResponse, parseHealthResponse } from '@{{TOOLU_PROJECT_SLUG}}/types/contracts';

const payload = parseHealthResponse(await response.json());
```

## The public surface is the `exports` map

`package.json` maps a subpath straight at the concrete file. There is no
`index.ts` — a re-export barrel is banned, and this needs no exemption to
avoid one. Add a contract by adding both the file under `src/contracts/` and a
line to the `exports` map.

## What isolation this does and does not buy

It gives you one schema per shape, imported on both sides of a call. It does
**not** validate a payload for you at the boundary — each side still calls
`parse*` itself; a contract nobody parses is just an unenforced type.

## Tests

`bun run test` runs plain Node vitest against real inputs — a valid payload
and the specific ways it can be malformed. No mocks: a schema is exercised by
parsing values, not by stubbing a collaborator.
