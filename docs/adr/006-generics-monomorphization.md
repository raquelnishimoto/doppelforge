# ADR 006 — Generics via Monomorphization at Use Sites

## Status
Accepted (implementation deferred to v0.2)

## Context

TypeScript generics are common in real projects:

```typescript
interface ApiResponse<T> {
  data: T;
  status: number;
  error?: string;
}

// concrete use sites:
type UserResponse    = ApiResponse<User>;
type ProductResponse = ApiResponse<Product>;
```

`ApiResponse<T>` alone is not a generatable type — `T` is unresolved. The IR must represent concrete instantiations, not abstract generic declarations.

Two approaches exist: represent generics as a new IR concept (with type-parameter slots), or resolve each concrete instantiation to a standalone registry entry that looks like any other interface.

## Options Considered

**Option A — New IR concept: `kind: "generic"`**
Add a `kind: "generic"` with `base` and `typeArguments` fields. The runtime receives generic shapes and must perform type substitution at generation time — effectively reimplementing part of the TypeScript type system inside the browser/Node runtime.

**Option B — Monomorphization at use sites**
For each concrete instantiation found in the scanned codebase, substitute the type arguments and register the result as a standalone `IRType` with a mangled key. `ApiResponse<User>` becomes a registry entry indistinguishable from a hand-written interface.

## Decision

Option B — monomorphization at use sites.

**What monomorphization means in this context:**

Monomorphization (from Greek: mono = one, morph = shape) means turning one parameterised shape into multiple concrete single shapes, one per unique instantiation. The term comes from compiled language implementations: Rust and C++ templates are monomorphized — each concrete instantiation (`Vec<i32>`, `Vec<String>`) is compiled as its own standalone type. doppelforge applies the same principle at the type-extraction level.

**Why Option A fails:**

The runtime's core design principle is that it is TypeScript-blind — it receives the IR and generates data with no knowledge of TypeScript's type system. Option A breaks this: the runtime would need to understand generic substitution (`replace T with User in this field list`) at generation time. This is type-system logic in the wrong layer, and it makes the runtime non-universal — a browser bundle that understands TypeScript generics is no longer lightweight.

**How monomorphization works:**

The extractor finds concrete use sites — property types, return types, type alias declarations:

```typescript
type UserResponse = ApiResponse<User>;           // use site
interface Dashboard { response: ApiResponse<User> } // another use site
```

For each unique instantiation, it substitutes type arguments (using the TypeScript checker) and registers the result:

```json
"src/api/responses.ts#ApiResponse<User>": {
  "name": "ApiResponse<User>",
  "fields": {
    "data":   { "kind": "reference", "ref": "src/models/user.ts#User" },
    "status": { "kind": "number" },
    "error":  { "kind": "string", "optional": true }
  }
}
```

A field of type `ApiResponse<User>` becomes `{ "kind": "reference", "ref": "src/api/responses.ts#ApiResponse<User>" }` — identical to any other reference. The runtime code path is unchanged.

**Key mangling convention:**
Generic instantiations extend the qualified id format: `<file>#<TypeName><TypeArgs>`. Multiple type parameters are joined in declaration order: `Pair<string, User>` → `src/utils/pair.ts#Pair<string, User>`.

**Constrained generics (`<T extends Base>`):**
Constraints are the TypeScript compiler's concern. By the time the extractor scans valid source, `tsc` has already rejected any instantiation violating the constraint. The extractor trusts its input and does not re-validate constraints. Constraint metadata is recorded on `IRType.typeParameters` for documentation purposes only.

**Generic declarations with no concrete use sites:**
If `ApiResponse<T>` is declared but never concretely instantiated within the scanned files, no registry entry is emitted. The `GENERIC_SKIPPED` diagnostic is emitted for the declaration. This is correct — there is no concrete shape to generate from.

## Consequences

- No new `IRField` kind is needed for generics — `reference` handles instantiation references identically to plain interface references
- `IRType.typeParameters` is reserved as a metadata field (see IR spec) — it is inert in v1 and populated in v0.2
- The extractor must scan use sites, not just declarations — it cannot register `ApiResponse<User>` without finding `ApiResponse<User>` written somewhere in the codebase
- Multiple type parameters compose naturally with the mangling scheme: `Pair<string, User>`, `Pair<number, Product>` are distinct keys
- Deeply nested generics (`Repository<Pair<string, User>>`) mangle depth-first: `src/...#Repository<src/...#Pair<string, User>>` — a valid if verbose key
