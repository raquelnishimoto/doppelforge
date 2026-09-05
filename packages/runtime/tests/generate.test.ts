import { test, expect } from "vitest";
import { generateField } from "../src/generate";
import { faker } from "@faker-js/faker";


// string
test('generate string with hint and arguments', () => {
    const MAX_LENGTH = 6;
    const field = generateField({ 'kind': 'string', 'hint': { 'strategy': 'string.alpha', 'args': { length: 6 } } }, faker);

    expect(typeof field).toBe('string');
    expect(field?.toString().length).toBe(MAX_LENGTH);
});

test('generate string with hint and no arguments', () => {
    const field = generateField({ 'kind': 'string', 'hint': { 'strategy': 'internet.email' } }, faker);

    expect(typeof field).toBe('string');
    expect(field).toMatch(/@/);
});

test('generate string with invalid hint', () => {
    expect(() => {
        generateField({ 'kind': 'string', 'hint': { 'strategy': 'invalid.strategy' } }, faker);
    }).toThrowError('Invalid faker strategy: "invalid.strategy".');
});

test('generate string without hint', () => {
    const field = generateField({ 'kind': 'string' }, faker);

    expect(typeof field).toBe('string');
});

// number
test('generate number without', () => {
    const field = generateField({ 'kind': 'number' }, faker);

    expect(typeof field).toBe('number');
});

test('generate number with hint', () => {
    const MIN = 0;
    const MAX = 5;
    const field = generateField({ 'kind': 'number', 'hint': { 'strategy': 'number.int', 'args': { min: MIN, max: MAX } } }, faker);

    expect(typeof field).toBe('number');
    expect(field).toBeGreaterThanOrEqual(MIN);
    expect(field).toBeLessThanOrEqual(MAX);
});

test('generate number with hint and no arguments', () => {
    const field = generateField({ 'kind': 'number', 'hint': { 'strategy': 'number.float' } }, faker);

    expect(typeof field).toBe('number');
});

test('generate number with invalid hint', () => {
    expect(() => {
        generateField({ 'kind': 'number', 'hint': { 'strategy': 'invalid.strategy' } }, faker);
    }).toThrowError('Invalid faker strategy: "invalid.strategy".');
});

// boolean
test('generate boolean', () => {
    const field = generateField({ kind: 'boolean' }, faker);
    expect(typeof field).toBe('boolean');
});

// date
test('generate date', () => {
    const field = generateField({ kind: 'date' }, faker);
    expect(field).toBeInstanceOf(Date);
});

// unknown
test('generate unknown returns null', () => {
    const field = generateField({ kind: 'unknown' }, faker);
    expect(field).toBeNull();
});