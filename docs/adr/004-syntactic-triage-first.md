# ADR 004 — Syntactic Triage First, Type Checker on Escalation

## Status
Accepted

## Context

The extractor has two available tools for understanding a TypeScript field's type:

1. **Syntactic AST walk** — reads the source structure as written. Cheap: essentially a pointer dereference into the already-parsed AST. No computation.
2. **Type checker invocation** — asks the TypeScript compiler to fully resolve and compute the type of a node. Correct for everything, including generics, utility types (`Omit`, `Pick`, `Partial`), and conditional types. More expensive per call.

One of doppelforge's explicit requirements is that the CLI is fast enough to run in watch mode on real projects. A project with 500 interfaces, each with 8 fields, is 4000 field classifications. If every field pays the checker's cost, cumulative latency becomes noticeable.

The question is not "checker or no checker" — the checker is loaded regardless, because tsconfig-based import resolution (ADR 005) requires a full `ts-morph` `Project`. The question is: **how many times do we pay the checker's cost, and on which fields?**

## Options Considered

**Option A — Always use the type checker**
Every field classification goes through `getType()`. Maximally correct, single code path. But pays checker cost on every field, including the 90%+ that are plain primitives or direct interface references — constructs the AST already answers unambiguously.

**Option B — Syntactic only, no checker**
Read only AST nodes, never invoke the checker. Fast, but cannot handle type aliases, utility types, generics, or any construct where the declared syntax doesn't directly describe the shape.

**Option C — Syntactic triage first, checker only when needed**
Classify each field syntactically upfront. The AST node itself tells you which category it falls in: "directly emittable" or "needs resolution." Only the second category pays checker cost.

## Decision

Option C — syntactic triage first, escalating to the type checker only for nodes that cannot be classified from syntax alone.

**The triage logic:**

| AST Node type | Syntactic answer | Checker needed? |
|---|---|---|
| `StringKeyword`, `NumberKeyword`, `BooleanKeyword` | `kind: "string/number/boolean"` | No |
| `TypeReference` to a known builtin (`Date`) | `kind: "date"` | No |
| `TypeReference` to a locally declared `interface` | `kind: "reference"` | No (just read the declared name) |
| `ArrayType` | `kind: "array"`, recurse on element | No |
| `TupleType` | `kind: "tuple"`, recurse on elements | No |
| `UnionType` (all `LiteralType` members) | `kind: "enum"` | No |
| `UnionType` (any non-literal member) | `kind: "union"`, recurse on members | No |
| `TypeReference` to a `type` alias, generic, or utility type | Escalate | **Yes** |
| `ConditionalType`, `MappedType`, `IndexedAccessType` | `kind: "unknown"` (deferred) | No (skip, don't compute) |

**Why this is not trial-and-error escalation:**
The triage classifies every node correctly on the first pass. It never attempts syntactic classification and falls back to the checker on failure — it identifies upfront which category a node belongs to and routes accordingly. For a realistic codebase (mostly plain interfaces, a handful of utility types), checker invocations represent roughly 5–10% of total field classifications.

**This is a reasoned model, not a measured one.** A benchmark against a representative real-world project should be run in the future to validate the assumption. If checker invocations prove cheap enough in practice that the triage adds more complexity than it saves latency, Option A should be reconsidered.

## Consequences

- The extractor has two classification paths — syntactic and checker-based. More code than Option A, but the paths are well-separated and the routing logic is a simple switch on AST node kind
- Performance scales with the proportion of "needs resolution" fields, not with total field count
- The benchmark checkpoint in future is a first-class deliverable — if the assumption doesn't hold, the architecture can be simplified to Option A without touching the IR or the runtime
- `ConditionalType` and `MappedType` nodes are explicitly routed to `kind: "unknown"` rather than escalated to the checker — full support for these is deferred (see ADR 008), but they never cause a crash
