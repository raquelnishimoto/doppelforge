# ADR 007 — Shared `packages/ir` with Zero Compiler Dependencies

## Status
Accepted

## Context

The IR type definitions (`IRField`, `IRType`, `MockRegistry`, `Diagnostic`) must be understood by two separate packages: the CLI (which writes the registry) and the runtime (which reads it). If these packages have independent copies of the type definitions, they can silently drift — the CLI emits a field the runtime doesn't know about, or vice versa, with no compile-time signal.

Three ownership models exist.

## Options Considered

**Option A — Shared `packages/ir` (types-only package)**
A third package containing only type definitions, zero runtime dependencies. Both CLI and runtime list it as a dependency. TypeScript enforces structural compatibility at compile time across both packages simultaneously.

**Option B — CLI owns the types, runtime re-declares its own**
The CLI is the authoritative producer. The runtime declares a parallel `RegistryReader` interface and stays in sync by convention. `schemaVersion` checking at runtime is the drift guard.

**Option C — Runtime owns the types, CLI imports from runtime**
The runtime is the authoritative consumer. The CLI imports from `@doppelforge/runtime` to know what shape to emit.

## Decision

Option A — a dedicated `packages/ir` with zero runtime dependencies.

**Why B and C fail:**

Option C creates a directional dependency that makes no conceptual sense: the Node-only TypeScript-aware CLI depending on the universal browser-compatible runtime. This risks pulling TypeScript compiler types into the runtime's dependency tree — the precise boundary violation the architecture is designed to prevent.

Option B avoids that, but "sync by convention" is an invisible contract. Six months into development, someone adds a `diagnostics` field to the CLI's `MockRegistry` and forgets to add it to the runtime's parallel declaration. The registry emits the field; the runtime silently ignores it; mocks degrade with no error. The failure mode is silent and distant from the cause.

**Why Option A's extra maintenance cost is worth it:**

The "extra maintenance" is concrete and bounded:

1. **Setup (one-time):** one additional `package.json` and `tsconfig.json`. The tsconfig for a types-only package is minimal — `"declaration": true, "emitDeclarationOnly": true`. No bundler, no browser target.
2. **Workspace wiring (one-time):** both CLI and runtime declare `"@doppelforge/ir": "workspace:*"` in their dependencies. The `workspace:*` protocol always uses the local version — no publish step needed during development.
3. **Change coordination (recurring, but structured):** when the IR evolves, TypeScript immediately errors at every affected callsite in both packages simultaneously, before any test runs. The maintenance cost is explicit compile errors, not silent runtime bugs.

**The zero-dependency rule:**

`packages/ir/package.json` must never list `typescript`, `ts-morph`, `@faker-js/faker`, or any other runtime dependency. If this package ever acquires a runtime dependency, it means either CLI-specific logic or runtime-specific logic has leaked into the neutral middle layer — a boundary violation.

This is enforced structurally: a `package.json` with no `dependencies` is machine-checkable. It can be added as a CI lint rule.

**Multi-language scalability:**

The zero-dependency rule on `packages/ir` enforces language-agnosticism by construction. `IRField` contains no TypeScript-specific types (`ts.Type`, `TypeNode`, etc.). A future analyzer for a different input language (e.g. JSON Schema, GraphQL SDL) can write to the same IR package without modification — the IR's vocabulary (`kind: "string"`, `kind: "reference"`) is not TypeScript vocabulary.

## Consequences

- Three packages instead of two: `ir`, `cli`, `runtime`
- `packages/ir` is publishable as `@doppelforge/ir` — third-party consumers building custom generators or analyzers can import the type definitions directly
- CI should include a check that `packages/ir/package.json` has no `dependencies` field (or only `devDependencies`)
- `schemaVersion` checking remains valuable even with shared types — package versions can drift in deployed environments where the CLI and runtime are installed separately
- The `ir` package should rarely need major version bumps — the IR is designed to evolve additively (see versioning policy in IR spec)
