# ADR 003 — Qualified Identifiers and Short-Name Aliases

## Status
Accepted

## Context

Real projects frequently define types with identical names in different files:

```typescript
// src/models/user.ts
export interface User { id: string; passwordHash: string; }

// src/api/responses.ts
export interface User { id: string; displayName: string; }
```

The registry is keyed by type name. Without an explicit addressing strategy, the second `User` silently overwrites the first. Worse: a `reference.ref: "User"` now points at whichever definition was registered last — silent corruption, no error.

The addressing model must be both **correct** (no silent collisions) and **ergonomic** (developers write `mock.create("User")`, not `mock.create("src/models/user.ts#User")`).

## Options Considered

**Option A — Last write wins**
Keep a flat `Record<string, IRType>`, overwrite silently on collision. Simple but produces silent, incorrect data. Ruled out immediately.

**Option B — Hard error on collision**
Refuse to emit a registry if any two types share a short name. Forces developers to narrow their `include` globs. Honest but makes the tool unusable on projects where collisions are legitimate and unavoidable.

**Option C — Always fully qualified keys, no aliases**
Key every entry as `src/models/user.ts#User`. Correct always. But `mock.create("src/models/user.ts#User")` is a miserable consumer API and makes the tool feel hostile.

**Option D — Qualified identity internally, short-name aliases where unambiguous**
Internally, every type is identified by its qualified id. A separate `aliases` map provides short-name ergonomics only where they are unambiguous. Collisions produce a diagnostic, not a crash.

## Decision

Option D — qualified ids as internal identity, `aliases` map for ergonomic short names.

This separates two concerns that should never have been conflated: **identity** (which type is this, unambiguously?) and **ergonomics** (what does a developer type to access it?).

The pattern is well-established: DNS separates IP addresses (identity) from domain names (ergonomics). Filesystems separate inodes (identity) from paths (ergonomics). This registry does the same.

**Qualified identifier format:**
```
<relative-file-path>#<TypeName>
```
File path is relative to the project root (`tsconfig.json` location). This makes qualified ids stable across machines while remaining human-readable.

**Alias rules:**
- A short name is added to `aliases` only if it maps to exactly one qualified id across all registered types
- If a short name maps to two or more qualified ids, it is omitted from `aliases` and an `AMBIGUOUS_ALIAS` diagnostic is emitted
- `reference.ref` always contains a qualified id — never an alias — so references are stable regardless of alias ambiguity

**Consumer experience on collision:**
```
// mock.create("User") throws:
// "User" is ambiguous.
// Did you mean:
//   "src/models/user.ts#User"
//   "src/api/responses.ts#User"
```
Loud, specific, actionable — not silent corruption.

## Consequences

- `MockRegistry.types` is keyed by qualified id — a longer string, but stable and unambiguous
- `MockRegistry.aliases` is a separate flat map — `Record<string, string>` from short name to qualified id
- `IRType.name` retains the short human name for error messages and diagnostics, decoupled from the registry key
- The extractor must produce qualified ids at parse time — it always has the source file path and symbol name available, so this is free
- Generic instantiations extend the format naturally: `src/api/responses.ts#ApiResponse<User>` — the `<TypeArgs>` suffix is part of the type name segment after `#`
