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

// createMany
test('createMany() returns an empty array when count is 0', () => {
  const mock = createMocker(makeRegistry({}));
  const post = mock.createMany('Post', 0);

  expect(post.length).toEqual(0);
});

test('createMany() returns an array with 1 element when count is 1 and type is valid', () => {
  const mock = createMocker(makeRegistry({}));
  const post = mock.createMany('Post', 1);

  expect(post.length).toEqual(1);
});

test('createMany() returns an array with 1 element with override when count is 1 and type has override', () => {
  const mock = createMocker(makeRegistry({}));
  const post = mock.createMany('Post', 1, { title: 'Overridden Title' });

  expect(post.length).toEqual(1);

  expect(post[0]).toMatchObject({ title: 'Overridden Title' });
});

test('createMany() throws when count is 1 and type is not found', () => {
  const mock = createMocker(makeRegistry({}));

  expect(() => mock.createMany('Product', 1)).toThrow('Type "Product" not found in registry. Available types: Post, GhostType');
});

test('createMany() returns an array with 2 elements when count is 2 and type is valid', () => {
  const mock = createMocker(makeRegistry({}));
  const post = mock.createMany('Post', 2);

  expect(post.length).toEqual(2);
});
