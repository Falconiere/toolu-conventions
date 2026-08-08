/** Every table, as one value — what drizzle's relational queries need. */
import { profiles } from './profiles-table';

// Not a barrel. This composes a value whose shape IS the schema, the same way
// the API's rpc/router.ts composes one whose shape is the API; drizzle needs it
// to resolve relations. Adding a table is one line here.
export const tables = { profiles };
