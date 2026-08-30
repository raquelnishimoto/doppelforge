import { makeRegistry } from "./utils/makeRegistry";
import { resolveType } from "../src/resolve";
import {test, expect} from "vitest";

test("resolveType() returns the correct type for a valid qualified id", () => {
    const registry = makeRegistry({});
    const type = resolveType("src/models/user.ts#User", registry);
    expect(type.name).toBe("User");
});

