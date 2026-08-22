# ADR 008 — Diagnostics as a First-Class Registry Field

## Status
Accepted

## Context

During extraction, the extractor encounters situations it cannot fully resolve: a `reference` pointing to a type outside the scanned files, a generic construct not yet supported, a field with no hint and no field-name inference match. Without a structured way to surface these signals, they are either silently swallowed (bad developer experience) or cause the CLI to crash (worse developer experience).

Additionally, the extractor already has richer information than it currently exposes: it knows which fields produced `kind: "unknown"`, which references are unresolvable, and which fields would benefit from an explicit `@mock` hint. This is structural insight about the codebase — valuable beyond mock generation.

## Options Considered

**Option A — CLI stderr output only**
Diagnostics are printed to stderr during extraction and not included in the registry. Simple, but the information is lost after the CLI run — the runtime cannot access it, tools consuming the registry cannot read it, and the developer must inspect CLI output rather than having diagnostics available programmatically.

**Option B — Separate `.mock-registry.diagnostics.json` file**
Diagnostics written to a sidecar file alongside the registry. Keeps the registry "clean" but creates two files to manage, two file paths to configure, and splits logically related information across two artifacts.

**Option C — `diagnostics` field on `MockRegistry`**
Diagnostics are a first-class field on the root registry envelope. Always present as an array (empty if extraction was clean). Never `null` or `undefined`.

## Decision

Option C — `diagnostics: Diagnostic[]` on `MockRegistry`.

**Why diagnostics belong in the registry:**

Diagnostics are a direct product of extraction — they describe the quality and completeness of the `types` map in the same registry. Separating them from what they describe creates an artificial split.

More practically: the runtime can surface diagnostics at generation time. `mock.create("User")` can warn if a field in `User` has `kind: "unknown"` with a `HINT_GAP` diagnostic — the developer gets feedback at the point of use, not just at extraction time.

**What the extractor surfaces vs what it judges:**

A deliberate scope boundary governs what becomes a diagnostic:

| Category | Included | Rationale |
|---|---|---|
| Unresolvable references | ✅ `UNRESOLVED_REFERENCE` (error) | Byproduct of extraction — the extractor attempted resolution and failed |
| Unsupported constructs | ✅ `UNSUPPORTED_CONSTRUCT` (warning) | The extractor knows it degraded to `unknown` |
| Hint gaps | ✅ `HINT_GAP` (info) | The extractor knows no strategy was found for a field |
| Ambiguous aliases | ✅ `AMBIGUOUS_ALIAS` (warning) | Byproduct of the addressing model |
| Skipped generic declarations | ✅ `GENERIC_SKIPPED` (warning) | The extractor explicitly skipped a type it cannot register |
| Type coherence (field named `email` typed as `number`) | ❌ Deferred to v0.2 | Requires semantic opinion beyond extraction — scope of a linter, not an extractor |

The boundary: **diagnostics that are a byproduct of extraction are in scope. Diagnostics that require correctness opinions beyond extraction are out of scope.**

**Diagnostic structure:**

```typescript
interface Diagnostic {
  severity: "error" | "warning" | "info";
  code: string;        // machine-readable, stable across versions
  message: string;     // human-readable, actionable
  location?: string;   // "src/models/user.ts:12:5"
  field?: string;      // qualified id of the affected field
}
```

`code` is stable — tooling can pattern-match on it without parsing `message`. `message` is human-readable and may change for clarity without being a breaking change.

**Severity semantics:**

- `error`: extraction failed for this field — it fell back to `kind: "unknown"`. The registry is incomplete.
- `warning`: extraction succeeded but with reduced fidelity. Generated data may be less realistic or less correct.
- `info`: informational only. No fidelity loss. The developer may want to act on it (e.g. add a `@mock` hint) but is not required to.

## Consequences

- `MockRegistry.diagnostics` is always an array — never `null`, never `undefined`. An empty array means extraction was clean.
- The CLI should print a summary of `error` and `warning` diagnostics to stderr after extraction, with a count and a pointer to the registry for full details
- The runtime may optionally surface `error`-severity diagnostics at `mock.create()` time — a field with `kind: "unknown"` due to `UNRESOLVED_REFERENCE` generates `null` and optionally warns
- `info`-severity diagnostics (`HINT_GAP`) are the foundation for a future `--suggest-hints` CLI flag that lists fields that would benefit from explicit `@mock` annotations
- Type coherence warnings (field name/type mismatches) are explicitly deferred to v0.2 as a named feature, not silently dropped
