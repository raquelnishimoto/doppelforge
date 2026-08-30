import { makeRegistry } from "./utils/makeRegistry";
import { resolveType } from "../src/resolve";
import {test, expect} from "vitest";

const registry = makeRegistry({});

const happyPathScenarios = [
    {
        description: "valid qualified id",
        input: "src/models/user.ts#User",
        expectedName: "User"
    },
    {
        description: "valid alias",
        input: "Post",
        expectedName: "Post"
    }
];

happyPathScenarios.forEach(({ description, input, expectedName }) => {
    test(`resolveType() returns the correct type for ${description}`, () => {
        const type = resolveType(input, registry);
        expect(type.name).toBe(expectedName);
    });
});

const errorScenarios = [
    {
        description: "non-existent qualified id",
        input: "src/models/nonexistent.ts#NonExistent",
        expectedError: 'Type "src/models/nonexistent.ts#NonExistent" not found in registry.'
    },
    {
        description: "non-existent alias",
        input: "GhostType",
        expectedError: 'Alias "GhostType" points to a non-existent type: "src/models/dele.ts#GhostType". This usually means "src/models/dele.ts" is outside your configured include globs.'
    },
    {
        description: "ambiguous short name",
        input: "Review",
        expectedError: 'Type "Review" is ambiguous. Use a qualified id instead:\n  "src/models/user.ts#Review"\n  "src/response.ts#Review"'
    }
];

errorScenarios.forEach(({ description, input, expectedError }) => {
    test(`resolveType() throws an error for ${description}`, () => {
        expect(() => resolveType(input, registry)).toThrowError(expectedError);
    });
});
