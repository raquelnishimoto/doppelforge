# ADR 005 — tsconfig Resolution via ts-morph Project

## Status
Accepted

## Context

TypeScript projects use `import` statements to compose types across files. For the extractor to follow these imports — a requirement for resolving `Post.author: User` when `User` lives in a separate file — it needs to understand the project's module resolution.

Modern projects routinely use path aliases:

```typescript
import type { User } from "@/models/User";   // not a relative path
import type { User } from "~/types/User";
```

These aliases are defined in `tsconfig.json` under `compilerOptions.paths`. Without reading the tsconfig, the extractor cannot resolve them.

Three options exist for how the extractor discovers and uses module resolution configuration.

## Options Considered

**Option A — Single-file only, no import resolution**
The extractor only processes types declared in the file it is currently scanning. Cross-file references produce `kind: "unknown"`. Fast and simple, but breaks on essentially any real project — cross-file type relationships are the norm, not the exception.

**Option B — Relative imports only**
Resolve `./User` and `../models/User` using Node-style relative path resolution, but ignore `@/` and `~/` aliases. Handles the simplest case but misses any project using path aliases — which includes virtually every Vite, Next.js, or Create React App project with a custom tsconfig.

**Option C — Full resolution via ts-morph pointed at the real tsconfig.json**
Initialise a `ts-morph` `Project` with the target project's actual `tsconfig.json`. ts-morph uses the TypeScript compiler's real module resolution algorithm under the hood — it resolves relative imports, path aliases, and project references identically to `tsc`. No custom resolver to write or maintain.

## Decision

Option C — ts-morph `Project` pointed at the project's real `tsconfig.json`.

**Why Option C is not meaningfully more expensive than Option B:**
The cost delta between B and C is approximately one constructor argument:

```typescript
// Option B equivalent
const project = new Project();
project.addSourceFilesAtPaths("src/**/*.ts");

// Option C
const project = new Project({ tsConfigFilePath: "./tsconfig.json" });
```

ts-morph already loads a full TypeScript `Program` to support any kind of type analysis. Pointing it at a real tsconfig costs nothing extra at the library level — the `Program` was going to exist regardless, and with a tsconfig it simply resolves paths correctly instead of incorrectly.

**`import type` and `import` are treated identically:**
`import type { User } from "..."` is a compile-time-only annotation that strips the import from JS output. It does not create a different symbol or a different resolution path. The extractor treats both forms identically — the `type` modifier is irrelevant to type extraction.

**Configuration surface:**
The extractor needs to know where the `tsconfig.json` lives. This is part of the CLI's configuration (e.g. `doppelforge.config.ts`), not the IR. The default assumption is the project root. Monorepos with multiple `tsconfig.json` files will configure this explicitly per package.

## Consequences

- The extractor has a hard dependency on `ts-morph` (and transitively on `typescript`) — this dependency lives in `packages/cli`, never in `packages/ir` or `packages/runtime`
- Path aliases (`@/`, `~/`, custom mappings) are resolved correctly out of the box with no additional configuration
- The extractor correctly handles TypeScript project references if the tsconfig uses them
- `import type` and `import` produce identical extraction results — no special-casing required
- Monorepo setups with multiple tsconfig files require explicit `tsConfigFilePath` configuration per package being extracted
