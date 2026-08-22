# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for doppelforge.

Each ADR captures the context, options considered, decision made, and consequences for one significant architectural choice. They are written at decision time — not after implementation — to preserve the reasoning chain that produces lived in the design, which is the hardest thing to reconstruct later.

ADRs are numbered sequentially and never deleted. Superseded decisions get a `Superseded by ADR-XXX` status rather than being removed.

## Index

| # | Title | Status |
|---|---|---|
| [001](./001-ir-kind-taxonomy.md) | IR Field Kind Taxonomy | Accepted |
| [002](./002-reference-by-name.md) | Reference by Name Over Structural Inlining | Accepted |
| [003](./003-qualified-ids-and-aliases.md) | Qualified Identifiers and Short-Name Aliases | Accepted |
| [004](./004-syntactic-triage-first.md) | Syntactic Triage First, Type Checker on Escalation | Accepted |
| [005](./005-tsconfig-resolution.md) | tsconfig Resolution via ts-morph Project | Accepted |
| [006](./006-generics-monomorphization.md) | Generics via Monomorphization at Use Sites | Accepted |
| [007](./007-shared-ir-package.md) | Shared `packages/ir` with Zero Compiler Dependencies | Accepted |
| [008](./008-diagnostics-as-registry-field.md) | Diagnostics as a First-Class Registry Field | Accepted |

## Format

Each ADR follows the [MADR](https://adr.github.io/madr/) (Markdown Architectural Decision Records) format:

- **Status** — `Proposed | Accepted | Deprecated | Superseded by ADR-XXX`
- **Context** — the problem and why a decision was needed
- **Options Considered** — what was on the table, including rejected options
- **Decision** — what was chosen and why
- **Consequences** — what becomes easier or harder as a result

## Adding a New ADR

1. Copy the structure from an existing ADR
2. Number it sequentially (`009-...`)
3. Add it to the index above
4. Status starts as `Proposed` until accepted by the team
