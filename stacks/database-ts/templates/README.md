# @{{TOOLU_PROJECT_NAME}}/database

The database, as its own package. It owns the Drizzle schema, the Turso client
factory, and the migrations. The API imports it and writes its own queries.

## What isolation this does and does not buy

It gives you one place where storage lives: schema, migrations and the client
are here, not scattered through `services/`. Swapping the engine is a change
inside this package for ordinary CRUD.

It is **not** total isolation, and the README says so on purpose. The package
exports a configured Drizzle instance, so Drizzle's types cross the boundary
into the API. Dialect-specific calls — `onConflictDoUpdate`, `returning()`,
`sqliteTable` vs `pgTable` inferred column types — will still break API call
sites on an engine change. If you need a swap that touches nothing outside this
package, you want repository ports (domain functions in, domain shapes out),
which is a different and more expensive design.

## Using it

```ts
import { createDatabase } from '@{{TOOLU_PROJECT_NAME}}/database/client';
import { profiles } from '@{{TOOLU_PROJECT_NAME}}/database/schema';
import { eq } from 'drizzle-orm';

export async function getProfile(env: Env, id: string) {
  const database = createDatabase({ url: env.TURSO_URL, authToken: env.TURSO_AUTH_TOKEN });
  return database.select().from(profiles).where(eq(profiles.id, id));
}
```

Build the handle **inside** the function. A Worker evaluates a module once per
isolate and shares that isolate across requests, so a module-scope handle
outlives the request that made it — `house/no-module-scope-database` fails the
lint if you try.

## The public surface is the `exports` map

`package.json` maps three subpaths straight at concrete files. That is the whole
API; there is no `index.ts`, because a re-export barrel is banned and this needs
no exemption to avoid one.

## Migrations

`bun run db:generate` writes to `drizzle/`, `bun run db:migrate` applies it.
better-auth owns its own tables and runs its own migrator against the same
database — `drizzle.config.ts` filters them out so `push` cannot read them as
drift and drop them.

## Tests

`bun run test` runs them inside workerd against the Turso database in
`.dev.vars`. Real data, no mocks.
