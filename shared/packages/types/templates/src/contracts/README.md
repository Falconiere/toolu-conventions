# contracts/

The shapes both sides of a call agree on.

## What is here

- One file per contract, exporting a zod schema, its inferred type, and a
  `parse*` function. `health-response.ts` is the example — replace it or add
  beside it.

## What does NOT go here

- Business logic, or a type declared by hand beside its schema. Infer it with
  `z.infer`.
