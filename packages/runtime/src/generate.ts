import { Hint, IRField } from "@doppelforge/ir";
import { Faker } from "@faker-js/faker";

type GenerateValue = string | number | boolean | Date | null;

const Errors = {
    invalidStrategy: (strategy: string) => `Invalid faker strategy: "${strategy}".`,
};

export function generateField(field: IRField, faker: Faker): GenerateValue {
    const { kind, hint } = field;
    const invokeFaker = (hint: Hint): GenerateValue | undefined => {
        const { strategy, args } = hint;
        const SEPARATOR = ".";
        const strategyParts = strategy.split(SEPARATOR);
        const fakerFunction = strategyParts.reduce(
            (obj, prop) => {
                if (obj === undefined) return undefined;
                return (obj as Record<string, unknown>)[prop];
            },
            faker as unknown
        );

        if (typeof fakerFunction === "function") {
            return args ? fakerFunction(args) : fakerFunction();
        }

        return undefined;
    };

    switch (kind) {
        case "string":
            if (hint) {
                const result = invokeFaker(hint);
                if (result === undefined) {
                    throw new Error(Errors.invalidStrategy(hint.strategy));
                };
                return result;
            }
            return faker.string.sample();
        case "number":
            if (hint) {
                const result = invokeFaker(hint);
                if (result === undefined) {
                    throw new Error(Errors.invalidStrategy(hint.strategy));
                }
                return result;
            }
            return faker.number.int();
        case "boolean":
            return faker.datatype.boolean();
        case "date":
            return faker.date.anytime();
        default:
            return null; // For enum and other unsupported field types, return null for now
    }
}
