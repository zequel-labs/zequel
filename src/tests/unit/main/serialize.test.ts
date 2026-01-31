import { describe, it, expect } from 'vitest';
import { toPlainObject } from '../../../main/utils/serialize';

describe('toPlainObject', () => {
  it('should return a plain copy of a simple object', () => {
    const input = { a: 1, b: 'hello', c: true };
    const result = toPlainObject(input);

    expect(result).toEqual(input);
    expect(result).not.toBe(input);
  });

  it('should handle nested objects', () => {
    const input = { a: { b: { c: 42 } } };
    const result = toPlainObject(input);

    expect(result).toEqual({ a: { b: { c: 42 } } });
    expect(result.a).not.toBe(input.a);
    expect(result.a.b).not.toBe(input.a.b);
  });

  it('should handle arrays', () => {
    const input = [1, 2, 3];
    const result = toPlainObject(input);

    expect(result).toEqual([1, 2, 3]);
    expect(result).not.toBe(input);
  });

  it('should handle arrays of objects', () => {
    const input = [{ id: 1 }, { id: 2 }];
    const result = toPlainObject(input);

    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(result[0]).not.toBe(input[0]);
  });

  it('should convert Date objects to ISO strings', () => {
    const date = new Date('2025-01-15T10:30:00.000Z');
    const input = { created: date };
    const result = toPlainObject(input);

    expect(result.created).toBe('2025-01-15T10:30:00.000Z');
    expect(typeof result.created).toBe('string');
  });

  it('should handle null values', () => {
    const input = { a: null };
    const result = toPlainObject(input);

    expect(result).toEqual({ a: null });
  });

  it('should handle top-level null', () => {
    const result = toPlainObject(null);

    expect(result).toBeNull();
  });

  it('should strip undefined values from objects', () => {
    const input = { a: 1, b: undefined, c: 'hello' };
    const result = toPlainObject(input);

    expect(result).toEqual({ a: 1, c: 'hello' });
    expect('b' in result).toBe(false);
  });

  it('should convert undefined array elements to null', () => {
    const input = [1, undefined, 3];
    const result = toPlainObject(input);

    expect(result).toEqual([1, null, 3]);
  });

  it('should strip methods from class instances', () => {
    class MyModel {
      name: string;
      constructor(name: string) {
        this.name = name;
      }
      greet(): string {
        return `Hello, ${this.name}`;
      }
    }

    const instance = new MyModel('test');
    const result = toPlainObject(instance);

    expect(result).toEqual({ name: 'test' });
    expect((result as Record<string, unknown>).greet).toBeUndefined();
  });

  it('should throw on circular references', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;

    expect(() => toPlainObject(obj)).toThrow();
  });

  it('should handle empty objects', () => {
    const result = toPlainObject({});

    expect(result).toEqual({});
  });

  it('should handle empty arrays', () => {
    const result = toPlainObject([]);

    expect(result).toEqual([]);
  });

  it('should handle primitive values', () => {
    expect(toPlainObject(42)).toBe(42);
    expect(toPlainObject('hello')).toBe('hello');
    expect(toPlainObject(true)).toBe(true);
  });

  it('should handle deeply nested mixed structures', () => {
    const input = {
      users: [
        { name: 'Alice', tags: ['admin', 'user'] },
        { name: 'Bob', tags: ['user'] },
      ],
      meta: { count: 2 },
    };
    const result = toPlainObject(input);

    expect(result).toEqual(input);
    expect(result.users[0].tags).not.toBe(input.users[0].tags);
  });

  it('should strip symbol-keyed properties', () => {
    const sym = Symbol('key');
    const input = { a: 1, [sym]: 'hidden' } as Record<string | symbol, unknown>;
    const result = toPlainObject(input);

    expect(result).toEqual({ a: 1 });
  });
});
