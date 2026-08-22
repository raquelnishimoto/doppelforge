# ADR 001 — IR Field Kind Taxonomy

## Status
Accepted

## Context

The IR needs a `kind` discriminator on every field so the runtime knows how to generate a value. The core question was: how many kinds, and where do we draw the lines between them?

The taxonomy had to satisfy three constraints simultaneously:

1. **Complete enough** to represent every TypeScript construct in MVP scope without losing fidelity
2. **Minimal enough** that the runtime stays simple — every new kind is a new code path in `mock.create()`
3. **Extensible enough** that future kinds (e.g. supporting more advanced constructs) can be added without breaking existing registries

The main tension was between completeness and minimalism. More kinds = more fidelity but more runtime complexity. Fewer kinds = simpler runtime but information loss.

## Options Considered

**Option A — Flat primitive kinds only**
Only `string | number | boolean | date`, treat everything else as `unknown`. Maximally simple runtime, but unusable on any real project that has arrays, nested types, or enums.

**Option B — Structural kinds without `unknown`**
Add `array`, `tuple`, `union`, `enum`, `reference` but crash on anything unrecognised. Maximally correct on supported constructs, catastrophically fragile on unsupported ones.

**Option C — Seven kinds including `unknown` as first-class member**
`string | number | boolean | date | enum | array | tuple | union | reference | unknown`. `unknown` is not a fallback of last resort added later — it is designed in from day one as a deliberate, graceful degradation path.

## Decision

Option C — seven distinct kinds, with `unknown` as a first-class member of the discriminated union.

**Why each kind earned its place:**

| Kind | Justification |
|---|---|
| `string`, `number`, `boolean`, `date` | Irreducible primitives — every other kind is built from these |
| `enum` | A fixed, enumerable set of literals requires neither type generation nor recursion — collapsing it into `union` would add unnecessary branching to the runtime for a conceptually distinct case |
| `array` | Homogeneous variable-length sequences are ubiquitous and can't be represented by `tuple` (fixed length, positional) |
| `tuple` | Fixed-length positional sequences cannot be faithfully represented as `array` — `array.items` describes one type for all positions; a tuple needs a type per position |
| `union` | Open-type unions (where at least one member is not a literal) require the runtime to pick a generation strategy, not a value — structurally different from `enum` |
| `reference` | Cross-type relationships must point by name, not inline, to handle cycles and avoid duplication |
| `unknown` | Any construct the extractor cannot classify must degrade gracefully — a partially correct registry with some `unknown` fields is more useful than a crashing extractor |

**The `array` / `tuple` distinction was explicitly debated.** The deciding factor: `tuple.elements` is positional and fixed — the runtime generates exactly `elements.length` values, each from its own field. `array.items` generates a variable number of homogeneous values. They are different instructions to the runtime, not variations of the same instruction.

**The `enum` / `union` boundary rule:** a union is `kind: "enum"` only if every member is a literal value. The moment any member is an open type, the whole union becomes `kind: "union"`. Literal-only sub-groups within a `union` may appear as nested `enum` options.

## Consequences

- The runtime has seven code paths in its generation switch — manageable, each clearly distinct
- `unknown` means the extractor never crashes — it degrades gracefully with a diagnostic
- Future kinds (e.g. `bigint`, `symbol`) can be added as new members of the `IRField` discriminated union without changing the meaning of existing kinds
- Consumer code using exhaustive switch statements will get a TypeScript error when a new kind is added — this is intentional and desirable (it forces consumers to handle new cases explicitly)
- `tuple` and `array` being separate means the extractor must correctly classify `TupleTypeNode` vs `ArrayTypeNode` at parse time — a cheap syntactic distinction, not a checker-level one
