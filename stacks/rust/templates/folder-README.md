# <module-dir>/

> Template. Copy into a `src/` submodule folder when it grows past a single
> file, rename the heading, and keep the lists current. Delete this blockquote.

**What belongs here:** <one line — the single responsibility of this module>.

**What does NOT belong here:** <where the tempting-but-wrong things go instead>.

## Contents

One line per file, named after its primary item:

| File | Primary item | Purpose |
| --- | --- | --- |
| `<name>.rs` | `<StructOrFn>` | <what it does> |

When you add a file here, add its row above so the index stays current. No
`mod.rs` barrel — declare submodules from the parent (`pub mod <name>;`) and
import concrete paths.
