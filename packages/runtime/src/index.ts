import { MockRegistry } from '@doppelforge/ir';
import { faker } from '@faker-js/faker';
import { resolveType } from './resolve';
import { generateField } from './generate';

export function createMocker(registry: MockRegistry) {
  const create = (typeName: string, override?: Partial<Record<string, unknown>>) => {
    const irType = resolveType(typeName, registry);

    const result = Object.fromEntries(Object.entries(irType.fields).map(([fieldName, irField]) => {
      return [fieldName, generateField(irField, faker)];
    }));

    return { ...result, ...(override ?? {}) }
  };

  const createMany = (typeName: string, count: number, override?: Partial<Record<string, unknown>>) => {
    // Implementation for creating multiple mock instances based on the registry
    const instances: Record<string, unknown>[] = [];
    for (let i = 0; i < count; i++) {
      instances.push(create(typeName, override));
    }
    return instances;
  };

  const seed = (value: number) => {
    // Implementation for seeding the mock registry
    faker.seed(value);

    return mocker; // Return the mocker instance for chaining
  };

  const mocker = { create, createMany, seed };
  return mocker;
}
