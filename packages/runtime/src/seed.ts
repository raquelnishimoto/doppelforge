import { faker } from '@faker-js/faker';

/**
 * Seed the random number generator for deterministic output.
 * Call before create() or createMany() at the start of each test.
 * 
 * @example
 * mock.seed(123).create('User') // always produces the same User
 */
export function seed(seed: number): void {
  faker.seed(seed);
}