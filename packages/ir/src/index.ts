// @doppelforge/ir — Mock Intermediate Representation
// Version: 1.0.0
//
// This is the contract between the CLI (producer) and the runtime (consumer).
// Neither package owns these types — both depend on this package.
//
// DEPENDENCY RULE: this file must never import from typescript, ts-morph,
// @faker-js/faker, or any other runtime dependency. Types only.

// ---------------------------------------------------------------------------
// Hint
// ---------------------------------------------------------------------------

/**
 * A structured instruction to the runtime about how to generate a value.
 * `strategy` is a dot-separated path into the generation engine's API.
 * e.g. { strategy: "internet.email" } or { strategy: "number", args: { min: 10, max: 150 } }
 */
export interface Hint {
  strategy: string;
  args?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// FieldMeta
// ---------------------------------------------------------------------------

/**
 * Metadata orthogonal to a field's shape. Carried by every IRField variant.
 *
 * `optional` and `nullable` are distinct:
 *   optional — the key may be absent from the object entirely
 *   nullable — the key is present but its value may be null
 *
 * A field may be both (e.g. deletedAt?: string | null).
 */
export interface FieldMeta {
  optional?: boolean;
  nullable?: boolean;
  hint?: Hint;
}

// ---------------------------------------------------------------------------
// IRField
// ---------------------------------------------------------------------------

/** A primitive scalar — string, number, boolean, or date. */
export type PrimitiveField = {
  kind: "string" | "number" | "boolean" | "date";
} & FieldMeta;

/**
 * A fixed, enumerable set of literal values.
 * Used for both TypeScript enum declarations and unions where every
 * member is a literal value (e.g. "admin" | "user").
 */
export type EnumField = {
  kind: "enum";
  values: (string | number)[];
} & FieldMeta;

/**
 * A variable-length homogeneous sequence.
 * All elements share one type described by `items`.
 * `items` is itself a full IRField — may be any kind.
 */
export type ArrayField = {
  kind: "array";
  items: IRField;
} & FieldMeta;

/**
 * A fixed-length positional sequence.
 * Each position has its own type described by `elements[i]`.
 * The runtime generates exactly `elements.length` values in order.
 */
export type TupleField = {
  kind: "tuple";
  elements: IRField[];
} & FieldMeta;

/**
 * A union where at least one member is an open type (not a literal value).
 * The runtime picks one option at random and generates from it.
 * Options may themselves be any IRField kind, including nested enums.
 */
export type UnionField = {
  kind: "union";
  options: IRField[];
} & FieldMeta;

/**
 * Points to another named type in the registry by its qualified identifier.
 * e.g. { kind: "reference", ref: "src/models/user.ts#User" }
 *
 * Cycles are valid — User.posts → Post, Post.author → User.
 * The runtime is responsible for depth-limiting recursive resolution.
 */
export type ReferenceField = {
  kind: "reference";
  ref: string;
} & FieldMeta;

/**
 * The universal escape hatch.
 * Used when the extractor cannot classify a field — generics not yet
 * supported, conditional types, mapped types, or unresolvable constructs.
 *
 * `raw` contains the original TypeScript type string for debugging.
 * The runtime generates null for unknown fields. It does not error.
 */
export type UnknownField = {
  kind: "unknown";
  raw?: string;
} & FieldMeta;

/**
 * A discriminated union on `kind` representing any field in the IR.
 * Every variant carries FieldMeta (optional, nullable, hint).
 */
export type IRField =
  | PrimitiveField
  | EnumField
  | ArrayField
  | TupleField
  | UnionField
  | ReferenceField
  | UnknownField;

// ---------------------------------------------------------------------------
// IRType
// ---------------------------------------------------------------------------

/**
 * A named, registrable type — the result of extracting one interface,
 * type alias, or resolved generic instantiation.
 *
 * `typeParameters` is reserved for generic type declarations.
 * It is metadata only — not consumed by the runtime in v1.
 * It exists to avoid a breaking change when generic support is added.
 */
export interface IRType {
  name: string;
  fields: Record<string, IRField>;
  typeParameters?: { name: string; constraint?: string }[];
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

export type DiagnosticSeverity = "error" | "warning" | "info";

/**
 * Standard diagnostic codes emitted by the extractor.
 * Codes are stable across versions — tooling may pattern-match on them.
 * Messages are human-readable and may change for clarity without being
 * considered a breaking change.
 */
export type DiagnosticCode =
  | "UNRESOLVED_REFERENCE"   // a reference.ref target was not found in the registry
  | "UNSUPPORTED_CONSTRUCT"  // a TypeScript construct is not yet supported
  | "HINT_GAP"               // no hint and no field-name inference match
  | "AMBIGUOUS_ALIAS"        // a short name maps to more than one qualified id
  | "GENERIC_SKIPPED";       // a generic declaration was skipped — only instantiations are registered

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: DiagnosticCode;
  message: string;
  location?: string;   // e.g. "src/models/user.ts:12:5"
  field?: string;      // qualified id of the affected field, if applicable
}

// ---------------------------------------------------------------------------
// MockRegistry
// ---------------------------------------------------------------------------

/**
 * The root envelope — the .mock-registry.json file on disk.
 *
 * `types`   — keyed by qualified identifier: "src/models/user.ts#User"
 * `aliases` — short name → qualified id, only where unambiguous
 * `diagnostics` — always an array, never null. Empty means clean extraction.
 */
export interface MockRegistry {
  schemaVersion: string;
  types: Record<string, IRType>;
  aliases: Record<string, string>;
  diagnostics: Diagnostic[];
}
