# ADR 002 — Reference by Name Over Structural Inlining

## Status
Accepted

## Context

When one type references another (`Post.author: User`), the IR needs to represent that relationship. Two fundamentally different approaches exist: inline the referenced type's fields directly at the use site, or point at the referenced type by name and let the runtime resolve it.

This decision has cascading consequences for cycles, duplication, and where resolution work happens.

## Options Considered

**Option A — Structural inlining**
When `Post.author: User` is encountered, copy `User`'s fields directly into `Post`'s IR at the `author` property:

```json
"author": {
  "kind": "object",
  "fields": {
    "username": { "kind": "string" },
    "email":    { "kind": "string" }
  }
}
```

Simple to generate, simple for the runtime (no lookup needed). But: cycles (`User.posts: Post[]`, `Post.author: User`) produce infinite structures. And if `User` changes, every type that inlined it is stale.

**Option B — Reference by name (qualified identifier)**
Emit a `kind: "reference"` pointing at the target's registry key:

```json
"author": { "kind": "reference", "ref": "src/models/user.ts#User" }
```

The runtime resolves `ref` against `MockRegistry.types` at generation time.

## Decision

Option B — reference by name using qualified identifiers.

**Why inlining fails:**

Cycles are the decisive factor. `User.posts: Post[]` and `Post.author: User` is a completely normal relationship in real codebases. With inlining, the extractor would recurse infinitely trying to inline `Post` into `User` into `Post` into `User`. The only way to break this at extraction time is arbitrary depth-limiting — which loses information and produces an IR that doesn't faithfully represent the type.

With reference-by-name, cycles are trivially representable: `User` points at `Post` by name, `Post` points at `User` by name. The JSON is finite. The cycle only becomes a live problem at generation time (the runtime needs a depth guard), not at IR design time.

**Secondary benefits:**

- **No duplication.** `User` is defined once in `types`, referenced everywhere. If `User` gains a field, only one registry entry changes.
- **Referential integrity.** If a `ref` points to a key that doesn't exist in `types`, the extractor emits an `UNRESOLVED_REFERENCE` diagnostic. Inlining has no equivalent — a missing type silently produces an empty object.
- **Runtime simplicity.** The runtime's reference-resolution logic is a single map lookup. It doesn't need to understand type structure to follow a reference.

**Ref always contains the qualified identifier, never the short alias.** Aliases are ergonomic sugar for the consumer API (`mock.create("User")`), not part of the type graph. Internal references use stable qualified ids so they remain correct even if aliases are ambiguous or change.

## Consequences

- The runtime must implement lazy reference resolution with a cycle-depth guard — `mock.create()` recursing into a `reference` field must track depth and stop before a stack overflow
- `UNRESOLVED_REFERENCE` diagnostics are possible and expected when a referenced type falls outside the extractor's configured `include` globs
- `IRField` never contains a nested `fields: Record<string, IRField>` — the only way to represent an object-typed field is through `reference`, which keeps the IR flat and the registry self-contained
