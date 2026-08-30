import { MockRegistry } from "@doppelforge/ir";

const registry: MockRegistry = {
    schemaVersion: "1.0.0",
    diagnostics: [],
    types: {
        "src/models/user.ts#User": {name: "User", fields: {
            "id": { kind: 'string'},
            "name": { kind: 'string'}
        }},
        "src/models/post.ts#Post": {name: "Post", fields: {
            "id": { kind: 'string'},
            "title": { kind: 'string'},
            "author": { kind: 'reference', ref: "src/models/user.ts#User"}
        }},
        "src/models/user.ts#Review": {name: "Review", fields: {
            "id": { kind: 'string'},
            "content": { kind: 'string'},
            "reviewer": { kind: 'reference', ref: "src/models/user.ts#User"}
        }},
        "src/response.ts#Review": {name: "Review", fields: {
            "id": { kind: 'string'},
            "content": { kind: 'string'},
            "reviewer": { kind: 'reference', ref: "src/models/user.ts#User"}
        }}
    },
    aliases: {
        "Post": "src/models/post.ts#Post",
        "GhostType": "src/models/dele.ts#GhostType",
    }
};

export function makeRegistry(overrides: Partial<MockRegistry>): MockRegistry {
    const { schemaVersion, diagnostics, types, aliases } = registry;
    return {
        schemaVersion, // not overrideable — always use base version
        diagnostics: [...diagnostics, ...(overrides.diagnostics ?? [])],
        types: { ...types, ...overrides.types },
        aliases: { ...aliases, ...overrides.aliases }
    }
}