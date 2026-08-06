/** The example application table. Replace it with your own. */
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

// One table per file, named after what it exports. `user` here is an
// APPLICATION table — better-auth owns its own `user`/`session`/`account`
// tables and migrates them itself; see drizzle.config.ts's tablesFilter.
export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
});
