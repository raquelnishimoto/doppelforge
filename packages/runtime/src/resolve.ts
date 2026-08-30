import { IRType, MockRegistry } from "@doppelforge/ir";

const Errors = {
    ghostAlias: (typeName: string, aliasTarget: string) => `Alias "${typeName}" points to a non-existent type: "${aliasTarget}". ` +
        `This usually means "${aliasTarget.split('#')[0]}" is outside your configured include globs.`,
    ambiguous: (typeName: string, qualifiedIds: string[]) => `Type "${typeName}" is ambiguous. Use a qualified id instead:\n` +
        qualifiedIds.map(id => `  "${id}"`).join('\n'),
    notFound: (typeName: string, available: string[]) => `Type "${typeName}" not found in registry. ` +
        `Available types: ${available.join(', ')}`,
};

export function resolveType(typeName: string, registry: MockRegistry): IRType {
    // 1. Direct qualified id lookup
    const type = registry.types[typeName];
    if (type) {
        return type;
    }

    // 2. Alias lookup
    const aliasTarget = registry.aliases[typeName];
    if (aliasTarget) {
        const resolvedType = registry.types[aliasTarget];
        if (resolvedType) {
            return resolvedType;
        }
        throw new Error(
            Errors.ghostAlias(typeName, aliasTarget)
        );
    }

    // 3. Check for ambiguous short name
    const qualifiedIds = Object.keys(registry.types)
        .filter(id => id.split('#')[1] === typeName);

    if (qualifiedIds.length > 0) {
        throw new Error(Errors.ambiguous(typeName, qualifiedIds));
    }

    // 4. Nothing found
    throw new Error(
        Errors.notFound(typeName, Object.keys(registry.aliases))
    );
}