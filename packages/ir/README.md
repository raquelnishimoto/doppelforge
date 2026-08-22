# `@doppelforge/ir` — Mock Intermediate Representation Specification

Version: `1.0.0`  
Status: **Locked**

This document is the authoritative contract between the CLI (producer) and the runtime (consumer). Both packages depend on this package. Neither owns it.

---

## Purpose

The IR is a language-agnostic, framework-agnostic intermediate representation of a type's structure. It contains exactly the information the runtime needs to generate realistic mock data — no more, no less.

**What the IR is not:**
- It is not a TypeScript AST dump
- It is not a JSON Schema
- It is not tied to Faker, MSW, or any specific consumer
- It does not contain TypeScript compiler types (`ts.Type`, `ts-morph` nodes, etc.)

The IR is the narrow waist of the architecture. Inputs (TypeScript analyzer, future analyzers) write to it. Outputs (runtime generator, diagnostics surface) read from it. Neither side knows about the other.

---

## Dependency Rule

> `@doppelforge/ir` must have **zero runtime dependencies**.  
> `typescript`, `ts-morph`, and `@faker-js/faker` are never listed as `dependencies` — only as `devDependencies` if needed for tests.

This is enforced structurally: if this package has a runtime dependency, the runtime's browser bundle is no longer lightweight and the architectural boundary has been violated.

---

## Type Definitions

### `Hint`

A structured instruction to the runtime about how to generate a value for a specific field. Optional — fields without a hint fall back to field-name inference, then type-based defaults.

```typescript
interface Hint {
  strategy: string;                      // e.g. "internet.email", "string.uuid"
  args?: Record<string, unknown>;        // e.g. { min: 10, max: 150 }
}
```

`strategy` is a dot-separated path into the generation engine's API. The runtime resolves this at generation time. It is not validated at extraction time.

---

### `FieldMeta`

Metadata orthogonal to a field's shape. Carried by every `IRField` variant.

```typescript
interface FieldMeta {
  optional?: boolean;   // true if the property is declared with ?:
  nullable?: boolean;   // true if null is in the field's type union
  hint?: Hint;          // explicit generation strategy override
}
```

**`optional` vs `nullable` are distinct and not interchangeable:**

| | Object key absent | Object key present, value is `null` |
|---|---|---|
| `optional: true` | ✅ valid | depends on nullable |
| `nullable: true` | ❌ invalid | ✅ valid |

A field can be both (`deletedAt?: string | null`).

---

### `IRField`

A discriminated union on `kind`. Every variant intersects `FieldMeta`.

```typescript
type IRField =
  | ({ kind: "string" | "number" | "boolean" | "date" } & FieldMeta)
  | ({ kind: "enum";      values: (string | number)[] }  & FieldMeta)
  | ({ kind: "array";     items: IRField }                & FieldMeta)
  | ({ kind: "tuple";     elements: IRField[] }           & FieldMeta)
  | ({ kind: "union";     options: IRField[] }            & FieldMeta)
  | ({ kind: "reference"; ref: string }                   & FieldMeta)
  | ({ kind: "unknown";   raw?: string }                  & FieldMeta);
```

---

#### Kind Reference

| Kind | Meaning | Extra fields | Recursive? |
|---|---|---|---|
| `string` | UTF-8 string value | — | No |
| `number` | IEEE 754 number | — | No |
| `boolean` | `true` or `false` | — | No |
| `date` | A point in time (JS `Date`) | — | No |
| `enum` | One of a fixed set of literal values | `values: (string \| number)[]` | No |
| `array` | Variable-length homogeneous sequence | `items: IRField` | Yes |
| `tuple` | Fixed-length positional sequence | `elements: IRField[]` | Yes |
| `union` | One of several open types | `options: IRField[]` | Yes |
| `reference` | Points to another named type in the registry | `ref: string` | Via registry |
| `unknown` | Unresolvable — extractor could not classify | `raw?: string` | No |

---

#### `enum`

Used for both TypeScript `enum` declarations and unions where **every member is a literal value**.

```typescript
// Both of these produce the same IR:
enum Role { Admin = "admin", User = "user" }
type Role = "admin" | "user";
```

```json
{ "kind": "enum", "values": ["admin", "user"] }
```

Values may be strings, numbers, or a mix (heterogeneous enums). The runtime picks one value at random.

**Rule:** a union is `enum` only if every member is a literal value. The moment any member is an open type (`string`, `number`, etc.), the whole union becomes `kind: "union"`. Literal members within that union may appear as nested `enum` options.

---

#### `array`

A variable-length, homogeneous sequence. All elements share one type described by `items`.

```json
{ "kind": "array", "items": { "kind": "string" } }
{ "kind": "array", "items": { "kind": "reference", "ref": "src/models/user.ts#User" } }
```

`items` is itself a full `IRField` — it may be any kind, including another `array` (for nested arrays) or a `reference`.

---

#### `tuple`

A fixed-length, positional sequence. Each position has its own type described by `elements[i]`.

```typescript
type Point = [number, number];
type Entry = [string, Date];
```

```json
{ "kind": "tuple", "elements": [{ "kind": "number" }, { "kind": "number" }] }
{ "kind": "tuple", "elements": [{ "kind": "string" }, { "kind": "date" }] }
```

The runtime generates exactly `elements.length` values, each using its position's own `IRField`. Order is significant.

**`array` vs `tuple`:**

| | `array` | `tuple` |
|---|---|---|
| Length | Variable | Fixed (`elements.length`) |
| Types | All elements share `items` | Each position has its own type |
| Order | Irrelevant to type | Positional, significant |

---

#### `union`

A union where at least one member is an open type (not a literal value). The runtime picks one `option` at random and generates from it.

```typescript
type StringOrNumber = string | number;
type WeirdRole = "admin" | "user" | number;
```

```json
{ "kind": "union", "options": [{ "kind": "string" }, { "kind": "number" }] }
{ "kind": "union", "options": [
    { "kind": "enum", "values": ["admin", "user"] },
    { "kind": "number" }
]}
```

`options` is itself a full `IRField[]` — options may themselves be `array`, `reference`, or any other kind.

**`union` vs `enum`:**

| | `enum` | `union` |
|---|---|---|
| Members | All literals | At least one open type |
| Runtime picks | One value from `values` | One generation strategy from `options` |

---

#### `reference`

Points to another named type in the same registry by its **qualified identifier**.

```json
{ "kind": "reference", "ref": "src/models/user.ts#User" }
```

`ref` always contains the qualified id, never the short alias. The runtime resolves `ref` against `MockRegistry.types` at generation time.

**Cycle handling:** cycles (`User.posts → Post`, `Post.author → User`) are valid in the IR. The runtime is responsible for depth-limiting recursive resolution at generation time. The IR does not break cycles — it represents them faithfully.

---

#### `unknown`

The universal escape hatch. Used when the extractor cannot classify a field — generics not yet supported, conditional types, mapped types, complex external types, or any other unresolvable construct.

```json
{ "kind": "unknown", "raw": "Omit<User, \"password\"> & { role: Role }" }
```

`raw` contains a human-readable string representation of the original TypeScript type, for debugging and diagnostic messages. It is never parsed by the runtime.

**Contract:** the runtime generates `null` for `unknown` fields. It does not error. `unknown` is not a failure — it is a deliberate, graceful degradation.

---

### `IRType`

A named, registrable type — the result of extracting one interface, type alias, or resolved generic instantiation.

```typescript
interface IRType {
  name: string;
  fields: Record<string, IRField>;
  typeParameters?: { name: string; constraint?: string }[];
}
```

| Field | Meaning |
|---|---|
| `name` | The short human-readable name (e.g. `"User"`). Used in error messages and diagnostics. Not the registry key. |
| `fields` | Map of property name → `IRField`. Order is not significant. |
| `typeParameters` | Reserved for generic type declarations. Metadata only — not consumed by the runtime in v1. Used by the extractor to record that a type is generic and what its parameter constraints are. |

`typeParameters` is intentionally inert in v1. It exists to avoid a breaking change when generic support is added. Runtimes built against v1 safely ignore it.

---

### `Diagnostic`

A structured message emitted by the extractor when it encounters something noteworthy — a resolution failure, a hint gap, or a type coherence issue.

```typescript
type DiagnosticSeverity = "error" | "warning" | "info";

interface Diagnostic {
  severity: DiagnosticSeverity;
  code: string;          // e.g. "UNRESOLVED_REFERENCE", "HINT_GAP", "UNSUPPORTED_CONSTRUCT"
  message: string;       // human-readable, actionable
  location?: string;     // "src/models/user.ts:12:5"
  field?: string;        // qualified id of the affected field, if applicable
}
```

**Severity semantics:**

| Severity | Meaning | Runtime impact |
|---|---|---|
| `error` | Extraction failed for this type or field | Affected field falls back to `unknown` |
| `warning` | Extraction succeeded but with reduced fidelity | Generated data may be less realistic |
| `info` | Informational — no fidelity loss | None |

**Standard diagnostic codes:**

| Code | Severity | Meaning |
|---|---|---|
| `UNRESOLVED_REFERENCE` | `error` | A `reference.ref` target was not found in the registry |
| `UNSUPPORTED_CONSTRUCT` | `warning` | A TypeScript construct is not yet supported (generic, conditional type, etc.) |
| `HINT_GAP` | `info` | A field has no hint and no field-name inference match — will produce a generic value |
| `AMBIGUOUS_ALIAS` | `warning` | A short name maps to more than one qualified id — no alias was emitted |
| `GENERIC_SKIPPED` | `warning` | A generic type declaration was skipped — only concrete instantiations are registered |

---

### `MockRegistry`

The root envelope. This is the `.mock-registry.json` file on disk.

```typescript
interface MockRegistry {
  schemaVersion: string;
  types: Record<string, IRType>;
  aliases: Record<string, string>;
  diagnostics: Diagnostic[];
}
```

| Field | Meaning |
|---|---|
| `schemaVersion` | Semver string of the IR spec version that produced this registry (e.g. `"1.0.0"`). Consumers should reject registries with an incompatible major version. |
| `types` | Map of **qualified identifier → IRType**. This is the authoritative type map. |
| `aliases` | Map of **short name → qualified identifier**. Only unambiguous short names appear here. Consumers may use aliases for ergonomic access (`mock.create("User")`). |
| `diagnostics` | All diagnostics emitted during extraction. Empty array if extraction was clean. Never `null` or `undefined`. |

---

#### Qualified Identifiers

Every entry in `types` is keyed by a qualified identifier of the form:

```
<relative-file-path>#<TypeName>
```

Examples:
```
src/models/user.ts#User
src/api/responses.ts#User
src/models/post.ts#Post
src/api/responses.ts#ApiResponse<User>
```

**Rules:**
- File path is relative to the project root (where `tsconfig.json` lives)
- `TypeName` is the declared name of the type
- Generic instantiations append the concrete type arguments: `ApiResponse<User>`
- `reference.ref` always contains a qualified id, never a short alias

#### Aliases

The `aliases` map provides ergonomic short-name access for consumers:

```json
{
  "aliases": {
    "Post": "src/models/post.ts#Post",
    "Product": "src/models/product.ts#Product"
  }
}
```

A short name is omitted from `aliases` if it maps to more than one qualified id (collision). In that case, the `AMBIGUOUS_ALIAS` diagnostic is emitted, and consumers must use the full qualified id.

---

## Full Example

**Input TypeScript:**

```typescript
// src/models/user.ts
export interface User {
  /** @mock { strategy: "internet.email" } */
  email: string;
  username: string;
  age?: number;
  deletedAt?: string | null;
  role: "admin" | "user";
  posts: Post[];
}

// src/models/post.ts
export interface Post {
  title: string;
  author: User;
  tags: string[];
  coordinates: [number, number];
}
```

**Output `.mock-registry.json`:**

```json
{
  "schemaVersion": "1.0.0",
  "types": {
    "src/models/user.ts#User": {
      "name": "User",
      "fields": {
        "email":     { "kind": "string", "hint": { "strategy": "internet.email" } },
        "username":  { "kind": "string" },
        "age":       { "kind": "number", "optional": true },
        "deletedAt": { "kind": "string", "optional": true, "nullable": true },
        "role":      { "kind": "enum", "values": ["admin", "user"] },
        "posts":     { "kind": "array", "items": { "kind": "reference", "ref": "src/models/post.ts#Post" } }
      }
    },
    "src/models/post.ts#Post": {
      "name": "Post",
      "fields": {
        "title":       { "kind": "string" },
        "author":      { "kind": "reference", "ref": "src/models/user.ts#User" },
        "tags":        { "kind": "array", "items": { "kind": "string" } },
        "coordinates": { "kind": "tuple", "elements": [{ "kind": "number" }, { "kind": "number" }] }
      }
    }
  },
  "aliases": {
    "User": "src/models/user.ts#User",
    "Post": "src/models/post.ts#Post"
  },
  "diagnostics": [
    {
      "severity": "info",
      "code": "HINT_GAP",
      "message": "Field 'username' has no hint and no field-name inference match. A generic string will be generated.",
      "location": "src/models/user.ts:4",
      "field": "src/models/user.ts#User.username"
    }
  ]
}
```

---

## Versioning Policy

`schemaVersion` follows semantic versioning:

| Change type | Version bump | Example |
|---|---|---|
| New optional field on `IRType` or `MockRegistry` | Patch | Adding `typeParameters` metadata |
| New `kind` member on `IRField` | Minor | Adding `kind: "tuple"` |
| Changing the meaning of an existing field | Major | Renaming `ref` to `target` |
| Removing a field | Major | Removing `aliases` |

Consumers should warn on minor version mismatch and reject on major version mismatch.
