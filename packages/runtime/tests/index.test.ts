import { expect, test } from "vitest";
import { makeRegistry } from "./utils/makeRegistry";
import { createMocker } from "../src";

test('create() returns a stable user with seed', () => {
  const mock = createMocker(makeRegistry({}));
  const user = mock.seed(1).create('User');

  expect(user).toMatchSnapshot();
});

test('create() applies override after generation', () => {
  const mock = createMocker(makeRegistry({}));
  const override = { name: 'Mayumi' };
  const user = mock.create('User', override);

  expect(user.name).toMatchSnapshot();
});

test('create() throws for unknown type', () => {
  const mock = createMocker(makeRegistry({}));

  expect(() => mock.create('Product')).toThrow('Type "Product" not found');
});
